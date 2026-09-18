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
import { RoomService } from '../services/room.service';
import { CreateRoomDto } from '../dto/create-room.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { RoomDto, ApiSuccessResponse } from '@hms/api-contracts';
import {
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('PMS - Physical Rooms')
@Controller('properties/:propertyId/pms/rooms')
@RequirePropertyContext()
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('room:create')
  @ApiOperation({ summary: 'Create physical room (syncs future daily inventory)' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 400, description: 'Hierarchy validation error' })
  @ApiResponse({ status: 404, description: 'Parent entity not found' })
  @ApiResponse({ status: 409, description: 'Room number already exists' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateRoomDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomDto>> {
    const data = await this.roomService.create(propertyId, dto);
    return createApiResponse(data, req);
  }

  @Get()
  @RequirePermissions('room:read')
  @ApiOperation({ summary: 'List physical rooms (filtered by building, floor, roomType)' })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'floorId', required: false })
  @ApiQuery({ name: 'roomTypeId', required: false })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Rooms returned successfully' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('buildingId') buildingId?: string,
    @Query('floorId') floorId?: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('activeOnly') activeOnly?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomDto[]>> {
    const data = await this.roomService.findAll(propertyId, {
      buildingId,
      floorId,
      roomTypeId,
      activeOnly: activeOnly === 'true',
    });
    return createApiResponse(data, req);
  }

  @Get(':id')
  @RequirePermissions('room:read')
  @ApiOperation({ summary: 'Get physical room by ID' })
  @ApiResponse({ status: 200, description: 'Room found' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomDto>> {
    const data = await this.roomService.findById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Put(':id')
  @RequirePermissions('room:update')
  @ApiOperation({ summary: 'Update physical room (handles atomic RoomType reassignment)' })
  @ApiResponse({ status: 200, description: 'Room updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation or hierarchy error' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 409, description: 'Room deactivation or reassignment rejected' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomDto>> {
    const data = await this.roomService.update(propertyId, id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id')
  @RequirePermissions('room:delete')
  @ApiOperation({ summary: 'Soft-delete physical room (via decoupled deactivation validator)' })
  @ApiResponse({ status: 200, description: 'Room soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 409, description: 'Deletion rejected by validator' })
  async delete(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RoomDto>> {
    const data = await this.roomService.delete(propertyId, id);
    return createApiResponse(data, req);
  }
}
