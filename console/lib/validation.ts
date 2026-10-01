import { z } from "zod"
import { ApiError } from "./api"

export type ValidationResult<T> =
  | { success: true; data: T; errors?: never }
  | { success: false; errors: Record<string, string>; data?: never }

/**
 * Validates arbitrary form data against a Zod schema and maps issues to a field-keyed error dictionary.
 */
export function validateWithZod<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = issue.path.join(".")
    if (field && !errors[field]) {
      errors[field] = issue.message
    }
  }

  return { success: false, errors }
}

/**
 * Maps API errors (such as 422 Unprocessable Entity, 401 Unauthorized, or 400 Bad Request)
 * to appropriate field-level errors and/or general fallback messages.
 */
export function mapApiError(
  err: unknown,
  fieldMapping?: Record<string, string>
): {
  fieldErrors: Record<string, string>
  generalError: string | null
} {
  const fieldErrors: Record<string, string> = {}
  let generalError: string | null = null

  if (err instanceof ApiError) {
    // If backend provided structured field errors in details (e.g. 422)
    if (
      err.details &&
      typeof err.details === "object" &&
      !Array.isArray(err.details)
    ) {
      for (const [key, val] of Object.entries(err.details)) {
        if (typeof val === "string") {
          const targetField = fieldMapping?.[key] || key
          fieldErrors[targetField] = val
        }
      }
    }

    // Status 422 or 400 with a message that mentions a specific field or credential
    const msg = err.message.toLowerCase()
    if (Object.keys(fieldErrors).length === 0) {
      if (err.status === 401 || err.status === 422 || err.status === 400) {
        if (msg.includes("password") || msg.includes("credential")) {
          fieldErrors.password = err.message
        } else if (msg.includes("email")) {
          fieldErrors.email = err.message
        } else if (msg.includes("domain")) {
          fieldErrors.domain = err.message
        } else {
          generalError = err.message
        }
      } else {
        generalError = err.message
      }
    }
  } else if (err instanceof Error) {
    generalError = err.message
  } else {
    generalError = "An unexpected error occurred."
  }

  return { fieldErrors, generalError }
}
