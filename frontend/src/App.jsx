import { useState, useRef, useEffect } from "react";

// In Docker: Nginx proxies /api/* → backend:8000
// In local dev: Vite proxies /api/* → localhost:8000
const API_BASE = "/api";

// ── Icons ────────────────────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const ChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const GithubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const MapPinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const BookOpenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

// ── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 20 }) => (
  <div style={{ width: size, height: size, border: `2px solid rgba(99,102,241,0.2)`, borderTop: `2px solid #6366f1`, borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
);

// ── Typing dots ──────────────────────────────────────────────────────────────
const TypingDots = () => (
  <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "4px 0" }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#818cf8", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
    ))}
  </div>
);

// ── Context Accordion ────────────────────────────────────────────────────────
const ContextAccordion = ({ chunks }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(99,102,241,0.2)" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "rgba(99,102,241,0.07)", border: "none", cursor: "pointer", color: "#a5b4fc", fontSize: 12, fontFamily: "inherit" }}>
        <span>📎 {chunks.length} context chunk{chunks.length !== 1 ? "s" : ""} used</span>
        <div style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", width: 14 }}><ChevronDown /></div>
      </button>
      {open && (
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto", background: "rgba(15,15,35,0.4)" }}>
          {chunks.map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6, padding: "6px 10px", background: "rgba(99,102,241,0.05)", borderRadius: 6, borderLeft: "2px solid rgba(99,102,241,0.4)" }}>
              {c.slice(0, 240)}{c.length > 240 ? "…" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Message Bubble ───────────────────────────────────────────────────────────
const Message = ({ msg }) => {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 18, animation: "fadeUp 0.3s ease" }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 10, marginTop: 2, fontSize: 14 }}>
          🧠
        </div>
      )}
      <div style={{ maxWidth: "75%" }}>
        <div style={{
          padding: "12px 16px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(30,30,60,0.8)",
          color: isUser ? "#fff" : "#e2e8f0",
          fontSize: 14, lineHeight: 1.7,
          border: isUser ? "none" : "1px solid rgba(99,102,241,0.2)",
          boxShadow: isUser ? "0 4px 20px rgba(99,102,241,0.3)" : "0 2px 12px rgba(0,0,0,0.3)",
          backdropFilter: "blur(8px)",
          whiteSpace: "pre-wrap",
        }}>
          {msg.content === "TYPING" ? <TypingDots /> : msg.content}
        </div>
        {msg.chunks && msg.chunks.length > 0 && <ContextAccordion chunks={msg.chunks} />}
      </div>
      {isUser && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 10, marginTop: 2, fontSize: 14 }}>
          👤
        </div>
      )}
    </div>
  );
};

// ── Upload Zone ──────────────────────────────────────────────────────────────
const UploadZone = ({ onUpload, loading }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();
  const handleFile = (file) => { if (file && file.type === "application/pdf") onUpload(file); };
  return (
    <div
      onClick={() => !loading && inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${drag ? "#6366f1" : "rgba(99,102,241,0.3)"}`,
        borderRadius: 16, padding: "48px 32px", textAlign: "center",
        cursor: loading ? "wait" : "pointer", transition: "all 0.25s",
        background: drag ? "rgba(99,102,241,0.08)" : "rgba(15,15,40,0.4)",
        backdropFilter: "blur(8px)",
      }}>
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <Spinner size={36} />
          <p style={{ color: "#a5b4fc", fontSize: 15 }}>Processing your PDF…</p>
        </div>
      ) : (
        <>
          <div style={{ width: 52, height: 52, margin: "0 auto 16px", color: "#6366f1", opacity: 0.8 }}><UploadIcon /></div>
          <p style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Drop your PDF here</p>
          <p style={{ color: "#64748b", fontSize: 13 }}>or click to browse • PDF files only</p>
        </>
      )}
    </div>
  );
};

// ── Chat Page ────────────────────────────────────────────────────────────────
const ChatPage = () => {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef();
  const textareaRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleUpload = async (file) => {
    setUploading(true); setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Upload failed"); }
      const data = await res.json();
      setSession(data);
      setMessages([{ id: Date.now(), role: "assistant", content: `✅ **${data.filename}** uploaded!\n\nSplit into **${data.num_chunks} chunks** and indexed. Ask me anything about this document!` }]);
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  const handleAsk = async () => {
    const q = input.trim();
    if (!q || !session || asking) return;
    setInput(""); setAsking(true); setError(null);
    const userMsg = { id: Date.now(), role: "user", content: q };
    const typingId = Date.now() + 1;
    setMessages(m => [...m, userMsg, { id: typingId, role: "assistant", content: "TYPING" }]);
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.session_id, question: q }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Query failed"); }
      const data = await res.json();
      setMessages(m => m.map(msg => msg.id === typingId ? { ...msg, content: data.answer, chunks: data.context_chunks } : msg));
    } catch (e) {
      setMessages(m => m.map(msg => msg.id === typingId ? { ...msg, content: `❌ Error: ${e.message}` } : msg));
    } finally { setAsking(false); }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } };
  const resetSession = () => { setSession(null); setMessages([]); setError(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {!session ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ maxWidth: 500, margin: "0 auto", width: "100%" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>Upload a PDF to get started</h2>
              <p style={{ color: "#64748b", fontSize: 14 }}>DocMind will extract, chunk, and index your document for intelligent Q&A</p>
            </div>
            <UploadZone onUpload={handleUpload} loading={uploading} />
            {error && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>⚠️ {error}</div>}
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: "10px 20px", borderBottom: "1px solid rgba(99,102,241,0.15)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, color: "#6366f1", flexShrink: 0 }}><FileIcon /></div>
            <span style={{ fontSize: 13, color: "#a5b4fc", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.filename}</span>
            <span style={{ fontSize: 11, color: "#475569", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 20 }}>{session.num_chunks} chunks</span>
            <button onClick={resetSession} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", width: 18, height: 18, padding: 0, opacity: 0.7 }} title="Close document"><TrashIcon /></button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px", scrollbarWidth: "thin", scrollbarColor: "rgba(99,102,241,0.3) transparent" }}>
            {messages.map(m => <Message key={m.id} msg={m} />)}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
            {error && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 12 }}>⚠️ {error}</div>}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "rgba(20,20,50,0.8)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, padding: "10px 14px", backdropFilter: "blur(8px)" }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your document…"
                rows={1}
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, fontFamily: "inherit", resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
              />
              <button
                onClick={handleAsk}
                disabled={!input.trim() || asking}
                style={{
                  width: 36, height: 36, borderRadius: "50%", border: "none",
                  background: input.trim() && !asking ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(99,102,241,0.2)",
                  cursor: input.trim() && !asking ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", flexShrink: 0, transition: "all 0.2s",
                  boxShadow: input.trim() && !asking ? "0 4px 14px rgba(99,102,241,0.4)" : "none",
                }}>
                {asking ? <Spinner size={16} /> : <div style={{ width: 16, height: 16 }}><SendIcon /></div>}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#334155", textAlign: "center", marginTop: 8 }}>Enter to send • Shift+Enter for new line</p>
          </div>
        </>
      )}
    </div>
  );
};

// ── About Page ───────────────────────────────────────────────────────────────
const AboutPage = () => {
  const tech = [
    { name: "FastAPI", desc: "Backend API", icon: "⚡" },
    { name: "React + TailwindCSS", desc: "Frontend interface", icon: "⚛️" },
    { name: "FAISS", desc: "Vector similarity search", icon: "🔍" },
    { name: "Sentence Transformers", desc: "Text embeddings", icon: "🧬" },
    { name: "Ollama + Llama 3", desc: "Local LLM inference", icon: "🦙" },
  ];
  return (
    <div style={{ overflowY: "auto", height: "100%", scrollbarWidth: "thin", scrollbarColor: "rgba(99,102,241,0.3) transparent" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16, filter: "drop-shadow(0 0 20px rgba(99,102,241,0.6))" }}>🧠</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, background: "linear-gradient(135deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10 }}>About DocMind</h1>
          <div style={{ width: 60, height: 3, background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 4, margin: "0 auto" }} />
        </div>

        <div style={{ background: "rgba(20,20,55,0.6)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 28, marginBottom: 28, backdropFilter: "blur(8px)", lineHeight: 1.8, color: "#cbd5e1", fontSize: 14 }}>
          <p style={{ marginBottom: 14 }}>DocMind is an intelligent document question-answering system built using <strong style={{ color: "#a5b4fc" }}>Retrieval-Augmented Generation (RAG)</strong>. It allows users to upload PDF documents and interact with them using natural language questions. Instead of manually searching through lengthy documents, DocMind retrieves relevant sections and generates accurate, context-aware answers.</p>
          <p style={{ marginBottom: 14 }}>The system works by extracting text from uploaded PDFs and dividing the content into smaller chunks. These chunks are converted into <strong style={{ color: "#a5b4fc" }}>vector embeddings</strong> and stored in a vector database. When a user asks a question, the system searches for the most relevant pieces of information, which are then provided as context to a large language model.</p>
          <p>This approach ensures answers are <strong style={{ color: "#a5b4fc" }}>grounded in the document itself</strong>, enabling efficient knowledge retrieval and improving how users interact with large amounts of textual information.</p>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#a5b4fc", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 20 }}><BookOpenIcon /></div> How It Works
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["📤", "Upload", "PDF is uploaded and text is extracted from all pages"],
              ["✂️", "Chunk", "Text is split into overlapping chunks for better context coverage"],
              ["🧬", "Embed", "Each chunk is transformed into a vector embedding using Sentence Transformers"],
              ["🔍", "Search", "Your question is embedded and matched against stored vectors via FAISS"],
              ["🦙", "Generate", "Top chunks are passed to Llama 3 via Ollama to generate a precise answer"],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 16px", background: "rgba(15,15,40,0.5)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#a5b4fc", marginBottom: 16 }}>⚙️ Technologies Used</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {tech.map(t => (
              <div key={t.name} style={{ padding: "14px 16px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 22 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#c7d2fe" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#a5b4fc", marginBottom: 10 }}>🎯 Purpose</h2>
          <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8 }}>
            DocMind demonstrates how modern AI systems can combine information retrieval with large language models to create powerful document-analysis tools. It can be applied in research, education, knowledge management, and document exploration — helping users quickly find answers within large documents.
          </p>
        </div>

        <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#a5b4fc", marginBottom: 16 }}>👤 Author</h2>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, color: "white", fontWeight: 700 }}>S</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>Sheikh Mohannad Nashid</div>
              <div style={{ fontSize: 12, color: "#818cf8", marginBottom: 14 }}>AI, DevOps & Technology Enthusiast</div>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, marginBottom: 14 }}>DocMind was developed as part of a personal exploration into artificial intelligence, retrieval systems, DevOps practices, and modern web technologies.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: <MailIcon />, label: "sheikhmohammadnashid@gmail.com", href: "mailto:sheikhmohammadnashid@gmail.com" },
                  { icon: <MapPinIcon />, label: "Srinagar, Kashmir" },
                  { icon: <GithubIcon />, label: "github.com/SheikhMohammadNashid", href: "https://github.com/SheikhMohammadNashid" },
                ].map(({ icon, label, href }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, color: "#6366f1", flexShrink: 0 }}>{icon}</div>
                    {href
                      ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#a5b4fc", textDecoration: "none" }}>{label}</a>
                      : <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── App Shell ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("chat");

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { background: #080818; font-family: 'Segoe UI', system-ui, sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,80%,100%{ transform:scale(0); opacity:0.5 } 40%{ transform:scale(1); opacity:1 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }
        textarea::placeholder { color: #334155; }
      `}</style>

      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.08) 0%, transparent 60%), #080818" }}>
        <header style={{ borderBottom: "1px solid rgba(99,102,241,0.2)", padding: "0 24px", flexShrink: 0, display: "flex", alignItems: "center", height: 58, backdropFilter: "blur(12px)", background: "rgba(8,8,24,0.8)", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧠</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", background: "linear-gradient(135deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>DocMind</div>
              <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: -1 }}>RAG Document Assistant</div>
            </div>
          </div>
          <nav style={{ display: "flex", gap: 4 }}>
            {["chat", "about"].map(p => (
              <button key={p} onClick={() => setPage(p)} style={{
                padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", textTransform: "capitalize", transition: "all 0.2s",
                background: page === p ? "rgba(99,102,241,0.2)" : "transparent",
                color: page === p ? "#a5b4fc" : "#475569",
                borderBottom: page === p ? "2px solid #6366f1" : "2px solid transparent",
              }}>{p}</button>
            ))}
          </nav>
        </header>

        <main style={{ flex: 1, overflow: "hidden" }}>
          {page === "chat" ? <ChatPage /> : <AboutPage />}
        </main>
      </div>
    </>
  );
}
