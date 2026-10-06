'use client';

import * as React from 'react';
import { cn } from 'cn';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChevronDownIcon, CheckIcon } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  group?: string;
}

export interface SearchableSelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  searchable?: boolean;
  size?: 'default' | 'sm';
  className?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
  id?: string;
  name?: string;
  ariaLabel?: string;
}

export function SearchableSelect({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  options,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No options found.',
  disabled = false,
  searchable,
  size = 'default',
  className,
  contentClassName,
  align = 'start',
  id,
  name,
  ariaLabel,
}: SearchableSelectProps) {
  const isSearchable = searchable !== undefined ? searchable : options.length >= 5;
  const [open, setOpen] = React.useState(false);
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : uncontrolledValue;

  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.value === currentValue);
  }, [options, currentValue]);

  const handleSelect = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
      setOpen(false);
    },
    [isControlled, onValueChange]
  );

  // Group options if any option specifies a group
  const groupedOptions = React.useMemo(() => {
    const hasGroups = options.some((opt) => !!opt.group);
    if (!hasGroups) return null;

    const map = new Map<string, SearchableSelectOption[]>();
    for (const opt of options) {
      const g = opt.group || 'Options';
      if (!map.has(g)) {
        map.set(g, []);
      }
      map.get(g)!.push(opt);
    }
    return map;
  }, [options]);

  const SelectedIcon = selectedOption?.icon;

  return (
    <div className={cn('relative w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              id={id}
              name={name}
              role="combobox"
              aria-expanded={open}
              aria-label={ariaLabel || placeholder}
              disabled={disabled}
              className={cn( 'group flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent text-left transition-colors outline-none', 'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50', 'disabled:cursor-not-allowed disabled:opacity-50', 'dark:bg-card dark:border-border dark:text-foreground dark:placeholder:text-[#939DB8]', size === 'default' && 'h-9 px-3 py-1.5 text-sm', size === 'sm' && 'h-8 px-2.5 py-1 text-xs' )}
            />
          }
        >
          <span className="flex items-center gap-2 truncate">
            {SelectedIcon && <SelectedIcon className="size-4 shrink-0 text-muted-foreground" />}
            {selectedOption ? (
              <span className="truncate text-foreground font-normal">{selectedOption.label}</span>
            ) : (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDownIcon
            className={cn( 'pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-150', open && 'rotate-180 text-foreground' )}
          />
        </PopoverTrigger>

        <PopoverContent
          align={align}
          side="bottom"
          sideOffset={4}
          className={cn( 'w-(--anchor-width) min-w-[200px] p-0 rounded-md bg-popover text-popover-foreground border border-border outline-none', contentClassName )}
        >
          <Command className="w-full">
            {isSearchable && (
              <CommandInput placeholder={searchPlaceholder} autoFocus className="text-sm" />
            )}
            <CommandList className="max-h-60 overflow-y-auto p-1 text-sm">
              <CommandEmpty>{emptyText}</CommandEmpty>

              {groupedOptions ? (
                Array.from(groupedOptions.entries()).map(([groupName, groupOpts]) => (
                  <CommandGroup key={groupName} heading={groupName}>
                    {groupOpts.map((option) => (
                      <CommandOptionItem
                        key={option.value}
                        option={option}
                        isSelected={option.value === currentValue}
                        onSelect={() => handleSelect(option.value)}
                      />
                    ))}
                  </CommandGroup>
                ))
              ) : (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandOptionItem
                      key={option.value}
                      option={option}
                      isSelected={option.value === currentValue}
                      onSelect={() => handleSelect(option.value)}
                    />
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CommandOptionItem({
  option,
  isSelected,
  onSelect,
}: {
  option: SearchableSelectOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;

  return (
    <CommandItem
      value={`${option.label} ${option.value} ${option.description || ''}`}
      onSelect={onSelect}
      disabled={option.disabled}
      className={cn( 'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm text-sm cursor-pointer select-none outline-none', 'data-selected:bg-muted data-selected:text-foreground', 'dark:data-selected:bg-white/10 dark:data-selected:text-white', isSelected && 'font-medium text-primary dark:text-white' )}
    >
      <div className="flex items-center gap-2 truncate">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <div className="truncate">
          <div className="truncate">{option.label}</div>
          {option.description && (
            <div className="text-xs text-muted-foreground font-normal truncate">
              {option.description}
            </div>
          )}
        </div>
      </div>
      <CheckIcon
        className={cn( 'size-4 shrink-0 text-primary transition-opacity', isSelected ? 'opacity-100' : 'opacity-0' )}
      />
    </CommandItem>
  );
}
