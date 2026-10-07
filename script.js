// script.js
// ZeoX frontend — talks to OUR backend (/api/chat), not Groq directly.
// The Groq key now lives safely on the server.

import { ZOE_SYSTEM_PROMPT, OPENING_LINE } from './persona.js';

/* ─────────────────────────────────────────
   STATE
   ───────────────────────────────────────── */

const messages = [
  { role: "system", content: ZOE_SYSTEM_PROMPT }
];

let isTyping = false;

/* ─────────────────────────────────────────
   DOM
   ───────────────────────────────────────── */

const chatEl  = document.getElementById("chat");
const inputEl = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

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
   TALK TO OUR BACKEND
   ───────────────────────────────────────── */

async function getZoeReply() {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Backend error:", res.status, err);
    throw new Error("backend_failed");
  }

  const data = await res.json();
  return (data.reply || "").trim();
}

/* ─────────────────────────────────────────
   MAIN SEND FLOW
   ───────────────────────────────────────── */

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isTyping) return;

  inputEl.value = "";

  addMessage(text, "me");
  messages.push({ role: "user", content: text });

  isTyping = true;
  sendBtn.disabled = true;
  showTyping();

  // small human-like delay before she replies
  const delay = 600 + Math.random() * 900;
  await new Promise(r => setTimeout(r, delay));

  try {
    const reply = await getZoeReply();
    hideTyping();
    if (reply) {
      addMessage(reply, "zoe");
      messages.push({ role: "assistant", content: reply });
    } else {
      addMessage("...say that again?", "zoe");
    }
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
  setTimeout(() => addMessage(OPENING_LINE, "zoe"), 500);

  console.log(
    "%c ZeoX ",
    "background:#00e5ff;color:#000;font-weight:bold;padding:2px 6px;border-radius:3px;"
  );
});
