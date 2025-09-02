export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' });

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return res.status(500).json({ error: 'Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID' });

  try {
    const resp = await fetch(`https://graph.facebook.com/v16.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: '447464476506',
        type: 'text',
        text: { body: message }
      })
    });

    const text = await resp.text();
    try { return res.status(resp.status).json(JSON.parse(text)); } catch { return res.status(resp.status).send(text); }
  } catch (err) {
    console.error('send-whatsapp error', err);
    return res.status(500).json({ error: err.message });
  }
}
