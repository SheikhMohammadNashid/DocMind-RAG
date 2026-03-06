#DocMind — RAG Document Assistant

> Upload any PDF and ask questions about it in plain English. DocMind finds the relevant parts of your document and uses a local AI model to generate an answer — no internet required, no data leaves your machine.

![DocMind](https://img.shields.io/badge/DocMind-RAG%20Assistant-6366f1?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)

---

#Table of Contents

- [What is DocMind?](#what-is-docmind)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Quick Start with Docker](#quick-start-with-docker)
- [Manual Setup (without Docker)](#manual-setup-without-docker)
- [Choosing a Model](#choosing-a-model)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Limitations](#limitations)
- [Author](#author)

---

#What is DocMind?

DocMind is a **Retrieval-Augmented Generation (RAG)** system. It lets you upload a PDF document and ask questions about its contents using natural language. Instead of reading through the whole document yourself, DocMind reads it for you and finds precise answers.

Everything runs **locally on your machine**. No cloud API keys needed. No data sent to external servers.

---

## How It Works

Understanding how DocMind works helps you understand both its strengths and its limitations.

#Step 1 — PDF Upload & Text Extraction

When you upload a PDF, DocMind uses **PyMuPDF** to extract all the raw text from every page. This works well for text-based PDFs (documents, reports, CVs) but has limitations with scanned or image-based PDFs (see [Limitations](#limitations)).

#Step 2 — Chunking

The extracted text is split into overlapping chunks of 500 words each, with a 50-word overlap between consecutive chunks. The overlap ensures that sentences and ideas that fall at a boundary between two chunks are still captured in at least one of them.

```
[  chunk 1  |overlap]
             [overlap|  chunk 2  |overlap]
                                  [overlap|  chunk 3  ]
```

Why chunk at all? Because the AI model has a limited "context window" — it can only read a certain amount of text at once. Chunking lets us feed it only the most relevant pieces rather than the entire document.

#Step 3 — Embedding

Each chunk is passed through **Sentence Transformers** (`all-MiniLM-L6-v2`), which converts the text into a **vector** — a list of 384 numbers that represents the semantic meaning of that chunk. Text with similar meaning will have vectors that are mathematically close to each other.

```
"Sheikh lives in Kashmir"  →  [0.23, -0.87, 0.41, ... 384 numbers]
"He is based in Kashmir"   →  [0.25, -0.84, 0.39, ... 384 numbers]  ← very similar
"The sky is blue"          →  [-0.91, 0.12, 0.67, ... 384 numbers]  ← very different
```

#Step 4 — FAISS Index

All chunk vectors are stored in a **FAISS** (Facebook AI Similarity Search) index in memory. FAISS is optimized to search through millions of vectors extremely fast using approximate nearest-neighbor algorithms.

#Step 5 — Query & Retrieval

When you ask a question, that question is also converted into a vector using the same embedding model. FAISS then searches the index to find the **top 5 chunks** whose vectors are closest to the question vector — these are the most semantically relevant parts of the document.

#Step 6 — LLM Answer Generation

The 5 retrieved chunks are assembled into a context block and sent to the local LLM (via **Ollama**) along with a strict prompt that instructs it to answer using only that context. The answer streams back to your browser token by token via **Server-Sent Events (SSE)**.

#Full Pipeline Diagram

```
Your PDF
   │
   ▼
[PyMuPDF] ──── Extract text
   │
   ▼
[Chunker] ──── Split into 500-word overlapping chunks
   │
   ▼
[Sentence Transformers] ──── Convert each chunk to a 384-dim vector
   │
   ▼
[FAISS Index] ──── Store all vectors in memory
   │
   │  ◄─── Your question also gets embedded
   ▼
[FAISS Search] ──── Find top 5 most relevant chunks
   │
   ▼
[Ollama LLM] ──── Generate answer from those 5 chunks only
   │
   ▼
Your Answer (streamed word by word)
```

---

#Project Structure

```
DocMind/
├── docker-compose.yml          # Orchestrates all 3 services
│
├── backend/
│   ├── Dockerfile              # Python multi-stage build
│   ├── .dockerignore
│   ├── main.py                 # FastAPI app — all RAG logic lives here
│   └── requirements.txt
│
└── frontend/
    ├── Dockerfile              # Node build + Nginx serve
    ├── .dockerignore
    ├── nginx.conf              # Reverse proxy + SSE config
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx            # React entry point
        └── App.jsx             # Full DocMind UI
```

---

#Quick Start with Docker

This is the recommended way to run DocMind. Docker handles everything automatically.

#Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- At least **4 GB of free RAM**
- At least **2 GB of free disk space** (for the AI model)

#Run

```bash
git clone https://github.com/SheikhMohammadNashid/DocMind.git
cd DocMind
docker compose up --build
```

On first run, Docker will:
1. Build the backend and frontend images
2. Pull the Ollama image
3. Automatically download the `tinyllama` model (~637 MB) — this takes a few minutes on first run only

Once everything is running, open your browser and go to:

```
http://localhost:3000
```

#Stop

```bash
docker compose down
```

# Rebuild after code changes

```bash
docker compose down
docker compose up --build
```

---

#Manual Setup (without Docker)

#Backend

```bash
# Install Ollama from https://ollama.ai and pull a model
ollama pull tinyllama

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Start the API server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

#Choosing a Model

The model you use has the biggest impact on both speed and answer quality. Change the model by editing two lines in `docker-compose.yml`:

```yaml
# In the backend environment section:
- OLLAMA_MODEL=tinyllama

# In the ollama-pull command:
OLLAMA_HOST=http://ollama:11434 ollama pull tinyllama
```

| Model | Size | RAM Needed | Speed on CPU | Answer Quality | Hallucination Risk |
|-------|------|------------|--------------|----------------|--------------------|
| `tinyllama` | 637 MB | 4 GB | Fast | Poor | High |
| `llama3.2:1b` | 1.3 GB | 6 GB | Moderate | OK | Medium |
| `llama3.2:3b` | 2 GB | 8 GB | Slow | Good | Low |
| `llama3` | 4.7 GB | 16 GB | Very slow | Excellent | Very low |
| `llama3` + GPU | 4.7 GB | 8 GB VRAM | Fast | Excellent | Very low |

**Recommendation by available RAM:**

```bash
free -h   # check your RAM on Linux
```

- **4–6 GB RAM** → use `tinyllama`
- **6–8 GB RAM** → use `llama3.2:1b`
- **8–16 GB RAM** → use `llama3.2:3b`
- **16+ GB RAM** → use `llama3`

---

# API Reference

The backend exposes a REST API at `http://localhost:8000`.
Interactive Swagger docs are available at `http://localhost:8000/docs`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Status check |
| `GET` | `/health` | Health check |
| `POST` | `/upload` | Upload a PDF, returns `session_id` |
| `POST` | `/ask` | Ask a question (returns full answer at once) |
| `POST` | `/ask/stream` | Ask a question (streams answer token by token) |
| `DELETE` | `/session/{id}` | Delete a session and free memory |

# Upload a PDF
```bash
curl -X POST http://localhost:8000/upload \
  -F "file=@your-document.pdf"
```

Response:
```json
{
  "session_id": "abc-123-...",
  "filename": "your-document.pdf",
  "num_chunks": 42,
  "message": "PDF processed into 42 chunks. Ready for questions!"
}
```

#Ask a Question
```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"session_id": "abc-123-...", "question": "What is this document about?"}'
```

---

# Configuration

Environment variables set in `docker-compose.yml` under the backend service:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://ollama:11434` | URL of the Ollama server |
| `OLLAMA_MODEL` | `tinyllama` | Model name to use for inference |

Constants that can be tuned directly in `backend/main.py`:

| Constant | Default | Description |
|----------|---------|-------------|
| `CHUNK_SIZE` | `500` | Words per chunk |
| `CHUNK_OVERLAP` | `50` | Overlapping words between consecutive chunks |
| `TOP_K` | `5` | Number of chunks retrieved per question |

---

# Limitations

DocMind is a demonstration project. Understanding its limitations will help you use it effectively and set the right expectations.

#  1. Small Models Hallucinate

The default model `tinyllama` is only 1.1 billion parameters. It will sometimes **invent facts, alter names, or add information that is not in your document** — even with strict prompting. This is a fundamental limitation of small language models, not a bug in DocMind.

**Real example of this problem:** If your document says "Sheikh Mohammad Nashid from Kashmir", the model might output "Mohammad Nasheed from Sri Lanka" because it pattern-matches to similar names from its training data and ignores the instruction to copy names exactly.

**Workaround:** Use a larger model (`llama3.2:3b` or `llama3`) if your hardware allows. Larger models follow instructions more reliably and hallucinate significantly less.

---

# 2. Scanned PDFs Will Not Work

DocMind extracts text directly from PDF files. If your PDF is a **scanned image** (e.g., a photo of a physical document, a scanned book, a photographed form), there is no selectable text to extract and DocMind will return empty or meaningless results. It does **not** perform OCR (Optical Character Recognition).

**How to tell:** If you cannot select/copy text in your PDF viewer, it is scanned.

**Workaround:** Use a tool like Adobe Acrobat, Tesseract OCR, or an online OCR service to convert the scanned PDF into a text-searchable PDF first, then upload the converted file.

---

# 3. No Persistence Between Restarts

Sessions and uploaded documents are stored entirely in RAM. If you restart the Docker containers, all sessions are lost and you must re-upload your PDF. There is no database or disk storage for documents.

---

# 4. One Document Per Session

Each chat session is tied to a single PDF. You cannot ask questions across multiple documents in the same conversation. To switch documents, click the trash icon in the chat bar and upload a new file.

---

# 5. Answers Are Only As Good As the Retrieved Chunks

DocMind retrieves the top 5 most relevant chunks (500 words each) and feeds them to the model. If the answer to your question is spread thinly across many parts of a large document, or requires a holistic understanding of the whole document, the answer may be incomplete or incorrect.

**Questions that work well:**
- "What is the author's email address?"
- "What technology stack is used?"
- "What does the document say about X?"

**Questions that may not work well:**
- "Summarize the entire document"
- "What are all the main conclusions?"
- "Compare section 2 and section 7"

---

#6. Slow on CPU Hardware

The LLM runs entirely on CPU by default. Expected response times on typical budget hardware:

| Model | Expected Response Time (CPU) |
|-------|------------------------------|
| `tinyllama` | 30–90 seconds |
| `llama3.2:1b` | 2–5 minutes |
| `llama3.2:3b` | 5–10 minutes |
| `llama3` | Often times out |

If you have an **NVIDIA GPU**, uncomment the `deploy` block in the `ollama` service in `docker-compose.yml` to enable GPU acceleration — responses become near-instant.

---

# 7. RAM Usage Grows With Document Size

FAISS runs entirely in memory. Each chunk embedding takes a small amount of RAM, but very large documents (hundreds of pages, thousands of chunks) can consume significant memory. There is no protection against out-of-memory errors if extremely large PDFs are uploaded.

---

# 8. PDF Encoding Issues

Some PDFs use non-standard fonts or encodings that cause PyMuPDF to extract garbled, partial, or missing text. This is especially common with PDFs exported from older software, certain design tools, or documents with non-Latin scripts (Arabic, Chinese, etc.).

**How to check:** After uploading, the system reports how many chunks were created. If a 50-page document produces only 1–2 chunks, the text extraction likely failed or produced very little text.

---

##Author

**Sheikh Mohammad Nashid**
AI, DevOps & Technology Enthusiast
Srinagar, Kashmir

- [sheikhmohammadnashid@gmail.com](mailto:sheikhmohammadnashid@gmail.com)
- [github.com/SheikhMohammadNashid](https://github.com/SheikhMohammadNashid)

---

DocMind was developed as a personal exploration into artificial intelligence, retrieval systems, DevOps practices, and modern web technologies.
