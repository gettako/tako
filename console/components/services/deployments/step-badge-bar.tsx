"use client"

import * as React from "react"

import { StepBadge } from "./step-badge"
import { DeploymentPipelineStep, DeploymentStepName } from "@/types/platform"

export interface StepBadgeBarProps {
  steps: DeploymentPipelineStep[]
  activeStepName?: DeploymentStepName | null
  onSelectStep?: (stepName: DeploymentStepName) => void
}

export function StepBadgeBar({
  steps,
  activeStepName,
  onSelectStep,
}: StepBadgeBarProps) {
  return (
    <div className="w-full overflow-x-auto py-1">
      <div className="grid w-full min-w-[680px] grid-cols-7 gap-2.5 sm:gap-3">
        {steps.map((step) => (
          <StepBadge
            key={step.name}
            step={step}
            isActive={activeStepName === step.name}
            onClick={() => onSelectStep?.(step.name)}
          />
        ))}
      </div>
    </div>
  )
}
