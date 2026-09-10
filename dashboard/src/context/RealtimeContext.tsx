"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { Socket } from 'socket.io-client';
import { getSocketClient } from '@/lib/socket';
import { ValidatedSensorReading } from '@/types/sensor';
import { NodeStatusState } from '@/types/node';
import { SystemLatencyMetrics, SnapshotPayload } from '@/types/socket';
import { SubsidenceAlert } from '@/types/alert';
import { getSensorSeverity } from '@/lib/utils';
import { SENSOR_CONFIGS } from '@/lib/constants';
import {
  decodeSensorReadingBatch,
  decodeNodeStatusBatch,
  decodeZoneSnapshot,
} from '@/lib/proto/telemetry';

export interface GatewayStatus {
  brokerConnected: boolean;
  loraGatewayConnected: boolean;
  status: 'online' | 'offline' | 'standby';
  lastLoraPacketAt: string | null;
  totalLoraPackets: number;
  gatewayType: string;
  topic: string;
  nodeId?: string;
}

interface RealtimeContextValue {
  socket: Socket | null;
  isConnected: boolean;
  gatewayStatus: GatewayStatus;
  activeZones: string[];
  readings: Record<string, Record<string, Record<string, ValidatedSensorReading>>>;
  nodeStatuses: Record<string, Record<string, NodeStatusState>>;
  metrics: SystemLatencyMetrics;
  alerts: SubsidenceAlert[];
  stats: {
    totalZones: number;
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalGaps: number;
    activeSensorsCount: number;
  };
  reconnect: () => void;
  joinZone: (zoneId: string) => void;
  clearAlerts: () => void;
  clearCache: (options?: { purgeOfflineOnly?: boolean }) => void;
  isSimulationActive: boolean;
  toggleSimulation: () => void;
  autoPurgeStale: boolean;
  setAutoPurgeStale: (enabled: boolean) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// Stable zone merge helper that prevents re-renders when list of zones is unchanged
function mergeUniqueZones(existing: string[], incoming: string[]): string[] {
  const merged = Array.from(new Set([...existing, ...incoming])).filter(Boolean).sort();
  if (existing.length === merged.length && existing.every((z, i) => z === merged[i])) {
    return existing;
  }
  return merged;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialization avoids setState inside useEffect
  const [socket] = useState<Socket | null>(() =>
    typeof window !== 'undefined' ? getSocketClient() : null
  );

  const [isConnected, setIsConnected] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({
    brokerConnected: false,
    loraGatewayConnected: false,
    status: 'standby',
    lastLoraPacketAt: null,
    totalLoraPackets: 0,
    gatewayType: 'ESP32 LoRa Gateway (SX1276)',
    topic: 'sensors/lora/#',
    nodeId: 'NODE_01',
  });
  const [activeZones, setActiveZones] = useState<string[]>([]);
  const [readings, setReadings] = useState<
    Record<string, Record<string, Record<string, ValidatedSensorReading>>>
  >({});
  const [nodeStatuses, setNodeStatuses] = useState<
    Record<string, Record<string, NodeStatusState>>
  >({});
  const [alerts, setAlerts] = useState<SubsidenceAlert[]>([]);
  const [metrics, setMetrics] = useState<SystemLatencyMetrics>({
    avgLatency: 0,
    maxLatency: 0,
    count: 0,
    totalLatency: 0,
    packetsPerSec: 0,
    protoBytesReceived: 0,
    lastPacketBytes: 0,
    lastJsonBytesEquivalent: 0,
    estimatedBandwidthSavedPercent: 0,
    transportFormat: 'Protobuf (Binary)',
  });

  // State for simulated interactive mesh mode & auto purge
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [autoPurgeStale, setAutoPurgeStale] = useState(true);

  const joinedZonesRef = useRef<Set<string>>(new Set());
  const packetCountInWindowRef = useRef(0);
  const lastProtoReceivedAtRef = useRef<number>(0);

  // Measure packets per second periodically
  useEffect(() => {
    const ppsInterval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        packetsPerSec: packetCountInWindowRef.current,
      }));
      packetCountInWindowRef.current = 0;
    }, 1000);

    return () => clearInterval(ppsInterval);
  }, []);

  // Client-side Gateway Watchdog to detect hardware disconnection promptly (<5s without LoRa packet)
  useEffect(() => {
    const gwWatchdog = setInterval(() => {
      setGatewayStatus(prev => {
        if (!prev.lastLoraPacketAt) return prev;
        const elapsed = Date.now() - new Date(prev.lastLoraPacketAt).getTime();
        if (elapsed > 5000 && (prev.loraGatewayConnected || prev.status === 'online')) {
          return {
            ...prev,
            loraGatewayConnected: false,
            status: 'offline',
          };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(gwWatchdog);
  }, []);

  // Built-in Live Simulation Generator (For First-time user / Zero-hardware preview)
  useEffect(() => {
    if (!isSimulationActive) return;

    const simZones = [
      'ZONE_ALPHA',
      'ZONE_BETA',
      'ZONE_GAMMA',
      'ZONE_DELTA',
      'ZONE_EPSILON',
    ];
    setActiveZones(prev => mergeUniqueZones(prev, simZones));

    // 5 groups (zones) with 20 nodes each (100 nodes total)
    const simNodes = simZones.flatMap((zoneId, zIdx) =>
      Array.from({ length: 20 }, (_, n) => ({
        zoneId,
        nodeId: `NODE_${String(zIdx * 20 + n + 1).padStart(2, '0')}`,
      }))
    );

    let batchRound = 1;

    const generateSimBatch = () => {
      const now = new Date().toISOString();
      const nowMs = Date.now();

      const newSimReadings: ValidatedSensorReading[] = [];

      simNodes.forEach(({ zoneId, nodeId }, nIdx) => {
        const baseTilt = 0.85 + Math.sin(nowMs / 8000 + nIdx * 0.7) * 0.55;
        const baseVibe = 1.35 + Math.cos(nowMs / 6000 + nIdx * 0.5) * 0.85;
        const baseDisp = 2.4 + Math.sin(nowMs / 10000 + nIdx * 0.6) * 0.9;
        const baseGas = 14 + Math.round(Math.sin(nowMs / 12000 + nIdx * 0.8) * 8);
        const baseWater = 1.4 + Math.cos(nowMs / 15000 + nIdx * 0.4) * 0.35;

        newSimReadings.push(
          {
            nodeId,
            zoneId,
            sensorType: 'tilt',
            value: Math.max(0.1, Number(baseTilt.toFixed(2))),
            unit: 'degrees',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'vibration',
            value: Math.max(0.1, Number(baseVibe.toFixed(2))),
            unit: 'mm/s',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'displacement',
            value: Math.max(0.1, Number(baseDisp.toFixed(2))),
            unit: 'mm',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'crack',
            value: 0,
            unit: '',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'gas',
            value: Math.max(5, baseGas),
            unit: 'ppm',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'water',
            value: Math.max(0.2, Number(baseWater.toFixed(2))),
            unit: 'm',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          }
        );
      });

      // Update Node Statuses (simulating a sequence gap on NODE_04 for testing)
      setNodeStatuses(prev => {
        const next = { ...prev };
        simNodes.forEach(({ zoneId, nodeId }, nIdx) => {
          if (!next[zoneId]) next[zoneId] = {};
          next[zoneId][nodeId] = {
            nodeId,
            zoneId,
            status: 'online',
            lastSeenAt: now,
            lastSequenceNumber: batchRound * 10 + nIdx,
            gapCount: nIdx === 3 ? 1 : 0,
          };
        });
        return next;
      });

      // Update Readings
      setReadings(prev => {
        const next = { ...prev };
        newSimReadings.forEach(r => {
          if (!next[r.zoneId]) next[r.zoneId] = {};
          if (!next[r.zoneId][r.nodeId]) next[r.zoneId][r.nodeId] = {};
          next[r.zoneId][r.nodeId][r.sensorType] = r;
        });
        return next;
      });

      // Update Metrics for 10s buffered batch
      const simProtoBytes = newSimReadings.length * 24;
      const simJsonBytes = newSimReadings.length * 155;
      packetCountInWindowRef.current += newSimReadings.length;
      setMetrics(prev => {
        const simLatency = 82 + Math.floor(Math.random() * 40);
        return {
          ...prev,
          avgLatency: simLatency,
          maxLatency: Math.max(prev.maxLatency, 175),
          count: prev.count + newSimReadings.length,
          totalLatency: prev.totalLatency + simLatency * newSimReadings.length,
          lastReadingAt: now,
          lastPacketBytes: simProtoBytes,
          lastJsonBytesEquivalent: simJsonBytes,
          protoBytesReceived: (prev.protoBytesReceived || 0) + simProtoBytes,
          estimatedBandwidthSavedPercent: 84,
          transportFormat: 'Protobuf (Binary)',
        };
      });

      batchRound++;
    };

    // Execute immediately on launch so cards appear without waiting 10s
    generateSimBatch();

    // 10s buffer / gap delay interval between subsequent telemetry bursts
    const simInterval = setInterval(generateSimBatch, 10000);

    return () => clearInterval(simInterval);
  }, [isSimulationActive]);

  // Periodic Auto-Purge of Old Stale / Ghost Nodes (Every 30s)
  useEffect(() => {
    if (!autoPurgeStale) return;

    const purgeInterval = setInterval(() => {
      const staleThresholdMs = 5 * 60 * 1000; // 5 minutes threshold
      const now = Date.now();

      setNodeStatuses(prev => {
        let changed = false;
        const next: Record<string, Record<string, NodeStatusState>> = {};

        Object.entries(prev).forEach(([zoneId, nodes]) => {
          const validNodes: Record<string, NodeStatusState> = {};
          Object.entries(nodes).forEach(([nodeId, st]) => {
            const lastSeen = st.lastSeenAt ? new Date(st.lastSeenAt).getTime() : 0;
            const isStaleExpired = st.status !== 'online' && now - lastSeen > staleThresholdMs;

            if (isStaleExpired) {
              changed = true;
            } else {
              validNodes[nodeId] = st;
            }
          });
          if (Object.keys(validNodes).length > 0) {
            next[zoneId] = validNodes;
          }
        });

        return changed ? next : prev;
      });
    }, 30000);

    return () => clearInterval(purgeInterval);
  }, [autoPurgeStale]);

  // WebSocket Event Handlers
  useEffect(() => {
    if (!socket) return;

    function handleConnect() {
      setIsConnected(true);
      socket?.emit('get_zones');
      socket?.emit('get_gateway_status');
    }

    function handleDisconnect() {
      setIsConnected(false);
      joinedZonesRef.current.clear();
    }

    function handleActiveZones(zones: string[]) {
      if (!Array.isArray(zones)) return;
      setActiveZones(prev => mergeUniqueZones(prev, zones));

      zones.forEach(zone => {
        if (zone && !joinedZonesRef.current.has(zone)) {
          socket?.emit('join_zone', { zoneId: zone });
          joinedZonesRef.current.add(zone);
        }
      });
    }

    function handleSnapshot(data: SnapshotPayload) {
      if (!data) return;

      const incomingZones: string[] = [];
      data.readings?.forEach(r => { if (r.zoneId) incomingZones.push(r.zoneId); });
      data.statuses?.forEach(st => { if (st.zoneId) incomingZones.push(st.zoneId); });

      if (incomingZones.length > 0) {
        setActiveZones(prev => mergeUniqueZones(prev, incomingZones));
        incomingZones.forEach(zone => {
          if (zone && !joinedZonesRef.current.has(zone)) {
            socket?.emit('join_zone', { zoneId: zone });
            joinedZonesRef.current.add(zone);
          }
        });
      }

      // Identify which nodes in the snapshot are offline
      const offlineKeys = new Set(
        data.statuses
          ?.filter(st => st.status === 'offline')
          .map(st => `${st.zoneId}:${st.nodeId}`) || []
      );

      setReadings(prev => {
        const next = { ...prev };

        // 1. Purge any existing sensor data for nodes that are offline
        offlineKeys.forEach(key => {
          const [zId, nId] = key.split(':');
          if (next[zId] && next[zId][nId]) {
            const zMap = { ...next[zId] };
            delete zMap[nId];
            next[zId] = zMap;
          }
        });

        // 2. Only populate sensor readings for online nodes
        data.readings?.forEach(r => {
          if (offlineKeys.has(`${r.zoneId}:${r.nodeId}`)) return;
          if (!next[r.zoneId]) next[r.zoneId] = {};
          if (!next[r.zoneId][r.nodeId]) next[r.zoneId][r.nodeId] = {};
          next[r.zoneId][r.nodeId] = {
            ...next[r.zoneId][r.nodeId],
            [r.sensorType]: r,
          };
        });
        return next;
      });

      setNodeStatuses(prev => {
        const next = { ...prev };
        data.statuses?.forEach(st => {
          if (!next[st.zoneId]) next[st.zoneId] = {};
          next[st.zoneId][st.nodeId] = st;
        });
        return next;
      });
    }

    function processSensorReadings(updates: ValidatedSensorReading[]) {
      if (!Array.isArray(updates) || updates.length === 0) return;

      const now = Date.now();
      packetCountInWindowRef.current += updates.length;

      const incomingZones = updates.map(r => r.zoneId).filter(Boolean);
      if (incomingZones.length > 0) {
        setActiveZones(prev => mergeUniqueZones(prev, incomingZones));
        incomingZones.forEach(zone => {
          if (zone && !joinedZonesRef.current.has(zone)) {
            socket?.emit('join_zone', { zoneId: zone });
            joinedZonesRef.current.add(zone);
          }
        });
      }

      const newAlerts: SubsidenceAlert[] = [];

      // Update gateway heartbeat when readings arrive
      setGatewayStatus(gw => ({
        ...gw,
        brokerConnected: true,
        loraGatewayConnected: true,
        status: 'online',
        lastLoraPacketAt: new Date().toISOString(),
        totalLoraPackets: gw.totalLoraPackets + updates.length,
      }));

      setReadings(prev => {
        const next = { ...prev };

        updates.forEach(r => {
          if (!next[r.zoneId]) next[r.zoneId] = {};
          if (!next[r.zoneId][r.nodeId])
            next[r.zoneId][r.nodeId] = { ...prev[r.zoneId]?.[r.nodeId] };

          next[r.zoneId][r.nodeId] = {
            ...next[r.zoneId][r.nodeId],
            [r.sensorType]: r,
          };

          // Check threshold alert triggers
          const severity = getSensorSeverity(r.sensorType, r.value);
          if (severity === 'critical' || severity === 'warning') {
            const meta = SENSOR_CONFIGS[r.sensorType];
            newAlerts.push({
              id: `${r.nodeId}-${r.sensorType}-${r.sequenceNumber}-${now}`,
              nodeId: r.nodeId,
              zoneId: r.zoneId,
              sensorType: r.sensorType,
              value: r.value,
              threshold:
                severity === 'critical'
                  ? (meta?.criticalThreshold ?? 0)
                  : (meta?.warningThreshold ?? 0),
              unit: r.unit,
              severity,
              timestamp: r.timestamp || new Date().toISOString(),
              message:
                severity === 'critical'
                  ? `CRITICAL: ${meta?.label || r.sensorType} reached ${r.value} ${r.unit}`
                  : `WARNING: ${meta?.label || r.sensorType} elevated at ${r.value} ${r.unit}`,
            });
          }
        });

        return next;
      });

      setMetrics(prev => {
        let maxL = prev.maxLatency;
        let sumL = prev.totalLatency;
        let count = prev.count;

        updates.forEach(r => {
          const timestamp = new Date(r.timestamp).getTime();
          const latency = isNaN(timestamp) ? 0 : Math.max(0, now - timestamp);

          if (latency > maxL) maxL = latency;
          sumL += latency;
          count++;
        });

        return {
          ...prev,
          maxLatency: maxL,
          totalLatency: sumL,
          count,
          avgLatency: count > 0 ? Math.round(sumL / count) : 0,
          lastReadingAt: new Date().toISOString(),
        };
      });

      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
      }
    }

    function processNodeStatuses(updates: NodeStatusState[]) {
      if (!Array.isArray(updates)) return;

      const incomingZones = updates.map(st => st.zoneId).filter(Boolean);
      if (incomingZones.length > 0) {
        setActiveZones(prev => mergeUniqueZones(prev, incomingZones));
        incomingZones.forEach(zone => {
          if (zone && !joinedZonesRef.current.has(zone)) {
            socket?.emit('join_zone', { zoneId: zone });
            joinedZonesRef.current.add(zone);
          }
        });
      }

      setNodeStatuses(prev => {
        const next = { ...prev };
        updates.forEach(st => {
          if (!next[st.zoneId]) next[st.zoneId] = {};
          next[st.zoneId][st.nodeId] = st;
        });
        return next;
      });

      // Clear all old sensor data when a node gets offline
      const offlineUpdates = updates.filter(st => st.status === 'offline');
      if (offlineUpdates.length > 0) {
        setReadings(prev => {
          let changed = false;
          const next = { ...prev };
          offlineUpdates.forEach(st => {
            if (next[st.zoneId] && next[st.zoneId][st.nodeId]) {
              const zoneMap = { ...next[st.zoneId] };
              delete zoneMap[st.nodeId];
              next[st.zoneId] = zoneMap;
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    }

    // High-performance Binary Protobuf Handlers
    function handleProtoSnapshot(binaryData: unknown) {
      try {
        const decoded = decodeZoneSnapshot(binaryData);
        const approxJson = decoded.readings.length * 155 + decoded.statuses.length * 90;
        handleSnapshot({
          readings: decoded.readings,
          statuses: decoded.statuses,
        });
        setMetrics(prev => ({
          ...prev,
          transportFormat: 'Protobuf (Binary)',
          lastPacketBytes: decoded.rawByteSize,
          lastJsonBytesEquivalent: approxJson,
          protoBytesReceived: (prev.protoBytesReceived || 0) + decoded.rawByteSize,
        }));
      } catch (err) {
        console.error('[Protobuf] Failed to decode snapshot:proto', err);
      }
    }

    function handleProtoReadings(binaryData: unknown) {
      try {
        lastProtoReceivedAtRef.current = Date.now();
        const decoded = decodeSensorReadingBatch(binaryData);
        const approxJsonSize = Math.max(decoded.rawByteSize, decoded.readings.length * 155);
        const savedPct = Math.min(95, Math.max(30, Math.round((1 - decoded.rawByteSize / approxJsonSize) * 100)));

        processSensorReadings(decoded.readings);

        setMetrics(prev => ({
          ...prev,
          transportFormat: 'Protobuf (Binary)',
          lastPacketBytes: decoded.rawByteSize,
          lastJsonBytesEquivalent: approxJsonSize,
          protoBytesReceived: (prev.protoBytesReceived || 0) + decoded.rawByteSize,
          estimatedBandwidthSavedPercent: savedPct,
        }));
      } catch (err) {
        console.error('[Protobuf] Failed to decode readings:proto', err);
      }
    }

    function handleProtoNodeStatuses(binaryData: unknown) {
      try {
        const decoded = decodeNodeStatusBatch(binaryData);
        const approxJson = decoded.statuses.length * 90;
        processNodeStatuses(decoded.statuses);
        setMetrics(prev => ({
          ...prev,
          transportFormat: 'Protobuf (Binary)',
          lastPacketBytes: decoded.rawByteSize,
          lastJsonBytesEquivalent: approxJson,
          protoBytesReceived: (prev.protoBytesReceived || 0) + decoded.rawByteSize,
        }));
      } catch (err) {
        console.error('[Protobuf] Failed to decode nodeStatuses:proto', err);
      }
    }

    // Legacy JSON Handlers (fallback only when Protobuf is inactive)
    function handleReadings(updates: ValidatedSensorReading[]) {
      // If Protobuf binary stream is active, ignore duplicate legacy JSON broadcasts
      if (Date.now() - lastProtoReceivedAtRef.current < 2500) return;
      processSensorReadings(updates);
      setMetrics(prev => ({
        ...prev,
        transportFormat: 'JSON (Text)',
      }));
    }

    function handleNodeStatuses(updates: NodeStatusState[]) {
      if (Date.now() - lastProtoReceivedAtRef.current < 2500) return;
      processNodeStatuses(updates);
    }

    function handleGatewayStatus(status: Partial<GatewayStatus>) {
      if (!status) return;
      setGatewayStatus(prev => ({
        ...prev,
        ...status,
      }));
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('active_zones', handleActiveZones);
    socket.on('gateway:status', handleGatewayStatus);

    // Primary Protobuf Binary Listeners
    socket.on('snapshot:proto', handleProtoSnapshot);
    socket.on('readings:proto', handleProtoReadings);
    socket.on('nodeStatuses:proto', handleProtoNodeStatuses);

    // Fallback JSON Listeners
    socket.on('snapshot', handleSnapshot);
    socket.on('readings', handleReadings);
    socket.on('nodeStatuses', handleNodeStatuses);

    // Initial check if already connected
    if (socket.connected) {
      handleConnect();
    }

    // Zone polling interval every 2s
    const pollInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('get_zones');
        socket.emit('get_gateway_status');
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('active_zones', handleActiveZones);
      socket.off('gateway:status', handleGatewayStatus);

      socket.off('snapshot:proto', handleProtoSnapshot);
      socket.off('readings:proto', handleProtoReadings);
      socket.off('nodeStatuses:proto', handleProtoNodeStatuses);

      socket.off('snapshot', handleSnapshot);
      socket.off('readings', handleReadings);
      socket.off('nodeStatuses', handleNodeStatuses);
    };
  }, [socket]);

  const stats = useMemo(() => {
    let totalNodes = 0;
    let onlineNodes = 0;
    let offlineNodes = 0;
    let totalGaps = 0;
    let activeSensorsCount = 0;

    const countedNodes = new Set<string>();

    Object.entries(nodeStatuses).forEach(([zoneId, nodes]) => {
      Object.entries(nodes).forEach(([nodeId, status]) => {
        const key = `${zoneId}:${nodeId}`;
        countedNodes.add(key);
        totalNodes++;
        if (status.status === 'online') {
          onlineNodes++;
        } else {
          offlineNodes++;
        }
        totalGaps += status.gapCount || 0;
      });
    });

    Object.entries(readings).forEach(([zoneId, zoneMap]) => {
      Object.entries(zoneMap).forEach(([nodeId, nodeSensors]) => {
        const key = `${zoneId}:${nodeId}`;
        if (!countedNodes.has(key)) {
          countedNodes.add(key);
          totalNodes++;
          onlineNodes++;
        }
        activeSensorsCount += Object.keys(nodeSensors).length;
      });
    });

    const allZones = new Set([
      ...activeZones,
      ...Object.keys(readings),
      ...Object.keys(nodeStatuses),
    ]);

    return {
      totalZones: allZones.size,
      totalNodes,
      onlineNodes,
      offlineNodes,
      totalGaps,
      activeSensorsCount,
    };
  }, [nodeStatuses, readings, activeZones]);

  const reconnect = useCallback(() => {
    if (socket) {
      joinedZonesRef.current.clear();
      socket.disconnect();
      socket.connect();
    }
  }, [socket]);

  const joinZone = useCallback(
    (zoneId: string) => {
      if (socket && zoneId && !joinedZonesRef.current.has(zoneId)) {
        socket.emit('join_zone', { zoneId });
        joinedZonesRef.current.add(zoneId);
      }
    },
    [socket]
  );

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Clear Cache Logic: Purges stale/old dashboard data so user always sees live stream
  const clearCache = useCallback((options?: { purgeOfflineOnly?: boolean }) => {
    if (options?.purgeOfflineOnly) {
      // Purge only offline or stale nodes from cache
      setNodeStatuses(prev => {
        const next: Record<string, Record<string, NodeStatusState>> = {};
        Object.entries(prev).forEach(([zoneId, nodes]) => {
          const liveNodes: Record<string, NodeStatusState> = {};
          Object.entries(nodes).forEach(([nodeId, st]) => {
            if (st.status === 'online') {
              liveNodes[nodeId] = st;
            }
          });
          if (Object.keys(liveNodes).length > 0) {
            next[zoneId] = liveNodes;
          }
        });
        return next;
      });

      setReadings(prev => {
        const next: Record<string, Record<string, Record<string, ValidatedSensorReading>>> = {};
        Object.entries(prev).forEach(([zoneId, nodes]) => {
          const liveNodes: Record<string, Record<string, ValidatedSensorReading>> = {};
          Object.entries(nodes).forEach(([nodeId, sensors]) => {
            const st = nodeStatuses[zoneId]?.[nodeId];
            if (st?.status === 'online') {
              liveNodes[nodeId] = sensors;
            }
          });
          if (Object.keys(liveNodes).length > 0) {
            next[zoneId] = liveNodes;
          }
        });
        return next;
      });
    } else {
      // Complete Cache Purge: Reset all memory buffers
      setReadings({});
      setNodeStatuses({});
      setAlerts([]);
      setMetrics({
        avgLatency: 0,
        maxLatency: 0,
        count: 0,
        totalLatency: 0,
        packetsPerSec: 0,
      });
      setIsSimulationActive(false);

      // Re-fetch only currently live active rooms from server
      if (socket && socket.connected) {
        socket.emit('get_zones');
      }
    }
  }, [socket, nodeStatuses]);

  const toggleSimulation = useCallback(() => {
    setIsSimulationActive(prev => !prev);
  }, []);

  const value = useMemo(
    () => ({
      socket,
      isConnected,
      gatewayStatus,
      activeZones,
      readings,
      nodeStatuses,
      metrics,
      alerts,
      stats,
      reconnect,
      joinZone,
      clearAlerts,
      clearCache,
      isSimulationActive,
      toggleSimulation,
      autoPurgeStale,
      setAutoPurgeStale,
    }),
    [
      socket,
      isConnected,
      gatewayStatus,
      activeZones,
      readings,
      nodeStatuses,
      metrics,
      alerts,
      stats,
      reconnect,
      joinZone,
      clearAlerts,
      clearCache,
      isSimulationActive,
      toggleSimulation,
      autoPurgeStale,
      setAutoPurgeStale,
    ]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
