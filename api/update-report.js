const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const body = req.body || {};
    const { id, haircuts, notes, cashTotal, cashFloat, password } = body;

    console.log('Update request received:', { method: req.method, body });

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing id' });
    }

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

    const updates = {};
    if (typeof haircuts !== 'undefined') updates.haircuts = Number(haircuts) || 0;
    if (typeof notes !== 'undefined') updates.notes = notes || '';
    if (typeof cashTotal !== 'undefined') updates.cash_total = Number(cashTotal) || 0;
    if (typeof cashFloat !== 'undefined') updates.cash_float = Number(cashFloat) || 0;

    const { data, error } = await supabase
      .from('daily_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error', error);
      return res.status(500).json({ success: false, error: error.message || error });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('update-report handler error', err);
    return res.status(500).json({ success: false, error: String(err?.message || err) });
  }
};
