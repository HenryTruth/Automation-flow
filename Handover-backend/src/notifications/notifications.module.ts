import { Module } from '@nestjs/common';
import { PushChannel } from './channels/push.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';
import { SmsChannel } from './channels/sms.channel';
import { NotificationsService } from './notifications.service';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';
import { StubWhatsappProvider } from './providers/stub-whatsapp.provider';

@Module({
  providers: [
    NotificationsService,
    PushChannel,
    WhatsappChannel,
    SmsChannel,
    { provide: WHATSAPP_PROVIDER, useClass: StubWhatsappProvider },
  ],
  exports: [NotificationsService, SmsChannel],
})
export class NotificationsModule {}
