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
  maxVal: number,
  width: number = CHART_WIDTH
): ChartPoint[] {
  const safeMin = Number.isFinite(minVal) ? minVal : 0
  const safeMax =
    Number.isFinite(maxVal) && maxVal > safeMin ? maxVal : safeMin + 1
  const rangeVal = Math.max(1e-6, safeMax - safeMin)

  if (!values || values.length === 0) {
    return []
  }

  const innerWidth = Math.max(
    1,
    width - CHART_PADDING.left - CHART_PADDING.right
  )
  const count = values.length
  const divisor = Math.max(1, count - 1)

  return values.map((rawVal, idx) => {
    const num =
      typeof rawVal === "number" && Number.isFinite(rawVal) ? rawVal : safeMin
    // Strictly clamp value between min and max
    const clampedVal = Math.max(safeMin, Math.min(safeMax, num))

    const xRatio = count === 1 ? 0.5 : idx / divisor
    const x = CHART_PADDING.left + xRatio * innerWidth

    const yRatio = (clampedVal - safeMin) / rangeVal
    const rawY =
      CHART_PADDING.top + CHART_INNER_HEIGHT - yRatio * CHART_INNER_HEIGHT
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

export function buildChartLine(
  coords: ChartPoint[],
  width: number = CHART_WIDTH,
  smooth: boolean = false
) {
  if (smooth) {
    return buildSmoothChartLine(coords, width)
  }
  if (!coords || coords.length === 0) return ""
  if (coords.length === 1) {
    const p = coords[0]
    const innerWidth = Math.max(
      1,
      width - CHART_PADDING.left - CHART_PADDING.right
    )
    return `M ${CHART_PADDING.left} ${p.y} L ${CHART_PADDING.left + innerWidth} ${p.y}`
  }

  return coords.reduce((acc, point, index) => {
    return index === 0
      ? `M ${point.x} ${point.y}`
      : `${acc} L ${point.x} ${point.y}`
  }, "")
}

export function buildChartArea(
  coords: ChartPoint[],
  width: number = CHART_WIDTH,
  smooth: boolean = false
) {
  if (smooth) {
    return buildSmoothChartArea(coords, width)
  }
  if (!coords || coords.length === 0) return ""

  const bottomY = CHART_PADDING.top + CHART_INNER_HEIGHT

  if (coords.length === 1) {
    const line = buildChartLine(coords, width)
    const innerWidth = Math.max(
      1,
      width - CHART_PADDING.left - CHART_PADDING.right
    )
    const rightX = CHART_PADDING.left + innerWidth
    const leftX = CHART_PADDING.left
    return `${line} L ${rightX} ${bottomY} L ${leftX} ${bottomY} Z`
  }

  const line = buildChartLine(coords, width)
  const lastX = coords[coords.length - 1].x
  const firstX = coords[0].x

  return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
}

export function buildSmoothChartLine(
  coords: ChartPoint[],
  width: number = CHART_WIDTH
): string {
  if (!coords || coords.length === 0) return ""
  if (coords.length === 1) {
    const p = coords[0]
    const innerWidth = Math.max(
      1,
      width - CHART_PADDING.left - CHART_PADDING.right
    )
    return `M ${CHART_PADDING.left} ${p.y} L ${CHART_PADDING.left + innerWidth} ${p.y}`
  }
  if (coords.length === 2) {
    return `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)} L ${coords[1].x.toFixed(2)} ${coords[1].y.toFixed(2)}`
  }

  const n = coords.length
  // Fritsch-Carlson Monotone Cubic Spline to prevent overshoot at extrema
  const deltas: number[] = []
  for (let k = 0; k < n - 1; k++) {
    const dx = coords[k + 1].x - coords[k].x
    const dy = coords[k + 1].y - coords[k].y
    deltas.push(dx !== 0 ? dy / dx : 0)
  }

  const m: number[] = Array.from({ length: n })
  m[0] = deltas[0]
  m[n - 1] = deltas[n - 2]
  for (let k = 1; k < n - 1; k++) {
    const prev = deltas[k - 1]
    const next = deltas[k]
    if (prev * next <= 0) {
      m[k] = 0
    } else {
      m[k] = (prev + next) / 2
    }
  }

  for (let k = 0; k < n - 1; k++) {
    const delta = deltas[k]
    if (delta === 0) {
      m[k] = 0
      m[k + 1] = 0
    } else {
      const alpha = m[k] / delta
      const beta = m[k + 1] / delta
      const dist = alpha * alpha + beta * beta
      if (dist > 9) {
        const tau = 3 / Math.sqrt(dist)
        m[k] = tau * alpha * delta
        m[k + 1] = tau * beta * delta
      }
    }
  }

  let path = `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`
  for (let k = 0; k < n - 1; k++) {
    const dx = coords[k + 1].x - coords[k].x
    const cp1x = coords[k].x + dx / 3
    const cp1y = coords[k].y + (m[k] * dx) / 3
    const cp2x = coords[k + 1].x - dx / 3
    const cp2y = coords[k + 1].y - (m[k + 1] * dx) / 3
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${coords[k + 1].x.toFixed(2)} ${coords[k + 1].y.toFixed(2)}`
  }

  return path
}

export function buildSmoothChartArea(
  coords: ChartPoint[],
  width: number = CHART_WIDTH
): string {
  if (!coords || coords.length === 0) return ""

  const bottomY = CHART_PADDING.top + CHART_INNER_HEIGHT

  if (coords.length === 1) {
    const line = buildSmoothChartLine(coords, width)
    const innerWidth = Math.max(
      1,
      width - CHART_PADDING.left - CHART_PADDING.right
    )
    const rightX = CHART_PADDING.left + innerWidth
    const leftX = CHART_PADDING.left
    return `${line} L ${rightX} ${bottomY} L ${leftX} ${bottomY} Z`
  }

  const line = buildSmoothChartLine(coords, width)
  const lastX = coords[coords.length - 1].x
  const firstX = coords[0].x

  return `${line} L ${lastX.toFixed(2)} ${bottomY} L ${firstX.toFixed(2)} ${bottomY} Z`
}
