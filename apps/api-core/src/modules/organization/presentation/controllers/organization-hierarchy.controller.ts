import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { HierarchyService } from '../../application/services/hierarchy.service';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { OrganizationHierarchyTree, ApiSuccessResponse } from '@hms/api-contracts';

@ApiTags('Organization - Hierarchy')
@Controller('v1/organization/hierarchy')
export class OrganizationHierarchyController {
  constructor(private readonly service: HierarchyService) {}

  @Get('tree')
  @ApiOperation({
    summary: 'Get the complete organization hierarchy tree for navigation and drill-down',
  })
  @ApiQuery({ name: 'includeDeleted', required: false })
  @ApiResponse({ status: 200, description: 'Organization tree returned successfully' })
  async getHierarchyTree(
    @Query('includeDeleted') includeDeleted?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<OrganizationHierarchyTree>> {
    const data = await this.service.getHierarchyTree(includeDeleted === 'true');
    return createApiResponse(data, req);
  }
}
