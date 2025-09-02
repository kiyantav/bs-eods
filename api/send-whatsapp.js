// ...existing code...
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, message, shop } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return res.status(500).json({ error: 'Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID' });

  // choose recipient:
  // 1) prefer 'to' from request
  // 2) fallback to DEFAULT_WHATSAPP_TO env (configure in your host)
  // 3) optional: map shop -> number (uncomment & configure below)
  const defaultTo = process.env.DEFAULT_WHATSAPP_TO || null;

  // optional static mapping (avoid embedding real numbers in source)
  // const SHOP_RECIPIENTS = {
  //   islington: process.env.WHATSAPP_TO_ISLINGTON,
  //   marylebone: process.env.WHATSAPP_TO_MARYLEBONE,
  //   shoreditch: process.env.WHATSAPP_TO_SHOREDITCH,
  //   richmond: process.env.WHATSAPP_TO_RICHMOND
  // };

  let recipient = null;
  if (to) recipient = String(to).replace(/^\+/, '').trim(); // strip leading '+'
  // fallback to shop mapping if provided
  if (!recipient && shop) {
    // if you use SHOP_RECIPIENTS, pick this line instead:
    // recipient = SHOP_RECIPIENTS[shop] ? SHOP_RECIPIENTS[shop].replace(/^\+/, '') : null;
    recipient = null;
  }
  if (!recipient && defaultTo) recipient = String(defaultTo).replace(/^\+/, '').trim();

  if (!recipient) {
    return res.status(400).json({ error: 'Missing recipient. Provide "to" in body or set DEFAULT_WHATSAPP_TO env.' });
  }

  try {
    const resp = await fetch(`https://graph.facebook.com/v16.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
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
