/**
 * IngestionService — Phase 1
 *
 * Subscribes to MQTT sensor topics, validates payload shape, stamps receivedAt,
 * and logs the parsed reading. That's it.
 *
 * Per Rules.md §1: this handler must NEVER contain business logic (dedup,
 * gap detection, anomaly checks) or call StorageModule / RealtimeModule.
 *
 * Per Rules.md §2: nothing synchronous/blocking/CPU-heavy runs here — this is
 * the latency-critical path.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import mqtt, { type MqttClient } from 'mqtt';
import type { RawSensorReading, ValidatedSensorReading } from './sensor-reading.interface.js';
import type { ValidatedNodeStatus } from './node-status.interface.js';

export interface GatewayStatusPayload {
  brokerConnected: boolean;
  loraGatewayConnected: boolean;
  status: 'online' | 'offline' | 'standby';
  lastLoraPacketAt: string | null;
  totalLoraPackets: number;
  gatewayType: string;
  topic: string;
  nodeId?: string;
}

/** Topic subscriptions for sensors, LoRa packets, and gateway status/LWT */
const SUBSCRIBE_TOPIC = 'mine/+/+/#';
const LORA_TOPIC = 'sensors/lora/#';
const GATEWAY_TOPIC = 'gateway/#';
const SENSORS_GATEWAY_TOPIC = 'sensors/gateway/#';
const MINE_GATEWAY_TOPIC = 'mine/gateway/#';

/** Valid sensor types per Design&Architecture.md §3 */
const VALID_SENSOR_TYPES = new Set([
  'tilt',
  'vibration',
  'displacement',
  'crack',
  'gas',
  'water',
  'temperature',
  'humidity',
]);

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private client: MqttClient | null = null;
  private isBrokerConnected = false;
  private isGatewayClientConnected = false;
  private hasSeenAnyGatewayActivity = false;
  private isGatewayExplicitlyOffline = false;
  private lastLoraPacketAt: string | null = null;
  private totalLoraPackets = 0;
  private activeLoraNodeId = 'NODE_01';
  private gatewayWatchdogTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getGatewayStatus(): GatewayStatusPayload {
    const elapsed = this.lastLoraPacketAt
      ? Date.now() - new Date(this.lastLoraPacketAt).getTime()
      : null;

    const isPacketRecent =
      !this.isGatewayExplicitlyOffline &&
      elapsed !== null &&
      elapsed < 10_000;

    // A gateway is connected if Mosquitto reports connected clients > 1 (e.g. ESP32 connected to broker)
    // OR if recent LoRa packets were received
    const isConnected =
      (this.isGatewayClientConnected || isPacketRecent) &&
      !this.isGatewayExplicitlyOffline;

    let status: 'online' | 'offline' | 'standby' = 'standby';
    if (isConnected) {
      status = 'online';
    } else if (
      this.hasSeenAnyGatewayActivity ||
      this.isGatewayExplicitlyOffline ||
      this.lastLoraPacketAt !== null ||
      this.totalLoraPackets > 0
    ) {
      status = 'offline';
    } else {
      status = 'standby';
    }

    return {
      brokerConnected: this.isBrokerConnected,
      loraGatewayConnected: isConnected,
      status,
      lastLoraPacketAt: this.lastLoraPacketAt,
      totalLoraPackets: this.totalLoraPackets,
      gatewayType: 'ESP32 LoRa Gateway (SX1276)',
      topic: 'sensors/lora/#',
      nodeId: this.activeLoraNodeId,
    };
  }

  private emitGatewayStatus(): void {
    this.eventEmitter.emit('gateway.status.changed', this.getGatewayStatus());
  }

  private recordLoraGatewayActivity(nodeId: string): void {
    this.isGatewayClientConnected = true;
    this.hasSeenAnyGatewayActivity = true;
    this.isGatewayExplicitlyOffline = false;
    this.lastLoraPacketAt = new Date().toISOString();
    this.totalLoraPackets++;
    this.activeLoraNodeId = nodeId;
    this.emitGatewayStatus();
  }

  onModuleInit(): void {
    const brokerUrl = this.config.get<string>('MQTT_BROKER_URL', 'mqtt://localhost:1883');

    this.client = mqtt.connect(brokerUrl, {
      clientId: 'backend-ingestion',
      clean: true,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker at ${brokerUrl}`);
      this.isBrokerConnected = true;
      this.emitGatewayStatus();

      // Subscribe to mine telemetry, hardware LoRa topics, gateway topics, and broker $SYS telemetry
      const topics = [
        SUBSCRIBE_TOPIC,
        LORA_TOPIC,
        GATEWAY_TOPIC,
        SENSORS_GATEWAY_TOPIC,
        MINE_GATEWAY_TOPIC,
        '$SYS/broker/clients/#',
        '$SYS/broker/clients/connected',
      ];
      this.client!.subscribe(topics, { qos: 1 }, (err, granted) => {
        if (err) {
          this.logger.error(`Subscribe error: ${err.message}`);
          return;
        }
        if (granted && granted.length > 0) {
          for (const g of granted) {
            this.logger.log(`Subscribed to "${g.topic}" with QoS ${g.qos}`);
          }
        }
      });
    });

    this.client.on('message', (_topic: string, payload: Buffer) => {
      this.handleMessage(_topic, payload);
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`MQTT error: ${err.message}`);
      this.isBrokerConnected = false;
      this.emitGatewayStatus();
    });

    this.client.on('offline', () => {
      this.logger.warn('MQTT client offline — will attempt reconnect');
      this.isBrokerConnected = false;
      this.emitGatewayStatus();
    });

    // 1-second watchdog to quickly detect physical LoRa gateway timeout/disconnect
    let lastKnownStatus: 'online' | 'offline' | 'standby' = 'standby';
    this.gatewayWatchdogTimer = setInterval(() => {
      const current = this.getGatewayStatus();
      if (current.status !== lastKnownStatus) {
        if (lastKnownStatus === 'online' && current.status === 'offline') {
          this.logger.warn(
            `[ingestion] LoRa Gateway timed out (>5s without packet) -> marked OFFLINE`,
          );
          if (this.activeLoraNodeId) {
            this.eventEmitter.emit('node.status.received', {
              nodeId: this.activeLoraNodeId,
              zoneId: 'zone-A',
              status: 'offline',
              receivedAt: new Date().toISOString(),
            });
          }
        }
        lastKnownStatus = current.status;
        this.emitGatewayStatus();
      }
    }, 1000);
  }

  onModuleDestroy(): void {
    if (this.gatewayWatchdogTimer) {
      clearInterval(this.gatewayWatchdogTimer);
      this.gatewayWatchdogTimer = null;
    }
    if (this.client) {
      this.client.end();
      this.logger.log('MQTT client disconnected');
    }
  }

  /**
   * MQTT message handler
   */
  private handleMessage(topic: string, payload: Buffer): void {
    // --- 0. Handle Mosquitto Broker Internal Client Telemetry ($SYS/broker/clients/...) ---
    if (topic.startsWith('$SYS/broker/clients')) {
      if (topic === '$SYS/broker/clients/connected' || topic.endsWith('/connected')) {
        const count = parseInt(payload.toString().trim(), 10);
        if (!isNaN(count)) {
          // backend-ingestion itself is 1 client.
          // Any count > 1 means an external gateway (such as ESP32 LoRa Gateway) is connected to the MQTT broker
          const wasConnected = this.isGatewayClientConnected;
          this.isGatewayClientConnected = count > 1;

          if (this.isGatewayClientConnected) {
            this.hasSeenAnyGatewayActivity = true;
            this.isGatewayExplicitlyOffline = false;
          }

          if (wasConnected !== this.isGatewayClientConnected) {
            this.logger.log(
              `[ingestion] MQTT Broker Gateway client state: connected=${this.isGatewayClientConnected} (broker client count=${count})`,
            );
            this.emitGatewayStatus();
          }
        }
      }
      return;
    }

    const lowerTopic = topic.toLowerCase();

    // --- 1. Handle Gateway Status and LWT Messages ---
    // (e.g. gateway/status, gateway/lwt, sensors/lora/status, sensors/lora/lwt, sensors/gateway/status)
    const isGatewayTopic =
      lowerTopic.includes('gateway') ||
      lowerTopic === 'sensors/lora/status' ||
      lowerTopic === 'sensors/lora/lwt' ||
      lowerTopic.startsWith('sensors/lora/status') ||
      lowerTopic.startsWith('sensors/lora/lwt');

    if (isGatewayTopic) {
      const rawStr = payload.toString().trim().toLowerCase();
      let isOffline = false;
      let isOnline = false;

      if (
        rawStr === 'offline' ||
        rawStr === 'disconnected' ||
        rawStr === '0' ||
        rawStr === 'down' ||
        rawStr === 'dead'
      ) {
        isOffline = true;
      } else if (
        rawStr === 'online' ||
        rawStr === 'connected' ||
        rawStr === '1' ||
        rawStr === 'up'
      ) {
        isOnline = true;
      } else {
        try {
          const parsed = JSON.parse(rawStr) as Record<string, unknown>;
          if (
            parsed &&
            (parsed.status === 'offline' ||
              parsed.connected === false ||
              parsed.online === false)
          ) {
            isOffline = true;
          } else if (
            parsed &&
            (parsed.status === 'online' ||
              parsed.connected === true ||
              parsed.online === true)
          ) {
            isOnline = true;
          }
        } catch {
          // not json
        }
      }

      if (isOffline) {
        this.logger.warn(
          `[ingestion] Gateway disconnect/LWT received on topic "${topic}" -> marking gateway OFFLINE`,
        );
        this.isGatewayExplicitlyOffline = true;
        this.emitGatewayStatus();
        if (this.activeLoraNodeId) {
          this.eventEmitter.emit('node.status.received', {
            nodeId: this.activeLoraNodeId,
            zoneId: 'zone-A',
            status: 'offline',
            receivedAt: new Date().toISOString(),
          });
        }
        return;
      }

      if (isOnline) {
        this.logger.log(`[ingestion] Gateway online received on topic "${topic}"`);
        this.isGatewayExplicitlyOffline = false;
        this.recordLoraGatewayActivity(this.activeLoraNodeId);
        return;
      }
    }

    // --- 1. Handle LoRa Hardware Topics (sensors/lora/...) ---
    if (topic.startsWith('sensors/lora')) {
      if (payload.length === 54) {
        this.handleLoraBinary(payload);
        return;
      }
      const str = payload.toString().trim();
      if (str.startsWith('{')) {
        this.handleLoraJson(payload);
        return;
      }
      this.logger.warn(`Unknown payload format on "${topic}" (length: ${payload.length})`);
      return;
    }

    // --- 2. Handle Status Topics ---
    if (topic.endsWith('/status')) {
      const parts = topic.split('/');
      if (parts.length === 4) {
        const zoneId = parts[1];
        const nodeId = parts[2];
        const rawStr = payload.toString().trim();
        let status: 'online' | 'offline' | undefined;

        if (rawStr === 'online' || rawStr === 'offline') {
          status = rawStr;
        } else {
          try {
            const parsed = JSON.parse(rawStr) as Record<string, unknown>;
            if (parsed && (parsed.status === 'online' || parsed.status === 'offline')) {
              status = parsed.status;
            }
          } catch {
            // not json
          }
        }

        if (status) {
          const validatedStatus: ValidatedNodeStatus = {
            nodeId,
            zoneId,
            status,
            receivedAt: new Date().toISOString(),
          };
          this.eventEmitter.emit('node.status.received', validatedStatus);
          this.logger.log(`[ingestion] node status received: node=${nodeId} status=${status}`);
          return;
        }
      }
    }

    // --- 3. Parse Standard JSON Reading ---
    let raw: unknown;
    try {
      raw = JSON.parse(payload.toString()) as unknown;
    } catch {
      this.logger.warn(`Invalid JSON on topic "${topic}" — skipped`);
      return;
    }

    // --- 4. Validate shape ---
    if (!this.isValidSensorReading(raw)) {
      this.logger.warn(`Invalid payload shape on topic "${topic}" — skipped`);
      return;
    }

    // --- 5. Stamp receivedAt ---
    const validated: ValidatedSensorReading = {
      ...raw,
      receivedAt: new Date().toISOString(),
    };

    // --- 6. Emit internal event ---
    this.logger.debug(`[ingestion] raw reading received: node=${validated.nodeId} seq=${validated.sequenceNumber}`);
    this.eventEmitter.emit('sensor.reading.received', validated);
  }

  /**
   * Decodes 54-byte packed SensorData struct sent by ESP32 LoRa Gateway
   */
  private handleLoraBinary(payload: Buffer): void {
    const nodeId = payload.subarray(0, 8).toString('utf8').replace(/\0.*$/, '').trim() || 'NODE_01';
    const packetSeq = payload.readUInt32LE(8);
    const temp = Math.round(payload.readFloatLE(12) * 10) / 10;
    const hum = Math.round(payload.readFloatLE(16) * 10) / 10;
    const ax = payload.readFloatLE(20);
    const ay = payload.readFloatLE(24);
    const az = payload.readFloatLE(28);
    const gx = payload.readFloatLE(32);
    const gy = payload.readFloatLE(36);
    const gz = payload.readFloatLE(40);
    const dist_cm = Math.round(payload.readFloatLE(44) * 10) / 10;
    const mq6_raw = payload.readInt16LE(48);
    const water_raw = payload.readInt16LE(50);
    const pot_raw = payload.readInt16LE(52);

    this.recordLoraGatewayActivity(nodeId);

    this.dispatchHardwareReadings(nodeId, packetSeq, {
      temp,
      hum,
      ax,
      ay,
      az,
      gx,
      gy,
      gz,
      dist_cm,
      mq6_raw,
      water_raw,
      pot_raw,
    });
  }

  private handleLoraJson(payload: Buffer): void {
    try {
      const data = JSON.parse(payload.toString()) as Record<string, unknown>;

      // Check for explicit offline/disconnect signal in LoRa JSON
      if (data.status === 'offline' || data.connected === false || data.online === false) {
        this.logger.warn(`[ingestion] LoRa JSON specified offline: ${JSON.stringify(data)}`);
        this.isGatewayExplicitlyOffline = true;
        this.emitGatewayStatus();
        const nodeId = String(data.id || data.nodeId || this.activeLoraNodeId || 'NODE_01');
        this.eventEmitter.emit('node.status.received', {
          nodeId,
          zoneId: 'zone-A',
          status: 'offline',
          receivedAt: new Date().toISOString(),
        });
        return;
      }

      const nodeId = String(data.id || data.nodeId || 'NODE_01');
      const packetSeq = Number(data.packetSequence || data.packetSeq || data.sequenceNumber || 1);
      this.recordLoraGatewayActivity(nodeId);
      this.dispatchHardwareReadings(nodeId, packetSeq, {
        temp: Number(data.temp ?? -999),
        hum: Number(data.hum ?? -999),
        ax: Number(data.ax ?? 0),
        ay: Number(data.ay ?? 0),
        az: Number(data.az ?? 0),
        gx: Number(data.gx ?? 0),
        gy: Number(data.gy ?? 0),
        gz: Number(data.gz ?? 0),
        dist_cm: Number(data.dist_cm ?? 0),
        mq6_raw: Number(data.mq6_raw ?? 0),
        water_raw: Number(data.water_raw ?? 0),
        pot_raw: Number(data.pot_raw ?? 0),
      });
    } catch (err: unknown) {
      this.logger.warn(`Failed to parse LoRa JSON payload: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private dispatchHardwareReadings(
    nodeId: string,
    packetSeq: number,
    data: {
      temp: number;
      hum: number;
      ax: number;
      ay: number;
      az: number;
      gx: number;
      gy: number;
      gz: number;
      dist_cm: number;
      mq6_raw: number;
      water_raw: number;
      pot_raw: number;
    },
  ): void {
    const now = new Date().toISOString();
    const zoneId = 'zone-A';

    // 1. Mark node as online
    const validatedStatus: ValidatedNodeStatus = {
      nodeId,
      zoneId,
      status: 'online',
      receivedAt: now,
    };
    this.eventEmitter.emit('node.status.received', validatedStatus);

    // 2. Compute physical metrics:
    // Pitch & Roll tilt angles in degrees
    const pitch = Math.atan2(data.ax, Math.sqrt(data.ay * data.ay + data.az * data.az)) * (180 / Math.PI);
    const roll = Math.atan2(data.ay, Math.sqrt(data.ax * data.ax + data.az * data.az)) * (180 / Math.PI);
    const tilt = Math.round(Math.sqrt(pitch * pitch + roll * roll) * 100) / 100;

    // Vibration magnitude
    const vibration = Math.round(Math.sqrt(data.ax * data.ax + data.ay * data.ay + data.az * data.az) * 100) / 100;

    const sensorReadings: Array<{ sensorType: string; value: number; unit: string }> = [
      { sensorType: 'tilt', value: isNaN(tilt) ? 0 : tilt, unit: 'degrees' },
      { sensorType: 'vibration', value: isNaN(vibration) ? 0 : vibration, unit: 'g' },
      { sensorType: 'displacement', value: data.dist_cm, unit: 'cm' },
      { sensorType: 'crack', value: data.pot_raw, unit: 'raw' },
      { sensorType: 'gas', value: data.mq6_raw, unit: 'raw' },
      { sensorType: 'water', value: data.water_raw, unit: 'raw' },
    ];

    if (data.temp !== -999 && !isNaN(data.temp)) {
      sensorReadings.push({ sensorType: 'temperature', value: data.temp, unit: '°C' });
    }
    if (data.hum !== -999 && !isNaN(data.hum)) {
      sensorReadings.push({ sensorType: 'humidity', value: data.hum, unit: '%' });
    }

    for (const item of sensorReadings) {
      const validated: ValidatedSensorReading = {
        nodeId,
        zoneId,
        sensorType: item.sensorType,
        value: item.value,
        unit: item.unit,
        timestamp: now,
        sequenceNumber: packetSeq,
        receivedAt: now,
      };
      this.logger.debug(`[ingestion] hardware reading: node=${nodeId} ${item.sensorType}=${item.value}${item.unit} seq=${packetSeq}`);
      this.eventEmitter.emit('sensor.reading.received', validated);
    }
  }

  /**
   * Type guard — validates that `data` has the exact shape of RawSensorReading.
   * No `any` — Rules.md §4.
   */
  private isValidSensorReading(data: unknown): data is RawSensorReading {
    if (typeof data !== 'object' || data === null) return false;

    const obj = data as Record<string, unknown>;

    return (
      typeof obj['nodeId'] === 'string' &&
      typeof obj['zoneId'] === 'string' &&
      typeof obj['sensorType'] === 'string' &&
      VALID_SENSOR_TYPES.has(obj['sensorType'] as string) &&
      typeof obj['value'] === 'number' &&
      typeof obj['unit'] === 'string' &&
      typeof obj['timestamp'] === 'string' &&
      typeof obj['sequenceNumber'] === 'number' &&
      Number.isInteger(obj['sequenceNumber'])
    );
  }
}
