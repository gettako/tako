import { describe, expect, it } from "bun:test"
import { ControlPlaneLoading } from "@/components/layout/control-plane-loading"

describe("ControlPlaneLoading Component", () => {
  it("exports valid ControlPlaneLoading component function", () => {
    expect(typeof ControlPlaneLoading).toBe("function")
  })
})
