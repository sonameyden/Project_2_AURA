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
 */
export async function request<T>(path: string, token: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: BodyInit | undefined;

  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/${path.replace(/^\/+/, '')}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(
      error instanceof Error ? `Network error: ${error.message}` : 'Unable to reach the AURA backend.',
      0,
    );
  }

  const text = await response.text();
  let payload: unknown;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String(payload.error)
        : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

/** URL-encodes one path segment or query value. */
export const encode = (value: string) => encodeURIComponent(value);

export const json = (method: RequestOptions['method'], body?: unknown): RequestOptions => ({ method, body });
