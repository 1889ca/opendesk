/** Contract: contracts/workflow/rules.md */
import { describe, it, expect } from 'vitest';
import { isBuiltinPlugin, executeBuiltin } from './wasm-builtins.ts';

describe('wasm-builtins', () => {
  describe('isBuiltinPlugin', () => {
    it('returns true for known plugins', () => {
      expect(isBuiltinPlugin('text-transformer')).toBe(true);
      expect(isBuiltinPlugin('json-validator')).toBe(true);
      expect(isBuiltinPlugin('word-counter')).toBe(true);
    });

    it('returns false for unknown plugins', () => {
      expect(isBuiltinPlugin('unknown-plugin')).toBe(false);
    });
  });

  describe('text-transformer', () => {
    it('uppercases text', () => {
      const result = executeBuiltin('text-transformer', { text: 'hello world', transform: 'uppercase' });
      expect(result).toEqual({ result: 'HELLO WORLD', originalLength: 11 });
    });

    it('lowercases text', () => {
      const result = executeBuiltin('text-transformer', { text: 'HELLO', transform: 'lowercase' });
      expect(result).toEqual({ result: 'hello', originalLength: 5 });
    });

    it('title-cases text', () => {
      const result = executeBuiltin('text-transformer', { text: 'hello world', transform: 'titlecase' });
      expect(result).toEqual({ result: 'Hello World', originalLength: 11 });
    });
  });

  describe('json-validator', () => {
    it('validates valid data', () => {
      const result = executeBuiltin('json-validator', {
        data: { name: 'test', age: 25 },
        schema: {
          required: ['name'],
          properties: { name: { type: 'string' }, age: { type: 'number' } },
        },
      });
      expect(result).toEqual({ valid: true, errors: [] });
    });

    it('catches missing required fields', () => {
      const result = executeBuiltin('json-validator', {
        data: {},
        schema: { required: ['name'] },
      });
      expect(result!.valid).toBe(false);
      expect(result!.errors).toContain('Missing required field: name');
    });

    it('catches type mismatches', () => {
      const result = executeBuiltin('json-validator', {
        data: { age: 'not-a-number' },
        schema: { properties: { age: { type: 'number' } } },
      });
      expect(result!.valid).toBe(false);
    });
  });

  describe('word-counter', () => {
    it('counts words correctly', () => {
      const result = executeBuiltin('word-counter', { text: 'Hello world foo bar' });
      expect(result!.words).toBe(4);
      expect(result!.characters).toBe(19);
    });

    it('handles empty text', () => {
      const result = executeBuiltin('word-counter', { text: '' });
      expect(result!.words).toBe(0);
      expect(result!.characters).toBe(0);
    });

    it('counts sentences', () => {
      const result = executeBuiltin('word-counter', { text: 'Hello. World! How?' });
      expect(result!.sentences).toBe(3);
    });
  });
});
