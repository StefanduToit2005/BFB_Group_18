/* New patient registration (Node 1 - intake)
   Public page for new patients. Staff can also use it at reception.
   A logged-in patient is sent back to their portal. */
const user = UI.init("patient");
const isStaff = user && UI.STAFF.includes(user.role);
if (user && user.role === "patient") location.replace("patient-portal.html");

const form = document.getElementById("registerForm");
const alertBox = document.getElementById("formAlert");
const submitBtn = document.getElementById("submitBtn");
const spinner = submitBtn.querySelector(".spinner-border");
const f = id => document.getElementById(id);

// Staff registering someone at reception see slightly different wording
if (isStaff) {
  f("crumbBack").textContent = "Patient portal";
  f("crumbBack").href = "patient-portal.html";
  f("introText").textContent = "Register a patient at reception. Give them their patient number and the password you set, and ask them to keep it safe.";
  f("passwordLabel").textContent = "Set a password for the patient";
  f("haveNumber").classList.add("d-none");
  submitBtn.lastChild.textContent = " Register patient";
}

// ---------- SA ID or passport ----------
const idType = () => form.querySelector('input[name="idType"]:checked').value;
function applyIdType() {
  const passport = idType() === "Passport";
  f("saIdGroup").classList.toggle("d-none", passport);
  document.querySelectorAll(".passport-field").forEach(el => el.classList.toggle("d-none", !passport));
  // Only the visible fields are required, so hidden ones never block the form
  f("idNumber").required = !passport;
  ["passportNo", "country", "dob"].forEach(id => { f(id).required = passport; });
}
form.querySelectorAll('input[name="idType"]').forEach(r => r.addEventListener("change", () => {
  applyIdType();
  if (form.classList.contains("was-validated")) runCustomChecks();
}));
f("dob").max = new Date().toISOString().slice(0, 10);
f("dob").min = "1900-01-01";
f("passportNo").addEventListener("input", e => { e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase(); });
applyIdType();

const strongPassword = pw => pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

// Custom checks on top of the browser's built-in ones
function runCustomChecks() {
  const id = f("idNumber"), phone = f("phone"), email = f("email"), pw = f("password"), pw2 = f("password2");
  UI.setFieldError(id, idType() === "SA ID" && id.value && !UI.isValidSAId(id.value.trim())
    ? "That ID number doesn't look right. Check that all 13 digits are correct." : "");
  UI.setFieldError(phone, phone.value && !UI.isValidPhone(phone.value) ? "Use 10 digits starting with 0, or + and the country code." : "");
  UI.setFieldError(email, email.value && !UI.isValidEmail(email.value) ? "Please enter a valid email address." : "");
  UI.setFieldError(pw, pw.value && !strongPassword(pw.value) ? "At least 8 characters, with a letter and a number." : "");
  UI.setFieldError(pw2, pw2.value && pw2.value !== pw.value ? "The passwords don't match." : "");
}

form.addEventListener("input", () => { if (form.classList.contains("was-validated")) runCustomChecks(); });
f("idNumber").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, ""); });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.classList.add("d-none");
  runCustomChecks();
  form.classList.add("was-validated");

  if (!form.checkValidity()) {
    form.querySelector(":invalid")?.focus();
    return;
  }

  const address = [f("street").value, f("suburb").value, f("city").value, f("postal").value]
    .map(s => s.trim()).filter(Boolean).join(", ");

  submitBtn.disabled = true; spinner.classList.remove("d-none");
  try {
    const patient = await MediLinkAPI.registerPatient({
      firstName: f("firstName").value.trim(),
      surname: f("surname").value.trim(),
      idType: idType(),
      idNumber: idType() === "Passport" ? f("passportNo").value.trim().toUpperCase() : f("idNumber").value.trim(),
      country: idType() === "Passport" ? f("country").value.trim() : "South Africa",
      dob: idType() === "Passport" ? f("dob").value : UI.dobFromSAId(f("idNumber").value.trim()),
      phone: f("phone").value.replace(/[\s-]/g, ""),
      email: f("email").value.trim().toLowerCase(),
      address,
      password: f("password").value
    });
    f("newPatientNo").textContent = patient.patientNo;
    if (isStaff) {
      f("successCard").querySelector("h2").textContent = `${patient.firstName} is registered`;
      f("successText").textContent = "Give the patient this number and their password. You can now open their file or send a request for them.";
      f("successActions").innerHTML = `
        <a href="patient-portal.html?patientNo=${encodeURIComponent(patient.patientNo)}" class="btn btn-primary">Open their portal</a>
        <a href="patient-file.html?id=${encodeURIComponent(patient.patientNo)}" class="btn btn-outline-primary">Open patient file</a>`;
    } else {
      f("goLogin").href = `index.html?role=patient&patientNo=${encodeURIComponent(patient.patientNo)}`;
    }
    f("formCard").classList.add("d-none");
    f("successCard").classList.remove("d-none");
  } catch (err) {
    alertBox.textContent = err.message || "Registration failed. Please try again.";
    alertBox.classList.remove("d-none");
  } finally {
    submitBtn.disabled = false; spinner.classList.add("d-none");
  }
});
