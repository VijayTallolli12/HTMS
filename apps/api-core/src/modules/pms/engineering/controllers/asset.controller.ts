import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  RequirePermissions,
  RequirePropertyContext,
  CurrentSecurityContext,
} from '../../../identity/presentation/decorators/authz.decorators';
import {
  AssetStatus,
  CreateAssetRequest,
  SecurityContext,
  UpdateAssetRequest,
} from '@hms/api-contracts';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { AssetService } from '../services/asset.service';

@ApiTags('PMS - Engineering Assets')
@Controller('properties/:propertyId/pms/engineering/assets')
@RequirePropertyContext()
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  @RequirePermissions('engineering.asset.view')
  @ApiOperation({ summary: 'List facility assets' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiResponse({ status: 200, description: 'Assets retrieved successfully' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('status') status?: AssetStatus,
    @Query('category') category?: string,
    @Query('roomId') roomId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    const data = await this.assetService.findAll(propertyId, {
      status,
      category,
      roomId,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return createApiResponse(data, req);
  }

  @Get(':assetId')
  @RequirePermissions('engineering.asset.view')
  @ApiOperation({ summary: 'Get asset detail' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'assetId', type: String })
  @ApiResponse({ status: 200, description: 'Asset retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  async findById(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Req() req?: Request,
  ) {
    const data = await this.assetService.findById(propertyId, assetId);
    return createApiResponse(data, req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('engineering.asset.manage')
  @ApiOperation({ summary: 'Create new facility asset' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiResponse({ status: 201, description: 'Asset created successfully' })
  @ApiResponse({ status: 409, description: 'Asset code already exists' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() body: CreateAssetRequest,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.assetService.create(propertyId, body, actor.userId);
    return createApiResponse(data, req);
  }

  @Patch(':assetId')
  @RequirePermissions('engineering.asset.manage')
  @ApiOperation({ summary: 'Update facility asset' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'assetId', type: String })
  @ApiResponse({ status: 200, description: 'Asset updated successfully' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  @ApiResponse({ status: 409, description: 'OCC conflict' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() body: UpdateAssetRequest,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.assetService.update(propertyId, assetId, body, actor.userId);
    return createApiResponse(data, req);
  }

  @Delete(':assetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('engineering.asset.manage')
  @ApiOperation({ summary: 'Delete (soft delete) facility asset' })
  @ApiParam({ name: 'propertyId', type: String })
  @ApiParam({ name: 'assetId', type: String })
  @ApiResponse({ status: 204, description: 'Asset deleted successfully' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  async delete(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @CurrentSecurityContext() actor: SecurityContext,
  ) {
    await this.assetService.delete(propertyId, assetId, actor.userId);
  }
}

