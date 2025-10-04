import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

// ---- WhatsApp creds from .env ----
const TOKEN = process.env.WHATSAPP_TOKEN;            // long-lived
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID; // numeric id
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'changeme';

// ---- Webhook VERIFY (GET) ----
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---- Webhook RECEIVE (POST) ----
app.post('/webhook', (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const msgs = value?.messages;
    const statuses = value?.statuses;

    if (msgs?.length) {
      const m = msgs[0];
      console.log('[INBOUND]', { from: m.from, type: m.type, text: m.text?.body });
      // TODO: insert into Supabase & increment counters
    }

    if (statuses?.length) {
      const s = statuses[0];
      console.log('[STATUS]', { id: s.id, status: s.status, timestamp: s.timestamp });
      // TODO: store delivery/read analytics
    }

    res.sendStatus(200);
  } catch (e) {
    console.error('Webhook error:', e);
    res.sendStatus(200);
  }
});

// ---- Simple send endpoint ----
app.post('/api/send-text', async (req, res) => {
  const { to, body } = req.body || {};
  if (!to || !body) return res.status(400).json({ error: 'to and body required' });

  try {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to, // E.164, e.g. "2547XXXXXXXX"
        type: 'text',
        text: { body }
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('WA send failed:', data);
      return res.status(500).json(data);
    }
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'send failed' });
  }
});

const PORT = process.env.PORT || 5174; // anything free
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
