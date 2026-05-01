/** Contract: contracts/sheets-formula/rules.md */

import { parse } from './parser.ts';
import { expandRange } from './evaluator.ts';
import { type ASTNode, isFormulaError } from './types.ts';

/**
 * Extract all cell addresses that a formula depends on.
 * Returns a Set of cell address strings (e.g., "A1", "B3").
 */
export function extractDependencies(formula: string): Set<string> {
  const ast = parse(formula);
  if (isFormulaError(ast)) return new Set();

  const deps = new Set<string>();
  collectDeps(ast, deps);
  return deps;
}

function collectDeps(node: ASTNode, deps: Set<string>, currentSheet?: string): void {
  switch (node.type) {
    case 'cell_ref':
      // Qualify with sheet when tracking multi-sheet graphs
      deps.add(currentSheet ? `${currentSheet}!${node.col}${node.row}` : `${node.col}${node.row}`);
      break;
    case 'range_ref': {
      const cells = expandRange(node);
      for (const cell of cells) {
        deps.add(currentSheet ? `${currentSheet}!${cell}` : cell);
      }
      break;
    }
    case 'cross_sheet_cell_ref':
      deps.add(`${node.sheet}!${node.ref.col}${node.ref.row}`);
      break;
    case 'cross_sheet_range_ref': {
      const cells = expandRange({ type: 'range_ref', start: node.start, end: node.end });
      for (const cell of cells) deps.add(`${node.sheet}!${cell}`);
      break;
    }
    case 'function_call':
      for (const arg of node.args) collectDeps(arg, deps, currentSheet);
      break;
    case 'binary_op':
      collectDeps(node.left, deps, currentSheet);
      collectDeps(node.right, deps, currentSheet);
      break;
    case 'unary_op':
      collectDeps(node.operand, deps, currentSheet);
      break;
    case 'number':
    case 'string':
    case 'boolean':
      break;
  }
}

/**
 * Detect circular references in a set of formulas.
 * @param formulas Map of cell address -> formula string (e.g., "A1" -> "=B1+1")
 * @returns Set of cell addresses involved in circular references
 */
export function detectCircular(formulas: Map<string, string>): Set<string> {
  // Build adjacency list
  const graph = new Map<string, Set<string>>();
  for (const [cell, formula] of formulas) {
    graph.set(cell, extractDependencies(formula));
  }

  const circular = new Set<string>();
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (inStack.has(node)) {
      // Found a cycle — mark all nodes in the cycle
      const cycleStart = path.indexOf(node);
      for (let i = cycleStart; i < path.length; i++) {
        circular.add(path[i]);
      }
      circular.add(node);
      return true;
    }

    if (visited.has(node)) return false;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const deps = graph.get(node);
    if (deps) {
      for (const dep of deps) {
        if (graph.has(dep) || inStack.has(dep)) {
          dfs(dep, path);
        }
      }
    }

    path.pop();
    inStack.delete(node);
    return false;
  }

  for (const cell of graph.keys()) {
    if (!visited.has(cell)) {
      dfs(cell, []);
    }
  }

  return circular;
}
