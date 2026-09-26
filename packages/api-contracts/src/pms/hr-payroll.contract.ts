export enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TERMINATED = 'TERMINATED',
  ON_LEAVE = 'ON_LEAVE',
}

export enum PayrollPeriodStatus {
  OPEN = 'OPEN',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  CLOSED = 'CLOSED',
}

export enum PayrollRunStatus {
  DRAFT = 'DRAFT',
  CALCULATING = 'CALCULATING',
  CALCULATED = 'CALCULATED',
  FINALIZED = 'FINALIZED',
}

export interface EmployeeDto {
  id: string;
  propertyId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  hireDate: string;
  terminationDate?: string | null;
  status: EmploymentStatus;
  department?: string | null;
  position?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeDto {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hireDate: string;
  department?: string;
  position?: string;
}

export interface UpdateEmployeeDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  terminationDate?: string | null;
  status?: EmploymentStatus;
  department?: string;
  position?: string;
}

export interface QueryEmployeesDto {
  status?: EmploymentStatus;
  department?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EmployeeCompensationDto {
  id: string;
  propertyId: string;
  employeeId: string;
  effectiveDate: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  currency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeCompensationDto {
  employeeId: string;
  effectiveDate: string;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowance?: number;
  currency?: string;
}

export interface PayrollPeriodDto {
  id: string;
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollPeriodStatus;
  processedAt?: string | null;
  processedBy?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePayrollPeriodDto {
  periodStart: string;
  periodEnd: string;
}

export interface PayrollRunDto {
  id: string;
  propertyId: string;
  payrollPeriodId: string;
  status: PayrollRunStatus;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  calculatedAt?: string | null;
  calculatedBy?: string | null;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
  idempotencyKey?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePayrollRunDto {
  payrollPeriodId: string;
  idempotencyKey?: string;
}

export interface PayrollLineDto {
  id: string;
  propertyId: string;
  payrollRunId: string;
  employeeId: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  };
  basic: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  overtime: number;
  gross: number;
  deductions: number;
  net: number;
  currency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface QueryPayrollPeriodsDto {
  page?: number;
  limit?: number;
}

export interface QueryPayrollRunsDto {
  page?: number;
  limit?: number;
}

export interface CalculatePayrollDto {
  idempotencyKey?: string;
}

export interface PayrollSummaryDto {
  employeeCount: number;
  activeEmployeeCount: number;
  currentPeriod?: PayrollPeriodDto | null;
  latestRun?: PayrollRunDto | null;
  totalGross: number;
  totalNet: number;
}