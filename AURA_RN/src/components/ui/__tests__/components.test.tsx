import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { BackButton } from '../BackButton';
import { DialogHost, showAlert } from '../Dialog';
import { ScreenErrorBoundary } from '../ScreenErrorBoundary';
import { SwitchRow } from '../SwitchRow';
import { ToastProvider, useToast } from '../Toast';

// The components read the theme, settings, router and safe area; tests use fixed stand-ins.
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/core/theme', () => ({
  useAuraTheme: () => ({
    mode: 'dark',
    highContrast: false,
    colors: {
      background: '#0C0D12',
      surface: '#1A1B23',
      elevated: '#1A1830',
      text: '#F3F4F6',
      muted: '#9CA3AF',
      border: '#FFFFFF1A',
      accent: '#A855F7',
      accentEnd: '#C084FC',
      accentBlue: '#3B82F6',
      accentCyan: '#22D3EE',
      accentSoft: '#2E1C4E',
      teal: '#13383B',
      danger: '#F87171',
    },
  }),
}));
jest.mock('@/core/settings', () => ({ useSettings: () => ({ settings: { reducedMotion: true }, textScale: 1 }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Rendering components is slower than the plain unit tests, especially the first render of a run.
jest.setTimeout(30000);

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
});

describe('BackButton', () => {
  it('goes back to the previous screen', async () => {
    await render(<BackButton />);
    await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('goes Home when there is nothing to go back to (e.g. opened from a link)', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await render(<BackButton variant="close" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
  });
});

describe('SwitchRow', () => {
  it('flips immediately while saving, then follows the saved value', async () => {
    let finishSave: () => void = () => undefined;
    const onChange = jest.fn((_value: boolean) => new Promise<void>((resolve) => (finishSave = resolve)));
    await render(<SwitchRow label="Public playlist" value={false} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('switch', { name: 'Public playlist' }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch', { name: 'Public playlist' })).toBeChecked();

    // The save finishes but the parent's value is still false (e.g. not refetched yet): the switch follows it.
    await act(async () => finishSave());
    expect(screen.getByRole('switch', { name: 'Public playlist' })).not.toBeChecked();
  });

  it('snaps back when saving fails', async () => {
    const onChange = jest.fn((_value: boolean) => Promise.reject(new Error('offline')));
    await render(<SwitchRow label="Show my listening" value onChange={onChange} />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Show my listening' }));
    await act(async () => undefined);
    expect(screen.getByRole('switch', { name: 'Show my listening' })).toBeChecked();
  });
});

describe('Toast', () => {
  function ShowToastButton({ onView }: { onView: () => void }) {
    const toast = useToast();
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          toast.show({ title: 'Added to Demo mix', message: 'Home', action: { label: 'View', onPress: onView } })
        }>
        <Text>Add</Text>
      </Pressable>
    );
  }

  it('shows a confirmation with a working action button', async () => {
    const onView = jest.fn();
    await render(
      <ToastProvider>
        <ShowToastButton onView={onView} />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Added to Demo mix')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'View' }));
    expect(onView).toHaveBeenCalled();
  });
});

describe('Themed dialog', () => {
  it('shows the buttons and runs the chosen one', async () => {
    jest.useFakeTimers();
    const onDelete = jest.fn();
    await render(<DialogHost />);
    await act(async () =>
      showAlert('Delete playlist?', 'It will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]),
    );
    expect(screen.getByText('Delete playlist?')).toBeOnTheScreen();
    expect(screen.getByText('It will be removed.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    // The action runs just after the dialog closes, so a follow-up dialog can queue behind it.
    await act(async () => jest.runAllTimers());
    expect(onDelete).toHaveBeenCalled();
    expect(screen.queryByText('Delete playlist?')).toBeNull();
    jest.useRealTimers();
  });
});

describe('ScreenErrorBoundary', () => {
  it('offers to try again or go home instead of a blank screen', async () => {
    const retry = jest.fn(async () => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await render(<ScreenErrorBoundary error={new Error('boom')} retry={retry} />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Go home' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
  });
});
