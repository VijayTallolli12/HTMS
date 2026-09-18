import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnassignRoomDto {
  @ApiPropertyOptional({ description: 'Optional operational reason for unassigning room' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
