import {
  Controller,
  Get,
  Post,
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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { HotelGroupService } from '../../application/services/hotel-group.service';
import { CreateHotelGroupDto } from '../dto/create-hotel-group.dto';
import { UpdateHotelGroupDto } from '../dto/update-hotel-group.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { HotelGroupDto, ApiSuccessResponse } from '@hms/api-contracts';

@ApiTags('Organization - Hotel Groups')
@Controller('v1/organization/groups')
export class HotelGroupController {
  constructor(private readonly service: HotelGroupService) {}

  @Get()
  @ApiOperation({ summary: 'List all hotel groups' })
  @ApiResponse({ status: 200, description: 'List of hotel groups returned successfully' })
  async findAll(
    @Query('includeDeleted') includeDeleted?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<HotelGroupDto[]>> {
    const data = await this.service.findAll(includeDeleted === 'true');
    return createApiResponse(data, req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a hotel group by ID' })
  @ApiResponse({ status: 200, description: 'Hotel group found' })
  @ApiResponse({ status: 404, description: 'Hotel group not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<HotelGroupDto>> {
    const data = await this.service.findById(id);
    return createApiResponse(data, req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new hotel group' })
  @ApiResponse({ status: 201, description: 'Hotel group created successfully' })
  @ApiResponse({ status: 409, description: 'Hotel group code already exists' })
  async create(
    @Body() dto: CreateHotelGroupDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<HotelGroupDto>> {
    const data = await this.service.create(dto, {
      correlationId: req?.correlationId,
    });
    return createApiResponse(data, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a hotel group' })
  @ApiResponse({ status: 200, description: 'Hotel group updated successfully' })
  @ApiResponse({ status: 404, description: 'Hotel group not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHotelGroupDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<HotelGroupDto>> {
    const data = await this.service.update(id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a hotel group' })
  @ApiResponse({ status: 200, description: 'Hotel group soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Hotel group not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete group with active child regions' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<HotelGroupDto>> {
    const data = await this.service.delete(id);
    return createApiResponse(data, req);
  }
}
