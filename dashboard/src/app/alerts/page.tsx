"use client";

import React from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { AlertRuleCard } from '@/components/alerts/AlertRuleCard';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { DEFAULT_ALERT_RULES } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import {
  ShieldAlert,
  AlertTriangle,
  BellRing,
  Trash2,
  Info,
} from 'lucide-react';

export function AlertHistoryList() {
  const { alerts } = useRealtime();

  if (alerts.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-[#5c677d] dark:text-[#94a3b8] italic">
        No active subsidence threshold breaches or safety alerts recorded. System operating in normal range.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#e5e5e5] dark:divide-[#14213d]/80">
      {alerts.map(alert => {
        const isCritical = alert.severity === 'critical';
        return (
          <div
            key={alert.id}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#f4f5f7]/80 dark:hover:bg-[#14213d]/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl border mt-0.5 ${
                  isCritical
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                    : 'bg-[#fca311]/15 text-amber-800 dark:text-[#fca311] border-[#fca311]/40'
                }`}
              >
                {isCritical ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-[#000000] dark:text-white tracking-wide">
                    {alert.message}
                  </h4>
                  <Badge
                    variant={isCritical ? 'danger' : 'warning'}
                    pulse={isCritical}
                    className="text-[10px] uppercase font-mono font-bold"
                  >
                    {alert.severity}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
                  <span>Node: <strong className="text-[#000000] dark:text-white">{alert.nodeId}</strong></span>
                  <span>Zone: <strong className="text-[#14213d] dark:text-[#fca311]">{alert.zoneId}</strong></span>
                  <span>Value: <strong className="text-[#14213d] dark:text-[#fca311]">{alert.value} {alert.unit}</strong></span>
                  <span>Threshold: {alert.threshold} {alert.unit}</span>
                </div>
              </div>
            </div>

            <span className="text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono self-start sm:self-auto">
              {formatRelativeTime(alert.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AlertsPage() {
  const { alerts, clearAlerts } = useRealtime();
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#000000] dark:text-white tracking-wide flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            Subsidence Early Warning &amp; Safety Alerts
          </h1>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1 font-medium">
            Threshold monitoring, automated trigger logic, and AI/ML early warning hooks (PRD §5 / Phase 5)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <button
              onClick={clearAlerts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f5f7] hover:bg-[#e5e5e5] dark:bg-[#14213d] dark:hover:bg-[#14213d]/80 text-xs text-[#14213d] dark:text-[#e5e5e5] border border-[#e5e5e5] dark:border-[#14213d] transition-all hover:scale-105"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Log
            </button>
          )}

          <div className="px-3.5 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#14213d]/70 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono text-[#14213d] dark:text-[#e5e5e5] shadow-sm">
            Active: <span className="text-red-600 dark:text-red-400 font-bold">{criticalCount} Crit</span> /{' '}
            <span className="text-amber-600 dark:text-[#fca311] font-bold">{warningCount} Warn</span>
          </div>
        </div>
      </div>

      {/* Seam Notice Card */}
      <Card className="p-4 bg-white/95 dark:bg-[#14213d]/35 border-[#e5e5e5] dark:border-[#14213d] text-xs text-[#14213d] dark:text-[#e5e5e5] space-y-2">
        <div className="flex items-center gap-2 text-[#14213d] dark:text-[#fca311] font-bold">
          <Info className="w-4 h-4" />
          <span>Phase 5 Architecture Seam — NestJS AlertsModule</span>
        </div>
        <p className="text-[#5c677d] dark:text-[#94a3b8] text-[11px] leading-relaxed">
          Per Design &amp; Architecture §2.3 and Phases.md Phase 5, the backend houses an <code className="text-[#14213d] dark:text-[#fca311] font-bold">AlertsModule</code> that
          subscribes to internal event bus notifications (<code className="text-[#14213d] dark:text-[#fca311]">sensor.reading.deduped</code> and <code className="text-[#14213d] dark:text-[#fca311]">node.status.changed</code>).
          This leaves clean decoupled seams for AI/ML anomaly detection and SMS/siren triggers without restructuring the ingestion pipeline.
        </p>
      </Card>

      {/* Safety Threshold Rules Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#000000] dark:text-white tracking-wide flex items-center gap-2">
          <BellRing className="w-4 h-4 text-[#fca311]" />
          Predefined Subsidence Safety Thresholds
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEFAULT_ALERT_RULES.map(rule => (
            <AlertRuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      </div>

      {/* Live Incident Stream */}
      <Card className="p-0 overflow-hidden bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d]">
        <div className="p-4 border-b border-[#e5e5e5] dark:border-[#14213d] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#000000] dark:text-white tracking-wide">
            Live Threshold Breach &amp; Incident Log
          </h3>
          <span className="text-xs font-mono text-[#5c677d] dark:text-[#94a3b8]">
            {alerts.length} events detected in session
          </span>
        </div>
        <AlertHistoryList />
      </Card>
    </div>
  );
}
