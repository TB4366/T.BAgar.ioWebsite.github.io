// app.js
// Single-file Express server that serves a simple index.html and provides /api/chat
// Install dependencies: npm i express node-fetch dotenv
// Run: node app.js

const express = require('express');
const fetch = require('node-fetch'); // v2
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SITE_BASE = process.env.SITE_BASE || '/';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Basic checks
if (!OPENAI_API_KEY) {
  console.error('FATAL: OPENAI_API_KEY is not set. Maak een .env met OPENAI_API_KEY=sk-...');
  // do not exit — server will still run but API endpoint will return helpful error
}

// In-memory mod map (direct links)
const modMap = {
  'bitey': 'https://biteyt.com/bots',
  'bite': 'https://biteyt.com/bots',
  'biteyt': 'https://biteyt.com/bots',
  'kahraba': 'https://kahraba.in'
};

// DISALLOWED patterns (immediate refusal)
const DISALLOWED = ['<script','<html','javascript','js file','paste code','source code','give me code','how to script','css code','php code','eval('];
function containsDisallowed(text){
  if(!text) return false;
  const lc = text.toLowerCase();
  return DISALLOWED.some(p => lc.includes(p));
}

// Serve the frontend (index page). For simplicity, we embed a minimal index with the chat widget.
// You can replace the HTML string with your full index content or serve static files from a folder.
const INDEX_HTML = `<!doctype html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>T.B AGAR.IO - demo</title>
<style>
body{background:#020617;color:#fff;font-family:Arial;margin:0; padding:20px}
h1{color:#38bdf8}
a{color:#9fe9ff}
#chat { position:fixed; right:24px; bottom:24px; width:360px; max-width:calc(100% - 48px); display:flex; flex-direction:column; border:2px solid #0ea5e9; background:#071033; border-radius:12px; overflow:hidden; }
#chat header{display:flex;align-items:center;gap:8px;padding:10px;background:linear-gradient(180deg,#071037,#021026)}
#chat .body{padding:10px;height:280px;overflow:auto}
#chat .input{display:flex;padding:10px;border-top:1px solid rgba(255,255,255,0.03)}
#chat input{flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:#021324;color:#e6f6fb}
#chat button{background:#0ea5e9;border:none;padding:8px 10px;border-radius:8px;color:#021026;cursor:pointer}
.msg.user{background:#05203a;color:#bfe7ff;padding:8px;border-radius:8px;margin:8px 0 8px auto;max-width:80%}
.msg.bot{background:#00313e;color:#e6f6fb;padding:8px;border-radius:8px;margin:8px 0 8px 0;max-width:80%}
.links a{display:block;color:#9fe9ff;margin-top:6px}
#status { font-size:13px;margin-bottom:12px;color:#9ca3af }
</style>
</head>
<body>
<h1>T.B AGAR.IO (demo pagina)</h1>
<p id="status">Server status: <span id="srv">checking…</span></p>

<!-- Minimal content; replace with your full site markup -->
<p>Welkom — dit is een demo. De echte site bevat video, mod cards en menu.</p>
<div id="site-links">
  <p>Mod Menu: <a href="${SITE_BASE}mod-menu.html" target="_blank">${SITE_BASE}mod-menu.html</a></p>
  <p>Bite Bots: <a href="https://biteyt.com/bots" target="_blank">https://biteyt.com/bots</a></p>
  <p>Kahraba: <a href="https://kahraba.in" target="_blank">https://kahraba.in</a></p>
</div>

<!-- Chat widget -->
<div id="chat" aria-hidden="false">
  <header><strong>T.B Chat Bot</strong><div style="flex:1"></div><button id="close">✕</button></header>
  <div class="body" id="chatBody"></div>
  <div class="input">
    <input id="chatInput" placeholder="Typ hier je bericht..." />
    <button id="sendBtn">Stuur</button>
  </div>
</div>

<script>
const srvSpan = document.getElementById('srv');
fetch('/ping').then(r=>r.json()).then(j=> srvSpan.innerText = j.ok ? 'online' : 'offline').catch(()=>srvSpan.innerText='offline');

const chatBody = document.getElementById('chatBody');
const input = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const STORAGE_KEY = 'tb_chat_client_demo';
let state = { messages: [], lastActivity: Date.now() };
try { const raw = localStorage.getItem(STORAGE_KEY); if(raw) state = JSON.parse(raw); } catch (e) {}

function render(){
  chatBody.innerHTML = '';
  for(const m of state.messages){
    const d = document.createElement('div');
    d.className = 'msg ' + (m.role === 'user' ? 'user' : 'bot');
    d.innerText = m.text;
    chatBody.appendChild(d);
    if(m.links){
      const linksWrap = document.createElement('div'); linksWrap.className='links';
      m.links.forEach(l => {
        const a = document.createElement('a'); a.href = l.url; a.target = '_blank'; a.innerText = l.title + ' — ' + l.url;
        linksWrap.appendChild(a);
      });
      chatBody.appendChild(linksWrap);
    }
  }
  chatBody.scrollTop = chatBody.scrollHeight;
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function addUser(text){ state.messages.push({ role:'user', text, t: new Date().toISOString() }); save(); render(); }
function addBot(text, links){ const m = { role:'bot', text, t:new Date().toISOString() }; if(links) m.links = links; state.messages.push(m); save(); render(); }

async function sendToServer(message){
  try{
    const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId: localStorage.getItem('tb_session') || (function(){ const s='sess_'+Math.random().toString(36).slice(2,12); localStorage.setItem('tb_session', s); return s; })(), message }) });
    return await res.json();
  } catch(e){
    return { error:true, reply: 'Er is een fout opgetreden bij de server.' };
  }
}

sendBtn.addEventListener('click', async ()=> {
  const text = input.value.trim(); if(!text) return;
  addUser(text); input.value='';
  addBot('Even denken...', null); // transient visible
  const r = await sendToServer(text);
  // remove last transient bot if any
  // for simplicity, we won't remove but add actual reply
  if(r.error) addBot(r.reply || 'Server error'); else addBot(r.reply, r.links);
});

input.addEventListener('keydown', (e)=> { if(e.key === 'Enter') sendBtn.click(); });
render();
</script>
</body>
</html>`;

// Serve index
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(INDEX_HTML);
});

// health
app.get('/ping', (req, res) => res.json({ ok: true }));

// API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) return res.status(400).json({ error: 'sessionId and message required' });

    // immediate checks
    if (containsDisallowed(message)) {
      return res.json({ reply: `Ik kan geen code of scripts delen. Vraag T.B via Instagram: @t.bagar.io`, links: [{ title: 'Instagram', url: 'https://www.instagram.com/t.bagar.io/' }] });
    }

    const lc = message.toLowerCase();

    // direct mod match
    for (const k of Object.keys(modMap)){
      if (lc.includes(k)) {
        return res.json({ reply: `Hier is de link die je vroeg: ${modMap[k]}`, links: [{ title: k, url: modMap[k] }] });
      }
    }

    // general mod request -> canonical mod menu
    if (lc.includes('mod') || lc.includes('mods') || lc.includes('agario')) {
      const url = SITE_BASE + 'mod-menu.html';
      return res.json({ reply: `Voor mods kijk op de Mod Menu pagina: ${url}`, links: [{ title: 'Mod Menu', url }] });
    }

    // if no OPENAI key return fallback
    if (!OPENAI_API_KEY) {
      return res.json({ reply: "Server niet geconfigureerd met OpenAI API key. Plaats OPENAI_API_KEY in je .env en herstart de server." });
    }

    // Prepare system prompt
    const systemPrompt = `
You are T.B Chat Bot. Be helpful and polite and respond in the user's language.
IMPORTANT RULES:
- NEVER provide code, HTML, CSS, JavaScript, scripts, or instructions to create or obtain scripts. If asked, reply with refusal and instruct to contact Instagram @t.bagar.io.
- Only share known links: the canonical Mod Menu page or known mod links.
- Keep answers concise and friendly.
`;

    // Construct messages (no persistent session history in this simple demo)
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    // Call OpenAI
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_tokens: 600,
        temperature: 0.2
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('OpenAI error', data);
      return res.json({ error: true, reply: 'OpenAI returned an error. Check server logs.' });
    }

    const reply = data.choices?.[0]?.message?.content || 'Geen antwoord ontvangen.';
    // Safety double-check
    if (containsDisallowed(reply)) {
      return res.json({ reply: `Ik kan geen code of scripts delen. Vraag T.B via Instagram: @t.bagar.io`, links: [{ title: 'Instagram', url: 'https://www.instagram.com/t.bagar.io/' }] });
    }

    return res.json({ reply });

  } catch (err) {
    console.error('api/chat error', err);
    return res.status(500).json({ error: true, reply: 'Er is een fout opgetreden in de server. Controleer server logs.' });
  }
});

app.listen(PORT, () => {
  console.log('Server listening on port', PORT);
  console.log('SITE_BASE:', SITE_BASE);
});
