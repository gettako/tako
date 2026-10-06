'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading this view. Please try again.',
  error,
  retry,
  className,
}: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-8 sm:p-12 text-center',
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/10">
        <AlertTriangle className="size-6 stroke-[1.5]" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {errorMessage && (
        <pre className="mt-3 max-w-lg rounded-md bg-muted/70 p-2 font-mono text-xs text-destructive text-left overflow-x-auto">
          {errorMessage}
        </pre>
      )}
      {retry && (
        <div className="mt-6">
          <Button variant="outline" onClick={retry} className="gap-2">
            <RotateCcw className="size-4" />
            <span>Try Again</span>
          </Button>
        </div>
      )}
    </div>
  );
}
