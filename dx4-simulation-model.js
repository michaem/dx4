/* Scenario calculations include all four dimensions, independent of survey availability. */
(function (root) {
  'use strict';
  const core = typeof module !== 'undefined' && module.exports
    ? require('./dx4-simulator-model.js') : root.DX4Model;
  const definitions = Object.fromEntries(Object.entries(core.definitions).map(([key, metric]) =>
    [key, {...metric, weight: metric.weight * 3 / 4}]));
  definitions.dxiRaw.weight = 1 / 4;

  function deviation(key, value, base) {
    const metric = definitions[key];
    if (!metric?.survey) return core.deviation(key, value, base);
    if (!metric.dir || !Number.isFinite(base)) return NaN;
    if (metric.weight && base === 0) return 0;
    if (!Number.isFinite(value) || base === 0) return NaN;
    return metric.dir * (value - base) / Math.abs(base) * 100;
  }

  function compute(values, bases) {
    const comp = Object.fromEntries(Object.keys(definitions).map(key =>
      [key, deviation(key, values[key], bases[key])]));
    const dim = {};
    for (const key of ['speed', 'effect', 'quality', 'impact']) {
      const metrics = Object.keys(definitions).filter(k => definitions[k].dim === key && definitions[k].weight > 0);
      dim[key] = core.strictMean(metrics.map(k => comp[k]));
    }
    dim.overall = core.strictMean([dim.speed, dim.effect, dim.quality, dim.impact]);
    return {comp, dim};
  }

  function targetForIndex(key, gainPP, values, bases, dimension = 'overall') {
    const m = definitions[key];
    if (!m?.weight || ![gainPP, values[key], bases[key]].every(Number.isFinite) || bases[key] === 0) return null;
    const weight = dimension === 'overall' ? m.weight : dimension === m.dim ? m.weight * 4 : 0;
    if (!weight) return null;
    const raw = values[key] + gainPP * Math.abs(bases[key]) / (100 * m.dir * weight);
    const value = core.bound(key, raw);
    return {value, reachable: Math.abs(value - raw) < 1e-9, raw};
  }

  const api = {...core, definitions, deviation, compute, targetForIndex};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DX4Simulation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
