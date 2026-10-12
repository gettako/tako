import { test, expect } from "bun:test";
import {
  formatBytes,
  formatMemoryMb,
  formatCpu,
  formatDate,
  formatDateTime,
  formatRelativeTime,
} from "../lib/utils/format";

test("formatBytes - formats standard byte thresholds accurately", () => {
  expect(formatBytes(0)).toBe("0 B");
  expect(formatBytes(1024)).toBe("1 KB");
  expect(formatBytes(1536)).toBe("1.5 KB");
  expect(formatBytes(1024 * 1024)).toBe("1 MB");
  expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
});

test("formatMemoryMb - formats memory in GiB and GB", () => {
  expect(formatMemoryMb(1024)).toBe("1 GiB");
  expect(formatMemoryMb(2048)).toBe("2 GiB");
  expect(formatMemoryMb(1536)).toBe("1.5 GiB");
  expect(formatMemoryMb(4096, "GB")).toBe("4 GB");
  expect(formatMemoryMb(0)).toBe("0 GiB");
});

test("formatCpu - formats cores correctly", () => {
  expect(formatCpu(1)).toBe("1 vCPU");
  expect(formatCpu(2)).toBe("2 vCPU");
  expect(formatCpu(0.5)).toBe("0.5 vCPU");
  expect(formatCpu(0)).toBe("0 vCPU");
});

test("formatDate and formatDateTime - formats ISO timestamps", () => {
  const iso = "2026-10-12T12:00:00Z";
  expect(formatDate(iso)).toContain("2026");
  expect(formatDateTime(iso)).toBeDefined();
  expect(formatDate(null)).toBe("-");
});

test("formatRelativeTime - computes relative strings", () => {
  const now = Date.now();
  expect(formatRelativeTime(new Date(now - 2000))).toBe("just now");
  expect(formatRelativeTime(new Date(now - 30000))).toBe("30s ago");
  expect(formatRelativeTime(new Date(now - 5 * 60 * 1000))).toBe("5m ago");
  expect(formatRelativeTime(new Date(now - 2 * 3600 * 1000))).toBe("2h ago");
  expect(formatRelativeTime(null)).toBe("-");
});
