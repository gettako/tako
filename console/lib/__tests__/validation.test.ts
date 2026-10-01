import { describe, it, expect } from "bun:test"
import { z } from "zod"
import { validateWithZod, mapApiError } from "../validation"
import { ApiError } from "../api"

describe("Validation helpers with Zod", () => {
  const schema = z.object({
    email: z.string().trim().email("Invalid email format"),
    password: z.string().min(8, "Password too short"),
  })

  it("validates successfully with valid data", () => {
    const res = validateWithZod(schema, {
      email: "user@gettako.dev",
      password: "securePassword123",
    })

    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.email).toBe("user@gettako.dev")
    }
  })

  it("returns field-level errors when validation fails", () => {
    const res = validateWithZod(schema, {
      email: "not-an-email",
      password: "short",
    })

    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.errors.email).toBe("Invalid email format")
      expect(res.errors.password).toBe("Password too short")
    }
  })

  it("maps 401/422 credentials error to password field", () => {
    const err = new ApiError(401, "INVALID_CREDENTIALS", "Invalid credentials")
    const { fieldErrors, generalError } = mapApiError(err)

    expect(fieldErrors.password).toBe("Invalid credentials")
    expect(generalError).toBeNull()
  })

  it("maps structured details to respective fields", () => {
    const err = new ApiError(422, "VALIDATION_ERROR", "Validation failed", {
      email: "Email already taken",
      password: "Password requires special characters",
    })
    const { fieldErrors } = mapApiError(err)

    expect(fieldErrors.email).toBe("Email already taken")
    expect(fieldErrors.password).toBe("Password requires special characters")
  })
})
