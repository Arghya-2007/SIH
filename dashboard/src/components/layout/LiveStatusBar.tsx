"use client";

import React, { useMemo } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { getLatencyRating } from '@/lib/utils';
import { Activity, Radio, AlertTriangle, ShieldCheck, Binary } from 'lucide-react';

export function LiveStatusBar() {
  const { metrics, stats, isConnected, activeZones, readings, nodeStatuses } = useRealtime();
  const latencyRating = getLatencyRating(metrics.avgLatency);

  const displayZones = useMemo(() => {
    return Array.from(
      new Set([...activeZones, ...Object.keys(readings), ...Object.keys(nodeStatuses)])
    )
      .filter(Boolean)
      .sort();
  }, [activeZones, readings, nodeStatuses]);

  return (
    <div className="h-8 bg-white dark:bg-[#000000] border-t border-[#e5e5e5] dark:border-[#14213d]/80 px-4 flex items-center justify-between text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono select-none z-30 transition-colors duration-300">
      {/* Left: Pipeline Throughput */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span className="font-semibold text-[#14213d] dark:text-[#e5e5e5]">
            {isConnected ? 'LIVE BROKER STREAM' : 'BROKER OFFLINE'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1">
          <Activity className="w-3 h-3 text-[#fca311]" />
          <span>Throughput:</span>
          <span className="text-[#14213d] dark:text-white font-bold">
            {metrics.packetsPerSec} msg/s
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <span>Total Ingested:</span>
          <span className="text-[#14213d] dark:text-[#e5e5e5] font-bold">
            {metrics.count.toLocaleString()}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold">
          <Binary className="w-3 h-3 text-blue-500" />
          <span>Wire:</span>
          <span className="text-[#14213d] dark:text-white font-mono font-bold">
            {metrics.lastPacketBytes ? `${metrics.lastPacketBytes} B` : '24 B'}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold">
            (-{metrics.estimatedBandwidthSavedPercent || 80}%)
          </span>
        </div>
      </div>

      {/* Center: Latency Target */}
      <div className="flex items-center gap-2">
        <span className="hidden lg:inline text-[#5c677d] dark:text-[#94a3b8]">
          Target Budget: &lt;500ms
        </span>
        <div className="flex items-center gap-1">
          <span>Avg:</span>
          <span className={`font-bold ${latencyRating.color}`}>
            {metrics.avgLatency}ms
          </span>
          <span className="text-[#5c677d] dark:text-[#94a3b8] hidden sm:inline">
            (Peak: {metrics.maxLatency}ms)
          </span>
        </div>
      </div>

      {/* Right: Health and Rooms */}
      <div className="flex items-center gap-3">
        {stats.totalGaps > 0 ? (
          <div className="flex items-center gap-1 text-[#fca311] font-bold">
            <AlertTriangle className="w-3 h-3" />
            <span>{stats.totalGaps} Packet Gaps</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
            <ShieldCheck className="w-3 h-3" />
            <span>0 Sequence Gaps</span>
          </div>
        )}

        <div className="hidden xl:flex items-center gap-1 text-[#5c677d] dark:text-[#94a3b8]">
          <Radio className="w-3 h-3 text-[#14213d] dark:text-[#fca311]" />
          <span>Rooms:</span>
          <span className="text-[#14213d] dark:text-[#e5e5e5]">
            {displayZones.length > 0
              ? displayZones.map(z => `zone:${z}`).join(', ')
              : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
}
