/** Contract: contracts/ai/rules.md */
import { describe, it, expect } from 'vitest';
import { loadZoo, findZooEntry } from './zoo-loader.ts';

describe('zoo-loader', () => {
  it('loads and validates all zoo entries', () => {
    const zoo = loadZoo();
    expect(zoo.length).toBeGreaterThan(0);
    for (const entry of zoo) {
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.ollamaTag).toBeTruthy();
      expect(entry.sizeGb).toBeGreaterThan(0);
      expect(['embed', 'generate', 'both']).toContain(entry.capability);
      expect(entry.license).toBeTruthy();
      expect(['recommended', 'lightweight', 'specialized']).toContain(entry.tier);
      expect(entry.useCases.length).toBeGreaterThan(0);
      expect(entry.hardware.ramGb).toBeGreaterThan(0);
      expect(entry.hardware.vramGb).toBeGreaterThanOrEqual(0);
    }
  });

  it('all zoo IDs are unique', () => {
    const zoo = loadZoo();
    const ids = zoo.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all zoo models have permissive licenses', () => {
    const zoo = loadZoo();
    const permissive = ['apache', 'mit', 'open-weight'];
    for (const entry of zoo) {
      const lower = entry.license.toLowerCase();
      const isPermissive = permissive.some((p) => lower.includes(p));
      expect(isPermissive, `${entry.id} has non-permissive license: ${entry.license}`).toBe(true);
    }
  });

  it('findZooEntry returns matching entry', () => {
    const entry = findZooEntry('mistral-7b');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('Mistral 7B');
  });

  it('findZooEntry returns undefined for unknown ID', () => {
    expect(findZooEntry('nonexistent')).toBeUndefined();
  });

  it('includes expected model categories', () => {
    const zoo = loadZoo();
    const capabilities = new Set(zoo.map((e) => e.capability));
    expect(capabilities.has('embed')).toBe(true);
    expect(capabilities.has('generate')).toBe(true);
  });
});
