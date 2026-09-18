import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignRoomDto {
  @ApiProperty({ description: 'Target physical room ID to assign' })
  @IsUUID()
  @IsNotEmpty()
  roomId: string;

  @ApiPropertyOptional({ description: 'Optional reason or note for assignment / move' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional({ description: 'Flag to authorize room type upgrade if permitted' })
  @IsOptional()
  @IsBoolean()
  allowUpgrade?: boolean;
}
