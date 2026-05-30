import { Injectable, Logger } from '@nestjs/common';
import { IWhatsappProvider } from './whatsapp-provider.interface';

@Injectable()
export class StubWhatsappProvider implements IWhatsappProvider {
  private readonly logger = new Logger(StubWhatsappProvider.name);

  async sendMessage(phone: string, templateName: string, variables: Record<string, string>): Promise<void> {
    this.logger.warn(`[STUB WhatsApp] To: ${phone}, Template: ${templateName}`, variables);
  }
}
