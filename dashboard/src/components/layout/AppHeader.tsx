"use client";

import React, { useState, useEffect } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { useTheme } from '@/context/ThemeContext';
import { Badge } from '../common/Badge';
import { getLatencyRating } from '@/lib/utils';
import {
  Radio,
  RefreshCw,
  Clock,
  Layers,
  Cpu,
  ShieldAlert,
  Sun,
  Moon,
  Trash2,
  Check,
  Sparkles,
} from 'lucide-react';

export function AppHeader() {
  const {
    isConnected,
    metrics,
    stats,
    reconnect,
    alerts,
    clearCache,
    isSimulationActive,
    toggleSimulation,
  } = useRealtime();
  const { theme, toggleTheme } = useTheme();
  const [timeString, setTimeString] = useState<string>('');
  const [purgedRecently, setPurgedRecently] = useState(false);

  const handlePurge = () => {
    clearCache();
    setPurgedRecently(true);
    setTimeout(() => setPurgedRecently(false), 2000);
  };

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const latencyRating = getLatencyRating(metrics.avgLatency);
  const activeAlertsCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <header className="sticky top-0 z-40 h-16 bg-white/85 dark:bg-[#000000]/85 backdrop-blur-xl border-b border-[#e5e5e5] dark:border-[#14213d]/80 px-4 lg:px-8 flex items-center justify-between transition-colors duration-300">
      {/* Left: Brand and Mission Identifier */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#14213d] border border-[#fca311]/50 text-[#fca311] shadow-md shadow-black/20 group">
          <div className="absolute inset-0 rounded-xl bg-[#fca311]/10 animate-pulse-slow" />
          <Radio className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:scale-110" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm lg:text-base tracking-wide text-[#000000] dark:text-white">
              GEO-MESH <span className="text-[#fca311]">SUBSIDENCE</span>
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-md bg-[#e5e5e5] dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#d4d4d4] dark:border-[#14213d]">
              SIH-2026
            </span>
          </div>
          <p className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] hidden sm:block font-medium">
            Autonomous Mine Subsidence Early Warning &amp; Telemetry Pipeline
          </p>
        </div>
      </div>

      {/* Center: Live Pipeline Benchmarks */}
      <div className="hidden md:flex items-center gap-3">
        {/* Latency badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f4f5f7] dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d] text-xs">
          <span className="text-[#5c677d] dark:text-[#94a3b8]">Latency:</span>
          <span className={`font-mono font-bold ${latencyRating.color}`}>
            {metrics.avgLatency}ms
          </span>
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">(&lt;500ms target)</span>
        </div>

        {/* Node health ratio */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f4f5f7] dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d] text-xs text-[#5c677d] dark:text-[#94a3b8]">
          <Cpu className="w-3.5 h-3.5 text-[#fca311]" />
          <span>Nodes:</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {stats.onlineNodes}
          </span>
          <span>/</span>
          <span className="font-mono text-[#14213d] dark:text-[#e5e5e5]">{stats.totalNodes}</span>
        </div>

        {/* Zones active */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f4f5f7] dark:bg-[#14213d]/60 border border-[#e5e5e5] dark:border-[#14213d] text-xs text-[#5c677d] dark:text-[#94a3b8]">
          <Layers className="w-3.5 h-3.5 text-[#14213d] dark:text-[#fca311]" />
          <span>Zones:</span>
          <span className="font-mono font-bold text-[#14213d] dark:text-[#ffffff]">
            {stats.totalZones}
          </span>
        </div>
      </div>

      {/* Right: Actions, Theme Switcher & Clock */}
      <div className="flex items-center gap-2.5">
        {activeAlertsCount > 0 && (
          <Badge variant="danger" pulse className="hidden sm:inline-flex">
            <ShieldAlert className="w-3.5 h-3.5" />
            {activeAlertsCount} Critical
          </Badge>
        )}

        <Badge
          variant={isConnected ? 'success' : 'danger'}
          pulse={isConnected}
          className="cursor-pointer"
          onClick={reconnect}
          title="Click to reconnect WebSocket"
        >
          {isConnected ? 'LIVE WS' : 'DISCONNECTED'}
        </Badge>

        {/* Simulated Telemetry Mesh Indicator (if active) */}
        {isSimulationActive && (
          <button
            onClick={toggleSimulation}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#fca311]/15 hover:bg-[#fca311]/25 border border-[#fca311]/50 text-[#fca311] text-[11px] font-mono font-bold tracking-wider animate-pulse hover:scale-105 transition-all shadow-sm"
            title="Browser demo simulation active. Click to stop."
          >
            <Sparkles className="w-3 h-3 text-[#fca311]" />
            <span className="hidden sm:inline">DEMO RUNNING</span>
            <span className="sm:hidden">DEMO</span>
          </button>
        )}

        {/* Purge Cache Button */}
        <button
          onClick={handlePurge}
          className={`px-2.5 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-semibold ${
            purgedRecently
              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#e5e5e5] border-[#e5e5e5] dark:border-[#14213d]'
          }`}
          title="Clear cached telemetry & reset ghost nodes to strictly enforce real-time stream"
        >
          {purgedRecently ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] font-mono">Cleaned!</span>
            </>
          ) : (
            <>
              <Trash2 className="w-3.5 h-3.5 text-[#fca311]" />
              <span className="hidden md:inline text-[11px]">Clear Cache</span>
            </>
          )}
        </button>

        <button
          onClick={reconnect}
          className="p-2 rounded-xl bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#e5e5e5] border border-[#e5e5e5] dark:border-[#14213d] transition-all hover:scale-105 active:scale-95"
          title="Reconnect WebSocket Stream"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="relative p-2 rounded-xl bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/80 dark:hover:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#e5e5e5] dark:border-[#fca311]/40 transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm group"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          <div className="relative w-4 h-4 overflow-hidden">
            <Sun
              className={`w-4 h-4 absolute inset-0 transition-all duration-500 transform ${
                theme === 'dark'
                  ? 'opacity-100 rotate-0 scale-100 text-[#fca311]'
                  : 'opacity-0 -rotate-90 scale-0 text-amber-500'
              }`}
            />
            <Moon
              className={`w-4 h-4 absolute inset-0 transition-all duration-500 transform ${
                theme === 'light'
                  ? 'opacity-100 rotate-0 scale-100 text-[#14213d]'
                  : 'opacity-0 rotate-90 scale-0 text-[#14213d]'
              }`}
            />
          </div>
        </button>

        <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#5c677d] dark:text-[#94a3b8] font-mono pl-2 border-l border-[#e5e5e5] dark:border-[#14213d]">
          <Clock className="w-3.5 h-3.5 text-[#fca311]" />
          <span className="font-semibold text-[#14213d] dark:text-[#e5e5e5]">
            {timeString || '--:--:--'}
          </span>
        </div>
      </div>
    </header>
  );
}
