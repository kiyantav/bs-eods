const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  console.log("API called with method:", req.method);
  console.log("Request body:", req.body);
  
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { password } = req.body;
  console.log("Password received:", password ? "YES" : "NO");

  // Check environment variables
  console.log("VITA_SUPABASE_URL exists:", !!process.env.VITA_SUPABASE_URL);
  console.log("VITA_SUPABASE_SERVICE_KEY exists:", !!process.env.VITA_SUPABASE_SERVICE_KEY);
  console.log("ADMIN_PASSWORD exists:", !!process.env.ADMIN_PASSWORD);
  console.log("BARBER_PASSWORD exists:", !!process.env.BARBER_PASSWORD);

  // Validate password
  if (password !== process.env.ADMIN_PASSWORD && password !== process.env.BARBER_PASSWORD) {
    console.log("Password validation failed");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  console.log("Password validation passed");

  try {
    const supabase = createClient(process.env.VITA_SUPABASE_URL, process.env.VITA_SUPABASE_SERVICE_KEY);
    console.log("Supabase client created");

    // Fetch shops and barbers
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('id,name');

    if (shopsError) {
      console.log("Shops error:", shopsError);
      throw shopsError;
    }

    console.log("Shops fetched:", shops?.length || 0);

    const { data: barbers, error: barbersError } = await supabase
      .from('barbers')
      .select('id,name,shop_id');

    if (barbersError) {
      console.log("Barbers error:", barbersError);
      throw barbersError;
    }

    console.log("Barbers fetched:", barbers?.length || 0);

    res.status(200).json({ 
      success: true, 
      shops: shops || [], 
      barbers: barbers || [] 
    });

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
};
