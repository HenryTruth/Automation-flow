import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';
import { PropertyType } from '@prisma/client';

export class ListingFiltersDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(PropertyType, { each: true })
  @Transform(({ value }: { value: string }) => (typeof value === 'string' ? value.split(',') : value))
  types?: PropertyType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: string }) => (typeof value === 'string' ? value.split(',') : value))
  amenities?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rent_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rent_max?: number;

  @IsOptional()
  @IsISO8601()
  move_in_before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
