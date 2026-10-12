/**
 * Centralized formatting utilities for Tako Console.
 * Standardizes byte, memory, CPU, and date displays across cards, tables, and charts (DRY).
 */

/**
 * Format raw bytes into human-readable size (B, KB, MB, GB, TB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

/**
 * Format memory specified in Megabytes into GiB or GB.
 * If whole number, omits fractional digits unless decimals are specified.
 */
export function formatMemoryMb(mb: number, unit: 'GiB' | 'GB' = 'GiB', decimals = 1): string {
  if (!mb || mb <= 0 || isNaN(mb)) return `0 ${unit}`;
  const val = mb / 1024;
  if (val % 1 === 0) {
    return `${val.toFixed(0)} ${unit}`;
  }
  return `${val.toFixed(decimals)} ${unit}`;
}

/**
 * Format CPU cores into standard display (e.g., 2 vCPU or 0.5 vCPU).
 */
export function formatCpu(cores: number): string {
  if (!cores || cores <= 0 || isNaN(cores)) return '0 vCPU';
  if (cores % 1 === 0) {
    return `${cores.toFixed(0)} vCPU`;
  }
  return `${cores.toFixed(1)} vCPU`;
}

/**
 * Standard short date formatting (e.g. "Oct 12, 2026").
 */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  };

  return d.toLocaleDateString(undefined, defaultOptions);
}

/**
 * Standard date & time formatting (e.g. "Oct 12, 12:45:00").
 */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  includeSeconds = true
): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false,
  });
}

/**
 * Format relative time (e.g. "2m ago", "1h ago", "3d ago", "just now").
 */
export function formatRelativeTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;

  return formatDate(d);
}
