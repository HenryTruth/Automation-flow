import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { IDENTITY_PROVIDER } from './providers/identity-provider.interface';
import { PremblyProvider } from './providers/prembly.provider';

@Module({
  imports: [StorageModule],
  controllers: [IdentityController],
  providers: [
    IdentityService,
    { provide: IDENTITY_PROVIDER, useClass: PremblyProvider },
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
