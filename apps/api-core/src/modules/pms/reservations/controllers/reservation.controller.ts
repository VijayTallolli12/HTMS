import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { ReservationService } from '../services/reservation.service';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { CancelReservationDto } from '../dto/cancel-reservation.dto';
import { QueryReservationsDto } from '../dto/query-reservations.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { ReservationDto, ApiSuccessResponse } from '@hms/api-contracts';
import {
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('PMS - Reservations')
@Controller('properties/:propertyId/pms/reservations')
@RequirePropertyContext()
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('front_office.reservation.create')
  @ApiOperation({ summary: 'Create new reservation with atomic inventory booking' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Unique client request token for idempotent reservation creation',
  })
  @ApiResponse({ status: 201, description: 'Reservation created successfully' })
  @ApiResponse({ status: 400, description: 'Validation or stay date error' })
  @ApiResponse({ status: 404, description: 'Room type or rate plan not found' })
  @ApiResponse({ status: 409, description: 'Inventory conflict or restriction failure' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateReservationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ReservationDto>> {
    const data = await this.reservationService.create(propertyId, dto, idempotencyKey);
    return createApiResponse(data, req);
  }

  @Get()
  @RequirePermissions('front_office.reservation.read')
  @ApiOperation({ summary: 'List reservations with property-scoped filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Reservations returned successfully' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryReservationsDto,
    @Req() req?: Request,
  ): Promise<
    ApiSuccessResponse<{ items: ReservationDto[]; total: number; page: number; limit: number }>
  > {
    const data = await this.reservationService.findAll(propertyId, query);
    return createApiResponse(data, req);
  }

  @Get(':id')
  @RequirePermissions('front_office.reservation.read')
  @ApiOperation({ summary: 'Get reservation details with nightly rate breakdown' })
  @ApiResponse({ status: 200, description: 'Reservation details returned' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async findById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ReservationDto>> {
    const data = await this.reservationService.findById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('front_office.reservation.cancel')
  @ApiOperation({ summary: 'Cancel confirmed reservation and release inventory' })
  @ApiResponse({ status: 200, description: 'Reservation cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  @ApiResponse({
    status: 409,
    description: 'Reservation already cancelled or not in CONFIRMED status',
  })
  async cancel(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ReservationDto>> {
    const data = await this.reservationService.cancel(propertyId, id, dto);
    return createApiResponse(data, req);
  }
}
