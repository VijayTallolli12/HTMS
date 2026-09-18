import {
  Controller,
  Get,
  Post,
  Put,
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
import { RoomTypeService } from '../services/room-type.service';
import { CreateRoomTypeDto } from '../dto/create-room-type.dto';
import { UpdateRoomTypeDto } from '../dto/update-room-type.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { RoomTypeDto, ApiSuccessResponse } from '@hms/api-contracts';
import {
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('PMS - Room Types')
@Controller('properties/:propertyId/pms/room-types')
@RequirePropertyContext()
export class RoomTypeController {
  constructor(private readonly roomTypeService: RoomTypeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('room-type:create')
  @ApiOperation({ summary: 'Create a new room type (initializes 365d inventory)' })
  @ApiResponse({ status: 201, description: 'Room type created successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({ status: 409, description: 'Room type code already exists' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateRoomTypeDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomTypeDto>> {
    const data = await this.roomTypeService.create(propertyId, dto);
    return createApiResponse(data, req);
  }

  @Get()
  @RequirePermissions('room-type:read')
  @ApiOperation({ summary: 'List room types for property' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Room types returned successfully' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('includeInactive') includeInactive?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomTypeDto[]>> {
    const data = await this.roomTypeService.findAll(propertyId, includeInactive === 'true');
    return createApiResponse(data, req);
  }

  @Get(':id')
  @RequirePermissions('room-type:read')
  @ApiOperation({ summary: 'Get room type by ID' })
  @ApiResponse({ status: 200, description: 'Room type found' })
  @ApiResponse({ status: 404, description: 'Room type not found' })
  async findById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomTypeDto>> {
    const data = await this.roomTypeService.findById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Put(':id')
  @RequirePermissions('room-type:update')
  @ApiOperation({ summary: 'Update room type' })
  @ApiResponse({ status: 200, description: 'Room type updated successfully' })
  @ApiResponse({ status: 404, description: 'Room type not found' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomTypeDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomTypeDto>> {
    const data = await this.roomTypeService.update(propertyId, id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id')
  @RequirePermissions('room-type:delete')
  @ApiOperation({ summary: 'Soft-delete room type (via decoupled deletion validator)' })
  @ApiResponse({ status: 200, description: 'Room type soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Room type not found' })
  @ApiResponse({ status: 409, description: 'Deletion prevented by validator' })
  async delete(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomTypeDto>> {
    const data = await this.roomTypeService.delete(propertyId, id);
    return createApiResponse(data, req);
  }
}
