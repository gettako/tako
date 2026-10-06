'use client';

import React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Header } from './header';
import { Toaster } from '@/components/ui/sonner';
import { GlobalCommandPalette } from '@/components/command-palette/command-dialog';
import { ScenarioSwitcher } from '@/components/dev/scenario-switcher';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="flex flex-1 flex-col min-w-0 min-h-screen bg-background">
        <Header />
        <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full overflow-y-auto">
          {children}
        </div>
      </SidebarInset>

      {/* Global ⌘K Command Palette Modal */}
      <GlobalCommandPalette />

      {/* Dev-only Mock Scenario Switcher */}
      <ScenarioSwitcher />

      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
}
