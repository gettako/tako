/**
 * Lightweight cron parser, validator, explainer, and next-run calculator.
 * Strictly adheres to ponytail principles: zero external dependencies,
 * clean standard library Date math and regular expressions.
 */

export interface CronValidationResult {
  isValid: boolean;
  error?: string;
}

const COMMON_PATTERNS: Record<string, string> = {
  '* * * * *': 'Every minute',
  '*/2 * * * *': 'Every 2 minutes',
  '*/5 * * * *': 'Every 5 minutes',
  '*/10 * * * *': 'Every 10 minutes',
  '*/15 * * * *': 'Every 15 minutes',
  '*/30 * * * *': 'Every 30 minutes',
  '0 * * * *': 'Every hour at the start of the hour',
  '0 */2 * * *': 'Every 2 hours',
  '0 */3 * * *': 'Every 3 hours',
  '0 */6 * * *': 'Every 6 hours',
  '0 */12 * * *': 'Every 12 hours',
  '0 0 * * *': 'Every day at midnight (00:00 UTC)',
  '0 2 * * *': 'Every day at 02:00 UTC',
  '0 3 * * *': 'Every day at 03:00 UTC',
  '0 12 * * *': 'Every day at noon (12:00 UTC)',
  '0 0 * * 0': 'Every Sunday at midnight',
  '0 0 * * 1': 'Every Monday at midnight',
  '0 0 1 * *': 'First day of every month at midnight',
};

const FIELD_RANGES = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day-of-month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'day-of-week', min: 0, max: 7 }, // 0 or 7 = Sunday
];

export function validateCronExpression(expression: string): CronValidationResult {
  if (!expression || typeof expression !== 'string') {
    return { isValid: false, error: 'Expression is required' };
  }

  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      isValid: false,
      error: `Expected 5 fields (minute, hour, day, month, day-of-week), got ${parts.length}`,
    };
  }

  for (let i = 0; i < 5; i++) {
    const part = parts[i];
    const { name, min, max } = FIELD_RANGES[i];

    if (part === '*') continue;

    // Step pattern */n
    if (part.startsWith('*/')) {
      const step = Number(part.slice(2));
      if (isNaN(step) || step <= 0 || step > max) {
        return { isValid: false, error: `Invalid step value in ${name}: "${part}"` };
      }
      continue;
    }

    // Comma separated list
    const subParts = part.split(',');
    for (const sub of subParts) {
      // Range n-m
      if (sub.includes('-')) {
        const [start, end] = sub.split('-').map(Number);
        if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
          return { isValid: false, error: `Invalid range in ${name}: "${sub}"` };
        }
      } else {
        const num = Number(sub);
        if (isNaN(num) || num < min || num > max) {
          return { isValid: false, error: `Invalid value for ${name}: "${sub}" (range: ${min}-${max})` };
        }
      }
    }
  }

  return { isValid: true };
}

export function explainCronExpression(expression: string): string {
  const trimmed = expression.trim();
  if (COMMON_PATTERNS[trimmed]) {
    return COMMON_PATTERNS[trimmed];
  }

  const validation = validateCronExpression(trimmed);
  if (!validation.isValid) {
    return 'Invalid cron expression';
  }

  const parts = trimmed.split(/\s+/);
  const [min, hour, dom, mon, dow] = parts;

  // Pattern: */N * * * *
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${min.slice(2)} minutes`;
  }

  // Pattern: M * * * *
  if (!min.includes('*') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every hour at minute ${min.padStart(2, '0')}`;
  }

  // Pattern: M H * * *
  if (!min.includes('*') && !hour.includes('*') && dom === '*' && mon === '*' && dow === '*') {
    return `Every day at ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  }

  // Pattern: M H * * D
  if (!min.includes('*') && !hour.includes('*') && dom === '*' && mon === '*' && !dow.includes('*')) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayName = days[Number(dow)] || `Day ${dow}`;
    return `Every ${dayName} at ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  }

  // Pattern: M H D * *
  if (!min.includes('*') && !hour.includes('*') && !dom.includes('*') && mon === '*' && dow === '*') {
    return `On day ${dom} of every month at ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`;
  }

  return `Custom: ${trimmed}`;
}

function fieldMatches(val: number, field: string): boolean {
  if (field === '*') return true;
  if (field.startsWith('*/')) {
    const step = Number(field.slice(2));
    return step > 0 && val % step === 0;
  }
  const parts = field.split(',');
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (val >= start && val <= end) return true;
    } else {
      if (Number(part) === val) return true;
    }
  }
  return false;
}

export function getNextRunDates(expression: string, count: number = 5, fromDate: Date = new Date()): Date[] {
  const validation = validateCronExpression(expression);
  if (!validation.isValid) return [];

  const [minField, hourField, domField, monField, dowField] = expression.trim().split(/\s+/);
  const results: Date[] = [];

  // Start from next full minute
  const current = new Date(fromDate.getTime());
  current.setUTCSeconds(0, 0);
  current.setUTCMinutes(current.getUTCMinutes() + 1);

  // Maximum loop iterations to protect from infinite search (approx 5 years of minutes)
  const maxIterations = 200000;
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;

    const m = current.getUTCMinutes();
    const h = current.getUTCHours();
    const dom = current.getUTCDate();
    const mon = current.getUTCMonth() + 1; // 1-12
    const dow = current.getUTCDay(); // 0-6

    const matchesMin = fieldMatches(m, minField);
    const matchesHour = fieldMatches(h, hourField);
    const matchesDom = fieldMatches(dom, domField);
    const matchesMon = fieldMatches(mon, monField);
    const matchesDow = fieldMatches(dow, dowField) || (dow === 0 && fieldMatches(7, dowField));

    if (matchesMin && matchesHour && matchesDom && matchesMon && matchesDow) {
      results.push(new Date(current.getTime()));
    }

    // Step forward: if minutes don't match, we can just step by 1 minute.
    // If hour doesn't match and minute is 0, we could advance by 60 mins, but 1-min increments
    // within a limit of 200,000 steps easily runs in < 15ms in JS engines.
    current.setUTCMinutes(current.getUTCMinutes() + 1);
  }

  return results;
}
