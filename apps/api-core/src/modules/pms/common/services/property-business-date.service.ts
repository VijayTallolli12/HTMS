import { Inject, Injectable } from '@nestjs/common';
import { Clock, CLOCK_TOKEN } from '../contracts/clock.interface';

@Injectable()
export class PropertyBusinessDateService {
  constructor(@Inject(CLOCK_TOKEN) private readonly clock: Clock) {}

  /**
   * Resolves the current calendar business date ('YYYY-MM-DD') for a property in its configured IANA timezone
   * based on the injected Clock instant.
   * Returns a Date object representing UTC midnight of that calendar date for Prisma Date columns.
   */
  public getCurrentBusinessDate(timeZone: string): Date {
    const instant = this.clock.now();
    return this.resolveBusinessDate(instant, timeZone);
  }

  /**
   * Resolves a calendar business date from a given instant and IANA timezone.
   */
  public resolveBusinessDate(instant: Date, timeZone: string): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // Strict ISO date format: 'YYYY-MM-DD'
    const dateStr = formatter.format(instant);
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  /**
   * Formats any Date object into the property's local calendar string 'YYYY-MM-DD'.
   */
  public formatToPropertyDateString(date: Date, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  }

  /**
   * Adds calendar days to a UTC-midnight Date object.
   */
  public addDays(date: Date, days: number): Date {
    const result = new Date(date.getTime());
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  /**
   * Calculates difference in calendar days between two UTC-midnight dates (endDate - startDate).
   */
  public differenceInCalendarDays(endDate: Date, startDate: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
  }
}
