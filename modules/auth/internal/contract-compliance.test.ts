/** Contract: contracts/auth/rules.md */

/**
 * Contract compliance tests — verify structural invariants
 * that are testable via code-level audit.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const authModuleRoot = join(__dirname, '..');

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('Contract Compliance', () => {
  const sourceFiles = getAllTsFiles(authModuleRoot);

  it('every source file has a contract header', () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      expect(content).toContain('Contract: contracts/auth/rules.md');
    }
  });

  it('no source file imports from permissions module', () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"].*permissions/);
      expect(content).not.toMatch(/import.*permissions/);
    }
  });

  it('no source file contains in-memory cache or session store', () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      // Should not have Map/WeakMap used for caching principals
      expect(content).not.toMatch(/new Map<.*Principal/);
      expect(content).not.toMatch(/sessionStore/i);
      expect(content).not.toMatch(/cookie/i);
    }
  });

  it('no source file exceeds 200 lines', () => {
    for (const file of sourceFiles) {
      const lines = readFileSync(file, 'utf-8').split('\n').length;
      expect(lines, `${file} has ${lines} lines`).toBeLessThanOrEqual(200);
    }
  });
});
