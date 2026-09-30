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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { UserManagementService } from '../../application/services/user-management.service';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignPropertiesDto,
  UpdateUserStatusDto,
  ListUsersQueryDto,
} from '../dto/user-management.dto';
import {
  Authenticated,
  RequirePermissions,
  CurrentSecurityContext,
} from '../decorators/authz.decorators';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  ApiSuccessResponse,
  ManagedUserSummaryDto,
  ManagedUserDetailDto,
  AccessiblePropertyDto,
  CreateUserResponse,
  SecurityContext,
} from '@hms/api-contracts';

@ApiTags('Admin - User Management')
@ApiBearerAuth()
@Controller('v1/admin/users')
export class UserManagementController {
  constructor(private readonly service: UserManagementService) {}

  @Get()
  @Authenticated()
  @RequirePermissions('user.manage.read')
  @ApiOperation({ summary: 'List manageable users with pagination and search' })
  @ApiResponse({ status: 200, description: 'User list returned successfully' })
  async listUsers(
    @Query() query: ListUsersQueryDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<{ items: ManagedUserSummaryDto[]; total: number; page: number; limit: number }>> {
    const data = await this.service.listUsers(actor, query);
    return createApiResponse(data, req);
  }

  @Get('meta/accessible-properties')
  @Authenticated()
  @RequirePermissions('user.manage.read')
  @ApiOperation({ summary: 'List properties the current administrator can assign to users' })
  @ApiResponse({ status: 200, description: 'Accessible properties returned' })
  async getAccessibleProperties(
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<AccessiblePropertyDto[]>> {
    const data = await this.service.getAccessiblePropertiesForManagement(actor);
    return createApiResponse(data, req);
  }

  @Get(':id')
  @Authenticated()
  @RequirePermissions('user.manage.read')
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiResponse({ status: 200, description: 'User detail returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ManagedUserDetailDto>> {
    const data = await this.service.getUserById(actor, id);
    return createApiResponse(data, req);
  }

  @Post()
  @Authenticated()
  @RequirePermissions('user.manage.write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create/provision a new user with role and property scope' })
  @ApiResponse({ status: 201, description: 'User provisioned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient authority to assign requested role/property' })
  @ApiResponse({ status: 409, description: 'Conflict: A user with this email already exists' })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<CreateUserResponse>> {
    const data = await this.service.createUser(actor, dto);
    return createApiResponse(data, req);
  }

  @Patch(':id')
  @Authenticated()
  @RequirePermissions('user.manage.write')
  @ApiOperation({ summary: 'Update user profile, role, or property scope' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ManagedUserDetailDto>> {
    const data = await this.service.updateUser(actor, id, dto);
    return createApiResponse(data, req);
  }

  @Post(':id/properties')
  @Authenticated()
  @RequirePermissions('user.manage.write')
  @ApiOperation({ summary: 'Assign additional property scopes to a user' })
  @ApiResponse({ status: 200, description: 'Properties assigned successfully' })
  async assignProperties(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPropertiesDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ManagedUserDetailDto>> {
    const data = await this.service.assignProperties(actor, id, dto);
    return createApiResponse(data, req);
  }

  @Delete(':id/properties/:propertyId')
  @Authenticated()
  @RequirePermissions('user.manage.write')
  @ApiOperation({ summary: 'Remove a property assignment from a user' })
  @ApiResponse({ status: 200, description: 'Property assignment removed' })
  async removePropertyAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ManagedUserDetailDto>> {
    const data = await this.service.removePropertyAssignment(actor, id, propertyId);
    return createApiResponse(data, req);
  }

  @Patch(':id/status')
  @Authenticated()
  @RequirePermissions('user.manage.write')
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ManagedUserDetailDto>> {
    const data = await this.service.updateUserStatus(actor, id, dto);
    return createApiResponse(data, req);
  }
}
