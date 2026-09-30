import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CreateUserRequest,
  UpdateUserRequest,
  AssignUserPropertiesRequest,
  UpdateUserStatusRequest,
} from '@hms/api-contracts';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Filter by search string across name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by role code (e.g. FDA, PROPERTY_GM, FNB_MANAGER)' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned property ID' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'LOCKED'], description: 'Filter by user status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 25;
}

export class CreateUserDto implements CreateUserRequest {
  @ApiProperty({ example: 'Kenji', description: 'User first name' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required.' })
  firstName!: string;

  @ApiProperty({ example: 'Sato', description: 'User last name' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required.' })
  lastName!: string;

  @ApiProperty({ example: 'kenji.sato@enterprise-hms.com', description: 'User login email address' })
  @IsEmail({}, { message: 'A valid email address is required.' })
  @Transform(({ value }: { value?: string }) => (value ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiPropertyOptional({ example: '+81-90-5555-0100', description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'FNB_MANAGER', description: 'Role code to assign' })
  @IsString()
  @IsNotEmpty({ message: 'Role code is required.' })
  roleCode!: string;

  @ApiProperty({
    type: [String],
    example: ['01a00000-0000-7000-0000-000000000001'],
    description: 'Array of property IDs to assign',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ message: 'At least one property must be assigned.' })
  propertyIds!: string[];

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';

  @ApiPropertyOptional({ description: 'Optional initial password. If omitted, a secure random one is provisioned.' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Initial password must be at least 8 characters long.' })
  initialPassword?: string;
}

export class UpdateUserDto implements UpdateUserRequest {
  @ApiPropertyOptional({ example: 'Kenji', description: 'User first name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Sato', description: 'User last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+81-90-5555-0100', description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'FNB_MANAGER', description: 'Updated role code' })
  @IsOptional()
  @IsString()
  roleCode?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Updated array of property IDs (replaces current assignments if provided)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyIds?: string[];

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}

export class AssignPropertiesDto implements AssignUserPropertiesRequest {
  @ApiProperty({
    type: [String],
    description: 'Array of property IDs to assign to the user',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ message: 'At least one property ID is required.' })
  propertyIds!: string[];

  @ApiPropertyOptional({
    description: 'Optional role code for these properties. Defaults to current primary role.',
  })
  @IsOptional()
  @IsString()
  roleCode?: string;
}

export class UpdateUserStatusDto implements UpdateUserStatusRequest {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'], description: 'Target user status' })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}

