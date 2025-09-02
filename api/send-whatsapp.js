export default async function handler(req, res) {
  // Diagnostic logging (do not log secrets)
  console.log('send-whatsapp: called, method=', req.method);

  if (req.method !== 'POST') {
    console.log('send-whatsapp: wrong method');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    to,
    message,
    shop,
    templateName,
    templateParams,
    templateLanguage = 'en'
  } = req.body || {};

  console.log('send-whatsapp: incoming body keys =', Object.keys(req.body || {}));

  if (!message && !templateName) {
    console.log('send-whatsapp: missing message AND templateName');
    return res.status(400).json({ error: 'Missing message or templateName' });
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  console.log('send-whatsapp: token present?', !!token, 'phoneId present?', !!phoneId);
  if (!token || !phoneId) {
    console.log('send-whatsapp: missing env config');
    return res.status(500).json({ error: 'Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID' });
  }

  // Resolve recipient
  let recipient = null;
  if (typeof to === 'string' && to.trim()) {
    recipient = to.replace(/^\+/, '').trim();
    console.log('send-whatsapp: using "to" from request (masked)');
  }
  if (!recipient && shop) {
    try {
      const mapJson = process.env.SHOP_RECIPIENTS_JSON || '{}';
      const shopMap = JSON.parse(mapJson);
      if (shopMap && shopMap[shop]) {
        recipient = String(shopMap[shop]).replace(/^\+/, '').trim();
        console.log('send-whatsapp: resolved recipient from SHOP_RECIPIENTS_JSON for shop (masked)');
      } else {
        console.log('send-whatsapp: shop provided but not found in SHOP_RECIPIENTS_JSON', shop);
      }
    } catch (e) {
      console.log('send-whatsapp: failed to parse SHOP_RECIPIENTS_JSON', e.message);
    }
  }
  if (!recipient && process.env.DEFAULT_WHATSAPP_TO) {
    recipient = String(process.env.DEFAULT_WHATSAPP_TO).replace(/^\+/, '').trim();
    console.log('send-whatsapp: using DEFAULT_WHATSAPP_TO (masked)');
  }
  if (!recipient) {
    console.log('send-whatsapp: no recipient available, aborting');
    return res.status(400).json({ error: 'Missing recipient. Provide "to" in body, map shop in SHOP_RECIPIENTS_JSON, or set DEFAULT_WHATSAPP_TO env.' });
  }

  const url = `https://graph.facebook.com/v16.0/${phoneId}/messages`;

  // Build payload
    let payload;
  if (templateName) {
    // Minimal template test - no parameters first
    payload = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: String(templateName),
        language: { code: String(templateLanguage || 'en') }
        // no components/parameters for now
      }
    };
    console.log('send-whatsapp: prepared simple template payload (no params)');
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body: String(message) }
    };
    console.log('send-whatsapp: prepared text payload (message length =', String(message).length, ')');
  }

  console.log('send-whatsapp: sending request to provider', {
    url,
    payloadSummary: { messaging_product: payload.messaging_product, to: '[REDACTED]', type: payload.type }
  });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`, // do not log token
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    console.log('send-whatsapp: provider response status=', resp.status);

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
    return res.status(500).json({ error: err.message || String(err) });
  }
}
