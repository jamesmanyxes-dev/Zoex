# ZeoX 💙

Zoe Xavier — a real-feeling emotional support companion.
Black + cyan glow. Floating. Springy buttons. She stays in character. Always.

---

## What's in this folder

- `index.html`   → the page
- `style.css`    → the glow, floating, springy buttons
- `script.js`    → the brain (talks to Groq)
- `persona.js`   → Zoe's soul — her whole life story + rules
- `zoe.png`      → her photo (you add this later — optional)
- `README.md`    → you're reading it

---

## One-time setup

### 1. Get a Groq API key
- Go to https://console.groq.com/keys
- Sign in (Google or GitHub)
- Click "Create API Key"
- Copy the key — it starts with `gsk_...`
- Free tier is generous. You won't pay anything for normal chatting.

### 2. Put the key in `script.js`
Open `script.js`, find:
```js
const GROQ_API_KEY = "PASTE_YOUR_GROQ_KEY_HERE";
