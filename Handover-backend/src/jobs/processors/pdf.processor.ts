import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { JOB } from '../constants/job-names';
import { QUEUE } from '../constants/queue-names';

@Processor(QUEUE.PDF)
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB.GENERATE_TENANCY_PDF) {
      await this.generateTenancyPdf(job.data.handoverId as string);
    }
  }

  private async generateTenancyPdf(handoverId: string): Promise<void> {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      include: {
        listing: true,
        outgoingTenant: true,
        incomingTenant: true,
        agreement: true,
      },
    });
    if (!handover?.agreement) return;

    const pdfBuffer = await this.renderPdf(handover);
    const url = await this.storage.uploadBuffer(pdfBuffer, `agreements/${handoverId}`, 'application/pdf');

    await this.prisma.tenancyAgreement.update({
      where: { handoverId },
      data: { documentUrl: url },
    });

    this.logger.log(`Tenancy agreement PDF generated for handover ${handoverId}`);
  }

  private renderPdf(handover: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Handover Tenancy Agreement', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Property: ${handover.listing.address}, ${handover.listing.city}`);
      doc.text(`Outgoing Tenant: ${handover.outgoingTenant.name}`);
      doc.text(`Incoming Tenant: ${handover.incomingTenant.name}`);
      doc.text(`Move-in Date: ${handover.moveInDate.toDateString()}`);
      doc.text(`Retainment Amount: ₦${handover.retainmentAmount.toLocaleString()}`);
      doc.moveDown();
      doc.fontSize(10).text('Both parties have digitally signed this agreement in the Handover app.', { align: 'center' });

      doc.end();
    });
  }
}
