import { getPrismaClient } from '../client';
import { generateUuidV7 } from '@hms/shared';
import { Prisma } from '@prisma/client';

// Local enum definitions to avoid cross-package import issues
enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TERMINATED = 'TERMINATED',
  ON_LEAVE = 'ON_LEAVE',
}

enum PayrollPeriodStatus {
  OPEN = 'OPEN',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  CLOSED = 'CLOSED',
}

enum PayrollRunStatus {
  DRAFT = 'DRAFT',
  CALCULATING = 'CALCULATING',
  CALCULATED = 'CALCULATED',
  FINALIZED = 'FINALIZED',
}

export async function seedHrPayroll(propertyId: string): Promise<void> {
  const prisma = getPrismaClient();
  console.log('Seeding HR & Payroll demo data...');

  // Create employees
  const employees = await seedEmployees(prisma, propertyId);
  console.log(`  Created ${employees.length} employees`);

  // Create compensation records
  await seedCompensations(prisma, propertyId, employees);
  console.log('  Created compensation records');

  // Create payroll period
  const period = await seedPayrollPeriod(prisma, propertyId);
  console.log('  Created payroll period');

  // Create payroll run
  const run = await seedPayrollRun(prisma, propertyId, period.id, employees);
  console.log('  Created payroll run with calculated payslips');

  console.log('HR & Payroll demo seeding completed.');
}

async function seedEmployees(prisma: any, propertyId: string) {
  const employeeData = [
    {
      employeeCode: 'EMP-001',
      firstName: 'Daniel',
      lastName: 'Thomas',
      email: 'daniel.thomas@demo.hms',
      phone: '+1-415-555-0202',
      hireDate: new Date('2020-01-15'),
      department: 'Front Office',
      position: 'Front Office Manager',
    },
    {
      employeeCode: 'EMP-002',
      firstName: 'Sara',
      lastName: 'Khan',
      email: 'sara.khan@demo.hms',
      phone: '+44-20-555-0303',
      hireDate: new Date('2021-03-22'),
      department: 'Housekeeping',
      position: 'Housekeeping Supervisor',
    },
    {
      employeeCode: 'EMP-003',
      firstName: 'James',
      lastName: 'Wright',
      email: 'james.wright@demo.hms',
      phone: '+61-2-555-0606',
      hireDate: new Date('2019-06-10'),
      department: 'Engineering',
      position: 'Maintenance Technician',
    },
    {
      employeeCode: 'EMP-004',
      firstName: 'Maria',
      lastName: 'Fernandes',
      email: 'maria.fernandes@demo.hms',
      phone: '+351-91-555-0505',
      hireDate: new Date('2022-09-01'),
      department: 'F&B',
      position: 'Restaurant Server',
    },
    {
      employeeCode: 'EMP-005',
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael.chen@demo.hms',
      phone: '+1-212-555-0101',
      hireDate: new Date('2018-11-05'),
      department: 'Management',
      position: 'General Manager',
    },
    {
      employeeCode: 'EMP-006',
      firstName: 'Aisha',
      lastName: 'Rahman',
      email: 'aisha.rahman@demo.hms',
      phone: '+971-50-555-0707',
      hireDate: new Date('2023-02-14'),
      department: 'Spa',
      position: 'Spa Therapist',
    },
  ];

  const createdEmployees = [];
  for (const emp of employeeData) {
    let existing = await prisma.employee.findFirst({
      where: { propertyId, employeeCode: emp.employeeCode },
    });

    if (!existing) {
      // Use raw SQL to avoid enum type issues
      await prisma.$executeRaw`
        INSERT INTO pms_schema.employees (id, property_id, employee_code, first_name, last_name, email, phone, hire_date, department, position, status, created_at, updated_at)
        VALUES (${generateUuidV7()}, ${propertyId}, ${emp.employeeCode}, ${emp.firstName}, ${emp.lastName}, ${emp.email}, ${emp.phone}, ${emp.hireDate}, ${emp.department}, ${emp.position}, 'ACTIVE'::pms_schema.employment_status, now(), now())
        ON CONFLICT (property_id, employee_code) DO NOTHING
      `;
      existing = await prisma.employee.findFirst({
        where: { propertyId, employeeCode: emp.employeeCode },
      });
      console.log(`    Created Employee: ${emp.employeeCode} - ${emp.firstName} ${emp.lastName}`);
    } else {
      console.log(`    Employee exists: ${emp.employeeCode} - ${emp.firstName} ${emp.lastName}`);
    }
    createdEmployees.push(existing);
  }

  return createdEmployees;
}

async function seedCompensations(prisma: any, propertyId: string, employees: any[]) {
  const compensationData: Record<string, { basic: number; housing: number; transport: number; other: number }> = {
    'EMP-001': { basic: 450000, housing: 90000, transport: 30000, other: 20000 },   // Daniel - FOM
    'EMP-002': { basic: 380000, housing: 76000, transport: 25000, other: 15000 },   // Sara - HK Supervisor
    'EMP-003': { basic: 350000, housing: 70000, transport: 20000, other: 10000 },   // James - Maint Tech
    'EMP-004': { basic: 280000, housing: 56000, transport: 15000, other: 5000 },    // Maria - Server
    'EMP-005': { basic: 800000, housing: 160000, transport: 50000, other: 40000 },  // Michael - GM
    'EMP-006': { basic: 320000, housing: 64000, transport: 20000, other: 10000 },   // Aisha - Spa Therapist
  };

  for (const employee of employees) {
    const comp = compensationData[employee.employeeCode];
    if (!comp) continue;

    const existing = await prisma.employeeCompensation.findFirst({
      where: { propertyId, employeeId: employee.id, deletedAt: null },
    });

    if (!existing) {
      await prisma.employeeCompensation.create({
        data: {
          id: generateUuidV7(),
          propertyId,
          employeeId: employee.id,
          effectiveDate: new Date('2024-01-01'),
          basicSalary: new Prisma.Decimal(comp.basic),
          housingAllowance: new Prisma.Decimal(comp.housing),
          transportAllowance: new Prisma.Decimal(comp.transport),
          otherAllowance: new Prisma.Decimal(comp.other),
          currency: 'JPY',
        },
      });
    }
  }
}

async function seedPayrollPeriod(prisma: any, propertyId: string) {
  // Create a period for October 2024
  let period = await prisma.payrollPeriod.findFirst({
    where: { propertyId, periodStart: new Date('2024-10-01'), periodEnd: new Date('2024-10-31') },
  });

  if (!period) {
    await prisma.$executeRaw`
      INSERT INTO pms_schema.payroll_periods (id, property_id, period_start, period_end, status, processed_at, processed_by, created_at, updated_at)
      VALUES (${generateUuidV7()}::uuid, ${propertyId}::uuid, '2024-10-01', '2024-10-31', 'PROCESSED'::pms_schema.payroll_period_status, '2024-11-02', '00000000-0000-0000-0000-000000000001'::uuid, now(), now())
      ON CONFLICT (property_id, period_start, period_end) DO NOTHING
      RETURNING id, property_id, period_start, period_end, status, processed_at, processed_by, created_at, updated_at
    `;
    period = await prisma.payrollPeriod.findFirst({
      where: { propertyId, periodStart: new Date('2024-10-01'), periodEnd: new Date('2024-10-31') },
    });
  }

  return period;
}

async function seedPayrollRun(prisma: any, propertyId: string, periodId: string, employees: any[]) {
  // Check if run already exists
  let run = await prisma.payrollRun.findFirst({
    where: { propertyId, payrollPeriodId: periodId },
  });

  if (run) {
    // Update to finalized if not already
    if (run.status !== 'FINALIZED') {
      await prisma.$executeRaw`
        UPDATE pms_schema.payroll_runs
        SET status = 'FINALIZED'::pms_schema.payroll_run_status,
            finalized_at = '2024-11-05',
            finalized_by = 'system-seed'
        WHERE id = ${run.id}
      `;
      return await prisma.payrollRun.findUnique({ where: { id: run.id } });
    }
    return run;
  }

  // Calculate payroll for each employee
  const employeesWithComp = await prisma.$queryRaw<Array<any>>`
    SELECT e.*, c.basic_salary, c.housing_allowance, c.transport_allowance, c.other_allowance
    FROM pms_schema.employees e
    LEFT JOIN LATERAL (
      SELECT basic_salary, housing_allowance, transport_allowance, other_allowance
      FROM pms_schema.employee_compensations ec
      WHERE ec.property_id = e.property_id AND ec.employee_id = e.id AND ec.deleted_at IS NULL
      ORDER BY ec.effective_date DESC
      LIMIT 1
    ) c ON true
    WHERE e.property_id = ${propertyId} AND e.deleted_at IS NULL AND e.status = 'ACTIVE'::pms_schema.employment_status
  `;

  const linesData: any[] = [];
  let totalGross = new Prisma.Decimal(0);
  let totalDeductions = new Prisma.Decimal(0);
  let totalNet = new Prisma.Decimal(0);

  for (const employee of employeesWithComp) {
    if (!employee.basic_salary) continue;

    const basic = new Prisma.Decimal(employee.basic_salary);
    const housing = new Prisma.Decimal(employee.housing_allowance);
    const transport = new Prisma.Decimal(employee.transport_allowance);
    const other = new Prisma.Decimal(employee.other_allowance);
    const overtime = new Prisma.Decimal(0);

    const gross = basic.add(housing).add(transport).add(other).add(overtime);
    const deductions = gross.mul(new Prisma.Decimal('0.15')); // 15% demo deductions
    const net = gross.sub(deductions);

    totalGross = totalGross.add(gross);
    totalDeductions = totalDeductions.add(deductions);
    totalNet = totalNet.add(net);

    linesData.push({
      id: generateUuidV7(),
      propertyId,
      payrollRunId: '', // Will be set after run creation
      employeeId: employee.id,
      basic,
      housingAllowance: housing,
      transportAllowance: transport,
      otherAllowance: other,
      overtime,
      gross,
      deductions,
      net,
      currency: 'JPY',
    });
  }

  // Create run and lines
  const runId = generateUuidV7();
  const systemUserId = '00000000-0000-0000-0000-000000000001';
await prisma.$executeRaw`
    INSERT INTO pms_schema.payroll_runs (id, property_id, payroll_period_id, status, total_gross, total_deductions, total_net, calculated_at, calculated_by, finalized_at, finalized_by, idempotency_key, created_at, updated_at)
    VALUES (${runId}::uuid, ${propertyId}::uuid, ${periodId}::uuid, 'FINALIZED'::pms_schema.payroll_run_status, ${totalGross}, ${totalDeductions}, ${totalNet}, '2024-11-03', ${systemUserId}::uuid, '2024-11-05', ${systemUserId}::uuid, 'demo-seed-run-' || ${periodId}, now(), now())
  `;

  // Create lines
  for (const line of linesData) {
    await prisma.$executeRaw`
      INSERT INTO pms_schema.payroll_lines (id, property_id, payroll_run_id, employee_id, basic, housing_allowance, transport_allowance, other_allowance, overtime, gross, deductions, net, currency, created_at, updated_at)
      VALUES (${line.id}::uuid, ${propertyId}::uuid, ${runId}::uuid, ${line.employeeId}::uuid, ${line.basic}, ${line.housingAllowance}, ${line.transportAllowance}, ${line.otherAllowance}, ${line.overtime}, ${line.gross}, ${line.deductions}, ${line.net}, ${line.currency}, now(), now())
    `;
  }

  return { id: runId, propertyId, payrollPeriodId: periodId, status: 'FINALIZED', totalGross, totalDeductions, totalNet, calculatedAt: new Date('2024-11-03'), calculatedBy: systemUserId, finalizedAt: new Date('2024-11-05'), finalizedBy: systemUserId };
}

if (require.main === module) {
  (async () => {
    const prisma = getPrismaClient();
    const property = await prisma.property.findUnique({ where: { code: 'PROP-TYO-001' } });
    if (property) {
      await seedHrPayroll(property.id);
    }
    await prisma.$disconnect();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}