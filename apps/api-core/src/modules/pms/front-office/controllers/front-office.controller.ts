import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoomAssignmentService } from '../services/room-assignment.service';
import { CheckInService } from '../services/check-in.service';
import { AssignRoomDto } from '../dto/assign-room.dto';
import { UnassignRoomDto } from '../dto/unassign-room.dto';
import { CheckInDto } from '../dto/check-in.dto';
import { QueryEligibleRoomsDto } from '../dto/query-eligible-rooms.dto';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  ApiSuccessResponse,
  CheckInResponseDto,
  EligibleRoomDto,
  ReservationAssignmentLogDto,
  ReservationDto,
  SecurityContext,
} from '@hms/api-contracts';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';

@ApiTags('PMS - Front Office')
@Controller('properties/:propertyId/pms/front-office')
@RequirePropertyContext()
export class FrontOfficeController {
  constructor(
    private readonly roomAssignmentService: RoomAssignmentService,
    private readonly checkInService: CheckInService,
  ) {}

  @Get('eligible-rooms')
  @RequirePermissions('front_office.reservation.read')
  @ApiOperation({ summary: 'Query eligible physical rooms for a confirmed reservation' })
  @ApiResponse({ status: 200, description: 'Eligible rooms returned successfully' })
  @ApiResponse({ status: 404, description: 'Property or reservation not found' })
  async getEligibleRooms(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryEligibleRoomsDto,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<EligibleRoomDto[]>> {
    const data = await this.roomAssignmentService.getEligibleRooms(propertyId, query);
    return createApiResponse(data, req);
  }

  @Post('reservations/:id/assign-room')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('front_office.room_assignment.manage')
  @ApiOperation({ summary: 'Assign or reassign a physical room to a confirmed reservation' })
  @ApiResponse({ status: 200, description: 'Room assigned successfully or NO-OP' })
  @ApiResponse({ status: 400, description: 'Room type mismatch without upgrade authorization' })
  @ApiResponse({ status: 404, description: 'Reservation or room not found' })
  @ApiResponse({
    status: 409,
    description: 'Room maintenance conflict, double-assignment, or OCC conflict',
  })
  async assignRoom(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoomDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ReservationDto>> {
    const data = await this.roomAssignmentService.assignRoom(propertyId, id, dto, actor);
    return createApiResponse(data, req);
  }

  @Post('reservations/:id/unassign-room')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('front_office.room_assignment.manage')
  @ApiOperation({ summary: 'Unassign physical room from a confirmed reservation' })
  @ApiResponse({ status: 200, description: 'Room unassigned successfully or NO-OP' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  @ApiResponse({ status: 409, description: 'Reservation not in CONFIRMED status' })
  async unassignRoom(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnassignRoomDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<ReservationDto>> {
    const data = await this.roomAssignmentService.unassignRoom(propertyId, id, dto, actor);
    return createApiResponse(data, req);
  }

  @Post('reservations/:id/check-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('front_office.checkin.execute')
  @ApiOperation({ summary: 'Check in a guest for a confirmed reservation with assigned room' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional unique client token for idempotent check-in execution',
  })
  @ApiResponse({ status: 200, description: 'Check-in processed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Preconditions failed (unassigned room, wrong arrival date)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: clean override without required permission',
  })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  @ApiResponse({
    status: 409,
    description: 'Room dirty/OOO, already checked in, or idempotency conflict',
  })
  async checkIn(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<CheckInResponseDto>> {
    const data = await this.checkInService.checkIn(propertyId, id, dto, actor, idempotencyKey);
    return createApiResponse(data, req);
  }

  @Get('reservations/:id/assignment-logs')
  @RequirePermissions('front_office.reservation.read')
  @ApiOperation({ summary: 'Get room assignment history for a reservation' })
  @ApiResponse({ status: 200, description: 'Assignment history returned successfully' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async getAssignmentLogs(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ): Promise<ApiSuccessResponse<{ items: ReservationAssignmentLogDto[]; total: number }>> {
    const data = await this.roomAssignmentService.getAssignmentLogs(propertyId, id);
    return createApiResponse(data, req);
  }
}
