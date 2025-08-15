const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { password } = req.body;

  // Only admin can access this data
  if (password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

  try {
    // Fetch logs with joins
    const { data: logs, error: logsError } = await supabase
      .from('daily_logs')
      .select('id,date,cash_total,cash_float,notes,haircuts,barbers(id,name),shops(id,name)')
      .order('date', { ascending: false });

    if (logsError) throw logsError;

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
      logs: logs || [], 
      shops: shops || [], 
      barbers: barbers || [] 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
