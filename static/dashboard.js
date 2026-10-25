/* Impact dashboard - before/after KPIs using kpi-model.js */
if (!UI.init("dashboard", ["neurologist"])) throw new Error("Not allowed");

const $ = id => document.getElementById(id);
const COLOR_BEFORE = "#c2703d"; // amber - paper process
const COLOR_AFTER = "#009690";  // teal - MediLink (pair checked for colour-blind safety)
const INK_MUTED = "#5b6b78";
const GRID = "#e6ecef";

const PCT_FIELDS = ["delayRate"];
const NUM_FIELDS = ["retrievalsPerDay", "delayRate", "extraMinutesPerDelay", "baseMinutes",
  "digitalLookupMinutes", "adminRatePerHour", "workingDaysPerMonth"];

function fillDefaults() {
  NUM_FIELDS.forEach(k => {
    $(k).value = PCT_FIELDS.includes(k) ? Math.round(KPI_DEFAULTS[k] * 100) : KPI_DEFAULTS[k];
  });
  $("digitisedShare").value = Math.round(KPI_DEFAULTS.digitisedShare * 100);
}

function readInputs() {
  const out = {};
  let ok = true;
  NUM_FIELDS.forEach(k => {
    const el = $(k);
    const valid = el.value !== "" && el.checkValidity();
    el.classList.toggle("is-invalid", !valid);
    if (!valid) { ok = false; return; }
    out[k] = PCT_FIELDS.includes(k) ? +el.value / 100 : +el.value;
  });
  out.digitisedShare = +$("digitisedShare").value / 100;
  return ok ? out : null;
}

const hrs = h => `${h.toFixed(1)} h`;
const mins = m => `${m.toFixed(1)} min`;
const pctChange = (b, a) => b === 0 ? "–" : `${a <= b ? "−" : "+"}${Math.abs((1 - a / b) * 100).toFixed(0)}%`;

// ---------- charts ----------
Chart.defaults.font.family = "Inter, system-ui, sans-serif";
Chart.defaults.color = INK_MUTED;

const barChart = new Chart($("barChart"), {
  type: "bar",
  data: {
    labels: ["Before (paper)", "With MediLink"],
    datasets: [{ data: [0, 0], backgroundColor: [COLOR_BEFORE, COLOR_AFTER], borderRadius: 4, borderSkipped: "start", maxBarThickness: 56 }]
  },
  options: {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: c => `${c.parsed.y.toFixed(2)} hours per day` } }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: GRID }, border: { display: false }, title: { display: true, text: "Hours per day" } },
      x: { grid: { display: false } }
    }
  }
});

const shares = Array.from({ length: 11 }, (_, i) => i * 10);
let currentIdx = 6; // which point on the line matches the slider
const lineChart = new Chart($("lineChart"), {
  type: "line",
  data: {
    labels: shares.map(s => `${s}%`),
    datasets: [{
      data: [], borderColor: COLOR_AFTER, backgroundColor: COLOR_AFTER, borderWidth: 2,
      pointRadius: ctx => ctx.dataIndex === currentIdx ? 6 : 0, pointHoverRadius: 6,
      pointBorderColor: "#fff", pointBorderWidth: 2, tension: 0
    }]
  },
  options: {
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { title: c => `${c[0].label} digitised`, label: c => `${UI.rand(c.parsed.y)} per month` } }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: GRID }, border: { display: false },
           ticks: { callback: v => "R" + v.toLocaleString("en-ZA") } },
      x: { grid: { display: false }, title: { display: true, text: "Files digitised" } }
    }
  }
});

// ---------- render ----------
function update() {
  const inputs = readInputs();
  $("digiOut").textContent = `${$("digitisedShare").value}%`;
  if (!inputs) return;
  const r = computeKpis(inputs);
  const { before: b, after: a, savings: s } = r;

  $("hSaved").textContent = hrs(s.hoursPerDay);
  $("hSavedSub").textContent = `of ${hrs(b.delayHoursPerDay)} lost now`;
  $("mSaved").textContent = UI.rand(s.perMonth);
  $("ySaved").textContent = `${UI.rand(s.perYear)} per year`;
  $("avgAfter").textContent = mins(a.avgRetrievalMin);
  $("avgCut").textContent = `${s.retrievalTimeCutPct.toFixed(0)}% faster than ${mins(b.avgRetrievalMin)}`;
  $("delAfter").textContent = a.delayedPerDay.toFixed(1);
  $("delSub").textContent = `down from ${b.delayedPerDay.toFixed(1)}`;

  const rows = [
    ["Average time per retrieval", mins(b.avgRetrievalMin), mins(a.avgRetrievalMin), pctChange(b.avgRetrievalMin, a.avgRetrievalMin)],
    ["Delayed retrievals per day", b.delayedPerDay.toFixed(1), a.delayedPerDay.toFixed(1), pctChange(b.delayedPerDay, a.delayedPerDay)],
    ["Admin hours lost to delays per day", hrs(b.delayHoursPerDay), hrs(a.delayHoursPerDay), pctChange(b.delayHoursPerDay, a.delayHoursPerDay)],
    ["Total retrieval time per day", hrs(b.totalRetrievalHoursPerDay), hrs(a.totalRetrievalHoursPerDay), pctChange(b.totalRetrievalHoursPerDay, a.totalRetrievalHoursPerDay)],
    ["Cost of delays per month", UI.rand(b.delayCost.perMonth), UI.rand(a.delayCost.perMonth), pctChange(b.delayCost.perMonth, a.delayCost.perMonth)],
    ["Cost of delays per year", UI.rand(b.delayCost.perYear), UI.rand(a.delayCost.perYear), pctChange(b.delayCost.perYear, a.delayCost.perYear)]
  ];
  $("kpiTable").innerHTML = rows.map(([k, bv, av, ch]) => `
    <tr><th scope="row" class="fw-normal">${k}</th><td class="text-end">${bv}</td>
        <td class="text-end fw-semibold">${av}</td><td class="text-end kpi-good fw-semibold">${ch}</td></tr>`).join("");

  barChart.data.datasets[0].data = [b.delayHoursPerDay, a.delayHoursPerDay];
  barChart.update();

  currentIdx = Math.round(inputs.digitisedShare * 10);
  lineChart.data.datasets[0].data = shares.map(sh => computeKpis({ ...inputs, digitisedShare: sh / 100 }).after.delayCost.perMonth);
  lineChart.update();
}

$("inputs").addEventListener("input", update);
$("resetInputs").addEventListener("click", () => { fillDefaults(); update(); });

// ---------- live ops ----------
async function loadOps() {
  $("opsBlock").innerHTML = UI.loading("Loading live numbers...");
  try {
    const s = await MediLinkAPI.getStats();
    const total = s.new + s.forwarded + s.completed;
    const digiPct = s.patients ? Math.round(s.digitisedPatients / s.patients * 100) : 0;
    const channels = Object.entries(s.byChannel).sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `<li class="d-flex justify-content-between"><span>${UI.escapeHtml(c)}</span><strong>${n}</strong></li>`).join("");
    $("opsBlock").innerHTML = `
      <div class="row g-3">
        <div class="col-sm-4">
          <div class="small-caps mb-2">Requests</div>
          <ul class="list-unstyled small mb-0">
            <li class="d-flex justify-content-between"><span>New</span><strong>${s.new}</strong></li>
            <li class="d-flex justify-content-between"><span>With neurologist</span><strong>${s.forwarded}</strong></li>
            <li class="d-flex justify-content-between"><span>Completed</span><strong>${s.completed}</strong></li>
            <li class="d-flex justify-content-between border-top mt-1 pt-1"><span>Total</span><strong>${total}</strong></li>
          </ul>
        </div>
        <div class="col-sm-4">
          <div class="small-caps mb-2">By channel</div>
          <ul class="list-unstyled small mb-0">${channels}</ul>
        </div>
        <div class="col-sm-4">
          <div class="small-caps mb-2">Records digitised</div>
          <div class="fs-3 fw-bold">${digiPct}%</div>
          <div class="progress mb-1" style="height:8px" role="progressbar" aria-label="Records digitised" aria-valuenow="${digiPct}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" style="width:${digiPct}%;background:${COLOR_AFTER}"></div></div>
          <div class="small text-muted">${s.digitisedPatients} of ${s.patients} active patients</div>
          <button class="btn btn-link btn-sm p-0 mt-1" id="useLive">Use this in the model</button>
        </div>
      </div>
      <div class="small text-muted mt-3">Average time from request to completion: <strong>${s.avgResponseHours ? s.avgResponseHours.toFixed(1) + " hours" : "no completed requests yet"}</strong></div>`;
    $("useLive").addEventListener("click", () => {
      $("digitisedShare").value = Math.round(digiPct / 5) * 5; update();
    });
  } catch (err) {
    $("opsBlock").innerHTML = UI.error(err.message);
  }
}

fillDefaults();
update();
loadOps();
