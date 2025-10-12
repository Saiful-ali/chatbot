const SERVER_BASE_URL = "http://localhost:5000"; // change after deploy

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
  } catch (err) {
    addBubble("bot", "Network error. Please try again.");
  }
});

btnVaccines.addEventListener("click", async () => {
  extra.textContent = "Loading vaccination schedule...";
  const res = await fetch(`${SERVER_BASE_URL}/api/vaccines?lang=${langSel.value}`);
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) {
    extra.textContent = "No vaccination data found.";
    return;
  }
  extra.textContent = data.map(v => `• ${v.disease} – ${v.vaccine} – ${v.age_group} – ${v.schedule}`).join("\n");
});

btnAlerts.addEventListener("click", async () => {
  extra.textContent = "Loading alerts...";
  const res = await fetch(`${SERVER_BASE_URL}/api/alerts`);
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) {
    extra.textContent = "No active alerts.";
    return;
  }
  extra.textContent = data.map(a => `• [${a.severity}] ${a.disease} in ${a.district}: ${a.message}`).join("\n");
});
