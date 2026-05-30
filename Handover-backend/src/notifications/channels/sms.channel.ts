import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsChannel {
  private readonly logger = new Logger(SmsChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(phone: string, message: string): Promise<void> {
    const apiKey = this.config.get<string>('termii.apiKey');
    const senderId = this.config.get<string>('termii.senderId');
    const baseUrl = this.config.get<string>('termii.baseUrl');

    if (!apiKey) {
      this.logger.warn(`[STUB SMS] To: ${phone}: ${message}`);
      return;
    }

    try {
      await axios.post(`${baseUrl}/api/sms/send`, {
        to: phone,
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'dnd',
        api_key: apiKey,
      });
    } catch (err) {
      this.logger.warn(`SMS send failed to ${phone}: ${(err as Error).message}`);
    }
  }
}
