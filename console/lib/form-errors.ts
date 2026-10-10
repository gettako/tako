import { APIError } from '@/lib/api-client';

export interface FormValidationResult {
  is422: boolean;
  status?: number;
  message: string;
  fieldErrors: Record<string, string>;
}

/**
 * Parses an unknown error (from API call, network, or client) into a structured
 * FormValidationResult with field-specific errors, HTTP 422 indicator, and message.
 */
export function parseApiError(
  err: unknown,
  defaultMessage = 'An unexpected error occurred.'
): FormValidationResult {
  if (!err) {
    return {
      is422: false,
      message: defaultMessage,
      fieldErrors: {},
    };
  }

  // Handle APIError instance
  if (err instanceof APIError) {
    const is422 = err.status === 422;
    const fieldErrors: Record<string, string> = { ...(err.errors || {}) };
    return {
      is422,
      status: err.status,
      message: err.message || (is422 ? 'Validation failed' : defaultMessage),
      fieldErrors,
    };
  }

  // Handle generic object with status or errors
  if (typeof err === 'object' && err !== null) {
    const status =
      'status' in err && typeof (err as any).status === 'number'
        ? (err as any).status
        : undefined;
    const is422 = status === 422;
    const message =
      ('message' in err && typeof (err as any).message === 'string'
        ? (err as any).message
        : '') ||
      ('error' in err && typeof (err as any).error === 'string'
        ? (err as any).error
        : '') ||
      defaultMessage;

    const fieldErrors: Record<string, string> = {};
    const rawErrors =
      ('errors' in err ? (err as any).errors : undefined) ||
      ('details' in err ? (err as any).details : undefined);

    if (rawErrors && typeof rawErrors === 'object') {
      for (const [key, val] of Object.entries(rawErrors)) {
        if (Array.isArray(val) && val.length > 0) {
          fieldErrors[key] = String(val[0]);
        } else if (typeof val === 'string') {
          fieldErrors[key] = val;
        }
      }
    }

    if (
      is422 &&
      Object.keys(fieldErrors).length === 0 &&
      'field' in err &&
      typeof (err as any).field === 'string'
    ) {
      fieldErrors[(err as any).field] = message;
    }

    return {
      is422,
      status,
      message,
      fieldErrors,
    };
  }

  if (err instanceof Error) {
    return {
      is422: false,
      message: err.message || defaultMessage,
      fieldErrors: {},
    };
  }

  return {
    is422: false,
    message: String(err) || defaultMessage,
    fieldErrors: {},
  };
}
