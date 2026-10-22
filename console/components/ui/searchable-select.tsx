"use client"

import * as React from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { Button } from "@/components/ui/button"
import { Flag } from "@/components/ui/flag"
import { Input } from "@/components/ui/input"
import type { SelectOption } from "@/lib/select-option"
import { cn } from "@/lib/utils"

export type { SelectOption } from "@/lib/select-option"

interface SearchableSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  dropdownClassName?: string
  size?: "default" | "sm"
  align?: "start" | "end"
  id?: string
  name?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search options...",
  disabled = false,
  className,
  triggerClassName,
  dropdownClassName,
  size = "default",
  align = "start",
  id,
  name,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listboxId = React.useId()

  const selectedOption = options.find((opt) => opt.value === value)

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options
    const q = searchQuery.toLowerCase()
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    )
  }, [options, searchQuery])

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSearchQuery("")
    }
  }, [])

  return (
    <div className={cn("w-full", className)}>
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <PopoverPrimitive.Trigger
          render={
            <Button
              id={id}
              name={name}
              type="button"
              role="combobox"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledby}
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-controls={listboxId}
              disabled={disabled}
              variant="outline"
              className={cn(
                size === "sm"
                  ? "h-7 w-full justify-between border-border/80 bg-background/90 px-2 text-xs font-normal shadow-2xs hover:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring"
                  : "h-9 w-full justify-between border-input bg-background px-3 text-xs font-normal shadow-xs hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring",
                !selectedOption && "text-muted-foreground",
                open && "border-ring ring-1 ring-ring",
                triggerClassName
              )}
            >
              <span className="flex items-center gap-1.5 truncate text-left">
                {selectedOption?.flag && (
                  <Flag
                    src={selectedOption.flag}
                    alt=""
                    width={18}
                    height={12}
                    className="h-3"
                  />
                )}
                {selectedOption?.icon && !selectedOption.flag && (
                  <selectedOption.icon className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">
                  {selectedOption ? selectedOption.label : placeholder}
                </span>
                {selectedOption?.badge && (
                  <span className="py-0.2 rounded bg-muted px-1 font-mono text-[9px] text-muted-foreground">
                    {selectedOption.badge}
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </Button>
          }
        />

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            side="bottom"
            sideOffset={4}
            align={align}
            className="z-[70]"
          >
            <PopoverPrimitive.Popup
              id={listboxId}
              role="listbox"
              initialFocus={inputRef}
              style={{ minWidth: "var(--anchor-width, 220px)" }}
              className={cn(
                "max-h-72 w-[var(--anchor-width)] max-w-[var(--available-width)] min-w-[220px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md backdrop-blur-md duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                dropdownClassName
              )}
            >
              {/* Search Input Bar */}
              <div className="flex items-center border-b border-border bg-muted/20 px-2.5 py-1.5">
                <Search className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      e.stopPropagation()
                      if (filteredOptions.length > 0) {
                        onChange(filteredOptions[0].value)
                        handleOpenChange(false)
                      }
                    } else if (e.key === "Escape") {
                      e.preventDefault()
                      e.stopPropagation()
                      handleOpenChange(false)
                    }
                  }}
                  className="h-7 border-none bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:outline-none"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSearchQuery("")
                      inputRef.current?.focus()
                    }}
                    className="size-5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>

              {/* Options List */}
              <div className="max-h-56 overflow-y-auto p-1 text-xs">
                {filteredOptions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    No matching options found.
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(opt.value)
                          handleOpenChange(false)
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors",
                          isSelected
                            ? "bg-primary font-medium text-primary-foreground"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {opt.flag && (
                            <Flag
                              src={opt.flag}
                              alt=""
                              width={18}
                              height={12}
                              className="h-3"
                            />
                          )}
                          {Icon && !opt.flag && (
                            <Icon
                              className={cn(
                                "size-3.5 shrink-0",
                                isSelected
                                  ? "text-primary-foreground"
                                  : "text-muted-foreground"
                              )}
                            />
                          )}
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate font-medium">
                                {opt.label}
                              </span>
                              {opt.badge && (
                                <span
                                  className={cn(
                                    "py-0.2 rounded px-1 font-mono text-[9px]",
                                    isSelected
                                      ? "bg-primary-foreground/20 text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            {opt.description && (
                              <div
                                className={cn(
                                  "truncate font-mono text-[10px]",
                                  isSelected
                                    ? "text-primary-foreground/80"
                                    : "text-muted-foreground"
                                )}
                              >
                                {opt.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="ml-2 size-3.5 shrink-0 text-primary-foreground" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  )
}
