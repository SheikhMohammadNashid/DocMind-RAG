from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os
import tempfile
import shutil
import uuid
import json
from typing import Optional, Generator

# PDF processing
import fitz  # PyMuPDF

# Embeddings & Vector DB
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

# LLM via Ollama
import requests

app = FastAPI(title="DocMind API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- In-memory store per session ---
sessions: dict = {}

# Load embedding model once at startup
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")  # Smallest/fastest model, works on weak CPUs
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
TOP_K = 5


# ── Helpers ──────────────────────────────────────────────────────────────────

def extract_text_from_pdf(path: str) -> str:
    doc = fitz.open(path)
    return "\n".join(page.get_text() for page in doc)


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i: i + size])
        chunks.append(chunk)
        i += size - overlap
    return chunks


def build_faiss_index(chunks: list[str]):
    embeddings = embedding_model.encode(chunks, show_progress_bar=False)
    embeddings = np.array(embeddings).astype("float32")
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    return index, embeddings


def retrieve_chunks(query: str, index, chunks: list[str], k: int = TOP_K) -> list[str]:
    q_emb = embedding_model.encode([query]).astype("float32")
    distances, indices = index.search(q_emb, k)
    return [chunks[i] for i in indices[0] if i < len(chunks)]


def query_ollama(prompt: str) -> str:
    """Non-streaming version (kept for internal use)."""
    payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
    try:
        resp = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=600)
        resp.raise_for_status()
        return resp.json().get("response", "No response from model.")
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Cannot reach Ollama. Make sure it is running.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def stream_ollama(prompt: str) -> Generator[str, None, None]:
    """Stream tokens from Ollama as Server-Sent Events."""
    payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": True}
    try:
        with requests.post(f"{OLLAMA_URL}/api/generate", json=payload, stream=True, timeout=600) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if line:
                    chunk = json.loads(line)
                    token = chunk.get("response", "")
                    if token:
                        yield f"data: {json.dumps({'token': token})}\n\n"
                    if chunk.get("done"):
                        yield f"data: {json.dumps({'done': True})}\n\n"
                        return
    except requests.exceptions.ConnectionError:
        yield f"data: {json.dumps({'error': 'Cannot reach Ollama. Make sure it is running.'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


# ── Models ───────────────────────────────────────────────────────────────────

class QuestionRequest(BaseModel):
    session_id: str
    question: str


class QuestionResponse(BaseModel):
    answer: str
    context_chunks: list[str]
    session_id: str


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    num_chunks: int
    message: str


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "DocMind API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    session_id = str(uuid.uuid4())

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        text = extract_text_from_pdf(tmp_path)
    finally:
        os.unlink(tmp_path)

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from PDF.")

    chunks = chunk_text(text)
    index, _ = build_faiss_index(chunks)

    sessions[session_id] = {
        "filename": file.filename,
        "chunks": chunks,
        "index": index,
    }

    return UploadResponse(
        session_id=session_id,
        filename=file.filename,
        num_chunks=len(chunks),
        message=f"PDF processed into {len(chunks)} chunks. Ready for questions!",
    )


@app.post("/ask", response_model=QuestionResponse)
def ask_question(req: QuestionRequest):
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a PDF first.")

    relevant_chunks = retrieve_chunks(req.question, session["index"], session["chunks"])
    context = "\n\n---\n\n".join(relevant_chunks)
    prompt = (
        "You are DocMind, a document assistant. Your ONLY job is to answer using the context below.\n\n"
        "STRICT RULES:\n"
        "1. Use ONLY information from the context. Do NOT use your own knowledge.\n"
        "2. Copy names, places, and spellings EXACTLY as they appear in the context. Do NOT alter them.\n"
        "3. If the answer is not in the context, say: 'This information is not in the document.'\n"
        "4. Do NOT guess, assume, or add anything not present in the context.\n"
        "5. Keep your answer short and factual.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {req.question}\n\nAnswer:"
    )
    answer = query_ollama(prompt)
    return QuestionResponse(answer=answer, context_chunks=relevant_chunks, session_id=req.session_id)


@app.post("/ask/stream")
def ask_question_stream(req: QuestionRequest):
    """Streaming endpoint — returns tokens as Server-Sent Events."""
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a PDF first.")

    relevant_chunks = retrieve_chunks(req.question, session["index"], session["chunks"])
    context = "\n\n---\n\n".join(relevant_chunks)
    prompt = (
        "You are DocMind, a document assistant. Your ONLY job is to answer using the context below.\n\n"
        "STRICT RULES:\n"
        "1. Use ONLY information from the context. Do NOT use your own knowledge.\n"
        "2. Copy names, places, and spellings EXACTLY as they appear in the context. Do NOT alter them.\n"
        "3. If the answer is not in the context, say: 'This information is not in the document.'\n"
        "4. Do NOT guess, assume, or add anything not present in the context.\n"
        "5. Keep your answer short and factual.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {req.question}\n\nAnswer:"
    )

    # Send context chunks as first SSE event so the frontend can show them
    def event_stream():
        yield f"data: {json.dumps({'chunks': relevant_chunks})}\n\n"
        yield from stream_ollama(prompt)

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
        return {"message": "Session deleted."}
    raise HTTPException(status_code=404, detail="Session not found.")
