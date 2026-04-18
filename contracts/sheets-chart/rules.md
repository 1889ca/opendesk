# Contract: sheets-chart

## Purpose

Transform spreadsheet cell data and chart configuration into platform-agnostic SVG chart output. Pure computation module — no DOM, no I/O, no side effects. Supports bar, line, pie, and scatter chart types with multi-series support, axis rendering, and legends.

## Inputs

- `config`: `ChartConfig` — Chart type, data range references, series definitions, title, axis labels, dimensions
- `data`: `ChartDataInput` — Raw cell values organized as rows of columns (string[][]), with optional header row

## Outputs

- `ChartSVG`: `string` — Complete SVG string ready for DOM insertion or file export
- `ChartSpec`: Intermediate chart specification (computed geometry, scales, series data) for inspection/debugging

## Side Effects

None. This module is pure computation: data extraction, scale computation, geometry calculation, and SVG string generation. No I/O, no network, no database, no filesystem, no DOM manipulation.

## Invariants

1. **Pure function.** Same config + data always produces the same SVG output.
2. **Graceful degradation.** Empty data produces a valid SVG with "No data" message. Invalid series indices produce an error result, never a crash.
3. **SVG well-formedness.** Output is always valid SVG 1.1 markup.
4. **Color consistency.** Series colors are deterministic — series index N always maps to the same color within a palette.
5. **Scale correctness.** Linear scales compute correct min/max with 10% padding. Zero is always included when data is all-positive or all-negative.
6. **Pie chart normalization.** Slice angles always sum to exactly 2π. Negative values are treated as zero.
7. **No dependencies on other OpenDesk modules.** This is a leaf module.
8. **Dimension constraints.** Output SVG respects the width/height specified in config. Default is 600×400.

## Dependencies

- `zod` (runtime) — schema validation at boundaries

No other OpenDesk module may be imported by `sheets-chart`.

## Boundary Rules

### MUST

- Export all public types via `contract.ts` with Zod schemas.
- Export `renderChart(config: ChartConfig, data: ChartDataInput): ChartOutput` as the public API.
- Support chart types: `bar`, `line`, `pie`, `scatter`.
- Support multiple data series for bar, line, and scatter charts.
- Render axes with tick marks and labels for cartesian charts (bar, line, scatter).
- Render a legend when multiple series are present.
- Return typed errors (never throw) for invalid configuration.
- Keep every file under 200 lines.
- Use no external charting libraries — built from scratch.

### MUST NOT

- Import any other OpenDesk module.
- Perform I/O of any kind (network, disk, database, DOM).
- Export mutable state.
- Throw exceptions for error conditions (use typed error returns).
- Use `any` or `unknown` in exported type positions.
- Mutate input data or config during processing.

## Verification

1. **Pure function** — Property test: render same config+data twice, assert SVG strings are identical.
2. **Graceful degradation** — Unit test: empty data produces valid SVG with message; out-of-range series index returns error.
3. **SVG well-formedness** — Unit test: output starts with `<svg` and ends with `</svg>`, contains no unclosed tags.
4. **Scale correctness** — Unit test: known data sets produce expected min/max/tick values.
5. **Pie normalization** — Property test: all slice angles sum to 2π (within floating-point epsilon).
6. **Multi-series** — Unit test: 3-series line chart produces 3 `<polyline>` elements with distinct colors.
7. **Dimension constraints** — Unit test: output SVG has correct width/height attributes matching config.

## File Structure

```
modules/sheets-chart/
  contract.ts                    — Zod schemas, public types
  index.ts                       — Public API re-exports
  internal/
    types.ts                     — Internal geometry types
    color-palette.ts             — Deterministic color schemes
    data-series.ts               — Extract typed series from raw cell data
    scale-linear.ts              — Linear scale (continuous numeric axis)
    scale-band.ts                — Band scale (categorical axis)
    chart-layout.ts              — Compute chart area, margins, axis positions
    svg-builder.ts               — SVG element string builder utilities
    render-axes.ts               — Axis lines, ticks, labels
    render-legend.ts             — Legend rendering
    render-bar.ts                — Bar chart SVG generation
    render-line.ts               — Line chart SVG generation
    render-pie.ts                — Pie chart SVG generation
    render-scatter.ts            — Scatter chart SVG generation
```
