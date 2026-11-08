import { describe, expect, it, jest } from '@jest/globals';

import { sendFailureMessage } from '../api/client';
import { audioMime } from '../audio-mime';
import { IMAGE_MAX_SIZE, prepareImageForUpload } from '../pick-image';

const mockManipulate = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: (...args: unknown[]) => mockManipulate(...args) },
}));
jest.mock('expo-image-picker', () => ({}));

function fakeManipulation(savedUri: string) {
  const saveAsync = jest.fn(async (_options: unknown) => ({ uri: savedUri, width: 1024, height: 1024 }));
  const rendered = { saveAsync, release: jest.fn() };
  const context = { renderAsync: jest.fn(async () => rendered), release: jest.fn() };
  mockManipulate.mockReturnValueOnce(context);
  return { saveAsync };
}

describe('image uploads', () => {
  it('shrinks big camera photos to fit under the backend limits and re-encodes them as JPEG', async () => {
    const { saveAsync } = fakeManipulation('file:///cache/resized.jpg');
    const upload = await prepareImageForUpload(
      { uri: 'file:///DCIM/huge.HEIC', fileName: 'IMG_0001.HEIC', mimeType: 'image/heic', fileSize: 9_000_000 },
      'profile.jpg',
      IMAGE_MAX_SIZE.avatar,
    );
    expect(mockManipulate).toHaveBeenCalledWith('file:///DCIM/huge.HEIC', { maxWidth: 1024, maxHeight: 1024 });
    expect(saveAsync).toHaveBeenCalledWith({ compress: 0.82, format: 'jpeg' });
    expect(upload).toEqual({ uri: 'file:///cache/resized.jpg', name: 'IMG_0001.jpg', mimeType: 'image/jpeg' });
  });

  it('falls back to the original image if it cannot be resized', async () => {
    mockManipulate.mockImplementationOnce(() => {
      throw new Error('decode failed');
    });
    jest.spyOn(console, 'warn').mockImplementationOnce(() => undefined);
    const upload = await prepareImageForUpload(
      { uri: 'file:///a.png', fileName: null, mimeType: 'image/png' },
      'art.png',
      1600,
    );
    expect(upload).toMatchObject({ uri: 'file:///a.png', name: 'art.png', mimeType: 'image/png' });
  });
});

describe('song uploads', () => {
  it('always sends an audio/* type, which the backend requires', () => {
    expect(audioMime('song.m4a')).toBe('audio/mp4');
    expect(audioMime('voice.OPUS')).toBe('audio/opus');
    expect(audioMime('track.flac')).toBe('audio/flac');
    expect(audioMime('mystery')).toBe('audio/mpeg');
  });
});

describe('request failures', () => {
  it('only calls real connectivity problems network errors', () => {
    expect(sendFailureMessage(new TypeError('Network request failed'))).toBe('Network error: Network request failed');
    expect(sendFailureMessage(new Error('Unsupported FormDataPart implementation'))).toBe(
      'The request could not be sent: Unsupported FormDataPart implementation',
    );
  });
});
