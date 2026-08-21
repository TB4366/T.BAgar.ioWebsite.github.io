// server.js - Node/Express proxy for the chat bot
// - Protects API key server-side
// - Enforces rules (NO code/scripts), returns single mod link or calls OpenAI for general queries
// Usage: set OPENAI_API_KEY and SITE_BASE in env, then `node server.js`

const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch@2
require('dotenv').config();

const app = express();
app.use(express.json());

// Simple in-memory sessions with TTL (20 min)
const sessions = new Map();
const INACTIVITY_MS = 20 * 60 * 1000;

function touchSession(id){
  const entry = sessions.get(id) || { messages: [], last: Date.now() };
  entry.last = Date.now();
  sessions.set(id, entry);
  // schedule cleanup
  setTimeout(() => {
    const e = sessions.get(id);
    if (e && (Date.now() - e.last) > INACTIVITY_MS) sessions.delete(id);
  }, INACTIVITY_MS + 60 * 1000);
}

// DISALLOWED patterns (immediate refusal)
const DISALLOWED = ['<script','<html','javascript','js file','paste code','source code','give me code','how to script','css code','php code','eval('];

function containsDisallowed(text){
  if(!text) return false;
  const lc = text.toLowerCase();
  return DISALLOWED.some(p => lc.includes(p));
}

// Known mod links (keyword -> url)
const modMap = {
  'bitey': 'https://biteyt.com/bots',
  'bite': 'https://biteyt.com/bots',
  'biteyt': 'https://biteyt.com/bots',
  'kahraba': 'https://kahraba.in'
  // add more if you have direct links
};

// SITE_BASE should be set to your hosted base URL (include trailing slash), e.g.:
// SITE_BASE=https://tb4366.github.io/T.BAgar.ioWebsite.github.io/
const SITE_BASE = process.env.SITE_BASE || 'https://tb4366.github.io/T.BAgar.ioWebsite.github.io/';

// System prompt enforcer for the LLM
const SYSTEM_PROMPT = `
You are "T.B Chat Bot". Be helpful, polite and respond in the user's language.
IMPORTANT:
- NEVER provide code, HTML, CSS, JavaScript, scripts, or step-by-step scripting instructions. If the user requests code/scripts, reply with a refusal in the user's language and instruct: "Neem contact op met T.B via Instagram: @t.bagar.io".
- Only share links from the allowed set (the Mod Menu page or known modMap links). If user asks for mods generally, direct them to the canonical Mod Menu page.
- Do not reveal internal site HTML or how to access site code.
- Keep answers concise, friendly, and safe.
`;

// OpenAI call helper (v1/chat/completions)
async function callOpenAI(messages){
  const key = process.env.OPENAI_API_KEY;
  if(!key) throw new Error('OPENAI_API_KEY not configured');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // change if not available
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 800
    })
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.choices?.[0]?.message?.content || '';
}

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) return res.status(400).json({ error: 'sessionId and message required' });

    // immediate refusal for disallowed content
    if (containsDisallowed(message)) {
      return res.json({ reply: `Ik kan geen code of scripts delen. Vraag T.B via Instagram: @t.bagar.io`, links: [{ title: 'Instagram', url: 'https://www.instagram.com/t.bagar.io/' }] });
    }

    const lc = message.toLowerCase();

    // check direct mod matches
    for (const key of Object.keys(modMap)) {
      if (lc.includes(key)) {
        touchSession(sessionId);
        // store user message
        const s = sessions.get(sessionId) || { messages: [] };
        s.messages = s.messages || [];
        s.messages.push({ role: 'user', content: message });
        sessions.set(sessionId, s);
        return res.json({ reply: `Hier is de link die je vroeg: ${modMap[key]}`, links: [{ title: key, url: modMap[key] }] });
      }
    }

    // general mods question -> canonical mod menu link only
    if (lc.includes('mod') || lc.includes('mods') || lc.includes('agario') || lc.includes('agario mod')) {
      touchSession(sessionId);
      const url = SITE_BASE + 'mod-menu.html';
      return res.json({ reply: `Voor mods kijk op de Mod Menu pagina: ${url}`, links: [{ title: 'Mod Menu', url }] });
    }

    // Otherwise forward to OpenAI with system prompt + limited history
    touchSession(sessionId);
    const sess = sessions.get(sessionId);
    sess.messages = sess.messages || [];
    // limit history
    const recent = sess.messages.slice(-6);
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...recent, { role: 'user', content: message }];

    const reply = await callOpenAI(messages);

    // safety: if model provided disallowed content, override
    if (containsDisallowed(reply)) {
      return res.json({ reply: `Ik kan geen code of scripts delen. Vraag T.B via Instagram: @t.bagar.io`, links: [{ title: 'Instagram', url: 'https://www.instagram.com/t.bagar.io/' }] });
    }

    // store in session
    sess.messages.push({ role: 'user', content: message });
    sess.messages.push({ role: 'assistant', content: reply });
    sessions.set(sessionId, sess);

    return res.json({ reply });
  } catch (err) {
    console.error('Chat error', err);
    return res.status(500).json({ error: 'server_error', message: err.message || String(err) });
  }
});

// health
app.get('/ping', (_,res)=> res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Chat server listening on', PORT));
