import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

export const WEBHOOK_HANDOVERS_TOKEN = 'WEBHOOK_HANDOVERS_TOKEN';

@Controller('payments')
export class WebhookController {
  constructor(
    private readonly payments: PaymentsService,
    @Inject(WEBHOOK_HANDOVERS_TOKEN) private readonly handovers: any,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: any,
    @Headers('x-webhook-signature') signature: string,
  ) {
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody) throw new BadRequestException('Missing raw body');

    const valid = this.payments.verifyWebhook(rawBody, signature ?? '');
    if (!valid) throw new BadRequestException('Invalid webhook signature');

    const payload = JSON.parse(rawBody.toString());

    if (payload.event === 'payment.success') {
      await this.handovers.confirmPayment(payload.data?.handover_id as string);
    }

    return { received: true };
  }
}
