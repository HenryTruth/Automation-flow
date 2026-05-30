import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsPhoneNumber('NG')
  phone: string;

  @IsString()
  @Length(4, 8)
  otp: string;
}
