import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWhatsappProvider, WHATSAPP_PROVIDER } from '../providers/whatsapp-provider.interface';

@Injectable()
export class WhatsappChannel {
  private readonly logger = new Logger(WhatsappChannel.name);

  constructor(@Inject(WHATSAPP_PROVIDER) private readonly provider: any) {}

  async send(phone: string, templateName: string, variables: Record<string, string>): Promise<void> {
    try {
      await this.provider.sendMessage(phone, templateName, variables);
    } catch (err) {
      this.logger.warn(`WhatsApp send failed for ${phone}: ${(err as Error).message}`);
    }
  }
}
