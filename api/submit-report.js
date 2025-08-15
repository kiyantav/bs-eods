const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { password, reportData } = req.body;

  // Validate password
  if (password !== process.env.ADMIN_PASSWORD && password !== process.env.BARBER_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Connect to Supabase
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

  // Insert report data
  const { data, error } = await supabase.from("daily_logs").insert(reportData);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ success: true, data });
};
