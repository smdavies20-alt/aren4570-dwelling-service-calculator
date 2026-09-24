import { calculate } from "./calculator.js";

const $ = (selector) => document.querySelector(selector);
const applianceDefinitions = [
  { id: "water-heater", name: "Water heater", rating: 6000, voltage: 240 },
  { id: "dishwasher", name: "Dishwasher", rating: 1500, voltage: 120 },
  { id: "compactor-1", name: "Compactor #1", rating: 900, voltage: 120 },
  { id: "compactor-2", name: "Compactor #2", rating: 800, voltage: 120 },
  { id: "attic-fan", name: "Attic fan", rating: 1600, voltage: 120 },
  { id: "vent-fan", name: "Vent fan", rating: 400, voltage: 120 },
];

const presets = {
  problem1: { area: 3200, ranges: 1, range: 12, dryers: 1, dryer: 6, heating: 30, cooling: 6, appliances: { "water-heater": [1, 6, 240], dishwasher: [1, 1.5, 120], "compactor-1": [1, 0.9, 120], "compactor-2": [1, 0.8, 120], "attic-fan": [1, 1.6, 120], "vent-fan": [1, 0.4, 120] } },
  problem2: { area: 2000, ranges: 1, range: 10, dryers: 1, dryer: 4.5, heating: 15, cooling: 5, appliances: { "water-heater": [1, 3, 240], dishwasher: [1, 1.5, 120], "compactor-1": [0, 0.9, 120], "compactor-2": [0, 0.8, 120], "attic-fan": [0, 1.6, 120], "vent-fan": [0, 0.4, 120] } },
};

function createApplianceRows() {
  $("#appliance-rows").innerHTML = applianceDefinitions.map((a) => `<tr data-id="${a.id}"><th scope="row">${a.name}</th><td><input aria-label="${a.name} quantity" data-field="count" type="number" min="0" max="30" step="1" value="0"></td><td><label class="sr-only" for="${a.id}-rating">${a.name} rating</label><input id="${a.id}-rating" data-field="rating" type="number" min="0" step="0.1" value="${a.rating / 1000}"><span class="cell-unit">kVA</span></td><td><label class="sr-only" for="${a.id}-voltage">${a.name} voltage</label><select id="${a.id}-voltage" data-field="voltage"><option value="120" ${a.voltage === 120 ? "selected" : ""}>120 V</option><option value="240" ${a.voltage === 240 ? "selected" : ""}>240 V</option></select></td></tr>`).join("");
}

function readInput() {
  const appliances = [...document.querySelectorAll("#appliance-rows tr")].map((row) => ({
    name: row.querySelector("th").textContent,
    count: Number(row.querySelector('[data-field="count"]').value),
    ratingVA: Number(row.querySelector('[data-field="rating"]').value) * 1000,
    voltage: Number(row.querySelector('[data-field="voltage"]').value),
  }));
  const otherCount = Number($("#other-count").value);
  const otherRating = Number($("#other-rating").value) * 1000;
  if (otherCount > 0) appliances.push({ name: "Other fixed appliances", count: otherCount, ratingVA: otherRating, voltage: Number($("#other-voltage").value) });
  const repeat = (count, ratingVA) => Array.from({ length: Math.max(0, count) }, () => ({ ratingVA }));
  return {
    floorArea: Number($("#floor-area").value), system: $("#system").value,
    rangeCount: Number($("#range-count").value),
    dryerCount: Number($("#dryer-count").value),
    rangeRatingVA: Number($("#range-rating").value) * 1000,
    dryerRatingVA: Number($("#dryer-rating").value) * 1000,
    ranges: repeat(Number($("#range-count").value), Number($("#range-rating").value) * 1000),
    dryers: repeat(Number($("#dryer-count").value), Number($("#dryer-rating").value) * 1000),
    appliances, heatingVA: Number($("#heating").value) * 1000,
    coolingVA: Number($("#cooling").value) * 1000,
    motorCount: Number($("#motor-count").value), largestMotorVA: Number($("#motor-rating").value) * 1000,
  };
}

function formatVA(va) { return `${Math.round(va).toLocaleString()} VA`; }
function formatKVA(va) { return `${(va / 1000).toFixed(2)} kVA`; }
function conductorText(conductor) { return conductor ? `${conductor.size} THW Cu` : "Above supported table"; }

function renderBreakdown(result) {
  const rows = [
    ["General connected load", `${formatVA(result.generalConnected)} = ${result.input.floorArea} ft² × 3 VA/ft² + 3,000 VA small-appliance circuits + 1,500 VA laundry`],
    ["General-load demand", `${formatVA(result.general.first)} at 100% + ${formatVA(result.general.middle)} at 35% + ${formatVA(result.general.upper)} at 25% = ${formatVA(result.general.demand)}`],
    ["Fixed appliances", `${result.fixed.count} qualifying appliances · ${formatVA(result.fixed.connected)} connected × ${Math.round(result.fixed.factor * 100)}% = ${formatVA(result.fixed.demand)}`],
    ["Ranges", `${formatVA(result.ranges.demand)} demand from ${formatVA(result.ranges.connected)} connected · ${result.ranges.count || 0} range(s)${result.ranges.equalRating === false ? " · mixed ratings use the maximum entered rating for this estimate" : ""}`],
    ["Dryers", `${formatVA(result.dryers.demand)} demand · ${Math.round(result.dryers.factor * 100)}% table factor · per-dryer basis ${result.dryers.perDryer.map(formatVA).join(" + ") || "none"}`],
    ["Heating / cooling", `${result.hvacSelected} selected at ${formatVA(result.hvac)} (heating at 100%; larger noncoincident load)`],
    ["Largest motor adder", `${formatVA(result.motorAdder)} (25% of ${formatVA(result.input.largestMotorVA)}${result.input.motorCount ? "" : "; no separately identified motor"})`],
    ["Total calculated demand", `${formatVA(result.totalDemand)} · ${formatKVA(result.totalDemand)}`],
    ["Service current", `${formatVA(result.totalDemand)} ÷ ${result.input.system === "three" ? `(${Math.sqrt(3).toFixed(3)} × 208 V)` : "240 V"} = ${result.current.toFixed(1)} A`],
    ["Neutral demand", `${formatVA(result.generalNeutral)} general + ${formatVA(result.fixedNeutral)} line-to-neutral fixed appliances + ${formatVA(result.rangeNeutral)} (70% ranges) + ${formatVA(result.dryerNeutral)} (70% dryers) = ${formatVA(result.neutralDemand)}`],
    ["Neutral current", `${formatVA(result.neutralDemand)} ÷ 240 V = ${result.neutralCurrent.toFixed(1)} A`],
    ["Conductor selection", `Select the next copper THW size whose 75°C ampacity meets the calculated current; main breaker is next listed standard rating at or above phase current (100 A dwelling minimum applied).`],
  ];
  $("#breakdown").innerHTML = rows.map(([label, value]) => `<div class="breakdown-row"><span>${label}</span><span>${value}</span></div>`).join("");
}

function validationExpected(key) {
  if (key === "problem1") return { phases: "250 MCM THW Cu", neutral: "2 AWG THW Cu" };
  if (key === "problem2") return { phases: "2/0 AWG THW Cu", neutral: "4 AWG THW Cu", breaker: 175 };
  return null;
}

function render(result) {
  if (result.errors.length) {
    $("#form-errors").innerHTML = `<strong>Check these inputs:</strong><ul>${result.errors.map((error) => `<li>${error}</li>`).join("")}</ul>`;
    $("#results").hidden = true;
    return;
  }
  $("#form-errors").textContent = "";
  $("#results").hidden = false;
  $("#result-system").textContent = result.input.system === "three" ? "120/208 V · 3-phase" : "120/240 V · 1-phase";
  $("#result-demand").textContent = `${formatKVA(result.totalDemand)} · ${formatVA(result.totalDemand)}`;
  $("#result-current").textContent = `Calculated phase current · ${result.current.toFixed(1)} A`;
  $("#result-phase").textContent = conductorText(result.phaseConductor);
  $("#result-phase-sub").textContent = result.phaseLabels.join(" / ") + " · 75°C ampacity basis";
  $("#result-neutral").textContent = conductorText(result.neutralConductor);
  $("#result-neutral-sub").textContent = `${formatVA(result.neutralDemand)} · ${result.neutralCurrent.toFixed(1)} A neutral estimate`;
  $("#result-ground").textContent = result.grounding ? `${result.grounding} THW Cu` : "Outside supplied Table 7.6";
  $("#result-breaker").textContent = result.breaker ? `${result.breaker} A` : "Above supported ratings";
  $("#result-poles").textContent = `${result.poles}-pole · ${result.current.toFixed(1)} A calculated`;
  const expected = validationExpected($("#validation-case").value);
  const banner = $("#validation-banner");
  if (expected) {
    const phase = result.phaseConductor ? conductorText(result.phaseConductor) : "unavailable";
    const mismatches = [];
    if (phase !== expected.phases) mismatches.push(`phase conductor expected ${expected.phases}, calculated ${phase}`);
    if (conductorText(result.neutralConductor) !== expected.neutral) mismatches.push(`neutral expected ${expected.neutral}, calculated ${conductorText(result.neutralConductor)}`);
    if (expected.breaker && result.breaker !== expected.breaker) mismatches.push(`breaker expected ${expected.breaker} A, calculated ${result.breaker ?? "unavailable"} A`);
    banner.hidden = false;
    banner.className = `validation-banner ${mismatches.length ? "validation-mismatch" : "validation-match"}`;
    banner.innerHTML = mismatches.length ? `<strong>Validation case needs review.</strong> ${mismatches.join("; ")}. The breakdown shows the computed values; no expected answer is hardcoded.` : `<strong>Validation case matches.</strong> Calculated conductor and breaker selections match the supplied expected result.`;
  } else banner.hidden = true;
  renderBreakdown(result);
}

function setPreset(key) {
  const preset = presets[key];
  if (!preset) return;
  $("#floor-area").value = preset.area;
  $("#range-count").value = preset.ranges;
  $("#range-rating").value = preset.range;
  $("#dryer-count").value = preset.dryers;
  $("#dryer-rating").value = preset.dryer;
  $("#heating").value = preset.heating;
  $("#cooling").value = preset.cooling;
  for (const row of document.querySelectorAll("#appliance-rows tr")) {
    const [count, rating, voltage] = preset.appliances[row.dataset.id] ?? [0, 0, 120];
    row.querySelector('[data-field="count"]').value = count;
    row.querySelector('[data-field="rating"]').value = rating;
    row.querySelector('[data-field="voltage"]').value = voltage;
  }
  $("#other-count").value = 0;
  $("#other-rating").value = 0;
  $("#motor-count").value = 0;
  $("#motor-rating").value = 0;
  $("#system").value = "split";
  render(calculate(readInput()));
}

createApplianceRows();
$("#calculator-form").addEventListener("submit", (event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; render(calculate(readInput())); });
$("#calculator-form").addEventListener("reset", () => setTimeout(() => {
  $("#validation-case").value = "custom";
  $("#form-errors").textContent = "";
  $("#results").hidden = true;
}, 0));
$("#validation-case").addEventListener("change", (event) => setPreset(event.target.value));
$("#system").addEventListener("change", () => { if (!$("#results").hidden) render(calculate(readInput())); });
$("#validation-case").value = "problem2";
setPreset("problem2");
