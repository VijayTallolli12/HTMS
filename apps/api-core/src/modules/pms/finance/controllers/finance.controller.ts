import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { FolioService } from '../services/folio.service';
import { CheckoutService } from '../services/checkout.service';
import { CreateFolioDto } from '../dto/create-folio.dto';
import { PostChargeDto } from '../dto/post-charge.dto';
import { RecordPaymentDto } from '../dto/record-payment.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  ApiSuccessResponse,
  CheckoutResponseDto,
  FolioDetailDto,
  FolioDto,
  FolioTransactionDto,
  PaymentDto,
  SecurityContext,
} from '@hms/api-contracts';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('PMS - Finance & Cashiering')
@Controller('properties/:propertyId/pms/finance')
@RequirePropertyContext()
export class FinanceController {
  constructor(
    private readonly folioService: FolioService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Post('folios')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('folio:post_charge')
  @ApiOperation({ summary: 'Create a new billing folio for a checked-in reservation' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Mandatory client token for idempotent folio creation',
  })
  @ApiResponse({
    status: 201,
    description: 'Folio created successfully or returned from idempotent key',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing idempotency key, invalid DTO, or reservation not CHECKED_IN',
  })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  @ApiResponse({ status: 409, description: 'Idempotency key reused for different entity' })
  async createFolio(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateFolioDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FolioDto>> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for creating a folio',
      });
    }
    const data = await this.folioService.createFolio(propertyId, dto, actor, idempotencyKey);
    return createApiResponse(data, req);
  }

  @Get('folios')
  @RequirePermissions('folio:view')
  @ApiOperation({ summary: 'List all folios for a reservation' })
  @ApiResponse({ status: 200, description: 'Folios retrieved successfully' })
  async getFolios(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('reservationId', ParseUUIDPipe) reservationId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FolioDto[]>> {
    const data = await this.folioService.findByReservation(propertyId, reservationId);
    return createApiResponse(data, req);
  }

  @Get('folios/:folioId')
  @RequirePermissions('folio:view')
  @ApiOperation({ summary: 'Get full folio details including transactions and payments' })
  @ApiResponse({ status: 200, description: 'Folio detail retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Folio not found' })
  async getFolioById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('folioId', ParseUUIDPipe) folioId: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FolioDetailDto>> {
    const data = await this.folioService.findById(propertyId, folioId);
    return createApiResponse(data, req);
  }

  @Post('folios/:folioId/charges')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('folio:post_charge')
  @ApiOperation({ summary: 'Post an immutable debit charge or credit adjustment to a folio' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Mandatory client token for idempotent charge posting',
  })
  @ApiResponse({
    status: 201,
    description: 'Charge posted successfully or returned from idempotent key',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing idempotency key, invalid amount, or missing credit reasonCode',
  })
  @ApiResponse({ status: 404, description: 'Folio not found' })
  @ApiResponse({ status: 409, description: 'Folio closed, OCC conflict, or idempotency mismatch' })
  async postCharge(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('folioId', ParseUUIDPipe) folioId: string,
    @Body() dto: PostChargeDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FolioTransactionDto>> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for posting a charge',
      });
    }
    const data = await this.folioService.postCharge(
      propertyId,
      folioId,
      dto,
      actor,
      idempotencyKey,
    );
    return createApiResponse(data, req);
  }

  @Post('folios/:folioId/payments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('folio:post_payment')
  @ApiOperation({ summary: 'Record an immutable payment against an open folio' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Mandatory client token for idempotent payment recording',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment recorded successfully or returned from idempotent key',
  })
  @ApiResponse({ status: 400, description: 'Missing idempotency key or non-positive amount' })
  @ApiResponse({ status: 404, description: 'Folio not found' })
  @ApiResponse({ status: 409, description: 'Folio closed, OCC conflict, or idempotency mismatch' })
  async recordPayment(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('folioId', ParseUUIDPipe) folioId: string,
    @Body() dto: RecordPaymentDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PaymentDto>> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for recording a payment',
      });
    }
    const data = await this.folioService.recordPayment(
      propertyId,
      folioId,
      dto,
      actor,
      idempotencyKey,
    );
    return createApiResponse(data, req);
  }

  @Post('reservations/:reservationId/checkout')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('frontdesk:checkout')
  @ApiOperation({ summary: 'Execute departure checkout with strict zero-balance validation' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Mandatory client token for idempotent checkout execution',
  })
  @ApiResponse({
    status: 200,
    description: 'Checkout completed successfully or returned from idempotent key',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing idempotency key, reservation not CHECKED_IN, or room not assigned',
  })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  @ApiResponse({
    status: 409,
    description: 'Non-zero folio balance, OCC conflict, or idempotency mismatch',
  })
  async checkout(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentSecurityContext() actor: SecurityContext,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<CheckoutResponseDto>> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for processing checkout',
      });
    }
    const data = await this.checkoutService.checkout(
      propertyId,
      reservationId,
      actor,
      idempotencyKey,
    );
    return createApiResponse(data, req);
  }
}
