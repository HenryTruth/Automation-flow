import { IsIn, IsString, IsNotEmpty } from 'class-validator';

export class DeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';
}
