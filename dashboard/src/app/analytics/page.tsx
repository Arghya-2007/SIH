"use client";

import React, { useState } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { SENSOR_CONFIGS } from '@/lib/constants';
import { BarChart3, Database, Search } from 'lucide-react';

export default function AnalyticsPage() {
  const [selectedSensor, setSelectedSensor] = useState<string>('tilt');
  const [timeRange, setTimeRange] = useState<string>('1h');

  // Sample data points simulation based on active readings
  const sensorMeta = SENSOR_CONFIGS[selectedSensor] || SENSOR_CONFIGS.tilt;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#000000] dark:text-white tracking-wide flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-[#fca311]" />
            Historical Time-Series Analytics &amp; AI Query Interface
          </h1>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1 font-medium">
            Data pipeline query contract implementation per Design &amp; Architecture §8
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#14213d]/70 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono text-[#14213d] dark:text-[#e5e5e5] shadow-sm">
          Storage Interface: <span className="text-[#14213d] dark:text-[#fca311] font-bold">Postgres / TimescaleDB</span>
        </div>
      </div>

      {/* Contract Explanation Card */}
      <Card className="p-5 bg-white/95 dark:bg-[#14213d]/35 border-[#e5e5e5] dark:border-[#14213d] space-y-3">
        <div className="flex items-center gap-2 text-[#14213d] dark:text-[#fca311] font-bold text-xs">
          <Database className="w-4 h-4" />
          <span>Design&amp;Architecture.md §8 — AI/ML Historical Query Contract</span>
        </div>
        <p className="text-xs text-[#14213d] dark:text-[#e5e5e5] leading-relaxed">
          The backend provides a clean storage interface for historical data extraction without exposing internal processing logic:
        </p>
        <div className="bg-[#f4f5f7] dark:bg-[#000000] p-3.5 rounded-xl border border-[#e5e5e5] dark:border-[#14213d] font-mono text-[11px] text-[#14213d] dark:text-[#e5e5e5] overflow-x-auto space-y-1">
          <div className="text-[#14213d] dark:text-[#fca311] font-bold">
            {'// StorageModule.getHistoricalReadings(nodeId, sensorType, timeRange)'}
          </div>
          <div>
            Returns: <span className="text-amber-700 dark:text-[#fca311] font-semibold">&#123; nodeId, zoneId, sensorType, value, unit, timestamp, sequenceNumber, receivedAt &#125;</span>
          </div>
          <div className="text-[#5c677d] dark:text-[#94a3b8] mt-2">
            Canonical truth for packet loss is always <code className="text-emerald-600 dark:text-emerald-400 font-bold">gapCount</code>. Hardware resets are handled seamlessly.
          </div>
        </div>
      </Card>

      {/* Query Parameters Bar */}
      <div className="p-4 rounded-2xl bg-white/95 dark:bg-[#14213d]/40 border border-[#e5e5e5] dark:border-[#14213d] flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Sensor Type */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#5c677d] dark:text-[#94a3b8] font-medium">Sensor:</span>
            <select
              value={selectedSensor}
              onChange={e => setSelectedSensor(e.target.value)}
              className="bg-[#f4f5f7] dark:bg-[#000000] border border-[#e5e5e5] dark:border-[#14213d] text-[#000000] dark:text-white rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-[#fca311] text-xs font-semibold cursor-pointer"
            >
              {Object.keys(SENSOR_CONFIGS).map(type => (
                <option key={type} value={type} className="bg-white dark:bg-[#14213d]">
                  {SENSOR_CONFIGS[type].label} ({type})
                </option>
              ))}
            </select>
          </div>

          {/* Time Range */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#5c677d] dark:text-[#94a3b8] font-medium">Window:</span>
            <div className="flex bg-[#f4f5f7] dark:bg-[#000000] p-1 rounded-xl border border-[#e5e5e5] dark:border-[#14213d]">
              {['15m', '1h', '6h', '24h', '7d'].map(w => (
                <button
                  key={w}
                  onClick={() => setTimeRange(w)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    timeRange === w
                      ? 'bg-[#14213d] text-white dark:bg-[#fca311] dark:text-[#000000] font-bold shadow-sm'
                      : 'text-[#5c677d] dark:text-[#94a3b8] hover:text-[#000000] dark:hover:text-white'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#fca311] hover:bg-[#ffb733] text-[#000000] text-xs font-bold tracking-wide transition-all shadow-md shadow-[#fca311]/25 hover:scale-105 active:scale-95 cursor-pointer">
          <Search className="w-3.5 h-3.5" />
          Execute Time-Series Query
        </button>
      </div>

      {/* Simulated Trend Visualization Container */}
      <Card className="p-6 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-[#e5e5e5] dark:border-[#14213d]">
          <div>
            <h3 className="text-sm font-bold text-[#000000] dark:text-white tracking-wide flex items-center gap-2">
              <span>{sensorMeta.label} Historical Trendline</span>
              <Badge variant="info" className="text-[10px]">
                {sensorMeta.defaultUnit}
              </Badge>
            </h3>
            <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1">{sensorMeta.description}</p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-[#5c677d] dark:text-[#94a3b8]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fca311] inline-block" />
              <span>Normal &lt; {sensorMeta.warningThreshold}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#5c677d] dark:text-[#94a3b8]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span>Critical &gt; {sensorMeta.criticalThreshold}</span>
            </div>
          </div>
        </div>

        {/* Visual Graph Representation */}
        <div className="h-64 w-full bg-[#f4f5f7] dark:bg-[#000000]/70 rounded-2xl border border-[#e5e5e5] dark:border-[#14213d] p-4 flex flex-col justify-between relative overflow-hidden">
          {/* Threshold Lines */}
          <div className="absolute top-1/4 left-0 right-0 border-b border-red-500/30 border-dashed flex justify-end pr-4">
            <span className="text-[10px] text-red-600 dark:text-red-400 font-mono font-bold">
              Critical: {sensorMeta.criticalThreshold} {sensorMeta.defaultUnit}
            </span>
          </div>
          <div className="absolute top-1/2 left-0 right-0 border-b border-[#fca311]/40 border-dashed flex justify-end pr-4">
            <span className="text-[10px] text-amber-700 dark:text-[#fca311] font-mono font-bold">
              Warning: {sensorMeta.warningThreshold} {sensorMeta.defaultUnit}
            </span>
          </div>

          {/* Synthetic waveform graph */}
          <div className="h-full flex items-end gap-2 pt-8 pb-4">
            {[42, 45, 48, 52, 50, 48, 53, 56, 60, 58, 62, 65, 70, 68, 64, 60, 58, 55, 52, 54].map(
              (val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className="w-full bg-gradient-to-t from-[#14213d]/60 to-[#fca311] rounded-t transition-all duration-200 hover:brightness-125 cursor-pointer shadow-sm"
                    style={{ height: `${val}%` }}
                    title={`Timestamp t-${20 - i}m: Value ~${(
                      (val / 100) *
                      sensorMeta.criticalThreshold
                    ).toFixed(2)}`}
                  />
                </div>
              )
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono pt-2 border-t border-[#e5e5e5] dark:border-[#14213d]/80">
            <span>-{timeRange}</span>
            <span>-{timeRange.replace(/[a-z]/, '') === '1' ? '30m' : 'midpoint'}</span>
            <span>Current (Live)</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
