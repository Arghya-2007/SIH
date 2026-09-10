import { Module } from '@nestjs/common';
import { ProcessingService } from './processing.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [ProcessingService],
  exports: [ProcessingService],
})
export class ProcessingModule {}
