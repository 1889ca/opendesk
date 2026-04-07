/** Contract: contracts/convert/rules.md */

import { describe, it, expect } from 'vitest';
import { CollaboraError } from './libreoffice.ts';

describe('CollaboraError', () => {
  it('has correct name', () => {
    const err = new CollaboraError('test message');
    expect(err.name).toBe('CollaboraError');
    expect(err.message).toBe('test message');
  });

  it('stores statusCode', () => {
    const err = new CollaboraError('not found', 404);
    expect(err.statusCode).toBe(404);
  });

  it('stores cause', () => {
    const cause = new Error('original');
    const err = new CollaboraError('wrapped', undefined, cause);
    expect(err.cause).toBe(cause);
  });

  it('is an instance of Error', () => {
    const err = new CollaboraError('test');
    expect(err).toBeInstanceOf(Error);
  });
});
