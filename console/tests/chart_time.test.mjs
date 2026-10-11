import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTimeRangeConfig,
  formatChartTick,
  formatChartTooltip,
  normalizeChartTimeSeries,
} from '../lib/utils/chart-time.ts';

test('getTimeRangeConfig - returns correct durations and step sizes', () => {
  const c15m = getTimeRangeConfig('15m');
  assert.equal(c15m.durationMs, 15 * 60 * 1000);
  assert.equal(c15m.bucketCount, 15);

  const c1h = getTimeRangeConfig('1h');
  assert.equal(c1h.durationMs, 60 * 60 * 1000);
  assert.equal(c1h.bucketCount, 20);

  const c6h = getTimeRangeConfig('6h');
  assert.equal(c6h.durationMs, 6 * 3600 * 1000);
  assert.equal(c6h.bucketCount, 24);

  const c24h = getTimeRangeConfig('24h');
  assert.equal(c24h.durationMs, 24 * 3600 * 1000);
  assert.equal(c24h.bucketCount, 24);

  const c7d = getTimeRangeConfig('7d');
  assert.equal(c7d.durationMs, 7 * 24 * 3600 * 1000);
  assert.equal(c7d.bucketCount, 28);
});

test('formatChartTick - formats ticks appropriately by range', () => {
  const date = new Date('2026-10-11T10:30:00Z');

  // 1h and 6h show HH:mm
  const tick1h = formatChartTick(date, '1h');
  assert.ok(tick1h.length > 0);

  // 24h shows date + time so user clearly sees the 24-hour timeline
  const tick24h = formatChartTick(date, '24h');
  assert.ok(tick24h.length > 0);

  // 7d shows month and day
  const tick7d = formatChartTick(date, '7d');
  assert.ok(tick7d.length > 0);
});

test('normalizeChartTimeSeries - generates full 24h span even when metrics only cover recent 20m', () => {
  const now = Date.now();
  // Simulate database having only 20 minutes of telemetry
  const recentPoints = [
    {
      timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
      cpu: 25,
      memory: 50,
      networkRx: 100,
      networkTx: 200,
      disk: 40,
    },
    {
      timestamp: new Date(now - 2 * 60 * 1000).toISOString(),
      cpu: 30,
      memory: 55,
      networkRx: 120,
      networkTx: 210,
      disk: 40,
    },
  ];

  const normalized = normalizeChartTimeSeries(recentPoints, '24h', ['cpu', 'memory']);

  // Must have 25 bucket points covering the full 24h span
  assert.equal(normalized.length, 25);

  const firstBucket = normalized[0];
  const lastBucket = normalized[normalized.length - 1];

  const firstTime = new Date(firstBucket.timestamp).getTime();
  const lastTime = new Date(lastBucket.timestamp).getTime();

  // Span between first and last bucket must be 24 hours (86400000 ms)
  const spanMs = lastTime - firstTime;
  assert.equal(spanMs, 24 * 3600 * 1000);

  // First bucket (yesterday) should be 0 because host was inactive/not recording yet
  assert.equal(firstBucket.cpu, 0);

  // Last bucket (now) should reflect recent telemetry
  assert.ok(lastBucket.cpu > 0);
});
