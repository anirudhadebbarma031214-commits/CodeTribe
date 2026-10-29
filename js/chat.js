/* Realtime direct messages. RLS remains the authorization boundary. */
(() => {
  const client = () => window.supabaseClient;
  let channel = null, activeProject = null, activeRecipientId = null, seenIds = new Set();
  const $ = id => document.getElementById(id);
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
    close(false);
    activeProject = project; activeRecipientId = project.user_id; seenIds = new Set();
    $("chatList");
    $("chatTitle").textContent = project.user_id === user.id ? "Project conversations" : "Talk with " + (project.users?.display_name || "the developer");
    $("chatSubtitle").textContent = project.title;
    $("chatNotice").textContent = "Messages are visible only to conversation participants.";
    $("messageList").innerHTML = ""; $("messageInput").value = "";
    $("messageForm").querySelector("button").disabled = false;
    $("chatDialog").showModal();
    try {
      const { data, error } = await client().from("codetribe_messages")
        .select("id,project_id,sender_id,recipient_id,body,created_at")
        .eq("project_id", project.id).order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      let messages = data || [];
      if (project.user_id === user.id) {
        const latestVisitorMessage = [...messages].reverse().find(m => m.sender_id !== user.id && m.recipient_id === user.id);
        if (!latestVisitorMessage) {
          $("chatNotice").textContent = "No one has messaged about this project yet. Visitors can start a conversation from this card.";
          $("messageForm").querySelector("button").disabled = true;
          showEmpty();
          return;
        }
        activeRecipientId = latestVisitorMessage.sender_id;
        messages = messages.filter(m => (m.sender_id === user.id && m.recipient_id === activeRecipientId) ||
          (m.sender_id === activeRecipientId && m.recipient_id === user.id));
        $("chatTitle").textContent = "Reply to a developer";
        $("chatNotice").textContent = "Replying to the latest person who contacted you about this project.";
      } else {
        messages = messages.filter(m => (m.sender_id === user.id && m.recipient_id === project.user_id) ||
          (m.sender_id === project.user_id && m.recipient_id === user.id));
      }
      if (!messages.length) showEmpty(); else messages.forEach(renderMessage);
    } catch (error) {
      $("chatNotice").textContent = "Could not load messages: " + error.message;
    }
    channel = client().channel("project-chat-" + project.id + "-" + user.id)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"codetribe_messages", filter:"project_id=eq." + project.id }, payload => {
        const m = payload.new;
        const relevant = (m.sender_id === user.id && m.recipient_id === activeRecipientId) ||
          (m.sender_id === activeRecipientId && m.recipient_id === user.id);
        if (relevant) {
          const empty = $("messageList").querySelector(".message-empty"); if (empty) empty.remove();
          renderMessage(m);
        }
      }).subscribe();
  }
  async function send(event) {
    event.preventDefault();
    const user = window.CodeTribeAuth.user, body = $("messageInput").value.trim();
    if (!body || !activeProject || !activeRecipientId || !user) return;
    const button = $("messageForm").querySelector("button"); button.disabled = true;
    try {
      const { data, error } = await client().from("codetribe_messages").insert({
        project_id: activeProject.id, sender_id: user.id, recipient_id: activeRecipientId, body
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
    channel = null;
    if (clear) { activeProject = null; activeRecipientId = null; }
  }
  window.CodeTribeChat = { open, send, close };
})();