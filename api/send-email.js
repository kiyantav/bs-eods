const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer re_M6xv6YhJ_N5BECSukTEKzLqd8ggN3ANgn`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'contact@submissions.barbersmiths.co.uk',
        to: 'contact@barbersmiths.co.uk', // Hardcoded for test
        subject: 'Simple Test Email',       // Hardcoded for test
        html: '<h1>Test email from Resend!</h1>' // Hardcoded for test
      })
    });

    const result = await response.json();
    
    console.log('Resend response:', result); // For debugging
    
    res.status(response.status).json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
