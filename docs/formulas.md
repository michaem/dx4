# Calculation contract

Synchronized on 2026-09-18 with `DXCore4/docs/dx4-simulator-model.js`, using the simulator methodology dated 2026-09-17. The calculation module is copied verbatim and embedded into the standalone page. Public defaults are teaching examples; they do not represent a current team snapshot. The BER and TDV defaults are synthetic because the previous public values used incompatible metrics or units.

## Aggregate

For a metric with direction `dir` (+1 for higher, -1 for lower):

```text
deviation = dir * (value - base) / abs(base) * 100
speed = mean(cycle, deploy, delivery, through deviations)
quality = mean(cfr, ber deviations)
impact = roi deviation
overall = mean(speed, quality, impact)
```

A zero baseline for an index metric returns zero deviation, even when its value is missing, matching the source guard. Otherwise, a missing input propagates to its dimension and the overall index. Missing inputs are never silently dropped from averages.

| Metric | Measurement | Overall weight |
|---|---|---|
| Cycle Time | Median hours in active task statuses until successful completion | 1/12 |
| Deployment Frequency | Completed Release and Beta Android rollouts / calendar days; VKAI excluded | 1/12 |
| Delivery Time | Median active days until epic delivery | 1/12 |
| Throughput | Successful tasks / active person-months, including partial months | 1/12 |
| CFR | Releases with Failed resolution or causal STOREINC Show-stopper / completed rollouts × 100% | 1/6 |
| BER | Successful Bug / successful (Task + Bug) in regular RUSTORE Release versions × 100% | 1/6 |
| ROI | Deviation of percentage-valued ROI | 1/3 |

BER counts version-task pairs. It excludes STOREINC, Beta Android and lines of code. CFR and BER are bounded to 0–100%. MTTR is absent from this model.

## Survey and diagnostics

DXI, Flow State Frequency and Cognitive Load Index are a single company-wide survey wave. They have no deviation series and no aggregate weight. CLI uses `(load + context complexity + 11 - load adequacy) / 3` with a 4–6 target corridor.

CSR measures transitions between different tasks per person and day. Technical Debt Velocity (TDV) is `(created - resolved) / created * 100` for technical tasks; its improvement is `base - value` in percentage points. TDV can be negative and is capped at 100. FDR measures eligible tasks in delivered Product epics / 7.6158 / months. Innovation Time is the product share of epic delivery time. These diagnostics have weight zero. TDV and Innovation Time are independent, with no complementary relationship.

## ROI

```text
T = eligible tasks / 7.6158
x = T / previous T
r = payroll / previous payroll
d = technical-work share of current capacity
d0 = technical-work share of previous capacity
ROI = ((1 - d) * (x - r) - d0) / d0 * 100
```

If `d0 = 0`, ROI is zero. The source accepts shares in 0–1 and nonnegative capacity and payroll ratios. The page demonstrates a single quarter; the dashboard averages quarterly ROI, including the open quarter. The demo baseline is -49.18%, equivalent to the old public ratio -0.4918.

Splitting an epic while retaining its tasks leaves capacity unchanged. Increasing the number of eligible tasks can still raise capacity, ROI, FDR and Throughput. The slicing preset applies a 50% increase to task counts and capacity. The old optional epic-count protection toggle is removed because the reference model already uses normalized capacity.

Manual ROI targets can be incompatible with the current drivers. The page identifies that case and preserves the target when setting a new baseline. Valid targets and driver outputs are not clipped to presentation slider ranges.

## Verification

`tests/model.test.cjs` checks aggregate weights, diagnostic independence, missing and zero baselines, percentage units, bounds, inverse goals, rates, quality goals and event budgets. It also verifies that the HTML embeds the exact calculation module.

`tests/browser.cjs` checks both languages, presets, ROI controls, custom baselines, independent diagnostics and mobile overflow. `scripts/check-reference.cjs` optionally reads an external source snapshot to compare all four indexes and seven deviations with saved SQL results. Reference snapshots remain outside this repository.
