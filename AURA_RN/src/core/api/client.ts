import { apiBaseUrl } from '../config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
};

/**
 * The only HTTP client in the app. Every endpoint module in `core/api/` goes
 * through here so the base URL, bearer token and error shape stay in one place.
 *
 * File uploads (`formData`) go through XMLHttpRequest instead of `fetch`. In
 * this Expo SDK the global `fetch` is Expo's own, which can't send React
 * Native file parts (`{ uri, name, type }`), and reading the file in JS first
 * is blocked in Expo Go (its sandbox denies access to the pickers' cache).
 * React Native's XMLHttpRequest streams the file natively from its `uri`.
 */
export async function request<T>(path: string, token: string, options: RequestOptions = {}): Promise<T> {
  const url = `${apiBaseUrl}/${path.replace(/^\/+/, '')}`;
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  let status: number;
  let text: string;
  try {
    if (options.formData) {
      ({ status, text } = await sendMultipart(url, method, headers, options.formData, options.signal));
    } else {
      let body: string | undefined;
      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
      const response = await fetch(url, { method, headers, body, signal: options.signal });
      status = response.status;
      text = await response.text();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(sendFailureMessage(error), 0);
  }

  let payload: unknown;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (status < 200 || status >= 300) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String(payload.error)
        : `Request failed (${status}).`;
    throw new ApiError(message, status);
  }

  return payload as T;
}

/**
 * Sends multipart form data with XMLHttpRequest (see `request`). The
 * Content-Type header, including the multipart boundary, is set by the
 * platform, so it must not be set here.
 */
export function sendMultipart(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: FormData,
  signal?: AbortSignal,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const abortError = () => Object.assign(new Error('The upload was cancelled.'), { name: 'AbortError' });
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText ?? '' });
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.ontimeout = () => reject(new TypeError('Network request timed out'));
    signal?.addEventListener('abort', () => {
      xhr.abort();
      reject(abortError());
    });
    xhr.send(body);
  });
}

/**
 * Why a request never got a response. Only real connectivity failures are
 * called network errors; anything else (e.g. a request body that couldn't be
 * built) says so, instead of sending people to check their Wi-Fi.
 */
export function sendFailureMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Unable to reach the AURA backend.';
  const offline = /network|failed to fetch|timed? ?out|timeout|offline|unreachable|connection|resolve host/i.test(
    error.message,
  );
  return offline ? `Network error: ${error.message}` : `The request could not be sent: ${error.message}`;
}

/** URL-encodes one path segment or query value. */
export const encode = (value: string) => encodeURIComponent(value);

export const json = (method: RequestOptions['method'], body?: unknown): RequestOptions => ({ method, body });
