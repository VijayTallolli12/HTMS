import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreatePayrollPeriodDto,
  CreatePayrollRunDto,
  CalculatePayrollDto,
  QueryPayrollPeriodsDto,
  QueryPayrollRunsDto,
} from '../dto';
import {
  PayrollPeriodDto,
  PayrollRunDto,
  PayrollRunStatus,
  PayrollPeriodStatus,
  PayrollLineDto,
  PayrollSummaryDto,
} from '@hms/api-contracts';
import { PrismaService } from '../../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== Payroll Period ====================

  async createPeriod(propertyId: string, dto: CreatePayrollPeriodDto): Promise<PayrollPeriodDto> {
    const start = new Date(dto.periodStart);
    const end = new Date(dto.periodEnd);

    if (start >= end) {
      throw new BadRequestException('Period end must be after period start');
    }

    // Check for overlapping periods
    const overlapping = await this.prisma.payrollPeriod.findFirst({
      where: {
        propertyId,
        deletedAt: null,
        OR: [
          { periodStart: { lte: end }, periodEnd: { gte: start } },
        ],
      },
    });
    if (overlapping) {
      throw new ConflictException('Payroll period overlaps with existing period');
    }

    const period = await this.prisma.payrollPeriod.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        periodStart: start,
        periodEnd: end,
        status: PayrollPeriodStatus.OPEN,
      },
    });

    return this.mapPeriodToDto(period);
  }

  async getPeriods(propertyId: string, query: QueryPayrollPeriodsDto): Promise<{ items: PayrollPeriodDto[]; total: number; page: number; limit: number }> {
    const where: Prisma.PayrollPeriodWhereInput = {
      propertyId,
      deletedAt: null,
    };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.payrollPeriod.findMany({
        where,
        orderBy: { periodStart: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payrollPeriod.count({ where }),
    ]);

    return {
      items: items.map((p) => this.mapPeriodToDto(p)),
      total,
      page,
      limit,
    };
  }

  async getPeriodById(propertyId: string, periodId: string): Promise<PayrollPeriodDto | null> {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, propertyId, deletedAt: null },
    });
    return period ? this.mapPeriodToDto(period) : null;
  }

  async getCurrentPeriod(propertyId: string): Promise<PayrollPeriodDto | null> {
    const today = new Date();
    const period = await this.prisma.payrollPeriod.findFirst({
      where: {
        propertyId,
        deletedAt: null,
        periodStart: { lte: today },
        periodEnd: { gte: today },
      },
      orderBy: { periodStart: 'desc' },
    });
    return period ? this.mapPeriodToDto(period) : null;
  }

  // ==================== Payroll Run ====================

  async createRun(propertyId: string, dto: CreatePayrollRunDto): Promise<PayrollRunDto> {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: dto.payrollPeriodId, propertyId, deletedAt: null },
    });
    if (!period) {
      throw new NotFoundException('Payroll period not found');
    }

    // Check if a run already exists for this period (idempotency)
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payrollRun.findFirst({
        where: { propertyId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return this.mapRunToDto(existing);
      }
    }

    // Check if there's already a run for this period
    const existingRun = await this.prisma.payrollRun.findFirst({
      where: { propertyId, payrollPeriodId: dto.payrollPeriodId, deletedAt: null },
    });
    if (existingRun) {
      throw new ConflictException('Payroll run already exists for this period');
    }

    const run = await this.prisma.payrollRun.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        payrollPeriodId: dto.payrollPeriodId,
        status: PayrollRunStatus.DRAFT,
        idempotencyKey: dto.idempotencyKey || null,
      },
    });

    return this.mapRunToDto(run);
  }

  async getRuns(propertyId: string, query: QueryPayrollRunsDto): Promise<{ items: PayrollRunDto[]; total: number; page: number; limit: number }> {
    const where: Prisma.PayrollRunWhereInput = {
      propertyId,
      deletedAt: null,
    };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where,
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payrollRun.count({ where }),
    ]);

    return {
      items: items.map((r) => this.mapRunToDto(r)),
      total,
      page,
      limit,
    };
  }

  async getRunById(propertyId: string, runId: string): Promise<PayrollRunDto | null> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, propertyId, deletedAt: null },
      include: { lines: { include: { employee: true } } },
    });
    return run ? this.mapRunToDto(run) : null;
  }

  // ==================== Payroll Calculation ====================

  async calculateRun(propertyId: string, runId: string, dto: CalculatePayrollDto, calculatedBy: string): Promise<PayrollRunDto> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, propertyId, deletedAt: null },
      include: { payrollPeriod: true },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== PayrollRunStatus.DRAFT && run.status !== PayrollRunStatus.CALCULATED) {
      throw new BadRequestException(`Cannot calculate payroll run in ${run.status} status`);
    }

    // Check idempotency for calculation
    if (dto.idempotencyKey) {
      const existingCalc = await this.prisma.payrollRun.findFirst({
        where: { propertyId, idempotencyKey: dto.idempotencyKey, status: { in: [PayrollRunStatus.CALCULATED, PayrollRunStatus.FINALIZED] } },
      });
      if (existingCalc) {
        return this.mapRunToDto(existingCalc);
      }
    }

    // Get active employees with their latest compensation
    const employees = await this.prisma.employee.findMany({
      where: { propertyId, deletedAt: null, status: 'ACTIVE' },
      include: {
        compensations: {
          where: { deletedAt: null },
          orderBy: { effectiveDate: 'desc' },
          take: 1,
        },
      },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No active employees found for payroll calculation');
    }

    // Calculate payroll lines
    const linesData: Prisma.PayrollLineUncheckedCreateInput[] = [];
    let totalGross = new Prisma.Decimal(0);
    let totalDeductions = new Prisma.Decimal(0);
    let totalNet = new Prisma.Decimal(0);

    for (const employee of employees) {
      const compensation = employee.compensations[0];
      if (!compensation) {
        continue; // Skip employees without compensation
      }

      const basic = new Prisma.Decimal(compensation.basicSalary);
      const housing = new Prisma.Decimal(compensation.housingAllowance);
      const transport = new Prisma.Decimal(compensation.transportAllowance);
      const other = new Prisma.Decimal(compensation.otherAllowance);
      const overtime = new Prisma.Decimal(0); // TODO: Integrate with attendance/overtime system

      const gross = basic.add(housing).add(transport).add(other).add(overtime);
      const deductions = new Prisma.Decimal(0); // Simplified - no statutory deductions for demo
      const net = gross.sub(deductions);

      totalGross = totalGross.add(gross);
      totalDeductions = totalDeductions.add(deductions);
      totalNet = totalNet.add(net);

      linesData.push({
        id: generateUuidV7(),
        propertyId,
        payrollRunId: run.id,
        employeeId: employee.id,
        basic,
        housingAllowance: housing,
        transportAllowance: transport,
        otherAllowance: other,
        overtime,
        gross,
        deductions,
        net,
        currency: compensation.currency,
      });
    }

    // Execute in transaction
    const updatedRun = await this.prisma.$transaction(async (tx) => {
      // Delete existing lines if re-calculating
      await tx.payrollLine.deleteMany({
        where: { propertyId, payrollRunId: run.id },
      });

      // Create new lines
      await tx.payrollLine.createMany({
        data: linesData,
      });

      // Update run
      return tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.CALCULATED,
          totalGross,
          totalDeductions,
          totalNet,
          calculatedAt: new Date(),
          calculatedBy,
          version: { increment: 1 },
        },
        include: { lines: { include: { employee: true } } },
      });
    });

    return this.mapRunToDto(updatedRun);
  }

  async finalizeRun(propertyId: string, runId: string, finalizedBy: string): Promise<PayrollRunDto> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, propertyId, deletedAt: null },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== PayrollRunStatus.CALCULATED) {
      throw new BadRequestException(`Can only finalize a CALCULATED run, current status: ${run.status}`);
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        status: PayrollRunStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedBy,
        version: { increment: 1 },
      },
    });

    // Also update period status if needed
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: run.payrollPeriodId, propertyId, deletedAt: null },
    });
    if (period && period.status === PayrollPeriodStatus.OPEN) {
      await this.prisma.payrollPeriod.update({
        where: { id: period.id },
        data: { status: PayrollPeriodStatus.PROCESSED, processedAt: new Date(), processedBy: finalizedBy },
      });
    }

    return this.mapRunToDto(updated);
  }

  async getRunLines(propertyId: string, runId: string): Promise<PayrollLineDto[]> {
    const lines = await this.prisma.payrollLine.findMany({
      where: { propertyId, payrollRunId: runId, deletedAt: null },
      include: { employee: true },
      orderBy: { employee: { lastName: 'asc' } },
    });
    return lines.map((l) => this.mapLineToDto(l));
  }

  // ==================== Summary ====================

  async getSummary(propertyId: string): Promise<PayrollSummaryDto> {
    const [employeeCount, activeEmployeeCount, currentPeriod, latestRun] = await Promise.all([
      this.prisma.employee.count({ where: { propertyId, deletedAt: null } }),
      this.prisma.employee.count({ where: { propertyId, deletedAt: null, status: 'ACTIVE' } }),
      this.getCurrentPeriod(propertyId),
      this.prisma.payrollRun.findFirst({
        where: { propertyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { lines: true },
      }),
    ]);

    return {
      employeeCount,
      activeEmployeeCount,
      currentPeriod: currentPeriod || undefined,
      latestRun: latestRun ? this.mapRunToDto(latestRun) : undefined,
      totalGross: latestRun ? Number(latestRun.totalGross) : 0,
      totalNet: latestRun ? Number(latestRun.totalNet) : 0,
    };
  }

  private mapPeriodToDto(period: any): PayrollPeriodDto {
    return {
      id: period.id,
      propertyId: period.propertyId,
      periodStart: period.periodStart.toISOString().slice(0, 10),
      periodEnd: period.periodEnd.toISOString().slice(0, 10),
      status: period.status,
      processedAt: period.processedAt ? period.processedAt.toISOString() : null,
      processedBy: period.processedBy,
      version: period.version,
      createdAt: period.createdAt.toISOString(),
      updatedAt: period.updatedAt.toISOString(),
    };
  }

  private mapRunToDto(run: any): PayrollRunDto {
    return {
      id: run.id,
      propertyId: run.propertyId,
      payrollPeriodId: run.payrollPeriodId,
      status: run.status,
      totalGross: Number(run.totalGross),
      totalDeductions: Number(run.totalDeductions),
      totalNet: Number(run.totalNet),
      calculatedAt: run.calculatedAt ? run.calculatedAt.toISOString() : null,
      calculatedBy: run.calculatedBy,
      finalizedAt: run.finalizedAt ? run.finalizedAt.toISOString() : null,
      finalizedBy: run.finalizedBy,
      idempotencyKey: run.idempotencyKey,
      version: run.version,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }

  private mapLineToDto(line: any): PayrollLineDto {
    return {
      id: line.id,
      propertyId: line.propertyId,
      payrollRunId: line.payrollRunId,
      employeeId: line.employeeId,
      employee: line.employee ? {
        id: line.employee.id,
        employeeCode: line.employee.employeeCode,
        firstName: line.employee.firstName,
        lastName: line.employee.lastName,
      } : undefined,
      basic: Number(line.basic),
      housingAllowance: Number(line.housingAllowance),
      transportAllowance: Number(line.transportAllowance),
      otherAllowance: Number(line.otherAllowance),
      overtime: Number(line.overtime),
      gross: Number(line.gross),
      deductions: Number(line.deductions),
      net: Number(line.net),
      currency: line.currency,
      version: line.version,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    };
  }
}