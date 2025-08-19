export default async function handler(req, res) {
  console.log('📧 /api/send-email invoked');
  console.log('Method:', req.method);
  try {
    // log raw headers and body
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY');
      return res.status(500).json({ error: 'Missing RESEND_API_KEY' });
    }

    // Use incoming body or fallback
    const payload = (req.body && Object.keys(req.body).length) ? req.body : {
      from: 'Acme <onboarding@resend.dev>',
      to: ['delivered@resend.dev'],
      subject: 'hello world',
      html: '<strong>it works!</strong>'
    };

    console.log('Calling Resend with:', payload);

    const fetchResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const respText = await fetchResp.text();
    console.log('Resend status:', fetchResp.status, 'body:', respText);

    // return raw response text if not JSON
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
