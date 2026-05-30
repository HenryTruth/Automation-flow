import { IsBoolean } from 'class-validator';

export class UpholdAppealDto {
  @IsBoolean()
  banOutgoingTenant: boolean;
}
