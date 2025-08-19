module.exports = async function handler(req, res) {
  try {
    const response = await fetch('https://api.resend.com/emails', { // Changed from 'res' to 'response'
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer re_M6xv6YhJ_N5BECSukTEKzLqd8ggN3ANgn`,
      },
      body: JSON.stringify({
        from: 'Submissions <contact@submissions.barbersmiths.co.uk>',
        to: ['contact@barbersmiths.co.uk'],
        subject: 'hello world',
        html: '<strong>it works!</strong>',
      }),
    });

    const result = await response.json(); // Changed from 'res' to 'response'
    res.status(response.status).json(result); // Use 'response.status' not 'res.status'
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};

