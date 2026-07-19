const tokenKey = "tidbyts.householdToken";
let token = localStorage.getItem(tokenKey) || "";
let state = null;

const sharedToken = new URLSearchParams(location.hash.slice(1)).get("key");
if (sharedToken) {
  token = sharedToken;
  localStorage.setItem(tokenKey, token);
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}

const login = document.querySelector("#login");
const dashboard = document.querySelector("#dashboard");
const status = document.querySelector("#status");
const scoreboard = document.querySelector("#scoreboard");
const binList = document.querySelector("#bin-list");
const addDialog = document.querySelector("#add-dialog");
const settingsDialog = document.querySelector("#settings-dialog");

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (response.status === 401) {
    localStorage.removeItem(tokenKey);
    token = "";
    showLogin();
    throw new Error("Household key was not accepted");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function showLogin() {
  login.hidden = false;
  dashboard.hidden = true;
}

function setStatus(message) {
  status.textContent = message;
}

function percent(member) {
  return member.total === 0 ? 0 : Math.round((member.dealt / member.total) * 100);
}

function renderScoreboard() {
  scoreboard.replaceChildren();
  const template = document.querySelector("#member-card-template");
  for (const member of state.members) {
    const card = template.content.firstElementChild.cloneNode(true);
    const donePercent = percent(member);
    card.style.setProperty("--progress", `${donePercent}%`);
    card.querySelector(".member-name").textContent = member.name;
    card.querySelector(".member-count").textContent = `${member.dealt} of ${member.total} cleared`;
    card.querySelector(".ring span").textContent = `${donePercent}%`;
    card.querySelector(".add-button").addEventListener("click", () => {
      document.querySelector("#add-member").value = member.id;
      document.querySelector("#add-label").value = "";
      addDialog.showModal();
      document.querySelector("#add-label").focus();
    });
    scoreboard.append(card);
  }
}

function renderBins() {
  binList.replaceChildren();
  if (state.bins.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No bins yet. Add one above to begin the quest.";
    binList.append(empty);
    return;
  }

  const template = document.querySelector("#bin-template");
  for (const bin of state.bins) {
    const member = state.members.find((candidate) => candidate.id === bin.member_id);
    const row = template.content.firstElementChild.cloneNode(true);
    row.classList.toggle("dealt", bin.dealt);
    row.querySelector("strong").textContent = bin.label || "Mystery bin";
    row.querySelector("small").textContent = `${member?.name || "UNKNOWN"} · ${bin.dealt ? "dealt with" : "still lurking"}`;
    row.querySelector(".toggle").addEventListener("click", async () => {
      setStatus("Saving…");
      await api(`/api/bins/${bin.id}`, {
        method: "PATCH",
        body: JSON.stringify({ dealt: !bin.dealt }),
      });
      await refresh();
    });
    row.querySelector(".delete-button").addEventListener("click", async () => {
      if (!confirm(`Delete “${bin.label || "Mystery bin"}”?`)) return;
      await api(`/api/bins/${bin.id}`, { method: "DELETE" });
      await refresh();
    });
    binList.append(row);
  }
}

async function refresh() {
  state = await api("/api/bins");
  login.hidden = true;
  dashboard.hidden = false;
  renderScoreboard();
  renderBins();
  setStatus("Up to date");
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  token = document.querySelector("#token").value.trim();
  try {
    await refresh();
    localStorage.setItem(tokenKey, token);
  } catch (error) {
    alert(error.message);
  }
});

document.querySelector("#add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  if (submitter?.value === "cancel") {
    addDialog.close();
    return;
  }
  await api("/api/bins", {
    method: "POST",
    body: JSON.stringify({
      memberId: document.querySelector("#add-member").value,
      label: document.querySelector("#add-label").value.trim(),
    }),
  });
  addDialog.close();
  await refresh();
});

document.querySelector("#settings-button").addEventListener("click", () => {
  if (!state) return;
  document.querySelector("#member-a-name").value = state.members.find((member) => member.id === "a")?.name || "";
  document.querySelector("#member-b-name").value = state.members.find((member) => member.id === "b")?.name || "";
  settingsDialog.showModal();
});

document.querySelector("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (event.submitter?.id === "forget-key") {
    localStorage.removeItem(tokenKey);
    token = "";
    settingsDialog.close();
    showLogin();
    return;
  }
  await Promise.all([
    api("/api/members/a", {
      method: "PATCH",
      body: JSON.stringify({ name: document.querySelector("#member-a-name").value }),
    }),
    api("/api/members/b", {
      method: "PATCH",
      body: JSON.stringify({ name: document.querySelector("#member-b-name").value }),
    }),
  ]);
  settingsDialog.close();
  await refresh();
});

if (token) {
  refresh().catch((error) => {
    console.error(error);
    showLogin();
  });
} else {
  showLogin();
}
