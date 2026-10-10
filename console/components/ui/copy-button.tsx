'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface CopyButtonProps {
  value?: string;
  text?: string;
  label?: string;
  title?: string;
  tooltip?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  className?: string;
  iconClassName?: string;
  children?: React.ReactNode;
}

export function CopyButton({
  value,
  text,
  label,
  title,
  tooltip,
  variant = 'ghost',
  size = 'icon',
  disabled,
  className,
  iconClassName,
  children,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const actualValue = value ?? text ?? '';
  const displayLabel = label || title || tooltip || 'Value';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !actualValue) return;
    try {
      await navigator.clipboard.writeText(actualValue);
      setCopied(true);
      toast.success(`Copied ${displayLabel} to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Failed to copy ${displayLabel}`);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={handleCopy}
      className={cn(
        size === 'icon' && 'size-6',
        'text-muted-foreground hover:text-foreground active:not-aria-[haspopup]:translate-y-px shrink-0',
        className
      )}
      title={displayLabel.toLowerCase().startsWith('copy') ? displayLabel : `Copy ${displayLabel}`}
      aria-label={displayLabel.toLowerCase().startsWith('copy') ? displayLabel : `Copy ${displayLabel}`}
    >
      {copied ? (
        <Check className={cn('size-3 text-status-success', iconClassName)} />
      ) : (
        <Copy className={cn('size-3', iconClassName)} />
      )}
      {children || (size !== 'icon' && title ? <span>{title}</span> : null)}
    </Button>
  );
}
