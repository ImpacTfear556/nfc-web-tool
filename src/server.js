const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { NFC } = require('nfc-pcsc');
const ndef = require('ndef');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

wss.on('connection', ws => {
  console.log('websocket connected');
  ws.on('message', msg => {
    try {
      const j = JSON.parse(msg);
      if (j.cmd === 'write') {
        broadcast({ type: 'request-write', payload: j.payload });
      }
    } catch (e) {}
  });
});

function broadcast(obj) {
  const s = JSON.stringify(obj);
  wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(s));
}

const nfc = new NFC();

nfc.on('reader', reader => {
  console.log(`Reader ${reader.name} attached`);

  reader.on('card', async card => {
    console.log(`Card detected`, card);
    broadcast({ type: 'card', uid: card.uid });

    try {
      const data = await reader.read(4, 16);
      broadcast({ type: 'raw-data', data: data.toString('hex') });

      try {
        const msgs = ndef.decodeMessage(data);
        const records = msgs.map(r => ndef.text.decodePayload(r.payload));
        broadcast({ type: 'ndef', records });
      } catch {}
    } catch (e) {
      console.log('read error:', e);
    }
  });

  reader.on('error', err => console.error(`Reader ${reader.name} error`, err));
  reader.on('end', () => console.log(`Reader ${reader.name} removed`));
});

nfc.on('error', err => console.error('NFC error', err));

server.listen(3000, () => console.log('Server running at http://localhost:3000'));
