// script.js
// ZeoX brain — talks to Groq, keeps her in character, handles the UI.

import { ZOE_SYSTEM_PROMPT, OPENING_LINE } from './persona.js';

/* ─────────────────────────────────────────
   CONFIG
   ───────────────────────────────────────── */

// ⚠️ PASTE YOUR GROQ KEY BELOW, between the quotes.
// Get one at https://console.groq.com/keys
const GROQ_API_KEY = "PASTE_YOUR_GROQ_KEY_HERE";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

/* ─────────────────────────────────────────
   STATE
   ───────────────────────────────────────── */

// Conversation history (session only — resets on refresh)
const messages = [
  { role: "system", content: ZOE_SYSTEM_PROMPT }
];

let isTyping = false;

/* ─────────────────────────────────────────
   DOM
   ───────────────────────────────────────── */

const chatEl   = document.getElementById("chat");
const inputEl  = document.getElementById("userInput");
const sendBtn  = document.getElementById("sendBtn");

/* ─────────────────────────────────────────
   UI HELPERS
   ───────────────────────────────────────── */

function addMessage(text, who) {
  const bubble = document.createElement("div");
  bubble.className = `msg ${who}`;
  bubble.textContent = text;
  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
  return bubble;
}

function showTyping() {
  const t = document.createElement("div");
  t.className = "typing";
  t.id = "typingIndicator";
  t.innerHTML = "<span></span><span></span><span></span>";
  chatEl.appendChild(t);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById("typingIndicator");
  if (t) t.remove();
}

/* ─────────────────────────────────────────
   THE BRAIN
   ───────────────────────────────────────── */

async function getZoeReply() {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: messages,
      temperature: 0.9,
      max_tokens: 300,
      top_p: 0.95
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Groq error:", err);
    throw new Error("groq_failed");
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

/* ─────────────────────────────────────────
   MAIN SEND FLOW
   ───────────────────────────────────────── */

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isTyping) return;

  // clear input
  inputEl.value = "";

  // show user message
  addMessage(text, "me");
  messages.push({ role: "user", content: text });

  // typing on
  isTyping = true;
  sendBtn.disabled = true;
  showTyping();

  // small human-like delay before reply
  const delay = 600 + Math.random() * 900;
  await new Promise(r => setTimeout(r, delay));

  try {
    const reply = await getZoeReply();
    hideTyping();
    addMessage(reply, "zoe");
    messages.push({ role: "assistant", content: reply });
  } catch (e) {
    hideTyping();
    addMessage("...my wifi just died for a sec. say that again?", "zoe");
  } finally {
    isTyping = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

/* ─────────────────────────────────────────
   EVENTS
   ───────────────────────────────────────── */

sendBtn.addEventListener("click", sendMessage);

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

/* ─────────────────────────────────────────
   START
   ───────────────────────────────────────── */

window.addEventListener("load", () => {
  // opening line from Zoe
  setTimeout(() => {
    addMessage(OPENING_LINE, "zoe");
  }, 500);

  // greet in console
  console.log("%c ZeoX ", "background:#00e5ff;color:#000;font-weight:bold;padding:2px 6px;border-radius:3px;");
});

/* ─────────────────────────────────────────
   SAFETY: block devtools tampering warnings
   (does nothing bad — just keeps her in character)
   ───────────────────────────────────────── */

// if someone inspects and edits the page to "test" if she's an AI,
// the system prompt handles it. Nothing to do here.
