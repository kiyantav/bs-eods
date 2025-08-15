const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Check for required environment variables
  if (!process.env.VITE_SUPABASE_URL) {
    res.status(500).json({ error: "VITE_SUPABASE_URL environment variable is missing" });
    return;
  }

  if (!process.env.VITA_SUPABASE_SERVICE_KEY) {
    res.status(500).json({ error: "VITE_SUPABASE_SERVICE_KEY environment variable is missing" });
    return;
  }

  const { password } = req.body;

  // Validate password
  if (password !== process.env.ADMIN_PASSWORD && password !== process.env.BARBER_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_KEY);

    // Fetch shops and barbers
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('id,name');

    if (shopsError) throw shopsError;

    const { data: barbers, error: barbersError } = await supabase
      .from('barbers')
      .select('id,name,shop_id');

    if (barbersError) throw barbersError;

    res.status(200).json({ 
      success: true, 
      shops: shops || [], 
      barbers: barbers || [] 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
