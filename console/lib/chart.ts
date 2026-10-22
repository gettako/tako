export interface ChartPoint {
  x: number
  y: number
}

export const CHART_WIDTH = 640
export const CHART_HEIGHT = 180
export const CHART_PADDING = { top: 16, right: 16, bottom: 28, left: 36 }
export const CHART_INNER_WIDTH =
  CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right
export const CHART_INNER_HEIGHT =
  CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom

export function getChartCoordinates(
  values: number[],
  minVal: number,
  maxVal: number
): ChartPoint[] {
  const safeMin = Number.isFinite(minVal) ? minVal : 0
  const safeMax = Number.isFinite(maxVal) && maxVal > safeMin ? maxVal : safeMin + 1
  const rangeVal = Math.max(1e-6, safeMax - safeMin)

  if (!values || values.length === 0) {
    return []
  }

  const count = values.length
  const divisor = Math.max(1, count - 1)

  return values.map((rawVal, idx) => {
    const num = typeof rawVal === "number" && Number.isFinite(rawVal) ? rawVal : safeMin
    // Strictly clamp value between min and max
    const clampedVal = Math.max(safeMin, Math.min(safeMax, num))

    const xRatio = count === 1 ? 0.5 : idx / divisor
    const x = CHART_PADDING.left + xRatio * CHART_INNER_WIDTH

    const yRatio = (clampedVal - safeMin) / rangeVal
    const rawY = CHART_PADDING.top + CHART_INNER_HEIGHT - yRatio * CHART_INNER_HEIGHT
    // Strictly clamp Y inside the chart plot area
    const y = Math.max(
      CHART_PADDING.top,
      Math.min(CHART_PADDING.top + CHART_INNER_HEIGHT, rawY)
    )

    return {
      x: Number.isFinite(x) ? x : CHART_PADDING.left,
      y: Number.isFinite(y) ? y : CHART_PADDING.top + CHART_INNER_HEIGHT,
    }
  })
}

export function buildChartLine(coords: ChartPoint[]) {
  if (!coords || coords.length === 0) return ""
  if (coords.length === 1) {
    const p = coords[0]
    return `M ${CHART_PADDING.left} ${p.y} L ${CHART_PADDING.left + CHART_INNER_WIDTH} ${p.y}`
  }

  return coords.reduce((acc, point, index) => {
    return index === 0
      ? `M ${point.x} ${point.y}`
      : `${acc} L ${point.x} ${point.y}`
  }, "")
}

export function buildChartArea(coords: ChartPoint[]) {
  if (!coords || coords.length === 0) return ""

  const bottomY = CHART_PADDING.top + CHART_INNER_HEIGHT

  if (coords.length === 1) {
    const line = buildChartLine(coords)
    const rightX = CHART_PADDING.left + CHART_INNER_WIDTH
    const leftX = CHART_PADDING.left
    return `${line} L ${rightX} ${bottomY} L ${leftX} ${bottomY} Z`
  }

  const line = buildChartLine(coords)
  const lastX = coords[coords.length - 1].x
  const firstX = coords[0].x

  return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
}
