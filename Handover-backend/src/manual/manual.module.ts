import { Module } from '@nestjs/common';
import { ManualController } from './manual.controller';
import { ManualService } from './manual.service';

@Module({
  controllers: [ManualController],
  providers: [ManualService],
})
export class ManualModule {}
