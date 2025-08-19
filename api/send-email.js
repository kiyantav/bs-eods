export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, // stored in Vercel env vars
        'Content-Type': 'application/json',
      },
       body: JSON.stringify({
        from: 'Submissions <contact@submissions.barbersmiths.co.uk>',
        to: ['contact@barbersmiths.co.uk'],
        subject: 'hello world',
        html: '<strong>it works!</strong>',
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
