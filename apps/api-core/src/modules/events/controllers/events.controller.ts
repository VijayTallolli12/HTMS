import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventsCatalogService } from '../services/events-catalog.service';
import { EventsBookingService } from '../services/events-booking.service';
import { createApiResponse } from '../../../common/utils/api-response.util';
import {
  ApiSuccessResponse,
  EventVenueDto,
  EventPackageDto,
  EventResourceDto,
  EventBookingDto,
  SecurityContext,
} from '@hms/api-contracts';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../identity/presentation/decorators/authz.decorators';
import {
  CreateEventVenueDto,
  UpdateEventVenueDto,
  CreateEventPackageDto,
  UpdateEventPackageDto,
  CreateEventResourceDto,
  UpdateEventResourceDto,
  CreateEventBookingDto,
  UpdateEventBookingStatusDto,
  CompleteEventBookingDto,
  QueryEventBookingsDto,
  AllocateResourcesDto,
} from '../dto/events.dto';

@ApiTags('Events & Banquets')
@Controller('properties/:propertyId/events')
@RequirePropertyContext()
export class EventsController {
  constructor(
    private readonly catalogService: EventsCatalogService,
    private readonly bookingService: EventsBookingService,
  ) {}

  // ----------------------------------------------------------------------
  // Venues
  // ----------------------------------------------------------------------
  @Get('venues')
  @RequirePermissions('events.venue.view')
  @ApiOperation({ summary: 'List banquet venues for property' })
  @ApiResponse({ status: 200, description: 'List of event venues' })
  async getVenues(
    @Param('propertyId') propertyId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<ApiSuccessResponse<EventVenueDto[]>> {
    const venues = await this.catalogService.getVenues(
      propertyId,
      includeInactive,
    );
    return createApiResponse(venues);
  }

  @Get('venues/:id')
  @RequirePermissions('events.venue.view')
  @ApiOperation({ summary: 'Get banquet venue details' })
  async getVenue(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<EventVenueDto>> {
    const venue = await this.catalogService.getVenue(propertyId, id);
    return createApiResponse(venue);
  }

  @Post('venues')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('events.venue.manage')
  @ApiOperation({ summary: 'Create new banquet venue' })
  async createVenue(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateEventVenueDto,
  ): Promise<ApiSuccessResponse<EventVenueDto>> {
    const venue = await this.catalogService.createVenue(propertyId, dto);
    return createApiResponse(venue);
  }

  @Patch('venues/:id')
  @RequirePermissions('events.venue.manage')
  @ApiOperation({ summary: 'Update banquet venue' })
  async updateVenue(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEventVenueDto,
  ): Promise<ApiSuccessResponse<EventVenueDto>> {
    const venue = await this.catalogService.updateVenue(propertyId, id, dto);
    return createApiResponse(venue);
  }

  // ----------------------------------------------------------------------
  // Packages
  // ----------------------------------------------------------------------
  @Get('packages')
  @RequirePermissions('events.package.view')
  @ApiOperation({ summary: 'List catering & banquet packages' })
  async getPackages(
    @Param('propertyId') propertyId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<ApiSuccessResponse<EventPackageDto[]>> {
    const packages = await this.catalogService.getPackages(
      propertyId,
      includeInactive,
    );
    return createApiResponse(packages);
  }

  @Get('packages/:id')
  @RequirePermissions('events.package.view')
  @ApiOperation({ summary: 'Get catering package details' })
  async getPackage(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<EventPackageDto>> {
    const pkg = await this.catalogService.getPackage(propertyId, id);
    return createApiResponse(pkg);
  }

  @Post('packages')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('events.package.manage')
  @ApiOperation({ summary: 'Create event package' })
  async createPackage(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateEventPackageDto,
  ): Promise<ApiSuccessResponse<EventPackageDto>> {
    const pkg = await this.catalogService.createPackage(propertyId, dto);
    return createApiResponse(pkg);
  }

  @Patch('packages/:id')
  @RequirePermissions('events.package.manage')
  @ApiOperation({ summary: 'Update event package' })
  async updatePackage(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEventPackageDto,
  ): Promise<ApiSuccessResponse<EventPackageDto>> {
    const pkg = await this.catalogService.updatePackage(propertyId, id, dto);
    return createApiResponse(pkg);
  }

  // ----------------------------------------------------------------------
  // Resources
  // ----------------------------------------------------------------------
  @Get('resources')
  @RequirePermissions('events.venue.view')
  @ApiOperation({ summary: 'List event resources & equipment' })
  async getResources(
    @Param('propertyId') propertyId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<ApiSuccessResponse<EventResourceDto[]>> {
    const resources = await this.catalogService.getResources(
      propertyId,
      includeInactive,
    );
    return createApiResponse(resources);
  }

  @Get('resources/:id')
  @RequirePermissions('events.venue.view')
  @ApiOperation({ summary: 'Get event resource details' })
  async getResource(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<EventResourceDto>> {
    const res = await this.catalogService.getResource(propertyId, id);
    return createApiResponse(res);
  }

  @Post('resources')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('events.venue.manage')
  @ApiOperation({ summary: 'Create event resource' })
  async createResource(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateEventResourceDto,
  ): Promise<ApiSuccessResponse<EventResourceDto>> {
    const res = await this.catalogService.createResource(propertyId, dto);
    return createApiResponse(res);
  }

  @Patch('resources/:id')
  @RequirePermissions('events.venue.manage')
  @ApiOperation({ summary: 'Update event resource' })
  async updateResource(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEventResourceDto,
  ): Promise<ApiSuccessResponse<EventResourceDto>> {
    const res = await this.catalogService.updateResource(propertyId, id, dto);
    return createApiResponse(res);
  }

  // ----------------------------------------------------------------------
  // Bookings
  // ----------------------------------------------------------------------
  @Get('bookings')
  @RequirePermissions('events.booking.view')
  @ApiOperation({ summary: 'List event bookings' })
  async getBookings(
    @Param('propertyId') propertyId: string,
    @Query() query: QueryEventBookingsDto,
  ): Promise<ApiSuccessResponse<EventBookingDto[]>> {
    const bookings = await this.bookingService.getBookings(propertyId, query);
    return createApiResponse(bookings);
  }

  @Get('bookings/:id')
  @RequirePermissions('events.booking.view')
  @ApiOperation({ summary: 'Get event booking details' })
  async getBooking(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<EventBookingDto>> {
    const booking = await this.bookingService.getBooking(propertyId, id);
    return createApiResponse(booking);
  }

  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('events.booking.create')
  @ApiOperation({ summary: 'Create event booking' })
  async createBooking(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateEventBookingDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<ApiSuccessResponse<EventBookingDto>> {
    const booking = await this.bookingService.createBooking(
      propertyId,
      dto,
      actor.userId,
    );
    return createApiResponse(booking);
  }

  @Patch('bookings/:id/status')
  @RequirePermissions('events.booking.manage')
  @ApiOperation({ summary: 'Transition event booking status' })
  async updateBookingStatus(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEventBookingStatusDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<ApiSuccessResponse<EventBookingDto>> {
    const booking = await this.bookingService.updateBookingStatus(
      propertyId,
      id,
      dto,
      actor.userId,
    );
    return createApiResponse(booking);
  }

  @Post('bookings/:id/resources')
  @RequirePermissions('events.booking.manage')
  @ApiOperation({ summary: 'Allocate equipment and resources to event booking' })
  async allocateResources(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: AllocateResourcesDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<ApiSuccessResponse<EventBookingDto>> {
    const booking = await this.bookingService.allocateResources(
      propertyId,
      id,
      dto,
      actor.userId,
    );
    return createApiResponse(booking);
  }

  @Post('bookings/:id/complete')
  @RequirePermissions('events.booking.complete')
  @ApiOperation({ summary: 'Complete event execution and post charges to folio' })
  async completeBooking(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: CompleteEventBookingDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<ApiSuccessResponse<EventBookingDto>> {
    const booking = await this.bookingService.completeBooking(
      propertyId,
      id,
      dto,
      actor,
    );
    return createApiResponse(booking);
  }

  // ----------------------------------------------------------------------
  // In-House Guests Lookup Helper
  // ----------------------------------------------------------------------
  @Get('in-house-guests')
  @RequirePermissions('events.booking.view')
  @ApiOperation({ summary: 'Lookup active checked-in hotel guests for room billing' })
  async getInHouseGuests(
    @Param('propertyId') propertyId: string,
  ): Promise<ApiSuccessResponse<Array<{
    reservationId: string;
    confirmationNumber: string;
    roomNumber: string;
    guestName: string;
    folioId: string | null;
  }>>> {
    const guests = await this.bookingService.getInHouseGuests(propertyId);
    return createApiResponse(guests);
  }
}

