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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { EmployeeService } from '../services/employee.service';
import { CompensationService } from '../services/compensation.service';
import { PayrollService } from '../services/payroll.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  QueryEmployeesDto,
  CreateEmployeeCompensationDto,
  CreatePayrollPeriodDto,
  QueryPayrollPeriodsDto,
  CreatePayrollRunDto,
  CalculatePayrollDto,
  QueryPayrollRunsDto,
} from '../dto';
import {
  EmployeeDto,
  EmploymentStatus,
  EmployeeCompensationDto,
  PayrollPeriodDto,
  PayrollRunDto,
  PayrollLineDto,
  PayrollSummaryDto,
} from '@hms/api-contracts';
import { createApiResponse } from '../../../../common/utils/api-response.util';
import {
  CurrentSecurityContext,
  RequirePermissions,
  RequirePropertyContext,
} from '../../../identity/presentation/decorators/authz.decorators';
import { SecurityContext } from '@hms/api-contracts';

@ApiTags('PMS - HR & Payroll')
@Controller('properties/:propertyId/pms/hr-payroll')
@RequirePropertyContext()
export class HrPayrollController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly compensationService: CompensationService,
    private readonly payrollService: PayrollService,
  ) {}

  // ==================== Employees ====================

  @Get('employees')
  @RequirePermissions('hr.employee.view')
  @ApiOperation({ summary: 'List employees with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Employees returned successfully' })
  async listEmployees(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryEmployeesDto,
    @Req() req?: Request,
  ) {
    const data = await this.employeeService.findAll(propertyId, query);
    return createApiResponse(data, req);
  }

  @Get('employees/count')
  @RequirePermissions('hr.employee.view')
  @ApiOperation({ summary: 'Get active employee count' })
  @ApiResponse({ status: 200, description: 'Employee count returned successfully' })
  async getEmployeeCount(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Req() req?: Request,
  ) {
    const data = await this.employeeService.getActiveCount(propertyId);
    return createApiResponse({ count: data }, req);
  }

  @Post('employees')
  @RequirePermissions('hr.employee.manage')
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({ status: 409, description: 'Employee code already exists' })
  async createEmployee(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateEmployeeDto,
    @Req() req?: Request,
  ) {
    const data = await this.employeeService.create(propertyId, dto);
    return createApiResponse(data, req);
  }

  @Get('employees/:id')
  @RequirePermissions('hr.employee.view')
  @ApiOperation({ summary: 'Get employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee returned successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async getEmployee(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ) {
    const data = await this.employeeService.findById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Patch('employees/:id')
  @RequirePermissions('hr.employee.manage')
  @ApiOperation({ summary: 'Update employee' })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async updateEmployee(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req?: Request,
  ) {
    const data = await this.employeeService.update(propertyId, id, dto);
    return createApiResponse(data, req);
  }

  // ==================== Compensation ====================

  @Get('employees/:id/compensation')
  @RequirePermissions('hr.compensation.view')
  @ApiOperation({ summary: 'Get employee compensation history' })
  @ApiResponse({ status: 200, description: 'Compensation history returned successfully' })
  async getEmployeeCompensation(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ) {
    const data = await this.compensationService.findByEmployee(propertyId, id);
    return createApiResponse(data, req);
  }

  @Get('employees/:id/compensation/latest')
  @RequirePermissions('hr.compensation.view')
  @ApiOperation({ summary: 'Get employee latest compensation' })
  @ApiResponse({ status: 200, description: 'Latest compensation returned successfully' })
  async getLatestCompensation(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ) {
    const data = await this.compensationService.findLatest(propertyId, id);
    return createApiResponse(data, req);
  }

  @Post('employees/:id/compensation')
  @RequirePermissions('hr.compensation.manage')
  @ApiOperation({ summary: 'Create employee compensation record' })
  @ApiResponse({ status: 201, description: 'Compensation created successfully' })
  @ApiResponse({ status: 409, description: 'Compensation for this effective date already exists' })
  async createCompensation(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmployeeCompensationDto,
    @Req() req?: Request,
  ) {
    // Ensure employeeId matches the route param
    dto.employeeId = id;
    const data = await this.compensationService.create(propertyId, dto);
    return createApiResponse(data, req);
  }

  // ==================== Payroll Periods ====================

  @Get('payroll/periods')
  @RequirePermissions('payroll.period.view')
  @ApiOperation({ summary: 'List payroll periods' })
  @ApiResponse({ status: 200, description: 'Payroll periods returned successfully' })
  async listPeriods(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryPayrollPeriodsDto,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.getPeriods(propertyId, query);
    return createApiResponse(data, req);
  }

  @Get('payroll/periods/current')
  @RequirePermissions('payroll.period.view')
  @ApiOperation({ summary: 'Get current payroll period' })
  @ApiResponse({ status: 200, description: 'Current payroll period returned successfully' })
  async getCurrentPeriod(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.getCurrentPeriod(propertyId);
    return createApiResponse(data, req);
  }

  @Post('payroll/periods')
  @RequirePermissions('payroll.period.manage')
  @ApiOperation({ summary: 'Create payroll period' })
  @ApiResponse({ status: 201, description: 'Payroll period created successfully' })
  @ApiResponse({ status: 409, description: 'Payroll period overlaps with existing period' })
  async createPeriod(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreatePayrollPeriodDto,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.createPeriod(propertyId, dto);
    return createApiResponse(data, req);
  }

  @Get('payroll/periods/:id')
  @RequirePermissions('payroll.period.view')
  @ApiOperation({ summary: 'Get payroll period by ID' })
  @ApiResponse({ status: 200, description: 'Payroll period returned successfully' })
  @ApiResponse({ status: 404, description: 'Payroll period not found' })
  async getPeriod(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.getPeriodById(propertyId, id);
    return createApiResponse(data, req);
  }

  // ==================== Payroll Runs ====================

  @Get('payroll/runs')
  @RequirePermissions('payroll.run.view')
  @ApiOperation({ summary: 'List payroll runs' })
  @ApiResponse({ status: 200, description: 'Payroll runs returned successfully' })
  async listRuns(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryPayrollRunsDto,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.getRuns(propertyId, query);
    return createApiResponse(data, req);
  }

  @Post('payroll/runs')
  @RequirePermissions('payroll.run.process')
  @ApiOperation({ summary: 'Create payroll run for a period' })
  @ApiResponse({ status: 201, description: 'Payroll run created successfully' })
  @ApiResponse({ status: 409, description: 'Payroll run already exists for this period' })
  async createRun(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreatePayrollRunDto,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.createRun(propertyId, dto);
    return createApiResponse(data, req);
  }

  @Get('payroll/runs/:id')
  @RequirePermissions('payroll.run.view')
  @ApiOperation({ summary: 'Get payroll run by ID with lines' })
  @ApiResponse({ status: 200, description: 'Payroll run returned successfully' })
  @ApiResponse({ status: 404, description: 'Payroll run not found' })
  async getRun(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.getRunById(propertyId, id);
    return createApiResponse(data, req);
  }

  @Post('payroll/runs/:id/calculate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll.run.process')
  @ApiOperation({ summary: 'Calculate payroll run' })
  @ApiResponse({ status: 200, description: 'Payroll calculated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid run status for calculation' })
  async calculateRun(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CalculatePayrollDto,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.calculateRun(propertyId, id, dto, actor.userId);
    return createApiResponse(data, req);
  }

  @Post('payroll/runs/:id/finalize')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll.run.finalize')
  @ApiOperation({ summary: 'Finalize payroll run' })
  @ApiResponse({ status: 200, description: 'Payroll finalized successfully' })
  @ApiResponse({ status: 400, description: 'Invalid run status for finalization' })
  async finalizeRun(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentSecurityContext() actor: SecurityContext,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.finalizeRun(propertyId, id, actor.userId);
    return createApiResponse(data, req);
  }

  @Get('payroll/runs/:id/payslips')
  @RequirePermissions('payroll.payslip.view')
  @ApiOperation({ summary: 'Get payslips for a payroll run' })
  @ApiResponse({ status: 200, description: 'Payslips returned successfully' })
  async getPayslips(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.getRunLines(propertyId, id);
    return createApiResponse(data, req);
  }

  // ==================== Summary ====================

  @Get('payroll/summary')
  @RequirePermissions('payroll.run.view')
  @ApiOperation({ summary: 'Get payroll summary dashboard data' })
  @ApiResponse({ status: 200, description: 'Payroll summary returned successfully' })
  async getSummary(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Req() req?: Request,
  ) {
    const data = await this.payrollService.getSummary(propertyId);
    return createApiResponse(data, req);
  }
}