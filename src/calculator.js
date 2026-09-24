export const AMPACITY_75C_CU = [
  { size: "14 AWG", amps: 20 }, { size: "12 AWG", amps: 25 }, { size: "10 AWG", amps: 35 },
  { size: "8 AWG", amps: 50 }, { size: "6 AWG", amps: 65 }, { size: "4 AWG", amps: 85 },
  { size: "3 AWG", amps: 100 }, { size: "2 AWG", amps: 115 }, { size: "1 AWG", amps: 130 },
  { size: "1/0 AWG", amps: 150 }, { size: "2/0 AWG", amps: 175 }, { size: "3/0 AWG", amps: 200 },
  { size: "4/0 AWG", amps: 230 }, { size: "250 MCM", amps: 255 }, { size: "300 MCM", amps: 285 },
  { size: "350 MCM", amps: 310 }, { size: "400 MCM", amps: 335 }, { size: "500 MCM", amps: 380 },
  { size: "600 MCM", amps: 420 }, { size: "700 MCM", amps: 460 }, { size: "750 MCM", amps: 475 },
  { size: "800 MCM", amps: 490 }, { size: "900 MCM", amps: 520 }, { size: "1000 MCM", amps: 545 },
  { size: "1250 MCM", amps: 590 }, { size: "1500 MCM", amps: 625 }, { size: "1750 MCM", amps: 650 },
  { size: "2000 MCM", amps: 665 },
];

export const STANDARD_BREAKERS = [100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000];

const DRYER_FACTORS = [100, 100, 100, 100, 85, 75, 65, 60, 55, 50, 47];

export function generalDemand(va) {
  const first = Math.min(va, 3000);
  const middle = Math.min(Math.max(va - 3000, 0), 117000);
  const upper = Math.max(va - 120000, 0);
  return { first, middle, upper, demand: first + middle * 0.35 + upper * 0.25 };
}

export function rangeDemand(ranges) {
  const count = ranges.length;
  if (!count) return { connected: 0, demand: 0, base: 0, adjustment: 0, factor: 0 };
  if (count > 25) throw new RangeError("Range demand table supports up to 25 ranges.");
  const ratings = ranges.map((r) => r.ratingVA / 1000);
  const equalRating = ratings.every((rating) => Math.abs(rating - ratings[0]) < 0.001);
  const rating = Math.max(...ratings);
  let base;
  if (count <= 1) base = 8;
  else if (count === 2) base = 11;
  else if (count <= 5) base = 14 + (count - 3) * 3;
  else if (count <= 20) base = 20 + (count - 5);
  else base = 35 + (count - 20);
  // Table 220.55 Note 1: increase Column C demand 5% per kW (or major fraction) above 12 kW.
  const excessOver12 = Math.max(0, Math.ceil((rating - 12) - 1e-9));
  const adjustment = 1 + excessOver12 * 0.05;
  let demand = base * adjustment;
  // If ratings vary, the table's Column C calculation is not directly applicable without the permitted Note 3 method.
  if (!equalRating) {
    const sorted = [...ratings].sort((a, b) => a - b);
    const firstBase = count <= 1 ? 8 : count === 2 ? 11 : count <= 5 ? 14 + (count - 3) * 3 : count <= 20 ? 20 + count - 5 : 35 + (count - 20) * 1.5;
    // Use the table demand at the highest rating as a conservative, clearly disclosed estimate.
    base = firstBase;
  }
  return { count, connected: ranges.reduce((sum, r) => sum + r.ratingVA, 0), demand: demand * 1000, base: base * 1000, adjustment, factor: demand / Math.max(ranges.reduce((sum, r) => sum + r.ratingVA / 1000, 0), 0.001), equalRating };
}

export function dryerDemand(dryers) {
  const count = dryers.length;
  if (!count) return { connected: 0, demand: 0, factor: 0, perDryer: [] };
  if (count > 42) throw new RangeError("Dryer demand table supports up to 42 dryers.");
  const perDryer = dryers.map((dryer) => Math.max(5000, dryer.ratingVA));
  const factor = count <= 4 ? 1 : count <= 10 ? DRYER_FACTORS[count - 1] / 100 : count <= 23 ? (0.47 - 0.01 * (count - 11)) : count <= 42 ? (0.35 - 0.005 * (count - 23)) : 0.25;
  return { connected: perDryer.reduce((a, b) => a + b, 0), demand: perDryer.reduce((a, b) => a + b, 0) * factor, factor, perDryer };
}

export function fixedApplianceDemand(appliances) {
  const qualifying = appliances.filter((a) => a.count > 0 && a.ratingVA > 0);
  const count = qualifying.reduce((sum, a) => sum + a.count, 0);
  const connected = qualifying.reduce((sum, a) => sum + a.count * a.ratingVA, 0);
  const factor = count >= 4 ? 0.75 : 1;
  return { count, connected, factor, demand: connected * factor, neutralConnected: qualifying.filter((a) => a.voltage === 120).reduce((sum, a) => sum + a.count * a.ratingVA, 0) };
}

export function selectAmpacity(current) {
  if (!(current > 0)) return AMPACITY_75C_CU[0];
  return AMPACITY_75C_CU.find((item) => item.amps >= current) ?? null;
}

export function selectBreaker(current) {
  const minimum = Math.max(100, current);
  return STANDARD_BREAKERS.find((amps) => amps >= minimum) ?? null;
}

export function groundingConductor(serviceSize) {
  const index = AMPACITY_75C_CU.findIndex((row) => row.size === serviceSize);
  if (index < 0) return null;
  if (index < 6) return null;
  if (index <= 7) return "8 AWG";
  if (index <= 9) return "6 AWG";
  if (index <= 11) return "4 AWG";
  if (index <= 15) return "2 AWG";
  if (index <= 18) return "1/0 AWG";
  if (index <= 23) return "2/0 AWG";
  return null;
}

export function calculate(input) {
  const errors = validateInput(input);
  if (errors.length) return { errors };
  const generalConnected = input.floorArea * 3 + 3000 + 1500;
  const general = generalDemand(generalConnected);
  const fixed = fixedApplianceDemand(input.appliances);
  const ranges = rangeDemand(input.ranges);
  const dryers = dryerDemand(input.dryers);
  const hvac = Math.max(input.heatingVA, input.coolingVA);
  const motorAdder = input.motorCount > 0 ? input.largestMotorVA * 0.25 : 0;
  const totalDemand = general.demand + fixed.demand + ranges.demand + dryers.demand + hvac + motorAdder;
  const volts = input.system === "three" ? 208 : 240;
  const current = input.system === "three" ? totalDemand / (Math.sqrt(3) * volts) : totalDemand / volts;
  const generalNeutral = general.demand;
  const fixedNeutral = fixed.neutralConnected * fixed.factor;
  const rangeNeutral = ranges.demand * 0.7;
  const dryerNeutral = dryers.demand * 0.7;
  const neutralDemand = generalNeutral + fixedNeutral + rangeNeutral + dryerNeutral;
  const neutralCurrent = neutralDemand / 240;
  const phaseConductor = selectAmpacity(current);
  const neutralConductor = selectAmpacity(neutralCurrent);
  const breaker = selectBreaker(current);
  const grounding = phaseConductor ? groundingConductor(phaseConductor.size) : null;
  return {
    errors: [], input, generalConnected, general, fixed, ranges, dryers, hvac,
    hvacSelected: input.heatingVA >= input.coolingVA ? "Heating" : "Cooling / A/C",
    motorAdder, totalDemand, current, volts, neutralDemand, neutralCurrent,
    generalNeutral, fixedNeutral, rangeNeutral, dryerNeutral,
    phaseConductor, neutralConductor, breaker, grounding,
    poles: input.system === "three" ? 3 : 2,
    phaseLabels: input.system === "three" ? ["Phase A", "Phase B", "Phase C"] : ["Phase A", "Phase B"],
  };
}

export function validateInput(input) {
  const errors = [];
  if (!Number.isFinite(input.floorArea) || input.floorArea <= 0) errors.push("Enter a floor area greater than 0 ft².");
  if (!Array.isArray(input.ranges) || input.ranges.length > 25) errors.push("Enter between 0 and 25 ranges.");
  if (!Array.isArray(input.dryers) || input.dryers.length > 42) errors.push("Enter between 0 and 42 dryers.");
  if (input.rangeCount !== undefined && (!Number.isInteger(input.rangeCount) || input.rangeCount < 0 || input.rangeCount > 25)) errors.push("Range quantity must be a whole number from 0 to 25.");
  if (input.dryerCount !== undefined && (!Number.isInteger(input.dryerCount) || input.dryerCount < 0 || input.dryerCount > 42)) errors.push("Dryer quantity must be a whole number from 0 to 42.");
  const rangeRating = input.rangeRatingVA ?? input.ranges?.[0]?.ratingVA;
  const dryerRating = input.dryerRatingVA ?? input.dryers?.[0]?.ratingVA;
  if ((input.rangeCount ?? input.ranges?.length ?? 0) > 0 && (!Number.isFinite(rangeRating) || rangeRating <= 1750)) errors.push("Enter a range rating greater than 1.75 kVA.");
  if ((input.dryerCount ?? input.dryers?.length ?? 0) > 0 && (!Number.isFinite(dryerRating) || dryerRating <= 0)) errors.push("Enter a dryer nameplate rating greater than 0 kVA.");
  for (const [name, value] of [["Heating", input.heatingVA], ["Cooling", input.coolingVA], ["Largest motor", input.largestMotorVA]]) {
    if (!Number.isFinite(value) || value < 0) errors.push(`${name} load cannot be negative.`);
  }
  if (!Number.isInteger(input.motorCount) || input.motorCount < 0) errors.push("Motor count must be a nonnegative whole number.");
  for (const appliance of input.appliances ?? []) {
    if (!Number.isInteger(appliance.count) || appliance.count < 0 || !Number.isFinite(appliance.ratingVA) || appliance.ratingVA < 0) {
      errors.push(`${appliance.name}: enter a nonnegative whole-number quantity and nonnegative rating.`);
    }
    if (![120, 240].includes(appliance.voltage)) errors.push(`${appliance.name}: select 120 V or 240 V.`);
    if (appliance.count > 0 && appliance.ratingVA <= 0) errors.push(`${appliance.name}: enter a rating greater than 0 VA.`);
  }
  for (const load of [...(input.ranges ?? []), ...(input.dryers ?? [])]) {
    if (!Number.isFinite(load.ratingVA) || load.ratingVA < 0) errors.push("Range and dryer ratings cannot be negative.");
  }
  return errors;
}
