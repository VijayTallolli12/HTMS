import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { HierarchyService } from '../../application/services/hierarchy.service';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import { OrganizationHierarchyTree, ApiSuccessResponse } from '@hms/api-contracts';
import { Authenticated } from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('Organization - Hierarchy')
@Controller('v1/organization/hierarchy')
export class OrganizationHierarchyController {
  constructor(private readonly service: HierarchyService) {}

  @Get('tree')
  @Authenticated()
  @ApiBearerAuth()
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
