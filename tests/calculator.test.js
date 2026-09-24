import test from "node:test";
import assert from "node:assert/strict";
import { calculate, generalDemand, fixedApplianceDemand, rangeDemand, dryerDemand, groundingConductor, selectAmpacity, selectBreaker } from "../src/calculator.js";

test("general demand applies all three demand tiers", () => {
  assert.deepEqual(generalDemand(3000), { first: 3000, middle: 0, upper: 0, demand: 3000 });
  assert.equal(generalDemand(120000).demand, 43950);
  assert.equal(generalDemand(130000).demand, 46450);
});

test("fixed-appliance demand changes at four appliances", () => {
  const three = fixedApplianceDemand([{ name: "test", count: 3, ratingVA: 1000, voltage: 120 }]);
  const four = fixedApplianceDemand([{ name: "test", count: 4, ratingVA: 1000, voltage: 120 }]);
  assert.equal(three.demand, 3000);
  assert.equal(four.demand, 3000);
  assert.equal(three.factor, 1);
  assert.equal(four.factor, 0.75);
});

test("single range uses Column C base demand and rating adjustment above 12 kW", () => {
  assert.equal(rangeDemand([{ ratingVA: 12000 }]).demand, 8000);
  assert.equal(rangeDemand([{ ratingVA: 13000 }]).demand, 8400);
});

test("dryer demand uses 5 kVA minimum and table factors", () => {
  assert.equal(dryerDemand([{ ratingVA: 4500 }]).demand, 5000);
  assert.equal(dryerDemand(Array.from({ length: 5 }, () => ({ ratingVA: 6000 }))).demand, 25500);
});

test("selection uses the first ampacity or breaker at/above load", () => {
  assert.equal(selectAmpacity(151).size, "2/0 AWG");
  assert.equal(selectBreaker(152), 175);
});

test("textbook Table 7.6 service grounding conductor ranges map correctly", () => {
  assert.equal(groundingConductor("2 AWG"), "8 AWG");
  assert.equal(groundingConductor("3 AWG"), "8 AWG");
  assert.equal(groundingConductor("1/0 AWG"), "6 AWG");
  assert.equal(groundingConductor("2/0 AWG"), "4 AWG");
  assert.equal(groundingConductor("4/0 AWG"), "2 AWG");
  assert.equal(groundingConductor("400 MCM"), "1/0 AWG");
  assert.equal(groundingConductor("700 MCM"), "2/0 AWG");
});

const common = { system: "split", motorCount: 0, largestMotorVA: 0 };
test("Problem 1 fixture exposes computed result for comparison", () => {
  const result = calculate({ ...common, floorArea: 3200, ranges: [{ ratingVA: 12000 }], dryers: [{ ratingVA: 6000 }], heatingVA: 30000, coolingVA: 6000, appliances: [
    { name: "Water heater", count: 1, ratingVA: 6000, voltage: 240 }, { name: "Dishwasher", count: 1, ratingVA: 1500, voltage: 120 },
    { name: "Compactor 1", count: 1, ratingVA: 900, voltage: 120 }, { name: "Compactor 2", count: 1, ratingVA: 800, voltage: 120 },
    { name: "Attic fan", count: 1, ratingVA: 1600, voltage: 120 }, { name: "Vent fan", count: 1, ratingVA: 400, voltage: 120 },
  ] });
  assert.equal(result.totalDemand, 59285);
  assert.equal(result.phaseConductor.size, "250 MCM");
  // This exposes the mismatch with the supplied #2 AWG course answer for follow-up.
  assert.equal(result.neutralConductor.size, "3 AWG");
});

test("Problem 2 fixture validates phase conductor and breaker while showing neutral result", () => {
  const result = calculate({ ...common, floorArea: 2000, ranges: [{ ratingVA: 10000 }], dryers: [{ ratingVA: 4500 }], heatingVA: 15000, coolingVA: 5000, appliances: [
    { name: "Dishwasher", count: 1, ratingVA: 1500, voltage: 120 }, { name: "Water heater", count: 1, ratingVA: 3000, voltage: 240 },
  ] });
  assert.equal(result.phaseConductor.size, "2/0 AWG");
  assert.equal(result.breaker, 175);
  assert.equal(result.neutralConductor.size, "4 AWG");
});

test("neutral estimate excludes line-to-line fixed loads and selects larger HVAC load", () => {
  const result = calculate({ ...common, floorArea: 1000, ranges: [], dryers: [], heatingVA: 8000, coolingVA: 12000, appliances: [
    { name: "Line-to-neutral", count: 1, ratingVA: 2000, voltage: 120 }, { name: "Line-to-line", count: 1, ratingVA: 4000, voltage: 240 },
  ] });
  assert.equal(result.hvac, 12000);
  assert.equal(result.hvacSelected, "Cooling / A/C");
  assert.equal(result.fixedNeutral, 2000);
  assert.equal(result.neutralDemand, result.general.demand + 2000);
});
