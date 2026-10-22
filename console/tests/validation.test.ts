import { describe, expect, it } from "bun:test"
import {
  isHttpUrl,
  isValidCidr,
  isValidHostname,
  isValidIpAllowlist,
  isValidIpv4,
  isValidTime,
} from "../lib/validation"

describe("Validation Utilities", () => {
  it("validates hostnames properly", () => {
    expect(isValidHostname("example.com")).toBe(true)
    expect(isValidHostname("sub.domain.co.uk")).toBe(true)
    expect(isValidHostname("localhost")).toBe(true)
    expect(isValidHostname("invalid_host")).toBe(false)
    expect(isValidHostname("")).toBe(false)
    expect(isValidHostname("-startwithdash.com")).toBe(false)
  })

  it("validates IPv4 addresses properly", () => {
    expect(isValidIpv4("192.168.1.1")).toBe(true)
    expect(isValidIpv4("10.0.0.1")).toBe(true)
    expect(isValidIpv4("127.0.0.1")).toBe(true)
    expect(isValidIpv4("256.0.0.1")).toBe(false)
    expect(isValidIpv4("192.168.1")).toBe(false)
    expect(isValidIpv4("not-an-ip")).toBe(false)
  })

  it("validates CIDR blocks properly", () => {
    expect(isValidCidr("192.168.1.0/24")).toBe(true)
    expect(isValidCidr("10.0.0.0/8")).toBe(true)
    expect(isValidCidr("192.168.1.1")).toBe(true) // single IP without prefix is allowed
    expect(isValidCidr("192.168.1.0/33")).toBe(false)
    expect(isValidCidr("invalid/24")).toBe(false)
  })

  it("validates IP allowlists", () => {
    expect(isValidIpAllowlist("192.168.1.0/24, 10.0.0.1")).toBe(true)
    expect(isValidIpAllowlist("")).toBe(false)
    expect(isValidIpAllowlist("invalid-ip")).toBe(false)
  })

  it("validates HTTP URLs", () => {
    expect(isHttpUrl("http://localhost:8080")).toBe(true)
    expect(isHttpUrl("https://tako.gettako.dev/healthz")).toBe(true)
    expect(isHttpUrl("ftp://ftp.example.com")).toBe(false)
    expect(isHttpUrl("not-a-url")).toBe(false)
  })

  it("validates 24-hour UTC time strings", () => {
    expect(isValidTime("03:00")).toBe(true)
    expect(isValidTime("23:59")).toBe(true)
    expect(isValidTime("00:00")).toBe(true)
    expect(isValidTime("24:00")).toBe(false)
    expect(isValidTime("12:60")).toBe(false)
    expect(isValidTime("invalid")).toBe(false)
  })
})
