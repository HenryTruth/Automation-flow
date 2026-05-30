import { PropertyType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { CreatePayoutAccountDto } from '../../users/dto/create-payout-account.dto';

export class CreateListingDto {
  @IsEnum(PropertyType)
  propertyType: PropertyType;

  @IsString()
  @MaxLength(500)
  address: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsInt()
  @Min(1)
  beds: number;

  @IsInt()
  @Min(1)
  baths: number;

  @IsInt()
  @Min(1)
  annualRent: number;

  // retainment_fee intentionally omitted — calculated server-side

  @IsDateString()
  availableFrom: string;

  @IsOptional()
  @IsDateString()
  moveOutDate?: string;

  @IsString()
  @MaxLength(5000)
  story: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photos?: string[];

  @IsOptional()
  @Type(() => CreatePayoutAccountDto)
  payoutAccount?: CreatePayoutAccountDto;
}
