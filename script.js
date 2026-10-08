// script.js
// ZeoX frontend — talks to OUR backend (/api/chat), not Groq directly.
// The Groq key lives safely on the server. Replies stream in live.

import { ZOE_SYSTEM_PROMPT, OPENING_LINE } from './persona.js';

/* ─────────────────────────────────────────
   STATE
   ───────────────────────────────────────── */

const STORE_KEY = "zeox.conversation.v1";

// conversation history (without the system prompt — that's added at send time)
let history = loadHistory();

let isTyping = false;

/* ─────────────────────────────────────────
   DOM
   ───────────────────────────────────────── */

const chatEl     = document.getElementById("chat");
const inputEl    = document.getElementById("userInput");
const sendBtn    = document.getElementById("sendBtn");
let welcomeEl    = document.getElementById("welcome");
const newChatBtn = document.getElementById("newChatBtn");

/* ─────────────────────────────────────────
   PERSISTENCE
   ───────────────────────────────────────── */

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(m => m && m.role && m.content) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    // keep the last 60 exchanges so we never blow the context window
    localStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-60)));
  } catch { /* storage full or blocked — she just forgets, that's ok */ }
}

/* ─────────────────────────────────────────
   UI HELPERS
   ───────────────────────────────────────── */

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function hideWelcome() {
  if (welcomeEl) {
    welcomeEl.remove();
    welcomeEl = null;
  }
}

function addMessage(text, who, ts = nowTime()) {
  hideWelcome();

  const row = document.createElement("div");
  row.className = `msg-row ${who}`;

  const bubble = document.createElement("div");
  bubble.className = `msg ${who}`;
  const span = document.createElement("span");
  span.className = "msg-text";
  span.textContent = text;
  bubble.appendChild(span);

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = ts;

  row.appendChild(bubble);
  row.appendChild(time);
  chatEl.appendChild(row);
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
   STREAM FROM OUR BACKEND
   Reads Server-Sent Events chunk by chunk.
   ───────────────────────────────────────── */

async function streamZoeReply(onToken) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stream: true,
      messages: [
        { role: "system", content: ZOE_SYSTEM_PROMPT },
        ...history
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Backend error:", res.status, err);
    throw new Error("backend_failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep the partial line in the buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const evt = JSON.parse(payload);
        if (evt.t) onToken(evt.t);
      } catch { /* skip malformed chunk */ }
    }
  }
}

/* ─────────────────────────────────────────
   MAIN SEND FLOW
   ───────────────────────────────────────── */

function setInput(text) {
  inputEl.value = text;
  autoGrow();
  updateSendState();
  inputEl.focus();
}

async function sendMessage(presetText) {
  const text = (presetText ?? inputEl.value).trim();
  if (!text || isTyping) return;

  inputEl.value = "";
  autoGrow();
  updateSendState();

  const userTs = nowTime();
  addMessage(text, "me", userTs);
  history.push({ role: "user", content: text, ts: userTs });

  isTyping = true;
  sendBtn.disabled = true;
  inputEl.blur();
  showTyping();

  // small human-like pause before she starts
  const delay = 500 + Math.random() * 700;
  await new Promise(r => setTimeout(r, delay));

  try {
    hideTyping();
    const bubble = addMessage("", "zoe");
    bubble.classList.add("streaming");

    let full = "";
    const zoeTs = nowTime();

    await streamZoeReply((token) => {
      full += token;
      bubble.querySelector(".msg-text").textContent = full;
      chatEl.scrollTop = chatEl.scrollHeight;
    });

    bubble.classList.remove("streaming");
    bubble.querySelector(".msg-time").textContent = zoeTs;

    if (full.trim()) {
      history.push({ role: "assistant", content: full.trim(), ts: zoeTs });
      saveHistory();
    } else {
      bubble.querySelector(".msg-text").textContent = "...say that again?";
    }
  } catch (e) {
    hideTyping();
    addMessage("...my wifi just died for a sec. say that again?");
  } finally {
    isTyping = false;
    sendBtn.disabled = !inputEl.value.trim();
    inputEl.focus();
  }
}

/* ─────────────────────────────────────────
   COMPOSER BEHAVIOR
   ───────────────────────────────────────── */

function autoGrow() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 132) + "px";
}

function updateSendState() {
  sendBtn.disabled = isTyping || !inputEl.value.trim();
}

inputEl.addEventListener("input", () => {
  autoGrow();
  updateSendState();
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", () => sendMessage());

// suggestion chips
document.getElementById("chips")?.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip && !isTyping) sendMessage(chip.dataset.text);
});

// new chat
newChatBtn.addEventListener("click", () => {
  if (isTyping) return;
  history = [];
  saveHistory();
  chatEl.querySelectorAll(".msg-row, .typing").forEach(el => el.remove());
  location.reload();
});

/* ─────────────────────────────────────────
   START
   ───────────────────────────────────────── */

window.addEventListener("load", () => {
  if (history.length > 0) {
    // restore the previous conversation
    history.forEach(m => addMessage(m.content, m.role === "user" ? "me" : "zoe", m.ts));
  } else {
    setTimeout(() => addMessage(OPENING_LINE, "zoe"), 500);
    // the opening line isn't in history — it's just a hello
  }
  inputEl.focus();

  console.log(
    "%c ZeoX ",
    "background:#00e5ff;color:#000;font-weight:bold;padding:2px 6px;border-radius:3px;"
  );
});
