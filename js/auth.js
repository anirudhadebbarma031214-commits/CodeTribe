/* Authentication and public profile sync. All authorization is enforced by Supabase RLS. */
(() => {
  const client = () => window.supabaseClient;
  const state = { user: null, profile: null, listeners: new Set() };
  const emit = () => state.listeners.forEach(fn => fn({ ...state }));
  async function syncProfile(user) {
    if (!user || !client()) return null;
    const metadata = user.user_metadata || {};
    const row = {
      id: user.id,
      display_name: String(metadata.full_name || metadata.name || user.email || "Developer").slice(0,120),
      avatar_url: typeof metadata.avatar_url === "string" ? metadata.avatar_url.slice(0,1000) : null
    };
    const { data, error } = await client().from("users").upsert(row, { onConflict: "id" }).select().single();
    if (error) console.warn("Profile sync will retry later:", error.message);
    return data || row;
  }
  async function signIn() {
    if (!client()) throw new Error("Add your Supabase URL and anon/publishable key in js/config.js first.");
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await client().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { access_type: "offline", prompt: "select_account" } }
    });
    if (error) throw error;
  }
  async function signOut() {
    const { error } = await client().auth.signOut();
    if (error) throw error;
  }
  async function initialize() {
    if (!client()) { emit(); return; }
    const { data, error } = await client().auth.getSession();
    if (error) console.error("Session lookup failed:", error.message);
    state.user = data?.session?.user || null;
    state.profile = await syncProfile(state.user);
    emit();
    client().auth.onAuthStateChange((_event, session) => {
      state.user = session?.user || null;
      state.profile = null;
      emit();
      // Defer database work until after the auth callback to avoid locking auth state.
      if (state.user) setTimeout(async () => { state.profile = await syncProfile(state.user); emit(); }, 0);
    });
  }
  window.CodeTribeAuth = {
    get user() { return state.user; }, get profile() { return state.profile; },
    onChange(fn) { state.listeners.add(fn); fn({ ...state }); return () => state.listeners.delete(fn); },
    signIn, signOut, initialize
  };
})();