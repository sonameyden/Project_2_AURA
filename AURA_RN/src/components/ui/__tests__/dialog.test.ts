import { describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';

import { showAlert } from '../Dialog';

// The dialog reads the theme, which loads saved settings from device storage.
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

describe('themed dialogs', () => {
  it('fall back to the system dialog if shown before the dialog host has mounted', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const buttons = [
      { text: 'Cancel', style: 'cancel' as const },
      { text: 'Delete', style: 'destructive' as const },
    ];
    showAlert('Delete playlist?', 'It will be removed.', buttons);
    expect(spy).toHaveBeenCalledWith('Delete playlist?', 'It will be removed.', buttons);
    spy.mockRestore();
  });
});
