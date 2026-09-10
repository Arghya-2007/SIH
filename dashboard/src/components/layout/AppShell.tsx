"use client";

import React from 'react';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { LiveStatusBar } from './LiveStatusBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#000000] text-[#14213d] dark:text-white font-sans transition-colors duration-300">
      {/* Navigation Sidebar */}
      <AppSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Header */}
        <AppHeader />

        {/* Scrollable Page Content with Ambient Gradient Mesh */}
        <main className="flex-1 overflow-y-auto relative px-4 lg:px-8 pt-3 pb-6 lg:pt-4 lg:pb-8 bg-[#fdfdfd] dark:bg-[#000000] transition-colors duration-300">
          {/* Ambient Lighting & Mesh Gradient Overlays */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
            {/* Dark Theme Ambient Orbs */}
            <div className="hidden dark:block absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#14213d]/60 via-[#14213d]/20 to-transparent blur-[120px] animate-float-orb" />
            <div className="hidden dark:block absolute top-1/3 -right-20 w-[450px] h-[450px] rounded-full bg-gradient-to-tl from-[#fca311]/12 via-[#fca311]/4 to-transparent blur-[100px] animate-pulse-slow" />
            <div className="hidden dark:block absolute -bottom-32 left-10 w-[500px] h-[500px] rounded-full bg-[#14213d]/40 blur-[130px]" />

            {/* Light Theme Ambient Radiance */}
            <div className="block dark:hidden absolute -top-32 left-1/3 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-[#14213d]/5 via-[#fca311]/5 to-transparent blur-[100px] animate-float-orb" />
            <div className="block dark:hidden absolute top-1/2 -right-20 w-[400px] h-[400px] rounded-full bg-gradient-to-bl from-[#fca311]/8 via-transparent to-transparent blur-[90px]" />

            {/* Subtle Tech Cyber Dot Grid Matrix */}
            <div className="absolute inset-0 cyber-grid-overlay opacity-30 dark:opacity-20" />
          </div>

          {/* Page Content Viewport */}
          <div className="max-w-7xl mx-auto w-full space-y-6 relative z-10">
            {children}
          </div>
        </main>

        {/* Realtime Bottom Status Bar */}
        <LiveStatusBar />
      </div>
    </div>
  );
}
