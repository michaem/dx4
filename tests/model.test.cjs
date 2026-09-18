const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const near = (actual, expected) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

// Execute the page's actual model adapter without the DOM rendering code.
function pageModel() {
  const context = vm.createContext({EN: false});
  const model = path.join(root, 'dx4-simulator-model.js');
  if (fs.existsSync(model)) vm.runInContext(fs.readFileSync(model, 'utf8'), context);
  const start = html.indexOf('const METRICS =');
  const end = html.indexOf('/* ---------- форматирование', start);
  vm.runInContext(html.slice(start, end) + '\nglobalThis.page = {M, state, compute, dev};', context);
  return context.page;
}

test('overall uses speed, CFR/BER quality and ROI with canonical weights', () => {
  const p = pageModel();
  p.state.deploy = p.M.deploy.etalon * 2;
  near(p.compute().dim.speed, 25);
  near(p.compute().dim.overall, 100 / 12);
  p.state.cfr = 0;
  near(p.compute().dim.quality, 50);
  near(p.compute().dim.overall, 25);
});

test('DXI and diagnostic metrics never change the aggregate', () => {
  const p = pageModel();
  p.state.dxiRaw = 8.5;
  p.state.flow = 9;
  p.state.cli = 4;
  p.state.csr = 0;
  p.state.tdv = -20;
  p.state.fdr = 1000;
  p.state.inno = 90;
  near(p.compute().dim.overall, 0);
  assert.ok(Number.isNaN(p.compute().dim.effect));
  assert.ok(Number.isNaN(p.dev('dxiRaw')));
});

test('zero reference returns zero, and missing nonzero-reference input invalidates the index', () => {
  const p = pageModel();
  p.M.cfr.etalon = 0;
  p.state.cfr = null;
  near(p.dev('cfr'), 0);
  p.state.ber = null;
  assert.ok(Number.isNaN(p.compute().dim.quality));
  assert.ok(Number.isNaN(p.compute().dim.overall));
});

test('quality is percentages, ROI is percentages, TDV replaces the old debt ratio', () => {
  const p = pageModel();
  assert.equal(p.M.ber.unit, '%');
  assert.equal(p.M.roi.unit, '%');
  assert.equal(p.M.mttr, undefined);
  assert.equal(p.M.tdr, undefined);
  assert.equal(p.M.tdv.pp, true);
  p.M.tdv.etalon = 0;
  p.state.tdv = -20;
  near(p.dev('tdv'), 20);
});

test('canonical calculation module is embedded verbatim and every script parses', () => {
  const model = fs.readFileSync(path.join(root, 'dx4-simulator-model.js'), 'utf8');
  const embedded = html.split('/* BEGIN MODEL */\n')[1]?.split('\n/* END MODEL */')[0];
  assert.equal(embedded, model);
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
});

test('ROI units, zero-investment guard and invalid inputs follow the source model', () => {
  const m = require('../dx4-simulator-model.js');
  near(m.roiFrom({d0: .2, d: .2, x: 1, r: 1}), -100);
  near(m.roiFrom({d0: 0, d: .2, x: 2, r: 1}), 0);
  assert.ok(Number.isNaN(m.roiFrom({d0: .2, d: .2, x: -1, r: 1})));
  near(m.deviation('roi', -90, -100), 10);
  assert.equal(m.bound('ber', 200), 100);
  assert.equal(m.bound('roi', 12345), 12345);
});

test('inverse targets, rate counts and event budgets retain source behavior', () => {
  const m = require('../dx4-simulator-model.js');
  const p = pageModel();
  const bases = Object.fromEntries(Object.values(p.M).map(metric => [metric.k, metric.etalon]));
  const target = m.targetForIndex('deploy', 1, p.state, bases);
  near(m.compute({...p.state, deploy: target.value}, bases).dim.overall, 1);
  near(m.ratePercent(3, 20), 15);
  assert.equal(m.ratePercent(0, 0), null);
  assert.equal(m.eventBudget(4, 100, 100, 1).possible, false);
  assert.equal(m.eventBudget(0, 0, 100, 1).maxNewEvents, 1);
  assert.deepEqual(m.qualityTarget({cfr: .5, ber: 20}, {cfr: 1, ber: 10}), {cfr: .5, ber: 10});
});
