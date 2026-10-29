/* Public browser configuration only. Never put a Supabase service_role key here. */
(() => {
  const CONFIG = {
    SUPABASE_URL: "YOUR_SUPABASE_PROJECT_URL",
    SUPABASE_ANON_KEY: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
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