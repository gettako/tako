'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Header } from './header';
import { Toaster } from '@/components/ui/sonner';
import { GlobalCommandPalette } from '@/components/command-palette/command-dialog';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/invite/') ||
    pathname === '/onboarding';

  if (isAuthPage) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        {children}
        <Toaster position="bottom-right" richColors />
      </main>
    );
  }

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

      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
}
