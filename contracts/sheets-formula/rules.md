# Contract: sheets-formula

## Purpose

Parse and evaluate Excel-compatible formula strings against a cell data grid, producing computed values or typed errors. Pure logic module with no I/O, no DOM, no side effects.

## Inputs

- `formula`: `string` — An Excel-compatible formula string (e.g., `=SUM(A1:B3)`, `=IF(A1>0, A1*2, 0)`)
- `grid`: `CellGrid` — A map of cell addresses to cell values, representing the spreadsheet data
- `cellRef`: `CellAddress` — The address of the cell containing the formula (for circular reference detection)

## Outputs

- `FormulaResult`: `CellValue | FormulaError` — The computed value or a typed error
- `FormulaAST`: The parsed abstract syntax tree of a formula (for inspection/debugging)
- `DependencySet`: `Set<string>` — The set of cell addresses a formula depends on

## Side Effects

None. This module is pure computation: parsing, evaluation, and dependency analysis. No I/O, no network, no database, no filesystem, no DOM.

## Invariants

1. **Parsing is deterministic.** The same formula string always produces the same AST.
2. **Evaluation is referentially transparent.** Given the same formula and the same grid, evaluation always produces the same result.
3. **All Excel error types are representable.** The engine handles: `#VALUE!`, `#REF!`, `#DIV/0!`, `#NAME?`, `#N/A`, `#NULL!`, `#NUM!`.
4. **Circular references are detected, never infinite-looped.** The engine builds a dependency graph and detects cycles before evaluation, returning `#REF!` for circular cells.
5. **Cell references are resolved correctly.** `A1`, `$A$1`, `A1:B3` ranges, and mixed references (`$A1`, `A$1`) all resolve to the correct cells.
6. **Error propagation follows Excel semantics.** If a referenced cell contains an error, that error propagates through dependent formulas (unless caught by IFERROR/similar).
7. **Function library is extensible.** New functions can be registered without modifying the evaluator.
8. **Empty/missing cells evaluate to 0 (numeric context) or "" (string context).** Matches Excel behavior.
9. **Cross-sheet references are parsed and evaluated.** `Sheet2!A1`, `Sheet2!A1:B3`, and `'Sheet Name'!A1` (quoted, with `''` escape for embedded quotes) are all valid syntax.
10. **Missing sheets return `#REF!`.** If a cross-sheet reference targets a sheet not present in the `MultiSheetGrid`, the evaluator returns a `#REF!` error — it never throws.
11. **Cross-sheet context is opt-in.** `evaluateFormula` (single-sheet API) is unchanged. `evaluateFormulaMultiSheet` accepts a `MultiSheetGrid` and resolves cross-sheet refs. Calling `evaluateFormula` with a formula containing cross-sheet refs returns `#REF!`.
12. **Cross-sheet dependency extraction is qualified.** `extractDependencies` returns cross-sheet deps as `SheetName!CellRef` strings so the caller can distinguish them from same-sheet deps.

## Dependencies

None. This is a leaf module. It imports only:
- `zod` (runtime schema validation at boundaries)

No other OpenDesk module may be imported by `sheets-formula`.

## Boundary Rules

### MUST

- Export all public types via `contract.ts` with Zod schemas.
- Export `parseFormula(formula: string): FormulaAST | FormulaError` as the public parsing API.
- Export `evaluateFormula(formula: string, grid: CellGrid, cellRef: CellAddress): FormulaResult` as the public evaluation API (single-sheet, backwards-compatible).
- Export `evaluateFormulaMultiSheet(formula: string, grid: CellGrid, cellRef: CellAddress, multiSheet: MultiSheetGrid): FormulaResult` for cross-sheet evaluation.
- Export `getDependencies(formula: string): DependencySet` for dependency graph construction.
- Export `detectCircular(formulas: Map<string, string>): Set<string>` for bulk circular reference detection.
- Export `MultiSheetGrid` type (alias for `ReadonlyMap<string, ReadonlyMap<string, CellValue | FormulaError>>`).
- Support these functions: SUM, AVERAGE, COUNT, MIN, MAX, IF, VLOOKUP, CONCATENATE, NOW, TODAY, ROUND, ABS, LEN, LEFT, RIGHT, MID, TRIM, UPPER, LOWER.
- Return typed `FormulaError` values (never throw) for all error conditions.
- Handle both uppercase and lowercase function names (case-insensitive).
- Keep every file under 200 lines.

### MUST NOT

- Import any other OpenDesk module.
- Perform I/O of any kind (network, disk, database, DOM).
- Export mutable state.
- Throw exceptions for formula errors (use typed error returns).
- Use `any` or `unknown` in exported type positions.
- Accept or produce mock data in any export, test fixture, or example.
- Mutate the input grid during evaluation.

## Verification

How to test each invariant:

1. **Parsing determinism** -- Property-based test: parse the same formula string twice, assert ASTs are deeply equal.
2. **Evaluation referential transparency** -- Unit test: evaluate formulas against fixed grids, assert consistent results across multiple calls.
3. **Error type coverage** -- Unit test: craft formulas that trigger each of the 7 error types, verify correct error is returned.
4. **Circular reference detection** -- Unit test: create grids where A1=B1, B1=A1 (direct cycle), and A1=B1, B1=C1, C1=A1 (transitive cycle). Verify detection.
5. **Cell reference resolution** -- Unit test: test A1, $A$1, A1:B3, $A1, A$1 against known grids.
6. **Error propagation** -- Unit test: set a cell to #DIV/0!, reference it from another formula, verify error propagates.
7. **Function extensibility** -- Integration test: register a custom function, evaluate a formula using it.
8. **Empty cell handling** -- Unit test: evaluate SUM with missing cells, verify 0. Evaluate CONCATENATE with missing cells, verify "".

## File Structure

```
modules/sheets-formula/
  contract.ts              -- Zod schemas, inferred types, FormulaError enum
  index.ts                 -- re-exports public API, evaluateFormula, evaluateFormulaMultiSheet
  internal/
    types.ts               -- AST node types, CellRef, CellValue, FormulaError
    cross-sheet-types.ts   -- CrossSheetCellRef, CrossSheetRangeRef, MultiSheetGrid
    tokenizer.ts           -- lexer, handles SHEET_PREFIX tokens
    parser.ts              -- recursive descent parser, produces cross-sheet AST nodes
    evaluator.ts           -- AST walker, cell ref resolution, function dispatch
    evaluator-compare.ts   -- comparison operator logic (extracted for line-limit)
    functions.ts           -- function library implementations (SUM, IF, etc.)
    functions-text.ts      -- text function implementations (LEN, LEFT, etc.)
    circular-detect.ts     -- dependency graph + cycle detection (cross-sheet aware)
```
