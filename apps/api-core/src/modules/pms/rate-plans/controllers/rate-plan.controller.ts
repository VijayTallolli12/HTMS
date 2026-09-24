import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { RatePlanService } from '../services/rate-plan.service';
import { CreateRatePlanDto } from '../dto/create-rate-plan.dto';
import { UpdateRatePlanDto } from '../dto/update-rate-plan.dto';
import { UpdateRatePlanRoomTypeDto } from '../dto/update-rate-plan-room-type.dto';
import { SetDailyRateOverrideDto } from '../dto/set-daily-rate-override.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  RatePlanDto,
  RatePlanRoomTypeDto,
  DailyRateDto,
  ApiSuccessResponse,
} from '@hms/api-contracts';
import {
  RequireAnyPermission,
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('PMS - Rate Plans')
@Controller('properties/:propertyId/pms/rate-plans')
@RequirePropertyContext()
export class RatePlanController {
  constructor(private readonly ratePlanService: RatePlanService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireAnyPermission('room-type:create', 'rate-plan:create')
  @ApiOperation({ summary: 'Create a new rate plan with room type bindings' })
  @ApiResponse({ status: 201, description: 'Rate plan created successfully' })
  @ApiResponse({ status: 400, description: 'Currency mismatch or invalid parameters' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({ status: 409, description: 'Rate plan code already exists' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateRatePlanDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RatePlanDto>> {
    const data = await this.ratePlanService.create(propertyId, dto);
    return createApiResponse(data, req);
  }

  @Get()
  @RequireAnyPermission('room-type:read', 'front_office.reservation.read', 'front_office.reservation.create', 'rate-plan:read')
  @ApiOperation({ summary: 'List rate plans for property' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Rate plans returned successfully' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('includeInactive') includeInactive?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RatePlanDto[]>> {
    const data = await this.ratePlanService.findAll(propertyId, includeInactive === 'true');
    return createApiResponse(data, req);
  }

  @Get(':id')
  @RequireAnyPermission('room-type:read', 'front_office.reservation.read', 'front_office.reservation.create', 'rate-plan:read')
  @ApiOperation({ summary: 'Get rate plan by ID' })
  @ApiResponse({ status: 200, description: 'Rate plan found' })
  @ApiResponse({ status: 404, description: 'Rate plan not found' })
  async findById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RatePlanDto>> {
    const data = await this.ratePlanService.findById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Put(':id')
  @RequireAnyPermission('room-type:update', 'rate-plan:update')
  @ApiOperation({ summary: 'Update rate plan' })
  @ApiResponse({ status: 200, description: 'Rate plan updated successfully' })
  @ApiResponse({ status: 404, description: 'Rate plan not found' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRatePlanDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RatePlanDto>> {
    const data = await this.ratePlanService.update(propertyId, id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id')
  @RequireAnyPermission('room-type:delete', 'rate-plan:delete')
  @ApiOperation({ summary: 'Soft-delete rate plan (via decoupled deletion validator)' })
  @ApiResponse({ status: 200, description: 'Rate plan soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Rate plan not found' })
  @ApiResponse({ status: 409, description: 'Deletion rejected by validator' })
  async delete(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RatePlanDto>> {
    const data = await this.ratePlanService.delete(propertyId, id);
    return createApiResponse(data, req);
  }

  @Patch(':id/room-types/:roomTypeId')
  @RequireAnyPermission('room-type:update', 'rate-plan:update')
  @ApiOperation({ summary: 'Update or deactivate RatePlanRoomType mapping' })
  @ApiResponse({ status: 200, description: 'Mapping updated successfully' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async updateRoomTypeMapping(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) ratePlanId: string,
    @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string,
    @Body() dto: UpdateRatePlanRoomTypeDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RatePlanRoomTypeDto>> {
    const data = await this.ratePlanService.updateRoomTypeMapping(
      propertyId,
      ratePlanId,
      roomTypeId,
      dto,
    );
    return createApiResponse(data, req);
  }
}

@ApiTags('PMS - Daily Rate Overrides')
@Controller('properties/:propertyId/pms/daily-rates')
@RequirePropertyContext()
export class DailyRateController {
  constructor(private readonly ratePlanService: RatePlanService) {}

  @Post('overrides')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('room-type:update', 'rate-plan:update')
  @ApiOperation({ summary: 'Set daily rate or restriction override' })
  @ApiResponse({ status: 200, description: 'Override saved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid business date or parameters' })
  @ApiResponse({ status: 404, description: 'Rate plan not found' })
  async setOverride(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: SetDailyRateOverrideDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<DailyRateDto>> {
    const data = await this.ratePlanService.setDailyRateOverride(propertyId, dto);
    return createApiResponse(data, req);
  }
}
