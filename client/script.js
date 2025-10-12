const SERVER = "http://localhost:5000"; // change to your Render URL after deploy

// --- Chat UI ---
const chatBox = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("msg");
const langSel = document.getElementById("lang");
const voiceBtn = document.getElementById("voiceBtn");

function addBubble(role, text) {
  const wrap = document.createElement("div");
  wrap.className = role === "user" ? "text-right" : "text-left";
  const bubble = document.createElement("div");
  bubble.className =
    (role === "user"
      ? "bg-blue-600 text-white"
      : "bg-gray-200 text-gray-900") + " inline-block px-3 py-2 rounded";
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
    const res = await fetch(`${SERVER}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, lang: langSel.value })
    });
    const data = await res.json();
    const text = data.reply || data.error || "No answer found.";
    addBubble("bot", text);
    speak(text, langSel.value); // voice out
  } catch {
    addBubble("bot", "Network error.");
  }
});

// --- Voice input/output using Web Speech API ---
let rec;
if ("webkitSpeechRecognition" in window) {
  rec = new webkitSpeechRecognition();
  rec.lang = "en-IN"; // updated dynamically
  rec.continuous = false;
  rec.interimResults = false;
  rec.onresult = (e) => {
    const t = e.results[0][0].transcript;
    input.value = t;
    form.requestSubmit();
  };
}

voiceBtn.addEventListener("click", () => {
  if (!rec) return alert("Speech recognition not supported in this browser.");
  rec.lang = langSel.value === "hi" ? "hi-IN" : (langSel.value === "or" ? "or-IN" : "en-IN");
  rec.start();
});

function speak(text, lang) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "hi" ? "hi-IN" : (lang === "or" ? "or-IN" : "en-IN");
  window.speechSynthesis.speak(u);
}

// --- Alerts ---
const alertsEl = document.getElementById("alerts");
document.getElementById("refreshAlerts").addEventListener("click", loadAlerts);
loadAlerts();
async function loadAlerts() {
  alertsEl.innerHTML = "Loading...";
  try {
    const res = await fetch(`${SERVER}/api/alerts`);
    const arr = await res.json();
    alertsEl.innerHTML = "";
    arr.forEach(a => {
      const li = document.createElement("li");
      li.textContent = `[${a.priority}] ${a.title}: ${a.description}`;
      alertsEl.appendChild(li);
    });
  } catch {
    alertsEl.innerHTML = "Failed to load alerts.";
  }
}

// --- Subscribe ---
const subForm = document.getElementById("subForm");
const subResult = document.getElementById("subResult");
subForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = document.getElementById("phone").value.trim();
  const name = document.getElementById("name").value.trim();
  const chWhats = document.getElementById("chWhats").checked;
  const chSms = document.getElementById("chSms").checked;
  const channels = [];
  if (chWhats) channels.push("whatsapp");
  if (chSms) channels.push("sms");
  subResult.textContent = "Saving...";
  try {
    const res = await fetch(`${SERVER}/api/subscribe`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ phone_number: phone, name, preferred_language: langSel.value, channels })
    });
    const data = await res.json();
    subResult.textContent = data.ok ? "Subscribed successfully!" : (data.error || "Failed");
  } catch {
    subResult.textContent = "Network error.";
  }
});

// --- Learn section ---
const categorySelect = document.getElementById("categorySelect");
const learnList = document.getElementById("learnList");
loadCategories(); loadEntries();

categorySelect.addEventListener("change", () => loadEntries(categorySelect.value));

async function loadCategories() {
  const res = await fetch(`${SERVER}/api/learn/categories`);
  const cats = await res.json();
  categorySelect.innerHTML = `<option value="">All</option>` + 
    cats.map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`).join("");
}

async function loadEntries(categoryId="") {
  const url = new URL(`${SERVER}/api/learn/entries`);
  if (categoryId) url.searchParams.set("categoryId", categoryId);
  const res = await fetch(url);
  const items = await res.json();
  learnList.innerHTML = items.map(i => `
    <div class="border rounded p-3 bg-gray-50">
      <div class="text-sm text-gray-500">${i.category || ""}</div>
      <div class="font-semibold">${i.title}</div>
      <div class="text-sm mt-1">${i.content}</div>
      ${i.risk_level ? `<div class="mt-1 text-xs">Risk: ${i.risk_level}</div>` : ""}
    </div>
  `).join("");
}
