const API_BASE =
  window.DOCMIND_API_BASE ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "/api");

const fileInput = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const uploadBtn = document.getElementById("upload-btn");
const uploadStatus = document.getElementById("upload-status");

const questionInput = document.getElementById("question-input");
const askBtn = document.getElementById("ask-btn");
const qaStatus = document.getElementById("qa-status");
const answerPanel = document.getElementById("answer-panel");
const answerText = document.getElementById("answer-text");

let pdfReady = false;

function setUploadStatus(message, type = "") {
  uploadStatus.textContent = message;
  uploadStatus.classList.remove("error", "success");
  if (type) uploadStatus.classList.add(type);
}

function setQaStatus(message, type = "") {
  qaStatus.textContent = message;
  qaStatus.classList.remove("error", "success");
  if (type) qaStatus.classList.add(type);
}

function enableAskIfReady() {
  askBtn.disabled = !pdfReady || !questionInput.value.trim();
}

fileInput.addEventListener("change", () => {
  if (fileInput.files && fileInput.files[0]) {
    uploadBtn.disabled = false;
    setUploadStatus(`Selected: ${fileInput.files[0].name}`);
  } else {
    uploadBtn.disabled = true;
    setUploadStatus("");
  }
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file && file.type === "application/pdf") {
    fileInput.files = e.dataTransfer.files;
    uploadBtn.disabled = false;
    setUploadStatus(`Selected: ${file.name}`);
  } else {
    setUploadStatus("Please drop a valid PDF file.", "error");
  }
});

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  uploadBtn.disabled = true;
  setUploadStatus("Uploading and indexing PDF…", "");
  pdfReady = false;
  enableAskIfReady();

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }

    const data = await res.json();
    setUploadStatus(data.message || "PDF processed successfully.", "success");
    pdfReady = true;
    enableAskIfReady();
  } catch (err) {
    console.error(err);
    setUploadStatus("Failed to upload or process PDF. Check the backend.", "error");
  } finally {
    uploadBtn.disabled = false;
  }
});

questionInput.addEventListener("input", () => {
  enableAskIfReady();
});

askBtn.addEventListener("click", async () => {
  const query = questionInput.value.trim();
  if (!query || !pdfReady) return;

  askBtn.disabled = true;
  setQaStatus("Thinking…", "");
  answerPanel.classList.add("hidden");
  answerText.textContent = "";

  try {
    const url = new URL(`${API_BASE}/ask`, window.location.origin);
    url.searchParams.set("query", query);

    const res = await fetch(url.toString(), {
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(`Ask failed with status ${res.status}`);
    }

    const data = await res.json();
    const answer = data.answer || "(No answer returned)";
    answerText.textContent = answer;
    answerPanel.classList.remove("hidden");
    setQaStatus("", "");
  } catch (err) {
    console.error(err);
    setQaStatus("Failed to get an answer. Verify that the backend and Ollama are running.", "error");
  } finally {
    askBtn.disabled = false;
  }
});

