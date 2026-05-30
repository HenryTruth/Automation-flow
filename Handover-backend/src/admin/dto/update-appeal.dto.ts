import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAppealDto {
  @IsOptional() @IsString() @MaxLength(5000) outgoingResponse?: string;
  @IsOptional() @IsString() @MaxLength(5000) incomingResponse?: string;
  @IsOptional() @IsString() @MaxLength(5000) adminNotes?: string;
  @IsOptional() @IsIn(['open', 'under_review', 'upheld', 'rejected']) status?: string;
}
