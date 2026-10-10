const GO_SERVER_URL = process.env.TAKO_SERVER_URL || 'http://127.0.0.1:8080';

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export async function fetchServer<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${GO_SERVER_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') {
        errorMessage = parsed.error;
      }
    } catch {
      // Keep plain text
    }
    throw new APIError(res.status, errorMessage || `HTTP ${res.status}`);
  }

  // Handle empty responses
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

export function getServerBaseURL(): string {
  return GO_SERVER_URL;
}

export async function clientFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data === 'object') {
        if (typeof data.error === 'string') errorMessage = data.error;
        else if (typeof data.message === 'string') errorMessage = data.message;
      }
    } catch {
      // fallback
    }
    throw new APIError(res.status, errorMessage);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(url: string, init?: RequestInit) => clientFetch<T>(url, { ...init, method: 'GET' }),
  post: <T>(url: string, body?: unknown, init?: RequestInit) =>
    clientFetch<T>(url, { ...init, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown, init?: RequestInit) =>
    clientFetch<T>(url, { ...init, method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: unknown, init?: RequestInit) =>
    clientFetch<T>(url, { ...init, method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string, init?: RequestInit) => clientFetch<T>(url, { ...init, method: 'DELETE' }),
};
