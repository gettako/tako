'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce values (e.g. search queries or filter inputs)
 * to prevent high-frequency re-renders and memory allocations.
 */
export function useDebounce<T>(value: T, delayMs: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
