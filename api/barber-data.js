import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { password } = req.body;

  // Validate password
  if (password !== process.env.ADMIN_PASSWORD && password !== process.env.BARBER_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

  try {
    // Fetch shops and barbers for form population
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
}
