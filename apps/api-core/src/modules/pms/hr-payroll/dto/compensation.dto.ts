import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsNumber, Min, IsNotEmpty } from 'class-validator';

export class CreateEmployeeCompensationDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @ApiProperty({ description: 'Effective date (YYYY-MM-DD)' })
  @IsDateString()
  effectiveDate!: string;

  @ApiProperty({ description: 'Basic salary' })
  @IsNumber()
  @Min(0)
  basicSalary!: number;

  @ApiPropertyOptional({ description: 'Housing allowance', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  housingAllowance?: number = 0;

  @ApiPropertyOptional({ description: 'Transport allowance', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transportAllowance?: number = 0;

  @ApiPropertyOptional({ description: 'Other allowance', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherAllowance?: number = 0;

  @ApiPropertyOptional({ description: 'Currency code', default: 'JPY' })
  @IsOptional()
  @IsString()
  currency?: string = 'JPY';
}