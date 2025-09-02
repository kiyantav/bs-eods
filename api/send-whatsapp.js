export default async function handler(req, res) {
  console.log('send-whatsapp: called, method=', req.method);
  console.log('send-whatsapp: raw body=', req.body);

  if (req.method !== 'POST') {
    console.log('send-whatsapp: wrong method');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, message, shop } = req.body || {};
  if (!message) {
    console.log('send-whatsapp: missing message field');
    return res.status(400).json({ error: 'Missing message' });
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  console.log('send-whatsapp: token present?', !!token, 'phoneId present?', !!phoneId);
  if (!token || !phoneId) {
    console.log('send-whatsapp: missing env config');
    return res.status(500).json({ error: 'Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID' });
  }

  const defaultTo = process.env.DEFAULT_WHATSAPP_TO || null;

  // determine recipient (do not log final recipient if null)
  let recipient = null;
  if (to) recipient = String(to).replace(/^\+/, '').trim();
  if (!recipient && shop) {
    // recipient = SHOP_RECIPIENTS[shop] ? SHOP_RECIPIENTS[shop].replace(/^\+/, '') : null;
    recipient = null;
    console.log('send-whatsapp: shop provided but no SHOP_RECIPIENTS configured', shop);
  }
  if (!recipient && defaultTo) recipient = String(defaultTo).replace(/^\+/, '').trim();

  console.log('send-whatsapp: resolved recipient present?', !!recipient, recipient ? '[REDACTED]' : null);
  if (!recipient) {
    console.log('send-whatsapp: no recipient available, aborting');
    return res.status(400).json({ error: 'Missing recipient. Provide "to" in body or set DEFAULT_WHATSAPP_TO env.' });
  }

  const url = `https://graph.facebook.com/v16.0/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'text',
    text: { body: message }
  };

  console.log('send-whatsapp: sending request to provider', { url, payload: { messaging_product: payload.messaging_product, to: '[REDACTED]', type: payload.type } });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    // Log provider response body (may contain error details)
    console.log('send-whatsapp: provider response status=', resp.status);
    // try parse JSON for nicer logging
    try {
      const json = JSON.parse(text);
      console.log('send-whatsapp: provider response body json=', json);
      return res.status(resp.status).json(json);
    } catch (parseErr) {
      console.log('send-whatsapp: provider response body text=', text);
      return res.status(resp.status).send(text);
    }
  } catch (err) {
    console.error('send-whatsapp error:', err);
    return res.status(500).json({ error: err.message });
  }
}
