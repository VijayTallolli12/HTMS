import { IsEmail, IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@enterprise-hms.com', description: 'User login email address' })
  @IsEmail({}, { message: 'A valid email address is required.' })
  @Transform(({ value }: { value?: string }) => (value ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiProperty({ example: 'SecretPassword123!', description: 'Plaintext password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  password!: string;

  @ApiPropertyOptional({
    enum: ['web', 'native'],
    default: 'web',
    description:
      'Client transport type. Web uses HttpOnly cookies; native returns refresh token in JSON.',
  })
  @IsOptional()
  @IsIn(['web', 'native'])
  clientType?: 'web' | 'native' = 'web';

  @ApiPropertyOptional({ example: 'Chrome / Windows', description: 'Client device information' })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
