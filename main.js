const { app, BrowserWindow, ipcMain, screen, safeStorage, globalShortcut, session, desktopCapturer, shell } = require('electron');
const http = require('http'), fs = require('fs'), path = require('path');

const PORT = 47821;
const DEF = {
  provider: 'groq',
  providers: {
    groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', key: '' },
    cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', model: 'llama3.1-8b', key: '' },
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct:free', key: '' },
    nvidia: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'meta/llama-3.3-70b-instruct', key: '' },
    github: { url: 'https://models.github.ai/inference/chat/completions', model: 'openai/gpt-4.1-mini', key: '' },
    google: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-3.8-flash', key: '' }
  }
};
const cfgFile = () => path.join(app.getPath('userData'), 'config.json');
const enc = k => (k && safeStorage.isEncryptionAvailable()) ? 'enc:' + safeStorage.encryptString(k).toString('base64') : 'raw:' + k;
const dec = s => !s ? '' : s.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(s.slice(4), 'base64')) : s.slice(4);

function load() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); } catch {}
  const cfg = JSON.parse(JSON.stringify(DEF));
  cfg.provider = saved.provider || cfg.provider;
  for (const n in cfg.providers) {
    const s = (saved.providers || {})[n] || {};
    if (s.model) cfg.providers[n].model = s.model;
    try { cfg.providers[n].key = dec(s.key); } catch { cfg.providers[n].key = ''; }
  }
  return cfg;
}
function save(cfg) {
  const out = { provider: cfg.provider, providers: {} };
  for (const n in cfg.providers) out.providers[n] = { model: cfg.providers[n].model, key: enc(cfg.providers[n].key) };
  fs.writeFileSync(cfgFile(), JSON.stringify(out));
}
const pub = cfg => ({
  provider: cfg.provider,
  providers: Object.fromEntries(Object.entries(cfg.providers).map(([n, p]) => [n, { model: p.model, hasKey: !!p.key }]))
});

let win;
function place(w, h) {
  const wa = screen.getPrimaryDisplay().workArea;
  win.setBounds({ x: Math.round(wa.x + (wa.width - w) / 2), y: wa.y, width: w, height: h });
}

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) return app.quit();
  win = new BrowserWindow({
    width: 300, height: 56, frame: false, transparent: true, resizable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  // lets the page capture system sound (Windows loopback) via getDisplayMedia
  session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => {
    desktopCapturer.getSources({ types: ['screen'] }).then(src => cb({ video: src[0], audio: 'loopback' }));
  });
  win.loadFile('index.html');
  win.once('ready-to-show', () => { place(300, 56); win.show(); });

  globalShortcut.register('CommandOrControl+Shift+Space', () => win.webContents.send('toggle'));
  globalShortcut.register('CommandOrControl+Shift+R', () => win.webContents.send('toggle-rec'));

  // eyes follow the cursor anywhere on screen
  let last = '';
  setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const c = screen.getCursorScreenPoint(), b = win.getBounds();
    const k = c.x + ',' + c.y;
    if (k !== last) { last = k; win.webContents.send('cursor', { x: c.x - b.x, y: c.y - b.y }); }
  }, 60);

  // local endpoint for agent hooks (Claude Code, etc.) – 127.0.0.1 only
  http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/event') { res.writeHead(404); return res.end(); }
    let body = '';
    req.on('data', d => { body += d; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { win.webContents.send('agent', JSON.parse(body)); } catch {}
      res.writeHead(200); res.end('ok');
    });
  }).listen(PORT, '127.0.0.1');
});

ipcMain.handle('getConfig', () => pub(load()));
ipcMain.handle('saveConfig', (_e, u) => {
  const cfg = load();
  cfg.provider = u.provider || cfg.provider;
  for (const n in u.providers || {}) {
    if (!cfg.providers[n]) continue;
    if (u.providers[n].model) cfg.providers[n].model = u.providers[n].model.trim();
    if (u.providers[n].key) cfg.providers[n].key = u.providers[n].key.trim();
  }
  save(cfg);
  return pub(cfg);
});
const recDir = () => { const d = path.join(app.getPath('documents'), 'Cotton Candy Recordings'); fs.mkdirSync(d, { recursive: true }); return d; };
ipcMain.handle('saveRec', (_e, buf) => {
  const name = 'rec-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.webm';
  fs.writeFileSync(path.join(recDir(), name), Buffer.from(buf));
  return name;
});
ipcMain.on('openRecs', () => shell.openPath(recDir()));

// local speech-to-text (Whisper via transformers.js); model downloads once, then works offline
let asr;
ipcMain.handle('transcribe', async (e, audio) => {
  if (!asr) {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = path.join(app.getPath('userData'), 'models');
    asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { progress_callback: p => e.sender.send('stt-progress', p) });
  }
  const out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' });
  return (out.text || '').trim();
});
ipcMain.handle('listModels', async (_e, n, k) => {
  const p = load().providers[n], key = k || (p && p.key);
  if (!p || !key) return { error: 'Paste a key first.' };
  try {
    const url = n === 'github' ? 'https://models.github.ai/catalog/models' : p.url.replace('/chat/completions', '/models');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + key } });
    if (!r.ok) return { error: `${r.status}: ${(await r.text()).slice(0, 120)}` };
    const j = await r.json();
    let ids = (Array.isArray(j) ? j : j.data || j.models || []).map(m => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean);
    if (n === 'google') ids = ids.filter(i => /gemini|gemma/.test(i));
    if (n === 'openrouter') ids = ids.filter(i => i.endsWith(':free'));
    return { ids: ids.sort() };
  } catch (e) { return { error: String(e.message || e) }; }
});
ipcMain.on('resize', (_e, w, h) => place(w, h));
ipcMain.on('quit', () => app.quit());

ipcMain.on('chat', async (e, { provider, messages }) => {
  const s = e.sender, p = load().providers[provider];
  if (!p || !p.key) return s.send('err', `No key saved for ${provider}. Open settings (gear icon) and paste one.`);
  try {
    const r = await fetch(p.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + p.key },
      body: JSON.stringify({ model: p.model, messages, stream: true, max_tokens: 1024 })
    });
    if (!r.ok) return s.send('err', `${provider} returned ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const td = new TextDecoder(); let buf = '';
    for await (const chunk of r.body) {
      buf += td.decode(chunk, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) {
        if (!l.startsWith('data:')) continue;
        const d = l.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        try { const t = JSON.parse(d).choices?.[0]?.delta?.content; if (t) s.send('chunk', t); } catch {}
      }
    }
    s.send('done');
  } catch (err) { s.send('err', String(err.message || err)); }
});

app.on('will-quit', () => globalShortcut.unregisterAll());
