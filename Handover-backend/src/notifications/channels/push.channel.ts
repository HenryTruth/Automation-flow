import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class PushChannel implements OnModuleInit {
  private readonly logger = new Logger(PushChannel.name);
  private app: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('firebase.projectId');
    if (!projectId) {
      this.logger.warn('Firebase config missing — push notifications disabled');
      return;
    }
    this.app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail: this.config.get<string>('firebase.clientEmail'),
        privateKey: this.config.get<string>('firebase.privateKey'),
      }),
    });
  }

  async send(deviceToken: string, title: string, body: string): Promise<void> {
    if (!this.app || !deviceToken) return;
    try {
      await this.app.messaging().send({ token: deviceToken, notification: { title, body } });
    } catch (err) {
      this.logger.warn(`Push notification failed for token ${deviceToken.slice(-8)}: ${(err as Error).message}`);
    }
  }
}
