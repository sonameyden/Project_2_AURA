import { describe, expect, it, jest } from '@jest/globals';

import { passwordErrorMessage } from '../auth-context';

// The auth context imports the Firebase setup; none of it is needed for the message mapping.
jest.mock('../firebase', () => ({ firebaseAuth: null }));

const firebaseError = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });

describe('confirming the password before deleting the account', () => {
  it('explains a wrong password plainly', () => {
    expect(passwordErrorMessage(firebaseError('auth/wrong-password'))).toBe("That password isn't right.");
    expect(passwordErrorMessage(firebaseError('auth/invalid-credential'))).toBe("That password isn't right.");
  });

  it('explains rate limits and lost connections', () => {
    expect(passwordErrorMessage(firebaseError('auth/too-many-requests'))).toMatch(/Too many attempts/);
    expect(passwordErrorMessage(firebaseError('auth/network-request-failed'))).toMatch(/No connection/);
  });

  it('falls back to the original message for anything else', () => {
    expect(passwordErrorMessage(new Error('Something odd'))).toBe('Something odd');
    expect(passwordErrorMessage('???')).toBe('Your password could not be confirmed.');
  });
});
