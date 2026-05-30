import { IsUUID } from 'class-validator';

export class CreateHandoverDto {
  @IsUUID()
  listingId: string;
}
