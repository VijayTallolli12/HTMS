import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { BedConfigurationItem, CreateRoomTypeRequest } from '@hms/api-contracts';

@ValidatorConstraint({ name: 'IsOccupancyValid', async: false })
export class IsOccupancyValidConstraint implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as CreateRoomTypeDto;
    if (
      obj.baseOccupancy === undefined ||
      obj.maxOccupancy === undefined ||
      obj.maxAdults === undefined ||
      obj.maxChildren === undefined
    ) {
      return true;
    }
    return (
      obj.baseOccupancy >= 1 &&
      obj.maxOccupancy >= obj.baseOccupancy &&
      obj.maxAdults >= 1 &&
      obj.maxAdults <= obj.maxOccupancy &&
      obj.maxChildren >= 0 &&
      obj.maxChildren <= obj.maxOccupancy &&
      obj.maxAdults + obj.maxChildren >= obj.maxOccupancy
    );
  }

  defaultMessage() {
    return 'Occupancy configuration invalid: baseOccupancy <= maxOccupancy, maxAdults <= maxOccupancy, maxChildren <= maxOccupancy, and maxAdults + maxChildren >= maxOccupancy required.';
  }
}

export class CreateRoomTypeDto implements CreateRoomTypeRequest {
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code must contain only uppercase alphanumeric characters, underscores, and hyphens.',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  roomClass!: string;

  @IsInt()
  @Min(1)
  baseOccupancy!: number;

  @IsInt()
  @Min(1)
  @Validate(IsOccupancyValidConstraint)
  maxOccupancy!: number;

  @IsInt()
  @Min(1)
  maxAdults!: number;

  @IsInt()
  @Min(0)
  maxChildren!: number;

  @IsArray()
  @ArrayMinSize(1)
  bedConfiguration!: BedConfigurationItem[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
