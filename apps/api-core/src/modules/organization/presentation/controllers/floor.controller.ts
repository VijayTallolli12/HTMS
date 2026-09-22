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
import { FloorService } from '../../application/services/floor.service';
import { CreateFloorDto } from '../dto/create-floor.dto';
import { UpdateFloorDto } from '../dto/update-floor.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { FloorDto, ApiSuccessResponse } from '@hms/api-contracts';
import { Authenticated } from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('Organization - Floors')
@Controller('v1/organization/floors')
export class FloorController {
  constructor(private readonly service: FloorService) {}

  @Get()
  @Authenticated()
  @ApiOperation({ summary: 'List floors (optionally filtered by buildingId)' })
  @ApiQuery({ name: 'buildingId', required: false, description: 'Filter by parent Building ID' })
  @ApiQuery({ name: 'includeDeleted', required: false })
  @ApiResponse({ status: 200, description: 'List of floors returned successfully' })
  async findAll(
    @Query('buildingId') buildingId?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FloorDto[]>> {
    const data = await this.service.findAll(buildingId, includeDeleted === 'true');
    return createApiResponse(data, req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a floor by ID' })
  @ApiResponse({ status: 200, description: 'Floor found' })
  @ApiResponse({ status: 404, description: 'Floor not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FloorDto>> {
    const data = await this.service.findById(id);
    return createApiResponse(data, req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new floor under a building' })
  @ApiResponse({ status: 201, description: 'Floor created successfully' })
  @ApiResponse({ status: 404, description: 'Parent building not found' })
  @ApiResponse({ status: 409, description: 'Floor code already exists under building' })
  async create(
    @Body() dto: CreateFloorDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FloorDto>> {
    const data = await this.service.create(dto, {
      correlationId: req?.correlationId,
    });
    return createApiResponse(data, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a floor' })
  @ApiResponse({ status: 200, description: 'Floor updated successfully' })
  @ApiResponse({ status: 404, description: 'Floor not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFloorDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FloorDto>> {
    const data = await this.service.update(id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a floor' })
  @ApiResponse({ status: 200, description: 'Floor soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Floor not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<FloorDto>> {
    const data = await this.service.delete(id);
    return createApiResponse(data, req);
  }
}
