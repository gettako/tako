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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDownIcon, CheckIcon } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  group?: string;
  rightElement?: React.ReactNode;
  avatarUrl?: string;
  badge?: React.ReactNode;
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
  triggerClassName?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
  id?: string;
  name?: string;
  ariaLabel?: string;
  error?: boolean | string;
  renderTrigger?: (selectedOption?: SearchableSelectOption) => React.ReactNode;
  renderOption?: (option: SearchableSelectOption, isSelected: boolean) => React.ReactNode;
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
  triggerClassName,
  contentClassName,
  align = 'start',
  id,
  name,
  ariaLabel,
  error,
  renderTrigger,
  renderOption,
}: SearchableSelectProps) {
  // Automatically show search whenever items count is greater than 5, or if explicitly enabled
  const isSearchable = searchable !== undefined ? searchable : options.length > 5;
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

  const hasError = Boolean(error);

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
              className={cn(
                'group flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent text-left transition-colors outline-none cursor-pointer',
                'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'dark:bg-card dark:border-border dark:text-foreground dark:placeholder:text-[#939DB8]',
                size === 'default' && 'h-9 px-3 py-1.5 text-sm',
                size === 'sm' && 'h-8 px-2.5 py-1 text-xs',
                hasError && 'border-status-danger ring-1 ring-status-danger/40',
                triggerClassName
              )}
            />
          }
        >
          {renderTrigger ? (
            <div className="flex items-center gap-2 truncate min-w-0 flex-1">
              {renderTrigger(selectedOption)}
            </div>
          ) : (
            <div className="flex items-center gap-2 truncate min-w-0 flex-1">
              {selectedOption?.avatarUrl ? (
                <Avatar className="size-4 shrink-0">
                  <AvatarImage src={selectedOption.avatarUrl} />
                  <AvatarFallback className="text-[9px]">
                    {selectedOption.label.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : React.isValidElement(selectedOption?.icon) ? (
                selectedOption.icon
              ) : selectedOption?.icon && typeof selectedOption.icon === 'function' ? (
                <selectedOption.icon className="size-4 shrink-0 text-muted-foreground" />
              ) : null}

              {selectedOption ? (
                <span className="truncate text-foreground font-normal">{selectedOption.label}</span>
              ) : (
                <span className="truncate text-muted-foreground">{placeholder}</span>
              )}

              {selectedOption?.badge && (
                <span className="shrink-0">{selectedOption.badge}</span>
              )}
            </div>
          )}

          <ChevronDownIcon
            className={cn(
              'pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-180 text-foreground'
            )}
          />
        </PopoverTrigger>

        <PopoverContent
          align={align}
          side="bottom"
          sideOffset={4}
          className={cn(
            'w-(--anchor-width) min-w-[240px] max-w-[420px] p-0 rounded-lg bg-popover text-popover-foreground border border-border shadow-lg outline-none',
            contentClassName
          )}
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
                        renderOption={renderOption}
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
                      renderOption={renderOption}
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
  renderOption,
}: {
  option: SearchableSelectOption;
  isSelected: boolean;
  onSelect: () => void;
  renderOption?: (option: SearchableSelectOption, isSelected: boolean) => React.ReactNode;
}) {
  if (renderOption) {
    return (
      <CommandItem
        value={`${option.label} ${option.value} ${option.description || ''}`}
        onSelect={onSelect}
        disabled={option.disabled}
        className={cn(
          'flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm cursor-pointer select-none outline-none',
          'data-selected:bg-muted data-selected:text-foreground',
          'dark:data-selected:bg-white/10 dark:data-selected:text-white',
          isSelected && 'font-medium text-primary dark:text-white'
        )}
      >
        {renderOption(option, isSelected)}
      </CommandItem>
    );
  }

  return (
    <CommandItem
      value={`${option.label} ${option.value} ${option.description || ''}`}
      onSelect={onSelect}
      disabled={option.disabled}
      className={cn(
        'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-sm cursor-pointer select-none outline-none',
        'data-selected:bg-muted data-selected:text-foreground',
        'dark:data-selected:bg-white/10 dark:data-selected:text-white',
        isSelected && 'font-medium text-primary dark:text-white'
      )}
    >
      <div className="flex items-center gap-2.5 truncate min-w-0">
        {option.avatarUrl ? (
          <Avatar className="size-5 shrink-0 border border-border">
            <AvatarImage src={option.avatarUrl} />
            <AvatarFallback className="text-[9px]">
              {option.label.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : React.isValidElement(option.icon) ? (
          <span className="shrink-0">{option.icon}</span>
        ) : option.icon && typeof option.icon === 'function' ? (
          <option.icon className="size-4 shrink-0 text-muted-foreground" />
        ) : null}

        <div className="truncate text-left min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="truncate font-medium">{option.label}</span>
            {option.badge && <span className="shrink-0">{option.badge}</span>}
          </div>
          {option.description && (
            <div className="text-[11px] text-muted-foreground font-normal truncate mt-0.5">
              {option.description}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        {option.rightElement}
        <CheckIcon
          className={cn(
            'size-4 text-primary transition-opacity shrink-0',
            isSelected ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>
    </CommandItem>
  );
}
