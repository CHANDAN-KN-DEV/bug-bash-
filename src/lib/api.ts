export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${apiBaseUrl}/api${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) {
    throw new ApiError(payload.error || `Request failed (${response.status}).`, response.status);
  }
  return payload;
}

export const apiGet = <T>(path: string, token?: string | null) =>
  apiRequest<T>(path, { method: 'GET' }, token);

export const apiPost = <T>(path: string, body: unknown, token?: string | null) =>
  apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }, token);

export const apiPatch = <T>(path: string, body: unknown, token?: string | null) =>
  apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, token);

export const apiPut = <T>(path: string, body: unknown, token?: string | null) =>
  apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }, token);
