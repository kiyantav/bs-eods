module.exports = async function handler(req, res) {
  console.log('📧 Send email endpoint hit!'); // Add this line
  console.log('Method:', req.method); // Add this line
  
  if (req.method !== "POST") {
    console.log('❌ Method not allowed'); // Add this line
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  console.log('🚀 Attempting to send email...'); // Add this line

  try {
   const res = await fetch('https://api.resend.com/emails', {
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

    const result = await res.json();

    console.log('✅ Resend response:', result);

    res.status(res.status).json(result);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};


