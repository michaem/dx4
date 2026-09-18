/* Pure calculations. Embedded into the standalone HTML by bin/build-dx4-simulator.mjs. */
(function (root) {
  "use strict";
  const definitions = {
    cycle: {dir:-1, dim:"speed", weight:1/12},
    deploy: {dir:1, dim:"speed", weight:1/12},
    delivery: {dir:-1, dim:"speed", weight:1/12},
    through: {dir:1, dim:"speed", weight:1/12},
    cfr: {dir:-1, dim:"quality", weight:1/6},
    ber: {dir:-1, dim:"quality", weight:1/6},
    roi: {dir:1, dim:"impact", weight:1/3},
    dxiRaw: {dir:1, dim:"effect", weight:0, survey:true},
    flow: {dir:1, dim:"effect", weight:0, survey:true},
    cli: {dir:0, dim:"effect", weight:0, survey:true},
    csr: {dir:-1, dim:"effect", weight:0},
    tdv: {dir:-1, dim:"quality", weight:0, pp:true},
    fdr: {dir:1, dim:"impact", weight:0},
    inno: {dir:1, dim:"impact", weight:0}
  };
  const finite = Number.isFinite;
  const strictMean = xs => xs.length && xs.every(finite) ? xs.reduce((a,b)=>a+b,0)/xs.length : NaN;
  function deviation(key, value, base) {
    const m = definitions[key];
    if (!m || !m.dir || !finite(base) || m.survey) return NaN;
    // Common explicitly returns zero for a zero reference, before checking the value.
    if (m.weight && base === 0) return 0;
    if (!finite(value)) return NaN;
    if (m.pp) return m.dir * (value-base);
    if (base === 0) return NaN;
    return m.dir * (value-base) / Math.abs(base) * 100;
  }
  function compute(values, bases) {
    const comp = Object.fromEntries(Object.keys(definitions).map(k=>[k,deviation(k,values[k],bases[k])]));
    const dim = {
      speed:strictMean([comp.cycle,comp.deploy,comp.delivery,comp.through]),
      quality:strictMean([comp.cfr,comp.ber]), impact:comp.roi, effect:NaN
    };
    dim.overall = strictMean([dim.speed,dim.quality,dim.impact]);
    return {comp,dim};
  }
  function bound(key,value) {
    if (!finite(value)) return null;
    if (key === "roi") return value;
    if (key === "tdv") return Math.min(100,value);
    if (["dxiRaw","cli"].includes(key)) return Math.max(1,Math.min(10,value));
    if (key === "flow") return Math.max(0,Math.min(10,value));
    if (["cfr","ber","inno"].includes(key)) return Math.max(0,Math.min(100,value));
    return Math.max(0,value);
  }
  function improve(values,fraction,keys=Object.keys(definitions)) {
    const next={...values};
    for(const k of keys){const m=definitions[k];if(m.dir && finite(values[k]))next[k]=bound(k,values[k]+m.dir*Math.abs(values[k])*fraction);}
    return next;
  }
  function roiFrom({d0,d,x,r}) {
    if (![d0,d,x,r].every(finite) || d0<0 || d0>1 || d<0 || d>1 || x<0 || r<0) return NaN;
    return d0===0 ? 0 : ((1-d)*(x-r)-d0)/d0*100;
  }
  function targetForIndex(key, gainPP, values, bases, dimension="overall") {
    const m=definitions[key];
    if (!m?.weight || !finite(values[key]) || !finite(bases[key]) || bases[key]===0 || !finite(gainPP)) return null;
    const w=dimension==="overall" ? m.weight : dimension===m.dim ? m.weight*3 : 0;
    if (!w) return null;
    const raw=values[key]+gainPP*Math.abs(bases[key])/(100*m.dir*w);
    return {value:bound(key,raw),reachable:Math.abs(bound(key,raw)-raw)<1e-9,raw};
  }
  function ratePercent(numerator, denominator) {
    if (![numerator,denominator].every(finite) || numerator<0 || denominator<=0 || numerator>denominator) return null;
    return numerator/denominator*100;
  }
  function qualityTarget(values, targets) {
    const next={...values};
    for (const k of ['cfr','ber']) {
      if (finite(values[k]) && finite(targets[k])) next[k]=Math.min(values[k],bound(k,targets[k]));
    }
    return next;
  }
  function eventBudget(currentEvents,currentTotal,futureTotal,targetPercent) {
    if (![currentEvents,currentTotal,futureTotal].every(Number.isInteger) || currentEvents<0 || currentTotal<currentEvents || futureTotal<0 || !finite(targetPercent) || targetPercent<0 || targetPercent>100) return null;
    const maxNewEvents=Math.floor(targetPercent/100*(currentTotal+futureTotal)+1e-9)-currentEvents;
    return {futureTotal,maxNewEvents,possible:maxNewEvents>=0,futureRateLimit:futureTotal>0?maxNewEvents/futureTotal*100:null};
  }
  const api={definitions,strictMean,deviation,compute,bound,improve,roiFrom,targetForIndex,ratePercent,qualityTarget,eventBudget};
  if (typeof module !== "undefined" && module.exports) module.exports=api;
  else root.DX4Model=api;
})(typeof globalThis !== "undefined" ? globalThis : this);
