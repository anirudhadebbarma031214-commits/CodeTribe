/* Project feed and submission. Supabase Row Level Security is the source of truth. */
(() => {
  const client = () => window.supabaseClient;
  const selectFields = "id,title,description,project_url,tech_stack,screenshot_url,user_id,created_at,codetribe_users(display_name,avatar_url)";
  function validHttpUrl(value) {
    try { const u = new URL(value); return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password; }
    catch { return false; }
  }
  function validGitHubRepo(value) {
    if (!validHttpUrl(value)) return false;
    const u = new URL(value);
    return u.hostname.toLowerCase() === "github.com" && u.pathname.split("/").filter(Boolean).length >= 2;
  }
  async function listProjects() {
    if (!client()) return [];
    const { data, error } = await client().from("codetribe_projects").select(selectFields).order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    return data || [];
  }
  async function createProject(input) {
    const user = window.CodeTribeAuth.user;
    if (!user) throw new Error("Sign in with Google before submitting a project.");
    const title = String(input.title || "").trim();
    const description = String(input.description || "").trim();
    const project_url = String(input.project_url || "").trim();
    const screenshot_url = String(input.screenshot_url || "").trim();
    const tech_stack = String(input.tech_stack || "").split(",").map(s => s.trim()).filter(Boolean).slice(0,8);
    if (title.length < 2 || title.length > 80) throw new Error("Project name must be 2–80 characters.");
    if (description.length < 10 || description.length > 500) throw new Error("Description must be 10–500 characters.");
    if (!validGitHubRepo(project_url)) throw new Error("Enter a valid GitHub repository URL, like https://github.com/owner/repo.");
    if (screenshot_url && !validHttpUrl(screenshot_url)) throw new Error("Screenshot must be a valid HTTP or HTTPS URL.");
    const { data, error } = await client().from("codetribe_projects").insert({
      user_id: user.id, title, description, project_url,
      tech_stack, screenshot_url: screenshot_url || null
    }).select(selectFields).single();
    if (error) throw error;
    return data;
  }
  async function deleteProject(id) {
    if (!window.CodeTribeAuth.user) throw new Error("Sign in first.");
    const { error } = await client().from("codetribe_projects").delete().eq("id", id);
    if (error) throw error;
  }
  window.CodeTribeDB = { listProjects, createProject, deleteProject, validHttpUrl };
})();