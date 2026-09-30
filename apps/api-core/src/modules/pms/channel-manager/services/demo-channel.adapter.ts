import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ChannelAdapter,
  ChannelAvailabilityDto,
  ChannelRateDto,
  OtaReservationDto,
} from '@hms/api-contracts';

/**
 * Local deterministic adapter used only by the HMS demo. It never performs HTTP
 * requests and must not be presented as a live Booking.com/Airbnb/Expedia link.
 */
@Injectable()
export class DemoChannelAdapter implements ChannelAdapter {
  readonly provider = 'DEMO' as const;
  readonly demoOnly = true as const;

  normalizeInbound(rawData: any): OtaReservationDto {
    if (!rawData || typeof rawData !== 'object') {
      throw new BadRequestException('Demo reservation payload must be an object');
    }

    const externalId = String(rawData.externalId || '').trim();
    const firstName = String(rawData.guest?.firstName || '').trim();
    const lastName = String(rawData.guest?.lastName || '').trim();
    const arrivalDate = String(rawData.arrivalDate || '').slice(0, 10);
    const departureDate = String(rawData.departureDate || '').slice(0, 10);
    const adults = Number(rawData.adults ?? 1);
    const children = Number(rawData.children ?? 0);
    const currency = String(rawData.currency || 'USD').toUpperCase();
    if (rawData.status !== undefined && rawData.status !== 'CONFIRMED') {
      throw new BadRequestException('The DEMO adapter only ingests CONFIRMED reservations; cancellation and status updates are unsupported');
    }

    if (!externalId || externalId.length > 100) {
      throw new BadRequestException('A demo external reservation ID (max 100 characters) is required');
    }
    if (!firstName || !lastName || firstName.length > 50 || lastName.length > 50) {
      throw new BadRequestException('Guest first and last names are required and limited to 50 characters');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
      throw new BadRequestException('Arrival and departure dates must use YYYY-MM-DD');
    }
    if ([arrivalDate, departureDate].some((date) => {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      return !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date;
    })) {
      throw new BadRequestException('Arrival and departure dates must be valid calendar dates');
    }
    if (arrivalDate >= departureDate) {
      throw new BadRequestException('Departure date must be after arrival date');
    }
    if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0) {
      throw new BadRequestException('Guest counts are invalid');
    }

    const amount = Number(rawData.totalAmount ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Reservation total must be a non-negative number');
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('Reservation currency must be an ISO 4217 three-letter code');
    }
    if (rawData.guest?.email && String(rawData.guest.email).length > 100) throw new BadRequestException('Guest email must be at most 100 characters');
    if (rawData.guest?.phone && String(rawData.guest.phone).length > 30) throw new BadRequestException('Guest phone must be at most 30 characters');

    return {
      externalId,
      provider: 'DEMO',
      propertyId: '', // Set from the property-scoped channel configuration by the service.
      status: 'CONFIRMED',
      guest: {
        firstName,
        lastName,
        ...(rawData.guest?.email ? { email: String(rawData.guest.email) } : {}),
        ...(rawData.guest?.phone ? { phone: String(rawData.guest.phone) } : {}),
      },
      arrivalDate,
      departureDate,
      adults,
      children,
      roomTypeCode: String(rawData.roomTypeCode || '').trim(),
      ratePlanCode: String(rawData.ratePlanCode || '').trim(),
      totalAmount: amount,
      currency,
      ...(rawData.specialRequests ? { specialRequests: String(rawData.specialRequests) } : {}),
      createdAt: String(rawData.createdAt || `${arrivalDate}T00:00:00.000Z`),
      updatedAt: String(rawData.updatedAt || rawData.createdAt || `${arrivalDate}T00:00:00.000Z`),
    };
  }

  buildOutbound(reservation: any): any {
    return { demoOnly: true, reservation };
  }

  buildAvailabilityPayload(data: ChannelAvailabilityDto[]): any {
    return { demoOnly: true, records: data };
  }

  buildRatePayload(data: ChannelRateDto[]): any {
    return { demoOnly: true, records: data };
  }

  async simulateAvailabilityRateDelivery(
    availabilityPayload: any,
    ratePayload: any,
    attempt: number,
    simulateTransientFailure = false,
    simulatePermanentFailure = false,
  ): Promise<{ processed: number; failed: number }> {
    // Failure modes are explicit UI demo scenarios. There is no network/provider call.
    if (simulatePermanentFailure) {
      throw new Error(`DEMO persistent delivery failure (simulated attempt ${attempt})`);
    }
    if (simulateTransientFailure && attempt === 1) {
      throw new Error('DEMO transient delivery failure (simulated)');
    }
    return {
      processed: (availabilityPayload.records?.length || 0) + (ratePayload.records?.length || 0),
      failed: 0,
    };
  }

  parseResponse(response: any): { success: boolean; externalId?: string; error?: string } {
    return response?.success === false
      ? { success: false, error: String(response.error || 'Demo adapter rejected the payload') }
      : { success: true, ...(response?.externalId ? { externalId: String(response.externalId) } : {}) };
  }

  getHealthCheckPayload(): any {
    return { demoOnly: true, provider: 'DEMO', status: 'DEMO_CONNECTED' };
  }
}
