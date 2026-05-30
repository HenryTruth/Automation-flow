import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { JOB } from '../constants/job-names';
import { QUEUE } from '../constants/queue-names';

@Processor(QUEUE.MEDIATOR)
export class MediatorProcessor extends WorkerHost {
  private readonly logger = new Logger(MediatorProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB.MEDIATOR_ASSIGNMENT) {
      const { disputeId } = job.data as { disputeId: string; handoverId: string };
      await this.prisma.dispute.update({
        where: { id: disputeId },
        data: { mediatorAssignedAt: new Date() },
      });
      this.logger.log(`Mediator assignment recorded for dispute ${disputeId}`);
      // In production: integrate with internal assignment system or webhook
    }
  }
}
