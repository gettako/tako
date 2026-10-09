'use client';

import React from 'react';
import { Cpu, HardDrive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export interface ResourceSliderFieldsProps {
  cpuCores: number;
  setCpuCores: (val: number) => void;
  memoryMb: number;
  setMemoryMb: (val: number) => void;
  maxCpu?: number;
  maxMemoryMb?: number;
  disabled?: boolean;
}

const DEFAULT_CPU_STEPS = [0.25, 0.5, 1, 2, 4, 8, 16];
const DEFAULT_MEM_STEPS = [256, 512, 1024, 2048, 4096, 8192, 16384];

function getStepIndex(val: number, steps: number[]): number {
  if (!steps.length) return 0;
  if (val <= steps[0]) return 0;
  if (val >= steps[steps.length - 1]) return steps.length - 1;

  for (let i = 0; i < steps.length - 1; i++) {
    if (val === steps[i]) return i;
    if (val > steps[i] && val < steps[i + 1]) {
      const frac = (val - steps[i]) / (steps[i + 1] - steps[i]);
      return i + frac;
    }
  }
  return steps.length - 1;
}

export function formatMemoryDisplay(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

export function ResourceSliderFields({
  cpuCores,
  setCpuCores,
  memoryMb,
  setMemoryMb,
  maxCpu = 8,
  maxMemoryMb = 16384,
  disabled = false,
}: ResourceSliderFieldsProps) {
  const availableCpuSteps = DEFAULT_CPU_STEPS.filter((s) => s <= maxCpu);
  if (!availableCpuSteps.includes(maxCpu) && maxCpu > 0) {
    availableCpuSteps.push(maxCpu);
  }
  const cpuStepIndex = getStepIndex(cpuCores, availableCpuSteps);

  const availableMemSteps = DEFAULT_MEM_STEPS.filter((s) => s <= maxMemoryMb);
  if (!availableMemSteps.includes(maxMemoryMb) && maxMemoryMb > 0) {
    availableMemSteps.push(maxMemoryMb);
  }
  const memStepIndex = getStepIndex(memoryMb, availableMemSteps);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {/* CPU Slider Card */}
      <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Cpu className="size-3.5" />
            </div>
            <div>
              <Label
                htmlFor="cpu-custom-input"
                className="text-xs font-semibold text-foreground block cursor-pointer"
              >
                CPU Limit
              </Label>
              <span className="text-[10px] text-muted-foreground">vCPU Cores quota</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Input
              id="cpu-custom-input"
              type="number"
              min="0.25"
              max={maxCpu}
              step="0.25"
              value={cpuCores}
              disabled={disabled}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                  setCpuCores(Math.min(maxCpu, Math.max(0.25, val)));
                }
              }}
              className="w-20 h-7.5 text-xs font-mono text-right py-1 px-2"
            />
            <span className="text-xs font-mono text-muted-foreground">vCPU</span>
          </div>
        </div>

        <div className="px-2 pt-2 pb-5">
          <div className="relative">
            <Slider
              value={[cpuStepIndex]}
              min={0}
              max={availableCpuSteps.length - 1}
              step={1}
              disabled={disabled}
              onValueChange={(val) => {
                const arr = Array.isArray(val) ? val : [val];
                const idx = arr[0];
                if (idx !== undefined) {
                  const rounded = Math.round(idx);
                  if (availableCpuSteps[rounded] !== undefined) {
                    setCpuCores(availableCpuSteps[rounded]);
                  }
                }
              }}
              className="py-1 cursor-pointer"
            />

            <div className="relative w-full h-7 mt-1.5 pointer-events-none select-none">
              {availableCpuSteps.map((stepVal, idx) => {
                const totalSteps =
                  availableCpuSteps.length > 1 ? availableCpuSteps.length - 1 : 1;
                const percent = (idx / totalSteps) * 100;
                const isSelected = cpuCores === stepVal;
                const isPast = cpuCores >= stepVal;

                return (
                  <button
                    key={stepVal}
                    type="button"
                    disabled={disabled}
                    onClick={() => setCpuCores(stepVal)}
                    title={`Set CPU to ${stepVal} vCPU`}
                    className="pointer-events-auto absolute -translate-x-1/2 flex flex-col items-center group cursor-pointer focus:outline-none"
                    style={{ left: `${percent}%` }}
                  >
                    <span
                      className={cn(
                        'w-0.5 rounded-full transition-all mb-1',
                        isSelected
                          ? 'bg-primary h-2 w-1'
                          : isPast
                          ? 'bg-primary/70 h-1.5'
                          : 'bg-muted-foreground/30 h-1.5',
                        'group-hover:bg-primary group-hover:h-2 group-hover:w-1'
                      )}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-mono leading-none transition-colors px-1 py-0.5 rounded',
                        isSelected
                          ? 'text-primary font-bold bg-primary/10'
                          : 'text-muted-foreground group-hover:text-foreground group-hover:bg-muted/60'
                      )}
                    >
                      {stepVal}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Memory Slider Card */}
      <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <HardDrive className="size-3.5" />
            </div>
            <div>
              <Label
                htmlFor="mem-custom-input"
                className="text-xs font-semibold text-foreground block cursor-pointer"
              >
                Memory Limit
              </Label>
              <span className="text-[10px] text-muted-foreground">RAM limit quota</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Input
              id="mem-custom-input"
              type="number"
              min="128"
              max={maxMemoryMb}
              step="128"
              value={memoryMb}
              disabled={disabled}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                  setMemoryMb(Math.min(maxMemoryMb, Math.max(128, val)));
                }
              }}
              className="w-20 h-7.5 text-xs font-mono text-right py-1 px-2"
            />
            <span className="text-xs font-mono text-muted-foreground">MB</span>
          </div>
        </div>

        <div className="px-2 pt-2 pb-5">
          <div className="relative">
            <Slider
              value={[memStepIndex]}
              min={0}
              max={availableMemSteps.length - 1}
              step={1}
              disabled={disabled}
              onValueChange={(val) => {
                const arr = Array.isArray(val) ? val : [val];
                const idx = arr[0];
                if (idx !== undefined) {
                  const rounded = Math.round(idx);
                  if (availableMemSteps[rounded] !== undefined) {
                    setMemoryMb(availableMemSteps[rounded]);
                  }
                }
              }}
              className="py-1 cursor-pointer"
            />

            <div className="relative w-full h-7 mt-1.5 pointer-events-none select-none">
              {availableMemSteps.map((stepVal, idx) => {
                const totalSteps =
                  availableMemSteps.length > 1 ? availableMemSteps.length - 1 : 1;
                const percent = (idx / totalSteps) * 100;
                const isSelected = memoryMb === stepVal;
                const isPast = memoryMb >= stepVal;

                return (
                  <button
                    key={stepVal}
                    type="button"
                    disabled={disabled}
                    onClick={() => setMemoryMb(stepVal)}
                    title={`Set Memory to ${formatMemoryDisplay(stepVal)}`}
                    className="pointer-events-auto absolute -translate-x-1/2 flex flex-col items-center group cursor-pointer focus:outline-none"
                    style={{ left: `${percent}%` }}
                  >
                    <span
                      className={cn(
                        'w-0.5 rounded-full transition-all mb-1',
                        isSelected
                          ? 'bg-primary h-2 w-1'
                          : isPast
                          ? 'bg-primary/70 h-1.5'
                          : 'bg-muted-foreground/30 h-1.5',
                        'group-hover:bg-primary group-hover:h-2 group-hover:w-1'
                      )}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-mono leading-none transition-colors px-1 py-0.5 rounded',
                        isSelected
                          ? 'text-primary font-bold bg-primary/10'
                          : 'text-muted-foreground group-hover:text-foreground group-hover:bg-muted/60'
                      )}
                    >
                      {formatMemoryDisplay(stepVal)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
