import { IsArray, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

const VALID_GROUNDS = ['rent_inflation', 'listing_discrepancy', 'agreement_breach'];

export class CreateAppealDto {
  @IsUUID()
  handoverId: string;

  @IsUUID()
  filedBy: string;

  @IsArray()
  @IsIn(VALID_GROUNDS, { each: true })
  grounds: string[];

  @IsString()
  @MaxLength(5000)
  evidenceDetails: string;
}
