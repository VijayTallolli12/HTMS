import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateFloorDto {
  @ApiProperty({
    description: 'Parent Building ID',
    example: '018f6c3a-921b-7a11-89dc-5491b281f9a1',
  })
  @IsUUID()
  @IsNotEmpty()
  buildingId: string;

  @ApiProperty({
    description: 'Floor code unique within the Building',
    example: 'FL-01',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 32)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code must contain only alphanumeric characters, underscores, or hyphens',
  })
  code: string;

  @ApiProperty({
    description: 'Display label or name of the floor',
    example: 'First Floor Suites',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 128)
  name: string;

  @ApiProperty({
    description: 'Floor number / order sequence (negative for basements, 0 for ground)',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  floorNumber: number;
}
