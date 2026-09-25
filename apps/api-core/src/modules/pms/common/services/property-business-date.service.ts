import { Inject, Injectable, Optional } from '@nestjs/common';
import { Clock, CLOCK_TOKEN } from '../contracts/clock.interface';
import { PrismaService } from '../../../../common/database/prisma.service';

@Injectable()
export class PropertyBusinessDateService {
  constructor(
    @Inject(CLOCK_TOKEN) private readonly clock: Clock,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

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
   * Formats Date to UTC ISO date string 'YYYY-MM-DD'.
   */
  public formatDateToIsoString(date: Date): string {
    return date.toISOString().split('T')[0];
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

  /**
   * Authoritative lookup of the current hotel business date for a property.
   * Checks the persisted PropertyBusinessDate record. If uninitialized, seeds it using
   * the property's timezone and clock.
   */
  public async getBusinessDate(propertyId: string, tx?: any): Promise<Date> {
    const client = tx || this.prisma;
    if (!client) {
      return this.getCurrentBusinessDate('UTC');
    }

    const record = await client.propertyBusinessDate.findUnique({
      where: { propertyId },
    });

    if (record) {
      return record.currentBusinessDate;
    }

    // Initialize if not present
    const property = await client.property.findUnique({
      where: { id: propertyId },
      select: { timeZone: true },
    });

    const timeZone = property?.timeZone || 'UTC';
    const initialDate = this.getCurrentBusinessDate(timeZone);

    try {
      const created = await client.propertyBusinessDate.create({
        data: {
          propertyId,
          currentBusinessDate: initialDate,
          isAuditInProgress: false,
        },
      });
      return created.currentBusinessDate;
    } catch {
      // In case of concurrent creation race, re-fetch
      const existing = await client.propertyBusinessDate.findUnique({
        where: { propertyId },
      });
      return existing?.currentBusinessDate || initialDate;
    }
  }

  /**
   * Authoritative string representation ('YYYY-MM-DD') of the hotel business date.
   */
  public async getBusinessDateString(propertyId: string, tx?: any): Promise<string> {
    const date = await this.getBusinessDate(propertyId, tx);
    return this.formatDateToIsoString(date);
  }

  /**
   * Fetch full state record of PropertyBusinessDate with property timeZone.
   */
  public async getBusinessDateState(propertyId: string, tx?: any) {
    const client = tx || this.prisma;
    if (!client) {
      return null;
    }

    let record = await client.propertyBusinessDate.findUnique({
      where: { propertyId },
      include: {
        property: {
          select: { timeZone: true },
        },
      },
    });

    if (!record) {
      await this.getBusinessDate(propertyId, client);
      record = await client.propertyBusinessDate.findUnique({
        where: { propertyId },
        include: {
          property: {
            select: { timeZone: true },
          },
        },
      });
    }

    return record;
  }

  /**
   * Ensure property business date is seeded and active.
   */
  public async ensureBusinessDate(propertyId: string, tx?: any) {
    return this.getBusinessDateState(propertyId, tx);
  }
}
