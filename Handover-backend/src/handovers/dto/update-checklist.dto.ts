import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateChecklistDto {
  @IsOptional() @IsBoolean() inspectionCompleted?: boolean;
  @IsOptional() @IsBoolean() agreementSigned?: boolean;
  @IsOptional() @IsBoolean() keysCollected?: boolean;
  @IsOptional() @IsBoolean() meterToppedUp?: boolean;
  @IsOptional() @IsBoolean() caretakerIntroduced?: boolean;
  @IsOptional() @IsBoolean() photosTaken?: boolean;
}
