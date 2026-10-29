/* Public browser configuration only. Never put a Supabase service_role key here. */
(() => {
  const CONFIG = {
    SUPABASE_URL: "https://xocizxszrqiexfxculsa.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_kkoFxldELeXQCUXTYpr_Qg_mejrPEyD"
  };
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(CONFIG.SUPABASE_URL)
    && !CONFIG.SUPABASE_ANON_KEY.includes("YOUR_");
  window.CodeTribeConfig = Object.freeze({ ...CONFIG, configured });
  window.supabaseClient = configured
    ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
})();