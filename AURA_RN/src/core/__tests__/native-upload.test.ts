import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { request } from '../api/client';
import { appendUploadFile } from '../native-upload';

jest.mock('../config', () => ({ apiBaseUrl: 'https://api.example.com' }));

type Sent = { method: string; url: string; headers: Record<string, string>; body: unknown };

/** A stand-in XMLHttpRequest that records what was sent and answers with `status`/`responseText`. */
function installFakeXhr(status: number, responseText: string) {
  const sent: Sent[] = [];
  class FakeXhr {
    status = 0;
    responseText = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    private record: Sent = { method: '', url: '', headers: {}, body: undefined };
    open(method: string, url: string) {
      this.record = { method, url, headers: {}, body: undefined };
    }
    setRequestHeader(name: string, value: string) {
      this.record.headers[name] = value;
    }
    abort() {}
    send(body: unknown) {
      this.record.body = body;
      sent.push(this.record);
      this.status = status;
      this.responseText = responseText;
      this.onload?.();
    }
  }
  (globalThis as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
  return sent;
}

const originalXhr = globalThis.XMLHttpRequest;
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.XMLHttpRequest = originalXhr;
  globalThis.fetch = originalFetch;
});

describe('file uploads', () => {
  it('attach the picked file as a React Native file part', () => {
    const parts: [string, unknown][] = [];
    const form = { append: (name: string, value: unknown) => parts.push([name, value]) } as unknown as FormData;
    appendUploadFile(form, 'file', { uri: 'file:///cache/photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg' });
    expect(parts).toEqual([['file', { uri: 'file:///cache/photo.jpg', name: 'photo.jpg', type: 'image/jpeg' }]]);
  });

  it("are sent with XMLHttpRequest (Expo's fetch can't send file parts), with the token and no hand-set Content-Type", async () => {
    const sent = installFakeXhr(201, JSON.stringify({ id: 'song-1' }));
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
    const form = new FormData();

    const result = await request<{ id: string }>('catalog/songs/upload', 'token-123', {
      method: 'POST',
      formData: form,
    });

    expect(result).toEqual({ id: 'song-1' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ method: 'POST', url: 'https://api.example.com/catalog/songs/upload', body: form });
    expect(sent[0].headers).toEqual({ Authorization: 'Bearer token-123' });
  });

  it("surface the server's error message, e.g. a size limit", async () => {
    installFakeXhr(413, JSON.stringify({ error: 'Profile images must be 5 MB or smaller' }));
    await expect(
      request('library/profile-image', 't', { method: 'POST', formData: new FormData() }),
    ).rejects.toMatchObject({
      message: 'Profile images must be 5 MB or smaller',
      status: 413,
    });
  });

  it('leave ordinary JSON requests on fetch', async () => {
    const sent = installFakeXhr(200, '{}');
    globalThis.fetch = jest.fn(async () => ({
      status: 200,
      text: async () => '{"ok":true}',
    })) as unknown as typeof fetch;
    await expect(request('library/profile', 't', { method: 'PUT', body: { bio: 'hi' } })).resolves.toEqual({
      ok: true,
    });
    expect(sent).toHaveLength(0);
  });
});
