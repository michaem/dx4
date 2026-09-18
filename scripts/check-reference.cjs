const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modelPath = path.resolve(__dirname, '../dx4-simulator-model.js');
const [referencePath, snapshotPath] = process.argv.slice(2);
if (!referencePath) throw new Error('Usage: node scripts/check-reference.cjs reference-model.js [snapshot.json]');
assert.equal(fs.readFileSync(modelPath, 'utf8'), fs.readFileSync(referencePath, 'utf8'), 'Model differs from reference');
console.log('Calculation module matches the reference byte for byte');
if (snapshotPath) {
  const model = require(modelPath);
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const near = (actual, expected, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8, label);
  for (const scenario of Object.values(snapshot.scenarios)) {
    const result = model.compute(scenario.values, scenario.etalons);
    for (const key of ['speed', 'quality', 'impact', 'overall']) near(result.dim[key], scenario.dash[key], `${scenario.key}/${key}`);
    for (const [key, value] of Object.entries(scenario.deviations)) near(result.comp[key], value, `${scenario.key}/${key}`);
    if (scenario.roiParams) near(model.roiFrom(scenario.roiParams), scenario.values.roi, `${scenario.key}/ROI drivers`);
  }
  console.log(`All ${Object.keys(snapshot.scenarios).length} reference slices match their saved SQL results within 1e-8`);
}
