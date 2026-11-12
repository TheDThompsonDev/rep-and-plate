import { describe, expect, it } from 'vitest';
import { uiResourceUri } from './ui-resource.ts';

describe('UI template identities', () => {
  it('keeps an unchanged template stable and changes identity when its HTML changes', () => {
    expect(uiResourceUri('coaching', 'hello')).toBe('ui://rep-and-plate/coaching-2cf24dba5fb0a30e.html');
    expect(uiResourceUri('coaching', 'hello')).not.toBe(uiResourceUri('coaching', 'hello!'));
    expect(uiResourceUri('spot', 'hello')).toBe('ui://rep-and-plate/spot-2cf24dba5fb0a30e.html');
  });
});
