import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ValidatedSensorReading } from '../ingestion/sensor-reading.interface.js';
import type { NodeStatusState } from '../ingestion/node-status.interface.js';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  @OnEvent('node.status.changed')
  handleNodeStatusChanged(status: NodeStatusState) {
    this.logger.debug(`[STUB] would evaluate alert here for node status change: ${status.nodeId} -> ${status.status}`);
  }

  @OnEvent('sensor.reading.deduped')
  handleDedupedReading(reading: ValidatedSensorReading) {
    this.logger.debug(`[STUB] would evaluate alert here for sensor reading: ${reading.nodeId}:${reading.sensorType} = ${reading.value}`);
  }
}
