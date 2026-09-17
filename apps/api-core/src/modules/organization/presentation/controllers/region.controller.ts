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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { RegionService } from '../../application/services/region.service';
import { CreateRegionDto } from '../dto/create-region.dto';
import { UpdateRegionDto } from '../dto/update-region.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { RegionDto, ApiSuccessResponse } from '@hms/api-contracts';

@ApiTags('Organization - Regions')
@Controller('v1/organization/regions')
export class RegionController {
  constructor(private readonly service: RegionService) {}

  @Get()
  @ApiOperation({ summary: 'List regions (optionally filtered by hotelGroupId)' })
  @ApiQuery({
    name: 'hotelGroupId',
    required: false,
    description: 'Filter by parent Hotel Group ID',
  })
  @ApiQuery({ name: 'includeDeleted', required: false })
  @ApiResponse({ status: 200, description: 'List of regions returned successfully' })
  async findAll(
    @Query('hotelGroupId') hotelGroupId?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RegionDto[]>> {
    const data = await this.service.findAll(hotelGroupId, includeDeleted === 'true');
    return createApiResponse(data, req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a region by ID' })
  @ApiResponse({ status: 200, description: 'Region found' })
  @ApiResponse({ status: 404, description: 'Region not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RegionDto>> {
    const data = await this.service.findById(id);
    return createApiResponse(data, req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new region under a hotel group' })
  @ApiResponse({ status: 201, description: 'Region created successfully' })
  @ApiResponse({ status: 404, description: 'Parent hotel group not found' })
  @ApiResponse({ status: 409, description: 'Region code already exists under hotel group' })
  async create(
    @Body() dto: CreateRegionDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RegionDto>> {
    const data = await this.service.create(dto, {
      correlationId: req?.correlationId,
    });
    return createApiResponse(data, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a region' })
  @ApiResponse({ status: 200, description: 'Region updated successfully' })
  @ApiResponse({ status: 404, description: 'Region not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegionDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RegionDto>> {
    const data = await this.service.update(id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a region' })
  @ApiResponse({ status: 200, description: 'Region soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Region not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete region with active child countries' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<RegionDto>> {
    const data = await this.service.delete(id);
    return createApiResponse(data, req);
  }
}
