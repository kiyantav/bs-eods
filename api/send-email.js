const fetch = require('node-fetch'); // For Node.js v18+ you can use global fetch

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { to, subject, html } = req.body;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer re_M6xv6YhJ_N5BECSukTEKzLqd8ggN3ANgn`, // Replace with your actual API key
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'contact@barbersmiths.co.uk', // Use a verified sender address
        to: 'contact@barbersmiths.co.uk',
        subject: 'Daily Submission',
        html: '<p>Test submission</p>'
      })
    });

    const result = await response.json();
    res.status(response.status).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

