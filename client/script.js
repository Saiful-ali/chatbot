// Change this after deploy (e.g., https://your-service.onrender.com)
const SERVER_BASE_URL = "http://localhost:5000";

const chatBox = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("msg");
const langSel = document.getElementById("lang");
const extra = document.getElementById("extra");
const btnVaccines = document.getElementById("btnVaccines");
const btnAlerts = document.getElementById("btnAlerts");

function addBubble(role, text) {
  const wrap = document.createElement("div");
  wrap.className = role === "user" ? "text-right" : "text-left";
  const bubble = document.createElement("div");
  bubble.className =
    (role === "user"
      ? "bg-blue-600 text-white"
      : "bg-gray-100 text-gray-900") + " inline-block px-3 py-2 rounded";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg) return;
  addBubble("user", msg);
  input.value = "";

  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, lang: langSel.value }),
    });
    const data = await res.json();
    addBubble("bot", data.reply || data.error || "No answer found.");
  } catch {
    addBubble("bot", "Network error. Please try again.");
  }
});

btnVaccines.addEventListener("click", async () => {
  extra.textContent = "Loading vaccination info...";
  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/vaccines?lang=${langSel.value}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      extra.textContent = "No vaccination info found.";
      return;
    }
    extra.textContent = data
      .map(v => `• ${v.title}${v.risk_level ? ` (${v.risk_level})` : ""}: ${v.content}`)
      .join("\n");
  } catch {
    extra.textContent = "Network error.";
  }
});

btnAlerts.addEventListener("click", async () => {
  extra.textContent = "Loading alerts...";
  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/alerts`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      extra.textContent = "No active alerts.";
      return;
    }
    extra.textContent = data
      .map(a => `• [${a.priority}] ${a.title}: ${a.description}`)
      .join("\n");
  } catch {
    extra.textContent = "Network error.";
  }
});
