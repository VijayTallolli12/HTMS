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
import { CountryService } from '../../application/services/country.service';
import { CreateCountryDto } from '../dto/create-country.dto';
import { UpdateCountryDto } from '../dto/update-country.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { CountryDto, ApiSuccessResponse } from '@hms/api-contracts';
import { Authenticated } from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('Organization - Countries')
@Controller('v1/organization/countries')
export class CountryController {
  constructor(private readonly service: CountryService) {}

  @Get()
  @Authenticated()
  @ApiOperation({ summary: 'List countries (optionally filtered by regionId)' })
  @ApiQuery({ name: 'regionId', required: false, description: 'Filter by parent Region ID' })
  @ApiQuery({ name: 'includeDeleted', required: false })
  @ApiResponse({ status: 200, description: 'List of countries returned successfully' })
  async findAll(
    @Query('regionId') regionId?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<CountryDto[]>> {
    const data = await this.service.findAll(regionId, includeDeleted === 'true');
    return createApiResponse(data, req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a country by ID' })
  @ApiResponse({ status: 200, description: 'Country found' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<CountryDto>> {
    const data = await this.service.findById(id);
    return createApiResponse(data, req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new country under a region' })
  @ApiResponse({ status: 201, description: 'Country created successfully' })
  @ApiResponse({ status: 404, description: 'Parent region not found' })
  @ApiResponse({ status: 409, description: 'Country code already exists under region' })
  async create(
    @Body() dto: CreateCountryDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<CountryDto>> {
    const data = await this.service.create(dto, {
      correlationId: req?.correlationId,
    });
    return createApiResponse(data, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a country' })
  @ApiResponse({ status: 200, description: 'Country updated successfully' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCountryDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<CountryDto>> {
    const data = await this.service.update(id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a country' })
  @ApiResponse({ status: 200, description: 'Country soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete country with active child properties' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<CountryDto>> {
    const data = await this.service.delete(id);
    return createApiResponse(data, req);
  }
}
