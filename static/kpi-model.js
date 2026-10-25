/* ==========================================================
   MediLink - retrieval time and cost model (front end copy)

   This mirrors the supply chain model your teammate builds in
   Python (Step 2 of the guide). Keep the two in sync. When the
   Flask API exists, the dashboard will call
       GET /api/kpis?retrievals=22&delayRate=0.45...
   and the Python module will do this maths instead.

   Baseline numbers come from the neurologist interview used
   in the proposal (Problem Statement section).
   ========================================================== */

const KPI_DEFAULTS = {
  retrievalsPerDay: 22,     // average daily file retrievals
  delayRate: 0.45,          // share of retrievals that are delayed (misplaced 20% + slow filing 20% + mixed <5%)
  extraMinutesPerDelay: 10, // extra minutes per delayed retrieval (cautious estimate)
  baseMinutes: 5,           // best-case time to find a paper file
  digitalLookupMinutes: 1,  // ASSUMPTION - time to open a digital record by patient number
  adminRatePerHour: 78,     // admin pay, Rand per hour
  workingDaysPerMonth: 22,
  digitisedShare: 0.6       // share of requested files already digitised (what-if slider)
};

/**
 * Works out the before and after numbers.
 * Before = everything on paper.
 * After  = digitised files take digitalLookupMinutes with no delays,
 *          files still on paper behave like before.
 */
function computeKpis(input) {
  const i = { ...KPI_DEFAULTS, ...input };
  const s = Math.min(Math.max(i.digitisedShare, 0), 1);

  const paperAvgMin = i.baseMinutes + i.delayRate * i.extraMinutesPerDelay;

  const before = {
    avgRetrievalMin: paperAvgMin,
    delayedPerDay: i.retrievalsPerDay * i.delayRate,
    delayHoursPerDay: i.retrievalsPerDay * i.delayRate * i.extraMinutesPerDelay / 60,
    totalRetrievalHoursPerDay: i.retrievalsPerDay * paperAvgMin / 60
  };
  const after = {
    avgRetrievalMin: s * i.digitalLookupMinutes + (1 - s) * paperAvgMin,
    delayedPerDay: i.retrievalsPerDay * i.delayRate * (1 - s),
    delayHoursPerDay: i.retrievalsPerDay * i.delayRate * (1 - s) * i.extraMinutesPerDelay / 60,
    totalRetrievalHoursPerDay: i.retrievalsPerDay * (s * i.digitalLookupMinutes + (1 - s) * paperAvgMin) / 60
  };

  const money = h => ({
    perMonth: h * i.adminRatePerHour * i.workingDaysPerMonth,
    perYear: h * i.adminRatePerHour * i.workingDaysPerMonth * 12
  });
  before.delayCost = money(before.delayHoursPerDay);
  after.delayCost = money(after.delayHoursPerDay);

  return {
    inputs: i,
    before,
    after,
    savings: {
      hoursPerDay: before.delayHoursPerDay - after.delayHoursPerDay,
      perMonth: before.delayCost.perMonth - after.delayCost.perMonth,
      perYear: before.delayCost.perYear - after.delayCost.perYear,
      retrievalTimeCutPct: (1 - after.avgRetrievalMin / before.avgRetrievalMin) * 100
    }
  };
}
