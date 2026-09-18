import { IsISO8601, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { InventoryCalendarQuery } from '@hms/api-contracts';

export class QueryInventoryCalendarDto implements InventoryCalendarQuery {
  @IsISO8601(
    { strict: true },
    { message: 'startDate must be an ISO 8601 date string (YYYY-MM-DD)' },
  )
  @IsNotEmpty()
  startDate!: string;

  @IsISO8601({ strict: true }, { message: 'endDate must be an ISO 8601 date string (YYYY-MM-DD)' })
  @IsNotEmpty()
  endDate!: string;

  @IsOptional()
  @IsUUID('all', { message: 'roomTypeId must be a valid UUID' })
  roomTypeId?: string;
}
