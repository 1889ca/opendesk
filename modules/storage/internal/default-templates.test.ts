/** Contract: contracts/storage/rules.md */
import { describe, it, expect } from 'vitest';
import { defaultTemplates } from './default-templates.ts';

describe('defaultTemplates', () => {
  it('contains at least one template', () => {
    expect(defaultTemplates.length).toBeGreaterThan(0);
  });

  it('every template has required fields', () => {
    for (const tmpl of defaultTemplates) {
      expect(typeof tmpl.name).toBe('string');
      expect(tmpl.name.length).toBeGreaterThan(0);
      expect(typeof tmpl.description).toBe('string');
      expect(tmpl.description.length).toBeGreaterThan(0);
      expect(tmpl.content).toBeDefined();
      expect(typeof tmpl.content).toBe('object');
    }
  });

  it('every template content is valid ProseMirror doc', () => {
    for (const tmpl of defaultTemplates) {
      expect(tmpl.content.type).toBe('doc');
      expect(Array.isArray(tmpl.content.content)).toBe(true);
    }
  });

  it('includes a Blank template', () => {
    const blank = defaultTemplates.find((t) => t.name === 'Blank');
    expect(blank).toBeDefined();
    expect(blank!.content.type).toBe('doc');
  });

  it('includes a Meeting Notes template', () => {
    const notes = defaultTemplates.find((t) => t.name === 'Meeting Notes');
    expect(notes).toBeDefined();
  });

  it('includes a Project Brief template', () => {
    const brief = defaultTemplates.find((t) => t.name === 'Project Brief');
    expect(brief).toBeDefined();
  });

  it('includes a Report template', () => {
    const report = defaultTemplates.find((t) => t.name === 'Report');
    expect(report).toBeDefined();
  });

  it('template names are unique', () => {
    const names = defaultTemplates.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
