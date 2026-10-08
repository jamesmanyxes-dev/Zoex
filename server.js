// server.js
// ZeoX backend — hides the Groq key, talks to Groq, streams replies live.

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

app.use(express.json({ limit: "1mb" }));

// Static assets: /public (logo, favicon) first, then the app root
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(__dirname));

// ─────────────────────────────────────────
// The chat endpoint — streams SSE events:
//   data: {"t":"chunk"}   (a piece of her reply)
//   data: [DONE]
// ─────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, stream } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "no messages" });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.9,
        max_tokens: 300,
        top_p: 0.95,
        stream: stream === true
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq error:", groqRes.status, errText);
      return res.status(groqRes.status).json({ error: "groq_failed", detail: errText });
    }

    // ── streaming: pipe Groq's deltas to the browser as SSE ──
    if (stream === true) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      });

      const reader = groqRes.body.getReader();
      const decoder = new TextDecoder();
      let groqBuffer = "";

      const push = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        groqBuffer += decoder.decode(value, { stream: true });
        const lines = groqBuffer.split("\n");
        groqBuffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") { push({ t: "" }); continue; }
          try {
            const evt = JSON.parse(payload);
            const delta = evt.choices?.[0]?.delta?.content || "";
            if (delta) push({ t: delta });
          } catch { /* skip malformed chunk */ }
        }
      }

      res.write("data: [DONE]\n\n");
      return res.end();
    }

    // ── non-streaming: one full reply ──
    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "";
    res.json({ reply });

  } catch (e) {
    console.error("Server error:", e);
    res.status(500).json({ error: "server_error" });
  }
});

// Health check (for Render / uptime monitors)
app.get("/health", (req, res) => res.json({ ok: true, service: "zeox" }));

app.listen(PORT, () => {
  console.log(`ZeoX running on port ${PORT} · model: ${MODEL}`);
});
