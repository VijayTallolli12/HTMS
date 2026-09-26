import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { HrPayrollController } from './controllers/hr-payroll.controller';
import { EmployeeService } from './services/employee.service';
import { CompensationService } from './services/compensation.service';
import { PayrollService } from './services/payroll.service';

@Module({
  controllers: [HrPayrollController],
  providers: [PrismaService, EmployeeService, CompensationService, PayrollService],
  exports: [EmployeeService, CompensationService, PayrollService],
})
export class HrPayrollModule {}