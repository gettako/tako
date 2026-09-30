import type { TelemetryPoint } from "./resource-chart"

/**
 * Generates synthetic historical telemetry data points anchored to the current value.
 * Used for high-fidelity client-side charts without requiring a heavy Prometheus time-series database.
 */
export function generateTelemetryHistory(
  baseValue: number,
  pointsCount: number = 24,
  rangeMinutes: number = 60,
  volatility: number = 5,
  minVal: number = 0,
  maxVal: number = 100
): TelemetryPoint[] {
  const points: TelemetryPoint[] = []
  const now = Date.now()
  const intervalMs = (rangeMinutes * 60 * 1000) / (pointsCount - 1)

  let current = Math.max(minVal, Math.min(maxVal, baseValue))

  for (let i = pointsCount - 1; i >= 0; i--) {
    const timestampMs = now - i * intervalMs
    const date = new Date(timestampMs)
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    const timeStr = `${hours}:${minutes}`

    if (i === 0) {
      // Latest point equals current real value
      points.push({ timestamp: timeStr, value: Number(baseValue.toFixed(1)) })
    } else {
      // Natural random walk variation
      const delta = (Math.random() - 0.48) * volatility
      current = Math.max(minVal, Math.min(maxVal, current + delta))
      points.push({ timestamp: timeStr, value: Number(current.toFixed(1)) })
    }
  }

  return points
}
