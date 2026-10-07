// server.js
// Tiny backend for ZeoX. Hides the Groq key + talks to Groq for the frontend.

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve the frontend (index.html, style.css, script.js, persona.js)
app.use(express.static(__dirname));

// ─────────────────────────────────────────
// The chat endpoint — frontend calls this
// ─────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

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
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.9,
        max_tokens: 300,
        top_p: 0.95
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq error:", groqRes.status, errText);
      return res.status(groqRes.status).json({ error: "groq_failed", detail: errText });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "";
    res.json({ reply });

  } catch (e) {
    console.error("Server error:", e);
    res.status(500).json({ error: "server_error" });
  }
});

// Health check
app.get("/health", (req, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log(`ZeoX running on port ${PORT}`);
});
