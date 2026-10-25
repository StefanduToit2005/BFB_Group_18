/* Home screen - choose a role, then log in */
const user = UI.init("home");
const $ = id => document.getElementById(id);

const ROLE_SETUP = {
  patient: {
    title: "Patient", icon: "bi-person", label: "Patient number", placeholder: "ML-1001",
    help: "Looks like ML-1234. You got it when you registered.", error: "Please enter your patient number."
  },
  admin: {
    title: "Administrator", icon: "bi-inbox", label: "Username", placeholder: "",
    help: "Your staff username.", error: "Please enter your username."
  },
  neurologist: {
    title: "Neurologist", icon: "bi-clipboard2-pulse", label: "Username", placeholder: "",
    help: "Your staff username.", error: "Please enter your username."
  }
};
let chosenRole = null;

// ---------- messages from other pages ----------
const params = new URLSearchParams(location.search);
function showAlert(text, type = "info") {
  $("pageAlert").className = `alert alert-${type}`;
  $("pageAlert").textContent = text;
}
if (params.get("denied")) showAlert("You don't have access to that page. Log in with an account that does.", "warning");
else if (params.get("login")) showAlert("Please log in to continue.", "info");
else if (params.get("loggedout")) showAlert("You have been logged out.", "success");

// ---------- views ----------
function showRoles() {
  chosenRole = null;
  $("roleView").classList.remove("d-none");
  $("loginView").classList.add("d-none");
}

function showLogin(role, push = true) {
  if (push) history.pushState({ view: "login", role }, "");
  chosenRole = role;
  const r = ROLE_SETUP[role];
  $("loginHeading").textContent = r.title;
  $("loginIcon").innerHTML = `<i class="bi ${r.icon}" aria-hidden="true"></i>`;
  $("usernameLabel").textContent = r.label;
  $("username").placeholder = r.placeholder;
  $("usernameHelp").textContent = r.help;
  $("usernameError").textContent = r.error;
  $("username").classList.toggle("text-uppercase", role === "patient");
  $("patientExtras").classList.toggle("d-none", role !== "patient");
  $("loginAlert").classList.add("d-none");
  $("loginForm").reset();
  $("loginForm").classList.remove("was-validated");
  $("roleView").classList.add("d-none");
  $("loginView").classList.remove("d-none");
  if (params.get("patientNo") && role === "patient") $("username").value = params.get("patientNo");
  ($("username").value ? $("password") : $("username")).focus();
}

document.querySelectorAll(".role-pick").forEach(btn =>
  btn.addEventListener("click", () => showLogin(btn.dataset.role)));
$("backBtn").addEventListener("click", () => history.back());
// Browser back button returns to the role choice instead of leaving the page
window.addEventListener("popstate", e => {
  if (e.state && e.state.view === "login") showLogin(e.state.role, false);
  else showRoles();
});

$("showPw").addEventListener("click", () => {
  const pw = $("password");
  const show = pw.type === "password";
  pw.type = show ? "text" : "password";
  $("showPw").setAttribute("aria-pressed", show);
  $("showPw").setAttribute("aria-label", show ? "Hide password" : "Show password");
  $("showPw").innerHTML = `<i class="bi ${show ? "bi-eye-slash" : "bi-eye"}" aria-hidden="true"></i>`;
});

// ---------- log in ----------
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  $("loginAlert").classList.add("d-none");
  form.classList.add("was-validated");
  if (!form.checkValidity()) { form.querySelector(":invalid")?.focus(); return; }

  const btn = $("loginBtn");
  btn.disabled = true; btn.querySelector(".spinner-border").classList.remove("d-none");
  try {
    const session = await MediLinkAPI.login(chosenRole, $("username").value, $("password").value);
    // Go back to the page they tried to open, if any, otherwise their home page
    location.href = UI.ROLE_HOME[session.role];
  } catch (err) {
    $("loginAlert").textContent = err.message;
    $("loginAlert").classList.remove("d-none");
    form.classList.remove("was-validated");
    $("password").value = "";
    $("password").focus();
  } finally {
    btn.disabled = false; btn.querySelector(".spinner-border").classList.add("d-none");
  }
});

// ---------- already logged in ----------
if (user && user.role) {
  $("roleView").classList.add("d-none");
  $("loggedInView").classList.remove("d-none");
  $("loggedInText").textContent = `You're logged in as ${user.name} (${UI.ROLE_LABEL[user.role]}).`;
  $("continueBtn").href = UI.ROLE_HOME[user.role];
  $("switchBtn").addEventListener("click", UI.logout);
} else if (params.get("role") && ROLE_SETUP[params.get("role")]) {
  showLogin(params.get("role"));
}
