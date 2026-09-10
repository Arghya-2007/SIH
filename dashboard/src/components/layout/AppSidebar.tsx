"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Activity,
  Cpu,
  ShieldAlert,
  BarChart3,
  Network,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Server,
} from 'lucide-react';
import { useRealtime } from '@/hooks/useRealtime';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const pathname = usePathname();
  // Initially closed by default; user can extend/expand it
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sih_sidebar_collapsed');
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sih_sidebar_collapsed', String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };
  const { alerts, stats, metrics } = useRealtime();

  const criticalAlertsCount = alerts.filter(a => a.severity === 'critical').length;

  const navItems = [
    {
      label: 'Executive Overview',
      href: '/',
      icon: Home,
      badge: null,
      description: 'System landing & pipeline summary',
    },
    {
      label: 'Realtime Monitoring',
      href: '/monitoring',
      icon: Activity,
      badge: stats.onlineNodes > 0 ? `${stats.onlineNodes} Live` : null,
      badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      description: 'Zone sensor telemetry grid',
    },
    {
      label: 'Node Fleet Health',
      href: '/nodes',
      icon: Cpu,
      badge: stats.totalGaps > 0 ? `${stats.totalGaps} Gaps` : null,
      badgeColor: 'bg-[#fca311]/15 text-amber-800 dark:text-[#fca311] border-[#fca311]/40',
      description: 'Packet gaps & LWT status',
    },
    {
      label: 'Alerts & Anomalies',
      href: '/alerts',
      icon: ShieldAlert,
      badge: criticalAlertsCount > 0 ? `${criticalAlertsCount}` : null,
      badgeColor: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 animate-pulse',
      description: 'Early warning threshold triggers',
    },
    {
      label: 'Historical Analytics',
      href: '/analytics',
      icon: BarChart3,
      badge: 'PRD §8',
      badgeColor: 'bg-[#14213d]/15 text-[#14213d] dark:text-[#fca311] border-[#14213d]/30 dark:border-[#fca311]/30',
      description: 'Time-series query interface',
    },
    {
      label: 'System Architecture',
      href: '/architecture',
      icon: Network,
      badge: null,
      description: 'Mesh to dashboard topology',
    },
  ];

  return (
    <aside
      className={cn(
        'relative bg-white dark:bg-[#000000] border-r border-[#e5e5e5] dark:border-[#14213d]/80 transition-all duration-300 flex flex-col z-30 shrink-0 select-none',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Navigation list */}
      <div className="flex-1 py-4 px-2.5 space-y-1.5 overflow-y-auto">
        <div
          className={cn(
            'px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#5c677d] dark:text-[#94a3b8]',
            collapsed && 'hidden'
          )}
        >
          Operations Navigation
        </div>

        {navItems.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 relative',
                isActive
                  ? 'bg-[#14213d]/10 dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border border-[#14213d]/30 dark:border-[#fca311]/50 shadow-sm dark:shadow-[#fca311]/5'
                  : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white hover:bg-[#f4f5f7] dark:hover:bg-[#14213d]/40 border border-transparent'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                  isActive
                    ? 'text-[#14213d] dark:text-[#fca311]'
                    : 'text-[#5c677d] dark:text-[#94a3b8] group-hover:text-[#14213d] dark:group-hover:text-white'
                )}
              />

              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold border shrink-0 ml-2',
                        item.badgeColor
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}

              {/* Active gold pill indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-md bg-[#fca311] shadow-[0_0_8px_rgba(252,163,17,0.7)]" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Pipeline Quick Info */}
      {!collapsed && (
        <div className="p-3 mx-2.5 mb-3 rounded-xl bg-[#f4f5f7] dark:bg-[#14213d]/50 border border-[#e5e5e5] dark:border-[#14213d] text-[11px] space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-[#14213d] dark:text-white font-bold">
            <Server className="w-3.5 h-3.5 text-[#fca311]" />
            <span>Ingestion Pipeline</span>
          </div>
          <p className="text-[#5c677d] dark:text-[#94a3b8] text-[10px] leading-relaxed">
            MQTT QoS 1 • Mosquitto • NestJS EventBus • Socket.IO Gateway
          </p>
          <div className="pt-1.5 border-t border-[#e5e5e5] dark:border-[#14213d]/60 space-y-1.5 text-[10px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[#5c677d] dark:text-[#94a3b8]">Protocol</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                WebSocket / Protobuf
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5c677d] dark:text-[#94a3b8]">Wire Packet</span>
              <span className="text-[#14213d] dark:text-white font-semibold">
                {metrics.lastPacketBytes ? `${metrics.lastPacketBytes} Bytes` : '24 Bytes'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5c677d] dark:text-[#94a3b8]">Bandwidth Saved</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                ~{metrics.estimatedBandwidthSavedPercent || 80}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Collapse button */}
      <div className="p-2 border-t border-[#e5e5e5] dark:border-[#14213d]/80 flex items-center justify-between">
        {!collapsed && (
          <span className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] px-2 font-mono flex items-center gap-1">
            <Terminal className="w-3 h-3 text-[#fca311]" /> v0.1.0-SIH
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d]/60 dark:hover:bg-[#14213d] text-[#5c677d] hover:text-[#000000] dark:text-[#94a3b8] dark:hover:text-white transition-colors ml-auto cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
