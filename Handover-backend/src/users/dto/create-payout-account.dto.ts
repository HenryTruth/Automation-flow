import { IsString, Length, Matches } from 'class-validator';

export class CreatePayoutAccountDto {
  @IsString()
  bankName: string;

  @IsString()
  @Length(10, 10)
  @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits' })
  accountNumber: string;

  @IsString()
  bankCode: string;
}
