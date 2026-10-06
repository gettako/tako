'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, Check, AlertOctagon, Layers, Minimize2, Maximize2 } from 'lucide-react';
import { applyScenario, getCurrentScenario, ScenarioType } from '@/lib/mock/scenarios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function ScenarioSwitcher() {
  const queryClient = useQueryClient();
  const [activeScenario, setActiveScenario] = useState<ScenarioType>(getCurrentScenario());
  const [isMinimized, setIsMinimized] = useState(false);

  const handleSelect = (scenario: ScenarioType) => {
    setActiveScenario(scenario);
    applyScenario(scenario);

    // Invalidate all TanStack queries to instantly update every page view
    queryClient.invalidateQueries();

    const labelMap: Record<ScenarioType, string> = {
      normal: 'Normal (Balanced Cluster)',
      errors: 'Many Errors (High Alert)',
      empty: 'Empty (Clean Slate)',
    };

    toast.info(`Switched mock scenario to: ${labelMap[scenario]}`);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex size-9 items-center justify-center rounded-full bg-background/90 text-primary border border-border backdrop-blur-md hover:bg-muted/80 transition-all"
          title="Open Dev Scenario Switcher"
        >
          <Sparkles className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 backdrop-blur-md text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium pl-1">
          <Sparkles className="size-3.5 text-primary" />
          <span className="hidden sm:inline">Scenario:</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Normal */}
          <button
            onClick={() => handleSelect('normal')}
            className={cn( 'flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-all', activeScenario === 'normal' ? 'bg-status-success/15 text-status-success border border-status-success/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60' )}
          >
            <span className="size-1.5 rounded-full bg-status-success" />
            <span>Normal</span>
          </button>

          {/* Many Errors */}
          <button
            onClick={() => handleSelect('errors')}
            className={cn( 'flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-all', activeScenario === 'errors' ? 'bg-status-danger/15 text-status-danger border border-status-danger/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60' )}
          >
            <span className="size-1.5 rounded-full bg-status-danger" />
            <span>Errors</span>
          </button>

          {/* Empty Slate */}
          <button
            onClick={() => handleSelect('empty')}
            className={cn( 'flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-all', activeScenario === 'empty' ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60' )}
          >
            <span className="size-1.5 rounded-full bg-muted-foreground/60" />
            <span>Empty</span>
          </button>
        </div>

        <button
          onClick={() => setIsMinimized(true)}
          className="ml-1 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Minimize widget"
        >
          <Minimize2 className="size-3" />
        </button>
      </div>
    </div>
  );
}
