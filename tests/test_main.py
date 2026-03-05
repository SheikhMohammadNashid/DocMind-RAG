from io import BytesIO

from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_upload_pdf_uses_process_pdf(monkeypatch, tmp_path):
    called = {}

    def fake_process_pdf(path: str) -> None:
        called["path"] = path

    # Monkeypatch the process_pdf used inside main
    import backend.main as main_module

    monkeypatch.setattr(main_module, "process_pdf", fake_process_pdf)

    file_content = b"dummy pdf content"
    files = {"file": ("test.pdf", BytesIO(file_content), "application/pdf")}

    response = client.post("/upload", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "PDF processed successfully"
    assert "path" in called


def test_ask_question_uses_rag_function(monkeypatch):
    def fake_ask_question(query: str) -> str:
        return f"answer to {query}"

    import backend.main as main_module

    monkeypatch.setattr(main_module, "ask_question", fake_ask_question)

    response = client.get("/ask", params={"query": "What is DocMind?"})

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "answer to What is DocMind?"

