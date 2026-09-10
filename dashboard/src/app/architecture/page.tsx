import React from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import {
  Network,
  Radio,
  Server,
  Database,
  Activity,
  Layers,
  ShieldCheck,
  Cpu,
  ArrowDown,
} from 'lucide-react';

export default function ArchitecturePage() {
  const layers = [
    {
      id: '01',
      title: 'Sensor Mesh & Gateway ESP32',
      badge: 'Hardware / Simulation Layer',
      badgeVariant: 'info' as const,
      icon: Radio,
      summary: 'Mesh sensor nodes measure ground subsidence and report to gateway',
      details: [
        'Sensors: Tilt, Vibration (PPV), Displacement, Crack (rupture), Gas, Water piezometer',
        'Independent MQTT clients with jittered intervals and per-node sequence counters',
        'Last Will and Testament (LWT) sets status=offline on unexpected disconnect',
        'QoS 1 at-least-once delivery guaranteed on all topics',
      ],
      topics: ['mine/{zoneId}/{nodeId}/{sensorType}', 'mine/{zoneId}/{nodeId}/status'],
    },
    {
      id: '02',
      title: 'Mosquitto MQTT Broker',
      badge: 'Transport Layer',
      badgeVariant: 'default' as const,
      icon: Server,
      summary: 'Decouples sensor producers from ingestion consumers',
      details: [
        'Eclipse Mosquitto 2.0 container running on port 1883',
        'Broker handles LWT broadcast automatically upon TCP connection timeout',
        'Backend subscribes broadly to wildcard mine/+/+/# to route dynamically',
      ],
      topics: ['Port 1883', 'sih-network bridge'],
    },
    {
      id: '03',
      title: 'NestJS IngestionModule (Thin & Fast)',
      badge: 'Latency-Critical Ingestion',
      badgeVariant: 'warning' as const,
      icon: Cpu,
      summary: 'Validates shape and stamps timestamp without blocking event loop',
      details: [
        'Strictly zero CPU-heavy or blocking tasks in MQTT callback (Rules.md §2)',
        'Validates payload structure against canonical interface',
        'Stamps receivedAt ISO 8601 timestamp and emits internal event',
        'Decoupled from storage and broadcast via NestJS EventEmitter2 bus',
      ],
      topics: ['sensor.reading.received', 'node.status.received'],
    },
    {
      id: '04',
      title: 'NestJS ProcessingModule (Correctness Core)',
      badge: 'Deduplication & Gap Detection',
      badgeVariant: 'success' as const,
      icon: ShieldCheck,
      summary: 'Eliminates duplicates and tracks packet loss as a primary safety signal',
      details: [
        'Deduplication by composite key (nodeId, sequenceNumber)',
        'Sequence gap detection: increments canonical gapCount on missing packets',
        'Hardware reset tolerance: forward jumps >10,000 or backward resets handled smoothly',
        'Updates node status state (online / offline / stale)',
      ],
      topics: ['sensor.reading.deduped', 'node.status.changed'],
    },
    {
      id: '05',
      title: 'NestJS Storage & Alerts Modules',
      badge: 'Persistence & AI Seams',
      badgeVariant: 'default' as const,
      icon: Database,
      summary: 'Time-series persistence and future-proof AI/ML hooks',
      details: [
        'StorageModule persists deduped readings behind clean StorageAdapter interface',
        'Provides getHistoricalReadings() and getNodeStatusHistory() for AI/ML (Design doc §8)',
        'AlertsModule stubs alert evaluation for seamless ML subsidence model integration',
      ],
      topics: ['Postgres / TimescaleDB', 'Phase 5 Seams'],
    },
    {
      id: '06',
      title: 'RealtimeModule & Socket.IO Gateway',
      badge: 'Sub-500ms Broadcast',
      badgeVariant: 'info' as const,
      icon: Activity,
      summary: 'Room-scoped WebSocket broadcasting with 250ms batch coalescing',
      details: [
        'Clients join zone-specific rooms (zone:{zoneId}) to prevent browser flooding',
        'Snapshot delivered immediately on initial connect',
        'RxJS bufferTime(250) batches rapid-fire readings before WebSocket push',
        'Sub-500ms sensor-to-dashboard budget validated continuously in DOM',
      ],
      topics: ['room: zone:{zoneId}', 'events: snapshot, readings, nodeStatuses'],
    },
    {
      id: '07',
      title: 'Next.js Operations Dashboard',
      badge: 'Presentation & Command Room',
      badgeVariant: 'success' as const,
      icon: Layers,
      summary: 'Modular Next.js App Router with centralized RealtimeContext',
      details: [
        'Single Socket.IO connection shared across routes via RealtimeContext',
        'Zone container grouping, node cards, and multi-sensor status badges',
        'Live latency budget tracker (<500ms) with pass/fail telemetry metrics',
        'GSAP animations for sleek executive presentation',
      ],
      topics: ['Port 3001', 'Routes: /, /monitoring, /nodes, /alerts, /analytics'],
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e5e5e5] dark:border-[#14213d]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#000000] dark:text-white tracking-wide flex items-center gap-2.5">
            <Network className="w-6 h-6 text-[#fca311]" />
            System Architecture &amp; Data Pipeline Topology
          </h1>
          <p className="text-xs text-[#5c677d] dark:text-[#94a3b8] mt-1 font-medium">
            Complete technical specification and module boundaries from Design&amp;Architecture.md
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-[#f4f5f7] dark:bg-[#14213d]/70 border border-[#e5e5e5] dark:border-[#14213d] text-xs font-mono text-[#14213d] dark:text-[#e5e5e5] shadow-sm">
          Specification: <span className="text-[#14213d] dark:text-[#fca311] font-bold">Design&amp;Architecture.md</span>
        </div>
      </div>

      {/* Pipeline Flowchart Cards */}
      <div className="space-y-4">
        {layers.map((layer, index) => {
          const Icon = layer.icon;
          return (
            <div key={layer.id} className="relative">
              <Card className="p-6 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d] hover:border-[#fca311]/50 transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e5e5e5] dark:border-[#14213d]">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black font-mono text-[#14213d] dark:text-[#fca311]">
                      {layer.id}
                    </span>
                    <div className="p-2.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000] border border-[#e5e5e5] dark:border-[#14213d] text-[#14213d] dark:text-[#fca311]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#000000] dark:text-white tracking-wide">
                        {layer.title}
                      </h3>
                      <p className="text-xs text-[#5c677d] dark:text-[#94a3b8]">{layer.summary}</p>
                    </div>
                  </div>

                  <Badge variant={layer.badgeVariant} className="text-xs self-start md:self-auto font-mono">
                    {layer.badge}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#5c677d] dark:text-[#94a3b8]">
                      Key Architectural Invariants:
                    </span>
                    <ul className="space-y-1.5 text-xs text-[#14213d] dark:text-[#e5e5e5]">
                      {layer.details.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-[#fca311] font-bold">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#f4f5f7] dark:bg-[#000000]/70 border border-[#e5e5e5] dark:border-[#14213d] space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#5c677d] dark:text-[#94a3b8]">
                      Contracts / Topics:
                    </span>
                    <div className="space-y-1 font-mono text-[11px]">
                      {layer.topics.map((t, i) => (
                        <div
                          key={i}
                          className="text-[#14213d] dark:text-[#fca311] truncate bg-white dark:bg-[#14213d] px-2.5 py-1 rounded-md border border-[#e5e5e5] dark:border-[#14213d] font-semibold"
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {index < layers.length - 1 && (
                <div className="flex justify-center my-2 text-[#14213d]/40 dark:text-[#fca311]/50">
                  <ArrowDown className="w-5 h-5 animate-pulse-slow" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tech Stack Summary Table */}
      <Card className="p-6 bg-white/95 dark:bg-[#14213d]/40 border-[#e5e5e5] dark:border-[#14213d]">
        <h3 className="text-sm font-bold text-[#000000] dark:text-white tracking-wide mb-4">
          Tech Stack Summary (Design &amp; Architecture §9)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#14213d] dark:text-[#e5e5e5]">
            <thead className="bg-[#f4f5f7] dark:bg-[#000000] text-[#5c677d] dark:text-[#94a3b8] font-mono text-[10px] uppercase border-b border-[#e5e5e5] dark:border-[#14213d]">
              <tr>
                <th className="px-4 py-3">System Layer</th>
                <th className="px-4 py-3">Technology Choice</th>
                <th className="px-4 py-3">Rationale &amp; Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5] dark:divide-[#14213d]/60 font-mono">
              <tr>
                <td className="px-4 py-3 font-bold text-[#14213d] dark:text-[#fca311]">Sensor Transport</td>
                <td className="px-4 py-3 font-bold text-[#000000] dark:text-white">MQTT (Mosquitto 2.0)</td>
                <td className="px-4 py-3 text-[#5c677d] dark:text-[#94a3b8] font-sans">
                  QoS 1 delivery, LWT offline detection, lightweight embedded standard
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-[#14213d] dark:text-[#fca311]">Backend Framework</td>
                <td className="px-4 py-3 font-bold text-[#000000] dark:text-white">NestJS (TypeScript strict)</td>
                <td className="px-4 py-3 text-[#5c677d] dark:text-[#94a3b8] font-sans">
                  Clean module boundaries (Ingestion, Processing, Storage, Realtime, Alerts)
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-[#14213d] dark:text-[#fca311]">Internal Decoupling</td>
                <td className="px-4 py-3 font-bold text-[#000000] dark:text-white">EventEmitter2</td>
                <td className="px-4 py-3 text-[#5c677d] dark:text-[#94a3b8] font-sans">
                  Keeps ingestion handler thin, non-blocking, and asynchronous
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-[#14213d] dark:text-[#fca311]">Realtime Broadcast</td>
                <td className="px-4 py-3 font-bold text-[#000000] dark:text-white">Socket.IO via NestJS Gateway</td>
                <td className="px-4 py-3 text-[#5c677d] dark:text-[#94a3b8] font-sans">
                  Zone-scoped rooms, 250ms batch coalescing to avoid client flood
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-[#14213d] dark:text-[#fca311]">Dashboard Framework</td>
                <td className="px-4 py-3 font-bold text-[#000000] dark:text-white">Next.js 16 + React 19 + GSAP</td>
                <td className="px-4 py-3 text-[#5c677d] dark:text-[#94a3b8] font-sans">
                  Modular App Router, single RealtimeContext, sub-500ms latency validation
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-[#14213d] dark:text-[#fca311]">Storage Layer</td>
                <td className="px-4 py-3 font-bold text-[#000000] dark:text-white">Postgres / TimescaleDB</td>
                <td className="px-4 py-3 text-[#5c677d] dark:text-[#94a3b8] font-sans">
                  Time-series queries behind clean StorageAdapter interface for AI/ML
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
