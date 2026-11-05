import { describe, expect, it } from '@jest/globals';

import { looksDescriptive } from '../lib/query-kind';

describe('looksDescriptive', () => {
  it('sends descriptions to the AI search and titles to normal search', () => {
    expect(looksDescriptive('calm songs for studying at night')).toBe(true);
    expect(looksDescriptive('sad')).toBe(true);
    expect(looksDescriptive('starboy')).toBe(false);
    expect(looksDescriptive('the weeknd')).toBe(false);
  });
});
