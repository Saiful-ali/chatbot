const SERVER_BASE_URL = "http://localhost:5000";

let ADMIN_KEY = null;

async function promptLogin() {
  ADMIN_KEY = localStorage.getItem("ADMIN_KEY") || prompt("🔐 Enter admin password:");
  if (!ADMIN_KEY) {
    alert("You must enter a valid admin password to continue.");
    location.reload();
  } else {
    localStorage.setItem("ADMIN_KEY", ADMIN_KEY);
    await loadUpdates();
  }
}

const form = document.getElementById("updateForm");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("updatesList");

// ✅ Load all existing updates (secured)
async function loadUpdates() {
  const res = await fetch(`${SERVER_BASE_URL}/api/admin/updates`, {
    headers: { "x-admin-key": ADMIN_KEY },
  });

  if (res.status === 403) {
    alert("❌ Unauthorized. Please log in again.");
    localStorage.removeItem("ADMIN_KEY");
    location.reload();
    return;
  }

  const data = await res.json();
  listEl.innerHTML = data
    .map(
      (u) => `
      <li class="p-3">
        <div class="font-semibold">${u.title}</div>
        <div class="text-sm text-gray-600">${u.description}</div>
        <div class="text-xs text-gray-500 mt-1">Priority: ${u.priority} • ${u.lang}</div>
      </li>`
    )
    .join("");
}

// ✅ Add new update (secured)
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const newUpdate = {
    title: document.getElementById("title").value,
    description: document.getElementById("description").value,
    priority: document.getElementById("priority").value,
    lang: document.getElementById("lang").value,
  };

  const res = await fetch(`${SERVER_BASE_URL}/api/admin/add-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY, // 🔐 Secure header
    },
    body: JSON.stringify(newUpdate),
  });

  if (res.status === 403) {
    alert("❌ Unauthorized. Please log in again.");
    localStorage.removeItem("ADMIN_KEY");
    location.reload();
    return;
  }

  const data = await res.json();

  if (data.success) {
    statusEl.textContent = "✅ Update added successfully and shared with users.";
    statusEl.className = "text-green-700";
    form.reset();
    loadUpdates();
  } else {
    statusEl.textContent = "❌ Failed to add update.";
    statusEl.className = "text-red-700";
  }
});

// ✅ Logout function (optional)
function logout() {
  localStorage.removeItem("ADMIN_KEY");
  alert("🔒 Logged out successfully.");
  location.reload();
}

// 🧭 Optional logout button handler
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.createElement("button");
  logoutBtn.textContent = "Logout";
  logoutBtn.className =
    "mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700";
  logoutBtn.onclick = logout;
  document.body.prepend(logoutBtn);
});

promptLogin();
