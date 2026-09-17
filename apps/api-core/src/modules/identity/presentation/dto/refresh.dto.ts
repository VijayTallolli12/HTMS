import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Plaintext refresh token for native/mobile clients. Omitted for browser clients using cookies.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
