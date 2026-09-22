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
import { BuildingService } from '../../application/services/building.service';
import { CreateBuildingDto } from '../dto/create-building.dto';
import { UpdateBuildingDto } from '../dto/update-building.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { BuildingDto, ApiSuccessResponse } from '@hms/api-contracts';
import { Authenticated } from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('Organization - Buildings')
@Controller('v1/organization/buildings')
export class BuildingController {
  constructor(private readonly service: BuildingService) {}

  @Get()
  @Authenticated()
  @ApiOperation({ summary: 'List buildings (optionally filtered by propertyId)' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Filter by parent Property ID' })
  @ApiQuery({ name: 'includeDeleted', required: false })
  @ApiResponse({ status: 200, description: 'List of buildings returned successfully' })
  async findAll(
    @Query('propertyId') propertyId?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<BuildingDto[]>> {
    const data = await this.service.findAll(propertyId, includeDeleted === 'true');
    return createApiResponse(data, req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a building by ID' })
  @ApiResponse({ status: 200, description: 'Building found' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<BuildingDto>> {
    const data = await this.service.findById(id);
    return createApiResponse(data, req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new building under a property' })
  @ApiResponse({ status: 201, description: 'Building created successfully' })
  @ApiResponse({ status: 404, description: 'Parent property not found' })
  @ApiResponse({ status: 409, description: 'Building code already exists under property' })
  async create(
    @Body() dto: CreateBuildingDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<BuildingDto>> {
    const data = await this.service.create(dto, {
      correlationId: req?.correlationId,
    });
    return createApiResponse(data, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a building' })
  @ApiResponse({ status: 200, description: 'Building updated successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBuildingDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<BuildingDto>> {
    const data = await this.service.update(id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a building' })
  @ApiResponse({ status: 200, description: 'Building soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete building with active child floors' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<BuildingDto>> {
    const data = await this.service.delete(id);
    return createApiResponse(data, req);
  }
}
