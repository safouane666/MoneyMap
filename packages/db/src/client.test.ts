import { describe, expect, it } from 'vitest';
import { createDb } from './client.js';

describe('@clear-money/db', () => {
  it('exports createDb', () => {
    expect(typeof createDb).toBe('function');
  });
});
