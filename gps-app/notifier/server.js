// Telegram notifier for Traccar (no dependencies). Receives Traccar event webhooks.
const http = require('http'), fs = require('fs');
const TOKEN = process.env.TELEGRAM_TOKEN, DIR = process.env.DATA_DIR || '/data', FILE = DIR + '/state.json';
let S = { chat: null, armed: true };
try { S = { ...S, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
if (process.env.TELEGRAM_CHAT_ID) S.chat = process.env.TELEGRAM_CHAT_ID;
if (!TOKEN) console.error('TELEGRAM_TOKEN is missing. Add it in Coolify > Environment Variables.');

const save = () => { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(S)); } catch (e) { console.error(e.message); } };
const tg = (m, b) => fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json()).catch(e => ({ ok: false, error: e.message }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const send = t => S.chat ? tg('sendMessage', { chat_id: S.chat, text: t }) : null;
const where = p => p ? `\nhttps://www.google.com/maps?q=${p.latitude},${p.longitude}${p.address ? '\n' + p.address : ''}\nSpeed: ${Math.round((p.speed || 0) * 1.852)} km/h` : '';

let movingSince = null, lastAlert = 0;
async function onEvent(d) {
  const ev = d.event || {}, p = d.position, name = (d.device && d.device.name) || 'Your motor';
  console.log('event', ev.type, name);
  if (!S.armed) return;
  if (ev.type === 'deviceMoving') {
    if (movingSince) return;
    movingSince = Date.now();
    if (Date.now() - lastAlert < 60000) return;
    lastAlert = Date.now();
    for (let i = 1; i <= 5; i++) { await send(`ALERT ${i}/5: Someone is using ${name}!${where(p)}`); await sleep(1500); }
  } else if (ev.type === 'deviceStopped') {
    if (!movingSince) return;
    const m = Math.max(1, Math.round((Date.now() - movingSince) / 60000)); movingSince = null;
    await send(`${name} has stopped after about ${m} min.${where(p)}`);
  } else if (ev.type === 'geofenceExit') {
    await send(`${name} left its guard zone!${where(p)}`);
  }
}

http.createServer((req, res) => {
  if (req.method !== 'POST') { res.end('ok'); return; }
  let b = ''; req.on('data', c => b += c);
  req.on('end', () => { res.end('ok'); try { onEvent(JSON.parse(b)).catch(e => console.error(e.message)); } catch (e) { console.error('bad payload'); } });
}).listen(3000, () => console.log('notifier listening on 3000'));

let off = 0;
(async function poll() {
  if (!TOKEN) return;
  for (;;) {
    const r = await tg('getUpdates', { offset: off, timeout: 25 });
    if (!r.ok) { await sleep(5000); continue; }
    for (const u of r.result || []) {
      off = u.update_id + 1; const m = u.message; if (!m || !m.text) continue;
      const id = String(m.chat.id), t = m.text.trim().toLowerCase();
      if (!S.chat && t.startsWith('/start')) { S.chat = id; save(); }
      if (id !== String(S.chat)) continue;
      if (t.startsWith('/start')) await send('Connected. I will message you when your motor moves or stops.\n/on - turn alerts on\n/off - pause alerts (when you ride it yourself)\n/status');
      else if (t === '/off') { S.armed = false; movingSince = null; save(); await send('Alerts paused. Send /on when you park.'); }
      else if (t === '/on') { S.armed = true; movingSince = null; save(); await send('Alerts are on.'); }
      else if (t === '/status') await send('Alerts are ' + (S.armed ? 'on' : 'paused'));
    }
  }
})();
