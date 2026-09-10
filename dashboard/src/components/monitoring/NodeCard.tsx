import React from 'react';
import { NodeStatusState } from '@/types/node';
import { ValidatedSensorReading } from '@/types/sensor';
import { SensorGauge } from './SensorGauge';
import { Badge } from '../common/Badge';
import { Card } from '../common/Card';
import { formatRelativeTime } from '@/lib/utils';
import { Cpu, AlertTriangle, WifiOff, Clock } from 'lucide-react';

interface NodeCardProps {
  nodeId: string;
  zoneId: string;
  status?: NodeStatusState;
  sensors: Record<string, ValidatedSensorReading>;
}

export const NodeCard = React.memo(function NodeCard({
  nodeId,
  zoneId,
  status,
  sensors,
}: NodeCardProps) {
  const isOnline = status?.status === 'online';
  const isStale = status?.status === 'stale';
  const hasGaps = (status?.gapCount || 0) > 0;

  const statusVariant = isOnline ? 'success' : isStale ? 'warning' : 'danger';
  const statusLabel = isOnline ? 'Online' : isStale ? 'Stale' : 'Offline / LWT';

  return (
    <Card
      accent={isOnline ? 'none' : 'red'}
      className={`relative transition-all duration-300 h-full flex flex-col justify-between select-none ${isOnline
          ? 'bg-white/95 dark:bg-[#14213d]/45'
          : 'bg-red-500/5 dark:bg-red-950/20 border-red-500/30 dark:border-red-900/50'
        }`}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#e5e5e5] dark:border-[#14213d]/80">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl border ${isOnline
                ? 'bg-[#14213d]/10 dark:bg-[#14213d] text-[#14213d] dark:text-[#fca311] border-[#14213d]/25 dark:border-[#fca311]/40 shadow-sm'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
              }`}
          >
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-mono font-bold text-sm text-[#000000] dark:text-white tracking-wide">
                {nodeId}
              </h4>
              {!isOnline && (
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-950 px-1.5 py-0.5 rounded border border-red-500/30 dark:border-red-800/60 flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5" /> No Signal
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#5c677d] dark:text-[#94a3b8] font-mono">Zone: {zoneId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasGaps && (
            <Badge variant="warning" className="text-[10px]">
              <AlertTriangle className="w-3 h-3" />
              {status?.gapCount} Gaps
            </Badge>
          )}

          <Badge variant={statusVariant} pulse={isOnline} className="text-[10px] uppercase font-mono font-bold">
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* Sensor Grid */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 transition-opacity ${
          isOnline ? 'opacity-100' : 'opacity-60'
        }`}
      >
        {isOnline &&
          Object.entries(sensors).map(([sensorType, reading]) => (
            <SensorGauge key={sensorType} reading={reading} />
          ))}

        {!isOnline ? (
          <div className="col-span-full py-8 px-4 text-center rounded-xl border border-dashed border-red-500/20 dark:border-red-900/40 bg-red-500/5 dark:bg-red-950/10 flex flex-col items-center justify-center gap-1.5">
            <WifiOff className="w-5 h-5 text-red-500/70 dark:text-red-400/70" />
            <p className="text-xs font-semibold text-red-700 dark:text-red-300">
              Sensor Telemetry Cleared (Node Offline)
            </p>
            <p className="text-[10px] text-[#5c677d] dark:text-[#94a3b8]">
              All cached sensor data cleared when node went offline.
            </p>
          </div>
        ) : Object.keys(sensors).length === 0 ? (
          <div className="col-span-full py-6 text-center text-xs text-[#5c677d] dark:text-[#94a3b8] italic">
            Waiting for first sensor reading from {nodeId}...
          </div>
        ) : null}
      </div>

      {/* Node Footer: Health, Sequence, Last Seen */}
      <div className="mt-3.5 pt-2.5 border-t border-[#e5e5e5] dark:border-[#14213d]/80 flex items-center justify-between text-[11px] text-[#5c677d] dark:text-[#94a3b8] font-mono">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#fca311]" />
          <span>Last seen:</span>
          <span className="text-[#14213d] dark:text-[#e5e5e5] font-semibold">
            {status?.lastSeenAt ? formatRelativeTime(status.lastSeenAt) : 'N/A'}
          </span>
        </div>

        {status?.lastSequenceNumber !== undefined && (
          <div>
            <span>Last Seq: </span>
            <span className="text-[#14213d] dark:text-[#fca311] font-bold">
              #{status.lastSequenceNumber}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
});
