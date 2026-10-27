import { describe, expect, it } from "bun:test"
import {
  profileSchema,
  TIMEZONE_OPTIONS,
} from "../components/profile/profile-general-tab"
import {
  DEFAULT_RECOVERY_CODES,
  DEFAULT_TOTP_SECRET,
  passkeySchema,
  passwordSchema,
  PASSKEY_TYPE_OPTIONS,
  twoFactorSchema,
} from "../components/profile/profile-security-tab"
import { PROFILE_TABS } from "../components/profile/profile-view"

describe("Profile View Tabs & Structure", () => {
  it("defines the expected streamlined tabs without deprecated passkeys tab", () => {
    expect(PROFILE_TABS).toEqual([
      "general",
      "security",
      "sessions",
      "activity",
    ])
    expect(PROFILE_TABS.length).toBe(4)
    expect(PROFILE_TABS.includes("general")).toBe(true)
    expect(PROFILE_TABS.includes("security")).toBe(true)
    expect(PROFILE_TABS.includes("sessions")).toBe(true)
    expect(PROFILE_TABS.includes("activity")).toBe(true)
    // passkeys has been merged into security
    expect(PROFILE_TABS.includes("passkeys" as any)).toBe(false)
  })
})

describe("Profile General Form Validation (profileSchema)", () => {
  const validData = {
    name: "Supian M",
    handle: "supian",
    email: "operator@gettako.dev",
    timezone: "Asia/Makassar (UTC+08:00)",
  }

  it("accepts valid operator profile data", () => {
    const result = profileSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("Supian M")
      expect(result.data.handle).toBe("supian")
      expect(result.data.email).toBe("operator@gettako.dev")
      expect(result.data.timezone).toBe("Asia/Makassar (UTC+08:00)")
    }
  })

  it("validates operator full name length constraints", () => {
    // Too short (< 2 chars)
    const tooShort = profileSchema.safeParse({ ...validData, name: "A" })
    expect(tooShort.success).toBe(false)
    if (!tooShort.success) {
      expect(tooShort.error.issues[0].message).toContain("at least 2 characters")
    }

    // Too long (> 80 chars)
    const tooLong = profileSchema.safeParse({
      ...validData,
      name: "A".repeat(81),
    })
    expect(tooLong.success).toBe(false)
    if (!tooLong.success) {
      expect(tooLong.error.issues[0].message).toContain("80 characters or fewer")
    }

    // Valid boundary lengths (2 and 80 chars)
    expect(
      profileSchema.safeParse({ ...validData, name: "Al" }).success
    ).toBe(true)
    expect(
      profileSchema.safeParse({ ...validData, name: "A".repeat(80) }).success
    ).toBe(true)
  })

  it("validates operator handle / username rules", () => {
    // Allows alphanumeric, dashes, dots, underscores
    expect(
      profileSchema.safeParse({ ...validData, handle: "supian-dev" }).success
    ).toBe(true)
    expect(
      profileSchema.safeParse({ ...validData, handle: "supian_m" }).success
    ).toBe(true)
    expect(
      profileSchema.safeParse({ ...validData, handle: "supian.admin" }).success
    ).toBe(true)

    // Rejects spaces or special punctuation
    expect(
      profileSchema.safeParse({ ...validData, handle: "supian m" }).success
    ).toBe(false)
    expect(
      profileSchema.safeParse({ ...validData, handle: "supian@dev" }).success
    ).toBe(false)
    expect(
      profileSchema.safeParse({ ...validData, handle: "supian!" }).success
    ).toBe(false)

    // Rejects too short (< 2 chars)
    expect(
      profileSchema.safeParse({ ...validData, handle: "s" }).success
    ).toBe(false)
  })

  it("validates alert email addresses", () => {
    expect(
      profileSchema.safeParse({ ...validData, email: "invalid-email" }).success
    ).toBe(false)
    expect(
      profileSchema.safeParse({ ...validData, email: "" }).success
    ).toBe(false)
    expect(
      profileSchema.safeParse({ ...validData, email: "test@domain.com" }).success
    ).toBe(true)
  })

  it("validates operational timezone selection", () => {
    expect(
      profileSchema.safeParse({ ...validData, timezone: "" }).success
    ).toBe(false)
    expect(
      profileSchema.safeParse({
        ...validData,
        timezone: "UTC (Coordinated Universal Time)",
      }).success
    ).toBe(true)
  })

  it("verifies TIMEZONE_OPTIONS catalogue contains standard regions", () => {
    expect(TIMEZONE_OPTIONS.length).toBeGreaterThanOrEqual(8)
    const values = TIMEZONE_OPTIONS.map((opt) => opt.value)
    expect(values).toContain("Asia/Makassar (UTC+08:00)")
    expect(values).toContain("Asia/Jakarta (UTC+07:00)")
    expect(values).toContain("UTC (Coordinated Universal Time)")
    expect(values).toContain("Europe/London (UTC+00:00)")
    expect(values).toContain("America/New_York (UTC-05:00)")

    // Ensure labels and descriptions exist
    for (const opt of TIMEZONE_OPTIONS) {
      expect(opt.label).toBeTruthy()
      expect(opt.description).toBeTruthy()
    }
  })
})

describe("Profile Security Password Validation (passwordSchema)", () => {
  const validPasswordPayload = {
    currentPassword: "OldPassword123!",
    newPassword: "StrongSecret99!",
    confirmPassword: "StrongSecret99!",
  }

  it("accepts valid passwords meeting all complexity criteria", () => {
    const result = passwordSchema.safeParse(validPasswordPayload)
    expect(result.success).toBe(true)
  })

  it("rejects when current password is empty", () => {
    const result = passwordSchema.safeParse({
      ...validPasswordPayload,
      currentPassword: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("currentPassword"))).toBe(true)
    }
  })

  it("rejects passwords shorter than 10 characters", () => {
    const result = passwordSchema.safeParse({
      ...validPasswordPayload,
      newPassword: "Pass1!",
      confirmPassword: "Pass1!",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("at least 10 characters")
        )
      ).toBe(true)
    }
  })

  it("rejects passwords missing uppercase letters", () => {
    const result = passwordSchema.safeParse({
      ...validPasswordPayload,
      newPassword: "password123!",
      confirmPassword: "password123!",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("uppercase letter")
        )
      ).toBe(true)
    }
  })

  it("rejects passwords missing digits", () => {
    const result = passwordSchema.safeParse({
      ...validPasswordPayload,
      newPassword: "PasswordSecret!",
      confirmPassword: "PasswordSecret!",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("at least one number")
        )
      ).toBe(true)
    }
  })

  it("rejects passwords missing special characters", () => {
    const result = passwordSchema.safeParse({
      ...validPasswordPayload,
      newPassword: "Password12345",
      confirmPassword: "Password12345",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("special character")
        )
      ).toBe(true)
    }
  })

  it("rejects when new password and confirm password do not match", () => {
    const result = passwordSchema.safeParse({
      ...validPasswordPayload,
      newPassword: "StrongSecret99!",
      confirmPassword: "DifferentSecret88!",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("Passwords do not match") ||
          i.message.includes("do not match")
        )
      ).toBe(true)
    }
  })
})

describe("Profile Security 2FA TOTP Validation (twoFactorSchema)", () => {
  it("accepts valid 6-digit TOTP verification codes", () => {
    expect(twoFactorSchema.safeParse({ verifyCode: "123456" }).success).toBe(true)
    expect(twoFactorSchema.safeParse({ verifyCode: "000000" }).success).toBe(true)
    expect(twoFactorSchema.safeParse({ verifyCode: "999888" }).success).toBe(true)
  })

  it("rejects non-digit or wrong length codes", () => {
    expect(twoFactorSchema.safeParse({ verifyCode: "12345" }).success).toBe(false)
    expect(twoFactorSchema.safeParse({ verifyCode: "1234567" }).success).toBe(false)
    expect(twoFactorSchema.safeParse({ verifyCode: "12345a" }).success).toBe(false)
    expect(twoFactorSchema.safeParse({ verifyCode: "" }).success).toBe(false)
    expect(twoFactorSchema.safeParse({ verifyCode: "abcdef" }).success).toBe(false)
  })

  it("verifies default backup recovery codes format and count", () => {
    expect(DEFAULT_RECOVERY_CODES.length).toBe(8)
    const codeFormatRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/
    for (const code of DEFAULT_RECOVERY_CODES) {
      expect(codeFormatRegex.test(code)).toBe(true)
    }
  })

  it("verifies DEFAULT_TOTP_SECRET adheres strictly to RFC 4648 Base32 specification", () => {
    // Secret must only contain A-Z and 2-7 (no 0, 1, 8, 9)
    const cleanSecret = DEFAULT_TOTP_SECRET.replace(/-/g, "")
    expect(cleanSecret.length).toBeGreaterThanOrEqual(16)
    expect(/^[A-Z2-7]+$/.test(cleanSecret)).toBe(true)

    // Verify URI format accepted by Google Authenticator & 1Password
    const email = "operator@gettako.dev"
    const uri = `otpauth://totp/Tako:${encodeURIComponent(email)}?secret=${cleanSecret}&issuer=Tako&algorithm=SHA1&digits=6&period=30`
    expect(uri.startsWith("otpauth://totp/Tako:")).toBe(true)
    expect(uri).toContain("secret=" + cleanSecret)
    expect(uri).toContain("issuer=Tako")
  })
})

describe("Profile Security Passkey Validation (passkeySchema)", () => {
  it("accepts valid hardware passkey registration data", () => {
    expect(
      passkeySchema.safeParse({
        keyName: "MacBook Pro Touch ID",
        keyType: "touch_id",
      }).success
    ).toBe(true)

    expect(
      passkeySchema.safeParse({
        keyName: "Primary YubiKey 5C NFC",
        keyType: "yubikey",
      }).success
    ).toBe(true)

    expect(
      passkeySchema.safeParse({
        keyName: "Backup Security Key",
        keyType: "security_key",
      }).success
    ).toBe(true)
  })

  it("enforces keyName length boundaries", () => {
    expect(
      passkeySchema.safeParse({
        keyName: "K",
        keyType: "touch_id",
      }).success
    ).toBe(false)

    expect(
      passkeySchema.safeParse({
        keyName: "A".repeat(61),
        keyType: "touch_id",
      }).success
    ).toBe(false)

    expect(
      passkeySchema.safeParse({
        keyName: "My Key",
        keyType: "touch_id",
      }).success
    ).toBe(true)
  })

  it("rejects unauthorized keyType enumerations", () => {
    expect(
      passkeySchema.safeParse({
        keyName: "Invalid Token",
        keyType: "bluetooth_key",
      }).success
    ).toBe(false)
  })

  it("verifies PASSKEY_TYPE_OPTIONS contains all 3 hardware classes with badges", () => {
    expect(PASSKEY_TYPE_OPTIONS.length).toBe(3)
    const types = PASSKEY_TYPE_OPTIONS.map((opt) => opt.value)
    expect(types).toContain("touch_id")
    expect(types).toContain("yubikey")
    expect(types).toContain("security_key")

    for (const opt of PASSKEY_TYPE_OPTIONS) {
      expect(opt.badge).toBeDefined()
      expect(opt.description).toBeDefined()
      expect(opt.label).toBeDefined()
    }
  })
})
