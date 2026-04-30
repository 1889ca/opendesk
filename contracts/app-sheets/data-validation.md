# Contract: Sheets Data Validation

## Purpose

Provide cell-level data validation for spreadsheets: dropdown lists, numeric/date range constraints, text length limits, custom formula validation, input guidance messages, and error alerts on invalid entry.

## Inputs

- `Y.Doc` — Yjs document containing validation rules keyed by `data-validation-{sheetId}`
- Cell value (string) — the raw value being validated
- Validation rule — defines the constraint type, parameters, and user-facing messages
- User interactions — cell focus (show input message), cell blur (validate), dropdown click

## Outputs

- Validation result: `{ valid: boolean; message?: string }`
- Visual cell indicators: dropdown arrow for list rules, colored border for invalid cells
- Dropdown overlay: positioned list of allowed values for list-type rules
- Input message tooltip: guidance shown on cell focus
- Error alert: shown on cell blur when value is invalid

## Side Effects

- Mutates Yjs shared state inside `ydoc.transact()` for rule CRUD
- Creates/destroys DOM overlays for dropdown lists and input messages
- Prevents or warns on invalid cell entry (configurable: stop, warning, info)

## Invariants

1. **Rules are per-cell-range.** Each rule targets a rectangular range `{ startRow, startCol, endRow, endCol }`.
2. **Yjs-transacted mutations.** All rule changes occur inside `ydoc.transact()`.
3. **Non-destructive.** Validation never prevents saving a value — it only warns/highlights. The `reject` error style prevents committing the value.
4. **Collaborative sync.** Rules replicate to all collaborators via Yjs.
5. **Dropdown values are static or range-based.** List items come from a comma-separated string or a cell range reference.
6. **No mock data.** Real cell values and rules only.

## Dependencies

- `yjs` (runtime) — Yjs shared types for collaborative rule storage
- `@opendesk/app-sheets` (compile-time) — Grid rendering, cell focus/blur lifecycle

## Boundary Rules

### MUST

- Wrap all Yjs mutations in `ydoc.transact()`
- Keep every file under 200 lines
- Use modern CSS (no Tailwind)
- Show dropdown arrow indicator on cells with list validation
- Show colored border on cells with invalid values

### MUST NOT

- Import server-side modules
- Use mock data
- Block cell value commits (except `reject` error style)
- Exceed 200 lines per file

## File Structure

```
modules/app-sheets/internal/data-validation/
  types.ts         — ValidationRule, ValidationType, ErrorStyle types
  store.ts         — Yjs-backed rule CRUD and observation
  engine.ts        — Validation logic: check value against rule
  engine.test.ts   — Property-based and unit tests for engine
  dropdown.ts      — Dropdown overlay for list-type validation
  dialog.ts        — Rule editor dialog UI
  renderer.ts      — Cell visual indicators (dropdown arrows, error borders)
  css/
    (styles in modules/app-sheets/internal/css/sheets-data-validation.css)
```

## Verification

1. **List validation** — Cells with list rules show dropdown; only listed values pass.
2. **Number validation** — Numeric constraints reject out-of-range values.
3. **Text length** — Text length constraints reject too-short/long values.
4. **Custom formula** — Formula-based rules evaluate correctly.
5. **Error styles** — `reject` prevents commit, `warning` allows with highlight, `info` shows message only.
6. **Collaborative** — Rules sync between collaborators.
7. **Build** — `npm run build` succeeds.
