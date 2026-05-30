import { IsOptional, IsString } from 'class-validator';
import { ListingFiltersDto } from './listing-filters.dto';

export class MapFiltersDto extends ListingFiltersDto {
  @IsOptional()
  @IsString()
  bounds?: string; // "sw_lat,sw_lng,ne_lat,ne_lng"
}
