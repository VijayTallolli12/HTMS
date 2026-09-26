import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SpaCatalogService } from '../services/spa-catalog.service';
import { SpaAppointmentService } from '../services/spa-appointment.service';
import { createApiResponse } from '../../../common/utils/api-response.util';
import {
  ApiSuccessResponse,
  SpaServiceDto,
  SpaServiceDetailDto,
  SpaServicePriceDto,
  SpaTherapistDto,
  SpaRoomDto,
  SpaAppointmentDto,
  SecurityContext,
  SpaServiceCategoryDto,
  SpaServiceAddonDto,
  SpaServiceAvailability,
} from '@hms/api-contracts';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../identity/presentation/decorators/authz.decorators';
import {
  CreateSpaServiceDto,
  UpdateSpaServiceDto,
  CreateSpaTherapistDto,
  UpdateSpaTherapistDto,
  CreateSpaRoomDto,
  UpdateSpaRoomDto,
  CreateSpaAppointmentDto,
  UpdateSpaAppointmentStatusDto,
  CompleteSpaAppointmentDto,
  QuerySpaAppointmentsDto,
  CreateSpaServiceCategoryDto,
  UpdateSpaServiceCategoryDto,
  CreateSpaServiceAddonDto,
  UpdateSpaServiceAddonDto,
  UpdateSpaServicePriceDto,
  UpdateSpaServiceAvailabilityDto,
  QuerySpaServicesDto,
} from '../dto/spa.dto';

@ApiTags('Spa Operations')
@Controller('properties/:propertyId/spa')
@RequirePropertyContext()
export class SpaController {
  constructor(
    private readonly catalogService: SpaCatalogService,
    private readonly appointmentService: SpaAppointmentService,
  ) {}

  // ----------------------------------------------------------------------
  // Service Categories
  // ----------------------------------------------------------------------
  @Get('categories')
  @RequirePermissions('spa.catalog.view')
  @ApiOperation({ summary: 'List spa service categories for property' })
  async getCategories(
    @Param('propertyId') propertyId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<ApiSuccessResponse<SpaServiceCategoryDto[]>> {
    const categories = await this.catalogService.getCategories(propertyId, includeInactive);
    return createApiResponse(categories);
  }

  @Get('categories/:id')
  @RequirePermissions('spa.catalog.view')
  @ApiOperation({ summary: 'Get spa service category by id' })
  async getCategory(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SpaServiceCategoryDto>> {
    const category = await this.catalogService.getCategory(propertyId, id);
    return createApiResponse(category);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('spa.catalog.manage')
  @ApiOperation({ summary: 'Create new spa service category' })
  async createCategory(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateSpaServiceCategoryDto,
  ): Promise<ApiSuccessResponse<SpaServiceCategoryDto>> {
    const created = await this.catalogService.createCategory(propertyId, dto);
    return createApiResponse(created);
  }

  @Patch('categories/:id')
  @RequirePermissions('spa.catalog.manage')
  @ApiOperation({ summary: 'Update spa service category' })
  async updateCategory(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaServiceCategoryDto,
  ): Promise<ApiSuccessResponse<SpaServiceCategoryDto>> {
    const updated = await this.catalogService.updateCategory(propertyId, id, dto);
    return createApiResponse(updated);
  }

  // ----------------------------------------------------------------------
  // Services
  // ----------------------------------------------------------------------
  @Get('services')
  @RequirePermissions('spa.service.view')
  @ApiOperation({ summary: 'List spa services for property' })
  async getServices(
    @Param('propertyId') propertyId: string,
    @Query() query: QuerySpaServicesDto,
  ): Promise<ApiSuccessResponse<SpaServiceDto[]>> {
    const services = await this.catalogService.getServices(propertyId, query);
    return createApiResponse(services);
  }

  @Get('services/:id')
  @RequirePermissions('spa.service.view')
  @ApiOperation({ summary: 'Get spa service by id' })
  async getService(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SpaServiceDto>> {
    const service = await this.catalogService.getService(propertyId, id);
    return createApiResponse(service);
  }

  @Get('services/:id/detail')
  @RequirePermissions('spa.service.view')
  @ApiOperation({ summary: 'Get spa service detail with addons' })
  async getServiceDetail(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SpaServiceDetailDto>> {
    const service = await this.catalogService.getServiceDetail(propertyId, id);
    return createApiResponse(service);
  }

  @Post('services')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('spa.service.manage')
  @ApiOperation({ summary: 'Create new spa service' })
  async createService(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateSpaServiceDto,
  ): Promise<ApiSuccessResponse<SpaServiceDto>> {
    const created = await this.catalogService.createService(propertyId, dto);
    return createApiResponse(created);
  }

  @Patch('services/:id')
  @RequirePermissions('spa.service.manage')
  @ApiOperation({ summary: 'Update spa service' })
  async updateService(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaServiceDto,
  ): Promise<ApiSuccessResponse<SpaServiceDto>> {
    const updated = await this.catalogService.updateService(propertyId, id, dto);
    return createApiResponse(updated);
  }

  @Patch('services/:id/price')
  @RequirePermissions('spa.pricing.manage')
  @ApiOperation({ summary: 'Update spa service base price' })
  async updateServicePrice(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaServicePriceDto,
  ): Promise<ApiSuccessResponse<SpaServicePriceDto>> {
    const updated = await this.catalogService.updateServicePrice(propertyId, id, dto);
    return createApiResponse(updated);
  }

  @Patch('services/:id/availability')
  @RequirePermissions('spa.availability.manage')
  @ApiOperation({ summary: 'Update spa service availability' })
  async updateServiceAvailability(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaServiceAvailabilityDto,
  ): Promise<ApiSuccessResponse<SpaServiceDto>> {
    const updated = await this.catalogService.updateServiceAvailability(propertyId, id, dto);
    return createApiResponse(updated);
  }

  // ----------------------------------------------------------------------
  // Service Addons
  // ----------------------------------------------------------------------
  @Get('services/:serviceId/addons')
  @RequirePermissions('spa.catalog.view')
  @ApiOperation({ summary: 'List addons for a spa service' })
  async getAddons(
    @Param('propertyId') propertyId: string,
    @Param('serviceId') serviceId: string,
  ): Promise<ApiSuccessResponse<SpaServiceAddonDto[]>> {
    const addons = await this.catalogService.getAddons(propertyId, serviceId);
    return createApiResponse(addons);
  }

  @Get('services/:serviceId/addons/:id')
  @RequirePermissions('spa.catalog.view')
  @ApiOperation({ summary: 'Get spa service addon by id' })
  async getAddon(
    @Param('propertyId') propertyId: string,
    @Param('serviceId') serviceId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SpaServiceAddonDto>> {
    const addon = await this.catalogService.getAddon(propertyId, id);
    return createApiResponse(addon);
  }

  @Post('services/:serviceId/addons')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('spa.catalog.manage')
  @ApiOperation({ summary: 'Create new spa service addon' })
  async createAddon(
    @Param('propertyId') propertyId: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateSpaServiceAddonDto,
  ): Promise<ApiSuccessResponse<SpaServiceAddonDto>> {
    const created = await this.catalogService.createAddon(propertyId, { ...dto, serviceId });
    return createApiResponse(created);
  }

  @Patch('services/:serviceId/addons/:id')
  @RequirePermissions('spa.catalog.manage')
  @ApiOperation({ summary: 'Update spa service addon' })
  async updateAddon(
    @Param('propertyId') propertyId: string,
    @Param('serviceId') serviceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaServiceAddonDto,
  ): Promise<ApiSuccessResponse<SpaServiceAddonDto>> {
    const updated = await this.catalogService.updateAddon(propertyId, id, dto);
    return createApiResponse(updated);
  }

  @Delete('services/:serviceId/addons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('spa.catalog.manage')
  @ApiOperation({ summary: 'Delete spa service addon' })
  async deleteAddon(
    @Param('propertyId') propertyId: string,
    @Param('serviceId') serviceId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.catalogService.deleteAddon(propertyId, id);
  }

  // ----------------------------------------------------------------------
  // Therapists
  // ----------------------------------------------------------------------
  @Get('therapists')
  @RequirePermissions('spa.therapist.view')
  @ApiOperation({ summary: 'List spa therapists for property' })
  async getTherapists(
    @Param('propertyId') propertyId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<ApiSuccessResponse<SpaTherapistDto[]>> {
    const therapists = await this.catalogService.getTherapists(propertyId, includeInactive);
    return createApiResponse(therapists);
  }

  @Get('therapists/:id')
  @RequirePermissions('spa.therapist.view')
  @ApiOperation({ summary: 'Get therapist details' })
  async getTherapist(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SpaTherapistDto>> {
    const therapist = await this.catalogService.getTherapist(propertyId, id);
    return createApiResponse(therapist);
  }

  @Post('therapists')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('spa.service.manage')
  @ApiOperation({ summary: 'Register new therapist' })
  async createTherapist(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateSpaTherapistDto,
  ): Promise<ApiSuccessResponse<SpaTherapistDto>> {
    const created = await this.catalogService.createTherapist(propertyId, dto);
    return createApiResponse(created);
  }

  @Patch('therapists/:id')
  @RequirePermissions('spa.service.manage')
  @ApiOperation({ summary: 'Update therapist details' })
  async updateTherapist(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaTherapistDto,
  ): Promise<ApiSuccessResponse<SpaTherapistDto>> {
    const updated = await this.catalogService.updateTherapist(propertyId, id, dto);
    return createApiResponse(updated);
  }

  // ----------------------------------------------------------------------
  // Treatment Rooms
  // ----------------------------------------------------------------------
  @Get('rooms')
  @RequirePermissions('spa.room.view')
  @ApiOperation({ summary: 'List spa treatment rooms' })
  async getRooms(
    @Param('propertyId') propertyId: string,
    @Query('status') status?: any,
  ): Promise<ApiSuccessResponse<SpaRoomDto[]>> {
    const rooms = await this.catalogService.getRooms(propertyId, status);
    return createApiResponse(rooms);
  }

  @Get('rooms/:id')
  @RequirePermissions('spa.room.view')
  @ApiOperation({ summary: 'Get treatment room details' })
  async getRoom(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SpaRoomDto>> {
    const room = await this.catalogService.getRoom(propertyId, id);
    return createApiResponse(room);
  }

  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('spa.service.manage')
  @ApiOperation({ summary: 'Create treatment room' })
  async createRoom(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateSpaRoomDto,
  ): Promise<ApiSuccessResponse<SpaRoomDto>> {
    const created = await this.catalogService.createRoom(propertyId, dto);
    return createApiResponse(created);
  }

  @Patch('rooms/:id')
  @RequirePermissions('spa.service.manage')
  @ApiOperation({ summary: 'Update treatment room status or info' })
  async updateRoom(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaRoomDto,
  ): Promise<ApiSuccessResponse<SpaRoomDto>> {
    const updated = await this.catalogService.updateRoom(propertyId, id, dto);
    return createApiResponse(updated);
  }

  // ----------------------------------------------------------------------
  // In-House Checked-in Guests
  // ----------------------------------------------------------------------
  @Get('in-house-guests')
  @RequirePermissions('spa.appointment.create')
  @ApiOperation({ summary: 'Get checked-in guests eligible for room charging' })
  async getInHouseGuests(
    @Param('propertyId') propertyId: string,
  ): Promise<
    ApiSuccessResponse<
      Array<{
        reservationId: string;
        confirmationNumber: string;
        roomNumber: string;
        guestName: string;
        folioId: string | null;
      }>
    >
  > {
    const guests = await this.appointmentService.getInHouseGuests(propertyId);
    return createApiResponse(guests);
  }

  // ----------------------------------------------------------------------
  // Appointments
  // ----------------------------------------------------------------------
  @Get('appointments')
  @RequirePermissions('spa.appointment.view')
  @ApiOperation({ summary: 'Query spa appointments' })
  async getAppointments(
    @Param('propertyId') propertyId: string,
    @Query() query: QuerySpaAppointmentsDto,
  ): Promise<ApiSuccessResponse<SpaAppointmentDto[]>> {
    const appointments = await this.appointmentService.getAppointments(propertyId, query);
    return createApiResponse(appointments);
  }

  @Get('appointments/:id')
  @RequirePermissions('spa.appointment.view')
  @ApiOperation({ summary: 'Get appointment details by id' })
  async getAppointment(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<SpaAppointmentDto>> {
    const appointment = await this.appointmentService.getAppointment(propertyId, id);
    return createApiResponse(appointment);
  }

  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('spa.appointment.create')
  @ApiOperation({ summary: 'Book new spa appointment' })
  async createAppointment(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateSpaAppointmentDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<ApiSuccessResponse<SpaAppointmentDto>> {
    const created = await this.appointmentService.createAppointment(propertyId, dto, actor.userId);
    return createApiResponse(created);
  }

  @Post('appointments/:id/status')
  @RequirePermissions('spa.appointment.manage')
  @ApiOperation({ summary: 'Update appointment lifecycle status' })
  async updateAppointmentStatus(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaAppointmentStatusDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<ApiSuccessResponse<SpaAppointmentDto>> {
    const updated = await this.appointmentService.updateAppointmentStatus(propertyId, id, dto, actor.userId);
    return createApiResponse(updated);
  }

  @Post('appointments/:id/complete')
  @RequirePermissions('spa.appointment.complete')
  @ApiOperation({ summary: 'Complete appointment and post charge to folio' })
  async completeAppointment(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: CompleteSpaAppointmentDto,
    @CurrentSecurityContext() actor: SecurityContext,
  ): Promise<ApiSuccessResponse<SpaAppointmentDto>> {
    const completed = await this.appointmentService.completeAppointment(propertyId, id, dto, actor);
    return createApiResponse(completed);
  }
}