import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CrmService } from '../services/crm.service';
import { LoyaltyService } from '../services/loyalty.service';
import {
  CreateCrmProfileDto,
  UpdateCrmProfileDto,
  CreateGuestPreferenceDto,
  UpdateGuestPreferenceDto,
  GuestSearchDto,
  CreateLoyaltyMembershipDto,
  AwardPointsDto,
  RedeemPointsDto,
  AdjustPointsDto,
  QueryLoyaltyTransactionsDto,
} from '../dto';
import {
  GuestCrmProfileDto,
  GuestPreferenceDto,
  GuestSearchResultDto,
  LoyaltyMembershipDto,
  LoyaltyTransactionDto,
} from '@hms/api-contracts';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';
import { SecurityContext } from '@hms/api-contracts';

@ApiTags('PMS - CRM & Loyalty')
@Controller('properties/:propertyId/pms/crm')
@RequirePropertyContext()
export class CrmController {
  constructor(
    private readonly crmService: CrmService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  // ============ Guest Search ============

  @Get('guests/search')
  @RequirePermissions('crm.guest.view')
  @ApiOperation({ summary: 'Search guests with CRM data' })
  @ApiResponse({ status: 200, description: 'Guests returned successfully' })
  async searchGuests(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: GuestSearchDto,
    @Req() req?: Request,
  ) {
    const data = await this.crmService.searchGuests(propertyId, query);
    return createApiResponse(data, req);
  }

  // ============ CRM Profile ============

  @Get('guests/:guestId/profile')
  @RequirePermissions('crm.guest.view')
  @ApiOperation({ summary: 'Get CRM profile for a guest' })
  @ApiResponse({ status: 200, description: 'CRM profile returned successfully' })
  @ApiResponse({ status: 404, description: 'Guest or profile not found' })
  async getProfile(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Req() req?: Request,
  ): Promise<{ data: GuestCrmProfileDto }> {
    const data = await this.crmService.getOrCreateProfile(propertyId, guestId);
    return createApiResponse(data, req);
  }

  @Put('guests/:guestId/profile')
  @RequirePermissions('crm.guest.manage')
  @ApiOperation({ summary: 'Update CRM profile for a guest' })
  @ApiResponse({ status: 200, description: 'CRM profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async updateProfile(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Body() dto: UpdateCrmProfileDto,
    @Req() req?: Request,
  ): Promise<{ data: GuestCrmProfileDto }> {
    const data = await this.crmService.updateProfile(propertyId, guestId, dto);
    return createApiResponse(data, req);
  }

  // ============ Guest Preferences ============

  @Get('guests/:guestId/preferences')
  @RequirePermissions('crm.preference.view')
  @ApiOperation({ summary: 'List guest preferences' })
  @ApiResponse({ status: 200, description: 'Preferences returned successfully' })
  async listPreferences(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Req() req?: Request,
  ): Promise<{ data: GuestPreferenceDto[] }> {
    const data = await this.crmService.listPreferences(propertyId, guestId);
    return createApiResponse(data, req);
  }

  @Post('guests/:guestId/preferences')
  @RequirePermissions('crm.preference.manage')
  @ApiOperation({ summary: 'Create guest preference' })
  @ApiResponse({ status: 201, description: 'Preference created successfully' })
  @ApiResponse({ status: 409, description: 'Preference already exists' })
  async createPreference(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Body() dto: CreateGuestPreferenceDto,
    @Req() req?: Request,
  ): Promise<{ data: GuestPreferenceDto }> {
    const data = await this.crmService.createPreference(propertyId, guestId, dto);
    return createApiResponse(data, req);
  }

  @Put('guests/:guestId/preferences/:category/:preference')
  @RequirePermissions('crm.preference.manage')
  @ApiOperation({ summary: 'Update guest preference' })
  @ApiResponse({ status: 200, description: 'Preference updated successfully' })
  @ApiResponse({ status: 404, description: 'Preference not found' })
  async updatePreference(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Param('category') category: string,
    @Param('preference') preference: string,
    @Body() dto: UpdateGuestPreferenceDto,
    @Req() req?: Request,
  ): Promise<{ data: GuestPreferenceDto }> {
    const data = await this.crmService.updatePreference(propertyId, guestId, category, preference, dto);
    return createApiResponse(data, req);
  }

  @Delete('guests/:guestId/preferences/:category/:preference')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('crm.preference.manage')
  @ApiOperation({ summary: 'Delete guest preference' })
  @ApiResponse({ status: 204, description: 'Preference deleted successfully' })
  @ApiResponse({ status: 404, description: 'Preference not found' })
  async deletePreference(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Param('category') category: string,
    @Param('preference') preference: string,
  ): Promise<void> {
    await this.crmService.deletePreference(propertyId, guestId, category, preference);
  }

  // ============ Guest Relationship View ============

  @Get('guests/:guestId/relationship')
  @RequirePermissions('crm.guest.view')
  @ApiOperation({ summary: 'Get full guest relationship view (profile, preferences, loyalty, reservations, folios)' })
  @ApiResponse({ status: 200, description: 'Guest relationship view returned successfully' })
  @ApiResponse({ status: 404, description: 'Guest not found' })
  async getRelationshipView(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Req() req?: Request,
  ) {
    const data = await this.crmService.getGuestRelationshipView(propertyId, guestId);
    return createApiResponse(data, req);
  }

  // ============ Loyalty Membership ============

  @Get('loyalty/memberships/:guestId')
  @RequirePermissions('loyalty.membership.view')
  @ApiOperation({ summary: 'Get loyalty membership for a guest' })
  @ApiResponse({ status: 200, description: 'Membership returned successfully' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  async getMembership(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Req() req?: Request,
  ): Promise<{ data: LoyaltyMembershipDto | null }> {
    const data = await this.loyaltyService.getMembership(propertyId, guestId);
    return createApiResponse(data, req);
  }

  @Post('loyalty/memberships')
  @RequirePermissions('loyalty.membership.manage')
  @ApiOperation({ summary: 'Create loyalty membership for a guest' })
  @ApiResponse({ status: 201, description: 'Membership created successfully' })
  @ApiResponse({ status: 409, description: 'Membership already exists' })
  async createMembership(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateLoyaltyMembershipDto,
    @Req() req?: Request,
  ): Promise<{ data: LoyaltyMembershipDto }> {
    const data = await this.loyaltyService.createMembership(propertyId, dto);
    return createApiResponse(data, req);
  }

  // ============ Loyalty Points ============

  @Post('loyalty/points/award')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('loyalty.points.adjust')
  @ApiOperation({ summary: 'Award points to a membership' })
  @ApiResponse({ status: 200, description: 'Points awarded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or membership not active' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  async awardPoints(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: AwardPointsDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<{ data: LoyaltyTransactionDto }> {
    const data = await this.loyaltyService.awardPoints(propertyId, dto, actor.userId);
    return createApiResponse(data, req);
  }

  @Post('loyalty/points/redeem')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('loyalty.points.adjust')
  @ApiOperation({ summary: 'Redeem points from a membership' })
  @ApiResponse({ status: 200, description: 'Points redeemed successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient points or membership not active' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  async redeemPoints(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: RedeemPointsDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<{ data: LoyaltyTransactionDto }> {
    const data = await this.loyaltyService.redeemPoints(propertyId, dto, actor.userId);
    return createApiResponse(data, req);
  }

  @Post('loyalty/points/adjust')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('loyalty.points.adjust')
  @ApiOperation({ summary: 'Manual points adjustment' })
  @ApiResponse({ status: 200, description: 'Points adjusted successfully' })
  @ApiResponse({ status: 400, description: 'Would result in negative balance' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  async adjustPoints(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: AdjustPointsDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<{ data: LoyaltyTransactionDto }> {
    const data = await this.loyaltyService.adjustPoints(propertyId, dto, actor.userId);
    return createApiResponse(data, req);
  }

  // ============ Loyalty Transactions ============

  @Get('loyalty/transactions')
  @RequirePermissions('loyalty.points.view')
  @ApiOperation({ summary: 'Get loyalty transaction history' })
  @ApiResponse({ status: 200, description: 'Transactions returned successfully' })
  async getTransactions(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryLoyaltyTransactionsDto,
    @Req() req?: Request,
  ) {
    const data = await this.loyaltyService.getTransactions(propertyId, query);
    return createApiResponse(data, req);
  }

  // ============ Tier Info ============

  @Get('loyalty/tiers')
  @RequirePermissions('loyalty.membership.view')
  @ApiOperation({ summary: 'Get loyalty tier thresholds' })
  @ApiResponse({ status: 200, description: 'Tier thresholds returned successfully' })
  async getTiers(@Req() req?: Request) {
    const data = this.loyaltyService.getTierThresholds();
    return createApiResponse(data, req);
  }
}