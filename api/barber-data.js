const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  console.log("API called. Method:", req.method);

  if (req.method !== "POST") {
    console.log("Method not allowed:", req.method);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Log environment variables
  console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL);
  console.log("VITE_SUPABASE_KEY:", process.env.VITE_SUPABASE_KEY);
  console.log("ADMIN_PASSWORD:", process.env.ADMIN_PASSWORD ? "set" : "missing");
  console.log("BARBER_PASSWORD:", process.env.BARBER_PASSWORD ? "set" : "missing");

  if (!process.env.VITE_SUPABASE_URL) {
    console.log("Missing VITE_SUPABASE_URL");
    res.status(500).json({ error: "VITE_SUPABASE_URL environment variable is missing" });
    return;
  }

  if (!process.env.VITE_SUPABASE_KEY) {
    console.log("Missing VITE_SUPABASE_KEY");
    res.status(500).json({ error: "VITE_SUPABASE_KEY environment variable is missing" });
    return;
  }

  let body = req.body;
  // Some platforms require parsing the body
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.log("Error parsing body:", e);
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  }

  const { password } = body;
  console.log("Password received:", password ? "yes" : "no");

  // Validate password
  if (password !== process.env.ADMIN_PASSWORD && password !== process.env.BARBER_PASSWORD) {
    console.log("Password validation failed");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  console.log("Password validation passed");

  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);
    console.log("Supabase client created");

    // Fetch shops
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('id,name');
    if (shopsError) {
      console.log("Shops fetch error:", shopsError);
      throw shopsError;
    }
    console.log("Shops fetched:", shops ? shops.length : 0);

    // Fetch barbers
    const { data: barbers, error: barbersError } = await supabase
      .from('barbers')
      .select('id,name,shop_id');
    if (barbersError) {
      console.log("Barbers fetch error:", barbersError);
      throw barbersError;
    }
    console.log("Barbers fetched:", barbers ? barbers.length : 0);

    res.status(200).json({ 
      success: true, 
      shops: shops || [], 
      barbers: barbers || [] 
    });

  } catch (error) {
    console.log("Catch block error:", error);
    res.status(500).json({ error: error.message });
  }
};
