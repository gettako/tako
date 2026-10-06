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
    throw new APIError(res.status, errorText || `HTTP ${res.status}`);
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
