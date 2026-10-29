/* UI rendering, search, form actions, and event wiring. User content is escaped or
   inserted with textContent to prevent HTML injection. */
(() => {
  const $ = id => document.getElementById(id);
  let projects = [], toastTimer;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const dateLabel = value => new Date(value).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
  function toast(message) {
    $("toast").textContent = message; $("toast").classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3200);
  }
  function renderAuth({ user, profile }) {
    $("signInBtn").classList.toggle("hidden", !!user);
    $("userMenu").classList.toggle("hidden", !user);
    $("submitProjectBtn").classList.toggle("hidden", !user);
    $("heroSubmitBtn").textContent = user ? "Share your work ↗" : "Share your work ↗";
    const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url;
    $("userAvatar").src = avatar || "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="#263044"/><text x="20" y="26" font-size="20" text-anchor="middle" fill="#c7f36b">✳</text></svg>');
    $("userAvatar").alt = user ? "Signed-in profile" : "";
  }
  function card(project, index) {
    const owner = project.users || {};
    const stack = Array.isArray(project.tech_stack) ? project.tech_stack : [];
    const screenshot = project.screenshot_url && window.CodeTribeDB.validHttpUrl(project.screenshot_url) ? project.screenshot_url : "";
    const initials = (owner.display_name || "D").trim().charAt(0).toUpperCase();
    return '<article class="project-card" style="animation-delay:' + Math.min(index * 45, 300) + 'ms">' +
      '<div class="project-image">' + (screenshot ? '<img src="' + esc(screenshot) + '" alt="' + esc(project.title) + ' screenshot" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') +
      '<span class="image-placeholder" aria-hidden="true">&lt;/&gt;</span><span class="image-tag">COMMUNITY BUILD</span></div>' +
      '<div class="project-body"><div class="project-topline"><h3>' + esc(project.title) + '</h3><span class="project-date">' + esc(dateLabel(project.created_at)) + '</span></div>' +
      '<p class="project-description">' + esc(project.description) + '</p><div class="tech-list">' + (stack.length ? stack.slice(0,6).map(t => '<span class="tech-pill">' + esc(t) + '</span>').join("") : '<span class="tech-pill">Open source</span>') + '</div>' +
      '<div class="card-footer"><div class="creator">' + (owner.avatar_url ? '<img src="' + esc(owner.avatar_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '<span class="creator-fallback">' + esc(initials) + '</span>') +
      '<span class="creator-name">' + esc(owner.display_name || "Community developer") + '</span></div><div class="card-actions"><a class="repo-link" href="' + esc(project.project_url) + '" target="_blank" rel="noopener noreferrer">GitHub ↗</a>' +
      '<button class="btn btn-primary talk-btn" data-project-id="' + esc(project.id) + '">Talk with Dev</button></div></div></div></article>';
  }
  function renderFeed() {
    const query = $("searchInput").value.trim().toLowerCase();
    const sorted = [...projects].sort((a,b) => $("sortSelect").value === "oldest" ? new Date(a.created_at)-new Date(b.created_at) : new Date(b.created_at)-new Date(a.created_at));
    const filtered = sorted.filter(p => [p.title,p.description,...(p.tech_stack || []),p.users?.display_name].join(" ").toLowerCase().includes(query));
    $("projectGrid").innerHTML = filtered.map(card).join("");
    $("projectCount").textContent = projects.length;
    $("emptyState").classList.toggle("hidden", filtered.length !== 0);
    $("projectGrid").classList.toggle("hidden", filtered.length === 0);
    $("feedStatus").textContent = projects.length ? (filtered.length + " PROJECT" + (filtered.length === 1 ? "" : "S") + " IN THE FEED") : "";
    $("emptySubmitBtn").textContent = window.CodeTribeAuth.user ? "Submit the first project" : "Sign in to submit";
  }
  async function loadProjects() {
    if (!window.CodeTribeConfig.configured) {
      $("feedStatus").textContent = "SETUP REQUIRED · ADD YOUR SUPABASE KEYS IN js/config.js";
      projects = []; renderFeed(); return;
    }
    $("feedStatus").textContent = "LOADING COMMUNITY PROJECTS…";
    try { projects = await window.CodeTribeDB.listProjects(); renderFeed(); }
    catch (error) { $("feedStatus").textContent = "Could not load projects. Check your Supabase schema and RLS policies."; console.error(error); toast("Feed error: " + error.message); }
  }
  function openProjectForm() {
    if (!window.CodeTribeConfig.configured) { toast("Add your Supabase settings in js/config.js first."); return; }
    if (!window.CodeTribeAuth.user) { window.CodeTribeAuth.signIn().catch(e => toast(e.message)); return; }
    $("projectForm").reset(); $("projectFormError").textContent = ""; $("projectDialog").showModal();
  }
  async function submitProject(event) {
    event.preventDefault(); $("projectFormError").textContent = "";
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = "Publishing…";
    try {
      await window.CodeTribeDB.createProject(Object.fromEntries(form.entries()));
      $("projectDialog").close(); toast("Project published — welcome to the tribe!");
      await loadProjects(); $("explore").scrollIntoView({ behavior:"smooth" });
    } catch (error) { $("projectFormError").textContent = error.message || "Could not submit this project."; }
    finally { button.disabled = false; button.innerHTML = 'Publish project <span>↗</span>'; }
  }
  async function signIn() {
    try { await window.CodeTribeAuth.signIn(); }
    catch (error) { toast(error.message || "Google sign-in failed."); }
  }
  async function signOut() {
    try { await window.CodeTribeAuth.signOut(); toast("You have signed out."); }
    catch (error) { toast(error.message || "Sign-out failed."); }
  }
  function wire() {
    $("year").textContent = new Date().getFullYear();
    $("signInBtn").addEventListener("click", signIn);
    $("signOutBtn").addEventListener("click", signOut);
    $("submitProjectBtn").addEventListener("click", openProjectForm);
    $("heroSubmitBtn").addEventListener("click", openProjectForm);
    $("emptySubmitBtn").addEventListener("click", openProjectForm);
    $("projectForm").addEventListener("submit", submitProject);
    $("messageForm").addEventListener("submit", window.CodeTribeChat.send);
    $("searchInput").addEventListener("input", renderFeed);
    $("sortSelect").addEventListener("change", renderFeed);
    document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => {
      const dialog = $(btn.dataset.close); dialog.close(); if (dialog.id === "chatDialog") window.CodeTribeChat.close();
    }));
    ["projectDialog","chatDialog"].forEach(id => $(id).addEventListener("click", e => {
      if (e.target === $(id)) { $(id).close(); if (id === "chatDialog") window.CodeTribeChat.close(); }
    }));
    $("projectGrid").addEventListener("click", e => {
      const btn = e.target.closest(".talk-btn"); if (!btn) return;
      const project = projects.find(p => String(p.id) === btn.dataset.projectId);
      if (project) window.CodeTribeChat.open(project);
    });
    window.CodeTribeAuth.onChange(state => { renderAuth(state); renderFeed(); });
  }
  window.CodeTribeApp = { toast, loadProjects };
  document.addEventListener("DOMContentLoaded", async () => {
    wire();
    if (!window.CodeTribeConfig.configured) { renderFeed(); return; }
    await window.CodeTribeAuth.initialize();
    await loadProjects();
  });
})();