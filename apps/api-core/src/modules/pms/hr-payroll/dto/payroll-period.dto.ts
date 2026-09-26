import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsNumber, Min, IsNotEmpty } from 'class-validator';

export class CreatePayrollPeriodDto {
  @ApiProperty({ description: 'Period start date (YYYY-MM-DD)' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ description: 'Period end date (YYYY-MM-DD)' })
  @IsDateString()
  periodEnd!: string;
}

export class QueryPayrollPeriodsDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}