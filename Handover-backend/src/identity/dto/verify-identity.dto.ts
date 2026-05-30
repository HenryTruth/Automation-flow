import { IsString, Length } from 'class-validator';

export class VerifyIdentityDto {
  @IsString()
  @Length(11, 11)
  nin: string;

  @IsString()
  selfieBase64: string;
}
