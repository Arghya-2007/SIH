import { Injectable } from '@nestjs/common';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import type { NodeStatusState } from '../ingestion/node-status.interface.js';

export interface GatewayStatusState {
  brokerConnected: boolean;
  loraGatewayConnected: boolean;
  status: 'online' | 'offline' | 'standby';
  lastLoraPacketAt: string | null;
  totalLoraPackets: number;
  gatewayType: string;
  topic: string;
  nodeId?: string;
}

@Injectable()
export class RealtimeService {
  // zoneId -> (nodeId:sensorType -> reading)
  private readonly snapshot = new Map<string, Map<string, ValidatedSensorReading>>();
  
  // zoneId -> (nodeId -> nodeStatus)
  private readonly statusSnapshot = new Map<string, Map<string, NodeStatusState>>();

  private currentGatewayStatus: GatewayStatusState = {
    brokerConnected: false,
    loraGatewayConnected: false,
    status: 'standby',
    lastLoraPacketAt: null,
    totalLoraPackets: 0,
    gatewayType: 'ESP32 LoRa Gateway (SX1276)',
    topic: 'sensors/lora/#',
    nodeId: 'NODE_01',
  };

  setGatewayStatus(status: GatewayStatusState) {
    this.currentGatewayStatus = status;
  }

  getGatewayStatus(): GatewayStatusState {
    return this.currentGatewayStatus;
  }
  
  updateSnapshot(reading: ValidatedSensorReading) {
    const { zoneId, nodeId, sensorType } = reading;
    
    if (!this.snapshot.has(zoneId)) {
      this.snapshot.set(zoneId, new Map());
    }
    
    const zoneMap = this.snapshot.get(zoneId)!;
    zoneMap.set(`${nodeId}:${sensorType}`, reading);
  }

  updateNodeStatus(status: NodeStatusState) {
    const { zoneId, nodeId } = status;
    
    if (!this.statusSnapshot.has(zoneId)) {
      this.statusSnapshot.set(zoneId, new Map());
    }
    
    const zoneMap = this.statusSnapshot.get(zoneId)!;
    zoneMap.set(nodeId, status);

    // Clear all old sensor data when the node gets offline
    if (status.status === 'offline') {
      const readingsMap = this.snapshot.get(zoneId);
      if (readingsMap) {
        for (const key of readingsMap.keys()) {
          if (key.startsWith(`${nodeId}:`)) {
            readingsMap.delete(key);
          }
        }
      }
    }
  }

  getSnapshotForZone(zoneId: string): { readings: ValidatedSensorReading[], statuses: NodeStatusState[] } {
    const readingsMap = this.snapshot.get(zoneId);
    const statusesMap = this.statusSnapshot.get(zoneId);
    
    return {
      readings: readingsMap ? Array.from(readingsMap.values()) : [],
      statuses: statusesMap ? Array.from(statusesMap.values()) : [],
    };
  }

  getActiveZones(): string[] {
    const zones = new Set<string>([
      ...this.snapshot.keys(),
      ...this.statusSnapshot.keys(),
    ]);
    return Array.from(zones);
  }
}
