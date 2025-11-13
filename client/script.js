const SERVER = "http://localhost:5000"; // change to your Render URL after deploy

// -----------------------------
// 🌐 UI TRANSLATION STRINGS
// -----------------------------
const uiText = {
  en: {
    languageLabel: "Language:",
    title: "Government Public Health Portal",
    subtitle: "Official health information, alerts, and chatbot assistance",
    chatbot: "AI Chatbot",
    placeholder: "Ask about symptoms, vaccines, prevention...",
    send: "Send",
    voice: "🎙️ Voice",
    tip: "Tip: Click 🎙️ to speak your query; bot can speak the answer back.",
    alerts: "Active Alerts",
    refresh: "Refresh",
    subscribeTitle: "Subscribe for Updates",
    phone: "Phone (e.g., 9876543210)",
    name: "Name (optional)",
    subscribe: "Subscribe",
    learn: "Learn: Diseases, Vaccines, Prevention",
  },
  hi: {
    languageLabel: "भाषा:",
    title: "सरकारी सार्वजनिक स्वास्थ्य पोर्टल",
    subtitle: "आधिकारिक स्वास्थ्य जानकारी, अलर्ट और चैटबॉट सहायता",
    chatbot: "एआई चैटबॉट",
    placeholder: "लक्षण, वैक्सीन, रोकथाम आदि पूछें...",
    send: "भेजें",
    voice: "🎙️ आवाज़",
    tip: "सुझाव: 🎙️ पर क्लिक करें और अपनी क्वेरी बोलें; बॉट जवाब बोलकर देगा।",
    alerts: "सक्रिय अलर्ट",
    refresh: "रीफ़्रेश करें",
    subscribeTitle: "अपडेट के लिए सदस्यता लें",
    phone: "फ़ोन (जैसे 9876543210)",
    name: "नाम (वैकल्पिक)",
    subscribe: "सदस्यता लें",
    learn: "जानें: बीमारियाँ, टीकाकरण, रोकथाम",
  },
  or: {
    languageLabel: "ଭାଷା:",
    title: "ସରକାରୀ ସାର୍ବଜନିକ ସ୍ୱାସ୍ଥ୍ୟ ପୋର୍ଟାଲ",
    subtitle: "ଆଧିକାରିକ ସ୍ୱାସ୍ଥ୍ୟ ସୂଚନା, ସତର୍କତା ଏବଂ ଚାଟବୋଟ ସହାୟତା",
    chatbot: "ଏଆଇ ଚାଟବୋଟ୍",
    placeholder: "ଲକ୍ଷଣ, ଟୀକା, ପ୍ରତିରୋଧ ବିଷୟରେ ପଚାରନ୍ତୁ...",
    send: "ପଠାନ୍ତୁ",
    voice: "🎙️ ଶବ୍ଦ",
    tip: "ସୁପାରିଶ: 🎙️ ଉପରେ କ୍ଲିକ୍ କରନ୍ତୁ ଏବଂ ପ୍ରଶ୍ନ କହନ୍ତୁ; ବୋଟ୍ ଉତ୍ତର ଶବ୍ଦରେ ଦେବ।",
    alerts: "ସକ୍ରିୟ ସତର୍କତା",
    refresh: "ପୁନଃଲୋଡ୍ କରନ୍ତୁ",
    subscribeTitle: "ଅଦ୍ୟତନ ପାଇଁ ସଦସ୍ୟତା ନିଅନ୍ତୁ",
    phone: "ଫୋନ (ଉଦାହରଣ: 9876543210)",
    name: "ନାମ (ଇଚ୍ଛାନୁସାରେ)",
    subscribe: "ସଦସ୍ୟତା ନିଅନ୍ତୁ",
    learn: "ଶିଖନ୍ତୁ: ରୋଗ, ଟୀକା, ପ୍ରତିରୋଧ",
  },
};

// -----------------------------
// 🈶 APPLY UI TRANSLATION
// -----------------------------
function applyTranslations(lang) {
  const t = uiText[lang] || uiText.en;
  document.querySelector("label.text-sm").textContent = t.languageLabel;
  document.querySelector("header h1").textContent = t.title;
  document.querySelector("header p").textContent = t.subtitle;

  const chatSection = document.querySelector("main section:nth-of-type(1)");
  chatSection.querySelector("h2").textContent = t.chatbot;
  document.getElementById("msg").placeholder = t.placeholder;
  chatSection.querySelector("button.bg-blue-600").textContent = t.send;
  document.getElementById("voiceBtn").textContent = t.voice;
  chatSection.querySelector("p.text-xs").textContent = t.tip;

  const alertsSection = document.querySelector("aside section:nth-of-type(1)");
  alertsSection.querySelector("h2").textContent = t.alerts;
  document.getElementById("refreshAlerts").textContent = t.refresh;

  const subSection = document.querySelector("aside section:nth-of-type(2)");
  subSection.querySelector("h2").textContent = t.subscribeTitle;
  document.getElementById("phone").placeholder = t.phone;
  document.getElementById("name").placeholder = t.name;
  subSection.querySelector("button.bg-green-600").textContent = t.subscribe;

  const learnSection = document.querySelector("main section.lg\\:col-span-3");
  learnSection.querySelector("h2").textContent = t.learn;
}

// -----------------------------
// 🌐 LANGUAGE HANDLING (Auto Detect + Save)
// -----------------------------
const langSel = document.getElementById("lang");
let savedLang = localStorage.getItem("preferredLang");
if (!savedLang) {
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  savedLang = ["hi", "or", "en"].includes(browserLang) ? browserLang : "en";
  alert(`Language auto-detected as ${savedLang.toUpperCase()}.`);
  localStorage.setItem("preferredLang", savedLang);
}
if (savedLang === "auto") {
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  savedLang = ["hi", "or", "en"].includes(browserLang) ? browserLang : "en";
}
langSel.value = savedLang;
applyTranslations(savedLang);
function getLang() {
  return localStorage.getItem("preferredLang") || "en";
}
langSel.addEventListener("change", (e) => {
  localStorage.setItem("preferredLang", e.target.value);
  applyTranslations(e.target.value);
});

// -----------------------------
// 💬 CHATBOT SECTION (manual play audio)
// -----------------------------
const chatBox = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("msg");

async function addBubble(role, text, lang = getLang()) {
  const wrap = document.createElement("div");
  wrap.className = role === "user" ? "text-right" : "text-left";

  const bubble = document.createElement("div");
  bubble.className =
    (role === "user"
      ? "bg-blue-600 text-white"
      : "bg-gray-200 text-gray-900") + " inline-block px-3 py-2 rounded";
  bubble.textContent = text;
  wrap.appendChild(bubble);

  // 🎧 Add Play button only for bot replies
  if (role === "bot") {
    const playBtn = document.createElement("button");
    playBtn.textContent = "🔊";
    playBtn.className = "ml-2 text-blue-600 hover:text-blue-800";
    playBtn.title = "Play audio reply";

    playBtn.addEventListener("click", async () => {
  try {
    playBtn.textContent = "🎧 Playing...";
    const audio = new Audio(
      `${SERVER}/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&stream=true`
    );
    audio.play();
    audio.onended = () => (playBtn.textContent = "🔊");
  } catch (err) {
    playBtn.textContent = "🔊";
    console.error("Audio play error:", err);
    alert("Unable to play audio.");
  }
});


    wrap.appendChild(playBtn);
  }

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
    const res = await fetch(`${SERVER}/api/chat?lang=${getLang()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
    const data = await res.json();
    const text = data.reply || data.error || "No answer found.";
    addBubble("bot", text);
  } catch {
    addBubble("bot", "Network error.");
  }
});

// -----------------------------
// 🎙️ VOICE INPUT (Speech → Text)
// -----------------------------
let rec;
const voiceBtn = document.getElementById("voiceBtn");
if ("webkitSpeechRecognition" in window) {
  rec = new webkitSpeechRecognition();
  rec.lang = `${getLang()}-IN`;
  rec.continuous = false;
  rec.interimResults = false;
  rec.onresult = (e) => {
    const t = e.results[0][0].transcript;
    input.value = t;
    form.requestSubmit();
  };
}
voiceBtn.addEventListener("click", () => {
  if (!rec) return alert("Speech recognition not supported.");
  rec.lang =
    getLang() === "hi" ? "hi-IN" : getLang() === "or" ? "or-IN" : "en-IN";
  rec.start();
  voiceBtn.textContent = "🎧 Listening...";
  rec.onend = () => (voiceBtn.textContent = uiText[getLang()].voice);
});

// -----------------------------
// 🚨 ALERTS SECTION
// -----------------------------
const alertsEl = document.getElementById("alerts");
document.getElementById("refreshAlerts").addEventListener("click", loadAlerts);
loadAlerts();
async function loadAlerts() {
  alertsEl.innerHTML = "Loading...";
  try {
    const res = await fetch(`${SERVER}/api/alerts?lang=${getLang()}`);
    const arr = await res.json();
    alertsEl.innerHTML = "";
    arr.forEach((a) => {
      const li = document.createElement("li");
      li.textContent = `[${a.priority}] ${a.title}: ${a.description}`;
      alertsEl.appendChild(li);
    });
  } catch {
    alertsEl.innerHTML = "Failed to load alerts.";
  }
}

// -----------------------------
// 📲 SUBSCRIBE SECTION
// -----------------------------
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_number: phone,
        name,
        preferred_language: getLang(),
        channels,
      }),
    });
    const data = await res.json();
    subResult.textContent = data.ok
      ? "✅ Subscribed successfully!"
      : data.error || "Failed.";
  } catch {
    subResult.textContent = "Network error.";
  }
});

// -----------------------------
// 📘 LEARN SECTION
// -----------------------------
const categorySelect = document.getElementById("categorySelect");
const learnList = document.getElementById("learnList");
loadCategories();
loadEntries();
categorySelect.addEventListener("change", () =>
  loadEntries(categorySelect.value)
);
async function loadCategories() {
  try {
    const res = await fetch(`${SERVER}/api/learn/categories?lang=${getLang()}`);
    const cats = await res.json();
    categorySelect.innerHTML =
      `<option value="">All</option>` +
      cats
        .map((c) => `<option value="${c.id}">${c.name} (${c.type})</option>`)
        .join("");
  } catch {
    categorySelect.innerHTML = `<option>Error loading categories</option>`;
  }
}
async function loadEntries(categoryId = "") {
  try {
    const url = new URL(`${SERVER}/api/learn/entries`);
    if (categoryId) url.searchParams.set("categoryId", categoryId);
    url.searchParams.set("lang", getLang());
    const res = await fetch(url);
    const items = await res.json();
    learnList.innerHTML = items
  .map(
    (i) => `
      <div>
        <div class="category">${i.category || "General"}</div>
        <div class="title">${i.title}</div>
        <div class="content">${i.content}</div>
        ${
          i.risk_level
            ? `<div class="risk" data-level="${i.risk_level.toLowerCase()}">
                ${i.risk_level} Risk
              </div>`
            : ""
        }
      </div>`
  )
  .join("");

  } catch {
    learnList.innerHTML = `<div class="text-sm text-red-600">Failed to load content.</div>`;
  }
}
