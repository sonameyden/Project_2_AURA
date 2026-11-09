import { describe, expect, it } from '@jest/globals';

import { parseInviteCode } from '../lib/invite-code';

const CODE = '3f2a9c1d8e7b4a60b5c2d1e0f9a8b7c6';

describe('pasted invite links', () => {
  it('reads the code from every kind of link', () => {
    expect(parseInviteCode(`https://aura-backend.example.workers.dev/invite/${CODE}`)).toBe(CODE);
    expect(parseInviteCode(`aura://invite/${CODE}`)).toBe(CODE);
    expect(parseInviteCode(`exp://192.168.1.20:8081/--/invite/${CODE}`)).toBe(CODE);
  });

  it('finds the link inside the whole share message', () => {
    const message = `Come build my playlist "Road trip" with me on AURA: https://example.com/invite/${CODE}`;
    expect(parseInviteCode(message)).toBe(CODE);
  });

  it('accepts a bare code', () => {
    expect(parseInviteCode(`  ${CODE}\n`)).toBe(CODE);
  });

  it('rejects text that is not an invite', () => {
    expect(parseInviteCode('')).toBeNull();
    expect(parseInviteCode('hello there')).toBeNull();
    expect(parseInviteCode('abc')).toBeNull();
  });
});
