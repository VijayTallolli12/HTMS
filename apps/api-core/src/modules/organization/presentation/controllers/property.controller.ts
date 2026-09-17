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
import { PropertyService } from '../../application/services/property.service';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { PropertyDto, ApiSuccessResponse } from '@hms/api-contracts';

@ApiTags('Organization - Properties')
@Controller('v1/organization/properties')
export class PropertyController {
  constructor(private readonly service: PropertyService) {}

  @Get()
  @ApiOperation({ summary: 'List properties (with optional countryId or status filters)' })
  @ApiQuery({ name: 'countryId', required: false, description: 'Filter by parent Country ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'includeDeleted', required: false })
  @ApiResponse({ status: 200, description: 'List of properties returned successfully' })
  async findAll(
    @Query('countryId') countryId?: string,
    @Query('status') status?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PropertyDto[]>> {
    const data = await this.service.findAll({
      countryId,
      status,
      includeDeleted: includeDeleted === 'true',
    });
    return createApiResponse(data, req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a property by ID' })
  @ApiResponse({ status: 200, description: 'Property found' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PropertyDto>> {
    const data = await this.service.findById(id);
    return createApiResponse(data, req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new hotel/resort property' })
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid timezone or currency' })
  @ApiResponse({ status: 404, description: 'Parent country not found' })
  @ApiResponse({ status: 409, description: 'Property code already exists' })
  async create(
    @Body() dto: CreatePropertyDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PropertyDto>> {
    const data = await this.service.create(dto, {
      correlationId: req?.correlationId,
    });
    return createApiResponse(data, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a property' })
  @ApiResponse({ status: 200, description: 'Property updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid timezone or currency' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PropertyDto>> {
    const data = await this.service.update(id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a property' })
  @ApiResponse({ status: 200, description: 'Property soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete property with active child buildings' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<PropertyDto>> {
    const data = await this.service.delete(id);
    return createApiResponse(data, req);
  }
}
