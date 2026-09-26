import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateEmployeeCompensationDto } from '../dto';
import { EmployeeCompensationDto } from '@hms/api-contracts';
import { PrismaService } from '../../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';

@Injectable()
export class CompensationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(propertyId: string, dto: CreateEmployeeCompensationDto): Promise<EmployeeCompensationDto> {
    // Check if employee exists
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, propertyId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Check if compensation for this effective date already exists
    const existing = await this.prisma.employeeCompensation.findFirst({
      where: { propertyId, employeeId: dto.employeeId, effectiveDate: new Date(dto.effectiveDate), deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Compensation record for this effective date already exists');
    }

    const compensation = await this.prisma.employeeCompensation.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        employeeId: dto.employeeId,
        effectiveDate: new Date(dto.effectiveDate),
        basicSalary: new Prisma.Decimal(dto.basicSalary),
        housingAllowance: new Prisma.Decimal(dto.housingAllowance || 0),
        transportAllowance: new Prisma.Decimal(dto.transportAllowance || 0),
        otherAllowance: new Prisma.Decimal(dto.otherAllowance || 0),
        currency: dto.currency || 'JPY',
      },
    });

    return this.mapToDto(compensation);
  }

  async findByEmployee(propertyId: string, employeeId: string): Promise<EmployeeCompensationDto[]> {
    const compensations = await this.prisma.employeeCompensation.findMany({
      where: { propertyId, employeeId, deletedAt: null },
      orderBy: { effectiveDate: 'desc' },
    });
    return compensations.map((c) => this.mapToDto(c));
  }

  async findLatest(propertyId: string, employeeId: string): Promise<EmployeeCompensationDto | null> {
    const compensation = await this.prisma.employeeCompensation.findFirst({
      where: { propertyId, employeeId, deletedAt: null },
      orderBy: { effectiveDate: 'desc' },
    });
    return compensation ? this.mapToDto(compensation) : null;
  }

  private mapToDto(compensation: any): EmployeeCompensationDto {
    return {
      id: compensation.id,
      propertyId: compensation.propertyId,
      employeeId: compensation.employeeId,
      effectiveDate: compensation.effectiveDate.toISOString().slice(0, 10),
      basicSalary: Number(compensation.basicSalary),
      housingAllowance: Number(compensation.housingAllowance),
      transportAllowance: Number(compensation.transportAllowance),
      otherAllowance: Number(compensation.otherAllowance),
      currency: compensation.currency,
      version: compensation.version,
      createdAt: compensation.createdAt.toISOString(),
      updatedAt: compensation.updatedAt.toISOString(),
    };
  }
}