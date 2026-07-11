import { describe, it, expect, beforeEach } from 'vitest';
import { readExistingDraftJson } from './useDraftPersistence';

// In-memory localStorage so this runs under Node (no jsdom in this project).
function memStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

describe('readExistingDraftJson — autosave seeding invariant', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = memStorage();
  });

  it('returns the on-disk draft JSON when one exists (so an unedited pristine state compares equal and the first autosave tick is skipped)', () => {
    localStorage.setItem('iggy-draft-new', '{"real":"draft"}');
    expect(readExistingDraftJson('iggy-draft-new')).toBe('{"real":"draft"}');
  });

  it('returns "" when no draft exists on disk, preserving default behavior for a brand-new draft', () => {
    expect(readExistingDraftJson('iggy-draft-new')).toBe('');
  });

  it('returns "" instead of throwing when localStorage access fails (private-browsing sandbox)', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: () => { throw new Error('access denied'); },
    };
    expect(readExistingDraftJson('iggy-draft-new')).toBe('');
  });
});
