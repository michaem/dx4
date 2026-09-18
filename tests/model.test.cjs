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
  const simulation = path.join(root, 'dx4-simulation-model.js');
  if (fs.existsSync(simulation)) vm.runInContext(fs.readFileSync(simulation, 'utf8'), context);
  const start = html.indexOf('const METRICS =');
  const end = html.indexOf('/* ---------- форматирование', start);
  vm.runInContext(html.slice(start, end) + '\nglobalThis.page = {M, state, compute, dev};', context);
  return context.page;
}

test('overall averages four dimensions with speed 1/16, quality 1/8 and ROI 1/4', () => {
  const p = pageModel();
  p.state.deploy = p.M.deploy.etalon * 2;
  near(p.compute().dim.speed, 25);
  near(p.compute().dim.overall, 100 / 16);
  p.state.cfr = 0;
  near(p.compute().dim.quality, 50);
  near(p.compute().dim.overall, 18.75);
});

test('diagnostic metrics keep zero aggregate weight and Flow changes are visible', () => {
  const p = pageModel();
  p.state.flow = 9;
  p.state.cli = 4;
  p.state.csr = 0;
  p.state.tdv = -20;
  p.state.fdr = 1000;
  p.state.inno = 90;
  near(p.compute().dim.overall, 0);
  near(p.compute().dim.effect, 0);
  near(p.dev('flow'), (9 / p.M.flow.etalon - 1) * 100);
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
  for (const [name, file] of [['MODEL', 'dx4-simulator-model.js'], ['SIMULATION', 'dx4-simulation-model.js']]) {
    const model = fs.readFileSync(path.join(root, file), 'utf8');
    const embedded = html.split(`/* BEGIN ${name} */\n`)[1]?.split(`\n/* END ${name} */`)[0];
    assert.equal(embedded, model);
  }
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
  const m = require('../dx4-simulation-model.js');
  const p = pageModel();
  const bases = Object.fromEntries(Object.values(p.M).map(metric => [metric.k, metric.etalon]));
  const target = m.targetForIndex('deploy', 1, p.state, bases);
  near(m.compute({...p.state, deploy: target.value}, bases).dim.overall, 1);
  for (const dimension of ['overall', 'effect']) {
    const dxi = m.targetForIndex('dxiRaw', 1, p.state, bases, dimension);
    assert.equal(dxi.reachable, true);
    near(m.compute({...p.state, dxiRaw: dxi.value}, bases).dim[dimension], 1);
  }
  assert.equal(m.targetForIndex('dxiRaw', 1, p.state, bases, 'speed'), null);
  assert.equal(m.targetForIndex('dxiRaw', 1000, p.state, bases).reachable, false);
  near(Object.values(m.definitions).reduce((sum, metric) => sum + metric.weight, 0), 1);
  near(m.ratePercent(3, 20), 15);
  assert.equal(m.ratePercent(0, 0), null);
  assert.equal(m.eventBudget(4, 100, 100, 1).possible, false);
  assert.equal(m.eventBudget(0, 0, 100, 1).maxNewEvents, 1);
  assert.deepEqual(m.qualityTarget({cfr: .5, ber: 20}, {cfr: 1, ber: 10}), {cfr: .5, ber: 10});
});


test('DXI improvement and decline change Effectiveness and one quarter of Overall', () => {
  const p = pageModel();
  for (const factor of [1.1, .9]) {
    p.state.dxiRaw = p.M.dxiRaw.etalon * factor;
    near(p.compute().dim.effect, (factor - 1) * 100);
    near(p.compute().dim.overall, (factor - 1) * 25);
    near(p.dev('dxiRaw'), (factor - 1) * 100);
  }
  p.state.dxiRaw = null;
  assert.ok(Number.isNaN(p.compute().dim.effect));
  assert.ok(Number.isNaN(p.compute().dim.overall));
});

test('setting a simulated DXI as the baseline resets its contribution', () => {
  const p = pageModel();
  p.state.dxiRaw = 8.5;
  p.M.dxiRaw.etalon = 8.5;
  near(p.compute().dim.effect, 0);
  near(p.compute().dim.overall, 0);
});
