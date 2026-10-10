const GO_SERVER_URL = process.env.TAKO_SERVER_URL || 'http://127.0.0.1:8080';

export class APIError extends Error {
  public status: number;
  public data?: any;
  public errors?: Record<string, string>;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;

    if (data && typeof data === 'object') {
      const normalized: Record<string, string> = {};

      if (data.errors && typeof data.errors === 'object') {
        for (const [key, val] of Object.entries(data.errors)) {
          if (Array.isArray(val) && val.length > 0) {
            normalized[key] = String(val[0]);
          } else if (typeof val === 'string') {
            normalized[key] = val;
          }
        }
      }

      if (data.details && typeof data.details === 'object' && !Array.isArray(data.details)) {
        for (const [key, val] of Object.entries(data.details)) {
          if (typeof val === 'string') normalized[key] = val;
          else if (Array.isArray(val) && val.length > 0) normalized[key] = String(val[0]);
        }
      }

      if (Array.isArray(data.detail)) {
        for (const item of data.detail) {
          if (item && typeof item === 'object') {
            const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : (item as any).field;
            if (field && item.msg) {
              normalized[String(field)] = String(item.msg);
            }
          }
        }
      }

      if (Object.keys(normalized).length === 0 && data.field && typeof data.field === 'string') {
        normalized[data.field] = message;
      }

      if (Object.keys(normalized).length > 0) {
        this.errors = normalized;
      }
    }
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
    let data: any = null;
    try {
      const parsed = JSON.parse(errorText);
      data = parsed;
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.error === 'string') {
          errorMessage = parsed.error;
        } else if (typeof parsed.message === 'string') {
          errorMessage = parsed.message;
        }
      }
    } catch {
      // Keep plain text
    }
    throw new APIError(res.status, errorMessage || `HTTP ${res.status}`, data);
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
    let data: any = null;
    try {
      data = await res.json();
      if (data && typeof data === 'object') {
        if (typeof data.error === 'string') errorMessage = data.error;
        else if (typeof data.message === 'string') errorMessage = data.message;
      }
    } catch {
      // fallback
    }
    throw new APIError(res.status, errorMessage, data);
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
