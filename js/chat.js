/* Direct messages are stored in Supabase and streamed with Realtime. RLS limits each
   message to its sender and recipient. Never trust client-side IDs for authorization. */
(() => {
  const client = () => window.supabaseClient;
  let channel = null, activeProject = null, seenIds = new Set();
  const $ = id => document.getElementById(id);
  const escapeText = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  function renderMessage(message) {
    if (seenIds.has(message.id)) return;
    seenIds.add(message.id);
    const mine = message.sender_id === window.CodeTribeAuth.user?.id;
    const row = document.createElement("div");
    row.className = "message-row" + (mine ? " mine" : "");
    const time = new Date(message.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    row.innerHTML = '<div class="message-bubble"></div><div class="message-meta"></div>';
    row.querySelector(".message-bubble").textContent = message.body;
    row.querySelector(".message-meta").textContent = (mine ? "YOU" : "DEVELOPER") + " · " + time;
    $("messageList").appendChild(row);
    $("messageList").scrollTop = $("messageList").scrollHeight;
  }
  function showEmpty() {
    $("messageList").innerHTML = '<div class="message-empty">Say hello 👋<br>Ask about the stack, share feedback, or talk about collaborating.</div>';
  }
  async function open(project) {
    const user = window.CodeTribeAuth.user;
    if (!client()) { window.CodeTribeApp.toast("Configure Supabase to use live chat."); return; }
    if (!user) { window.CodeTribeApp.toast("Sign in with Google to message developers."); await window.CodeTribeAuth.signIn(); return; }
    if (project.user_id === user.id) { window.CodeTribeApp.toast("This is your project — open it from your GitHub repository."); return; }
    close(false);
    activeProject = project; seenIds = new Set();
    $("chatTitle").textContent = "Talk with " + (project.users?.display_name || "the developer");
    $("chatSubtitle").textContent = project.title;
    $("chatNotice").textContent = "Messages are visible only to you and this project's creator.";
    $("messageList").innerHTML = "";
    $("messageInput").value = "";
    $("messageForm").querySelector("button").disabled = false;
    $("chatDialog").showModal();
    try {
      const { data, error } = await client().from("messages").select("id,project_id,sender_id,recipient_id,body,created_at").eq("project_id", project.id).order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      if (!data.length) showEmpty(); else data.forEach(renderMessage);
    } catch (error) {
      $("chatNotice").textContent = "Could not load messages: " + error.message;
    }
    channel = client().channel("project-chat-" + project.id + "-" + user.id)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages", filter:"project_id=eq." + project.id }, payload => {
        if (payload.new.sender_id === user.id || payload.new.recipient_id === user.id) {
          const empty = $("messageList").querySelector(".message-empty"); if (empty) empty.remove();
          renderMessage(payload.new);
        }
      }).subscribe();
  }
  async function send(event) {
    event.preventDefault();
    const user = window.CodeTribeAuth.user, body = $("messageInput").value.trim();
    if (!body || !activeProject || !user) return;
    const button = $("messageForm").querySelector("button");
    button.disabled = true;
    try {
      const { data, error } = await client().from("messages").insert({
        project_id: activeProject.id, sender_id: user.id,
        recipient_id: activeProject.user_id, body
      }).select("id,project_id,sender_id,recipient_id,body,created_at").single();
      if (error) throw error;
      const empty = $("messageList").querySelector(".message-empty"); if (empty) empty.remove();
      renderMessage(data); $("messageInput").value = "";
    } catch (error) {
      window.CodeTribeApp.toast(error.message || "Message could not be sent.");
    } finally { button.disabled = false; $("messageInput").focus(); }
  }
  function close(clear = true) {
    if (channel && client()) client().removeChannel(channel);
    channel = null; if (clear) activeProject = null;
  }
  window.CodeTribeChat = { open, send, close };
})();