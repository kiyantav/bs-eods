module.exports = async function handler(req, res) {
  console.log('📧 Send email endpoint hit!');
  console.log('Method:', req.method);
  
  if (req.method !== "POST") {
    console.log('❌ Method not allowed');
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  console.log('🚀 Attempting to send email...');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer re_M6xv6YhJ_N5BECSukTEKzLqd8ggN3ANgn`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'contact@submissions.barbersmiths.co.uk',
        to: 'contact@barbersmiths.co.uk',
        subject: 'Simple Test Email',
        html: '<h1>Test email from Resend!</h1>'
      })
    });

    const result = await response.json();
    
    console.log('✅ Resend response:', result);
    
    res.status(response.status).json(result);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};
