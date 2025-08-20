export default async function handler(req, res) {
  console.log('📧 /api/send-email invoked');
  console.log('Method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY');
    return res.status(500).json({ error: 'Missing RESEND_API_KEY' });
  }

  const { from, to, subject, html } = req.body || {};
  if (!from || !to || !subject || !html) {
    console.error('Missing required email fields');
    return res.status(400).json({ error: 'Missing required email fields: from, to, subject, html' });
  }

  try {
    const fetchResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, subject, html })
    });

    const respText = await fetchResp.text();
    console.log('Resend status:', fetchResp.status, 'body:', respText);

    try {
      const json = JSON.parse(respText);
      return res.status(fetchResp.status).json(json);
    } catch {
      return res.status(fetchResp.status).send(respText);
    }
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
