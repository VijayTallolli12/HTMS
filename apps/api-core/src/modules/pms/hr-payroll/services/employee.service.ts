import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  QueryEmployeesDto,
} from '../dto';
import { EmployeeDto, EmploymentStatus } from '@hms/api-contracts';
import { PrismaService } from '../../../../common/database/prisma.service';
import { generateUuidV7 } from '@hms/shared';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(propertyId: string, dto: CreateEmployeeDto): Promise<EmployeeDto> {
    // Check if employee code already exists
    const existing = await this.prisma.employee.findFirst({
      where: { propertyId, employeeCode: dto.employeeCode, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Employee code already exists');
    }

    const employee = await this.prisma.employee.create({
      data: {
        id: generateUuidV7(),
        propertyId,
        employeeCode: dto.employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email || null,
        phone: dto.phone || null,
        hireDate: new Date(dto.hireDate),
        status: EmploymentStatus.ACTIVE,
        department: dto.department || null,
        position: dto.position || null,
      },
    });

    return this.mapToDto(employee);
  }

  async findById(propertyId: string, employeeId: string): Promise<EmployeeDto> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, propertyId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return this.mapToDto(employee);
  }

  async update(propertyId: string, employeeId: string, dto: UpdateEmployeeDto): Promise<EmployeeDto> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, propertyId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.terminationDate !== undefined && { terminationDate: dto.terminationDate ? new Date(dto.terminationDate) : null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.position !== undefined && { position: dto.position }),
        version: { increment: 1 },
      },
    });

    return this.mapToDto(updated);
  }

  async findAll(propertyId: string, query: QueryEmployeesDto): Promise<{ items: EmployeeDto[]; total: number; page: number; limit: number }> {
    const where: Prisma.EmployeeWhereInput = {
      propertyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.department ? { department: query.department } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { employeeCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items: items.map((e) => this.mapToDto(e)),
      total,
      page,
      limit,
    };
  }

  async getActiveCount(propertyId: string): Promise<number> {
    return this.prisma.employee.count({
      where: { propertyId, deletedAt: null, status: EmploymentStatus.ACTIVE },
    });
  }

  private mapToDto(employee: any): EmployeeDto {
    return {
      id: employee.id,
      propertyId: employee.propertyId,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      hireDate: employee.hireDate.toISOString().slice(0, 10),
      terminationDate: employee.terminationDate ? employee.terminationDate.toISOString().slice(0, 10) : null,
      status: employee.status,
      department: employee.department,
      position: employee.position,
      version: employee.version,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    };
  }
}