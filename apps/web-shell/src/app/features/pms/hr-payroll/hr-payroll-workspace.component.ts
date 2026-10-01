import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { PmsApiService } from '../services/pms-api.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import {
  EmployeeDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  QueryEmployeesDto,
  EmploymentStatus,
  EmployeeCompensationDto,
  CreateEmployeeCompensationDto,
  PayrollPeriodDto,
  CreatePayrollPeriodDto,
  PayrollRunDto,
  CreatePayrollRunDto,
  CalculatePayrollDto,
  QueryPayrollPeriodsDto,
  QueryPayrollRunsDto,
  PayrollLineDto,
  PayrollSummaryDto,
} from '@hms/api-contracts';

interface TabType {
  id: string;
  label: string;
}

@Component({
  selector: 'app-hr-payroll-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hr-payroll-workspace.component.html',
  styleUrls: ['./hr-payroll-workspace.component.css'],
})
export class HrPayrollWorkspaceComponent implements OnInit, OnDestroy {
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);
  private readonly router = inject(Router);
  private readonly confirmService = inject(ConfirmService);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<{ propertyId: string; query: QueryEmployeesDto }>();

  tabs: TabType[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'employees', label: 'Employees' },
    { id: 'compensation', label: 'Compensation' },
    { id: 'periods', label: 'Payroll Periods' },
    { id: 'runs', label: 'Payroll Runs' },
    { id: 'summary', label: 'Summary' },
  ];
  activeTab = 'overview';

  // Summary data
  summary: PayrollSummaryDto | null = null;

  // Employees
  employees: EmployeeDto[] = [];
  totalEmployees = 0;
  employeePage = 1;
  employeeLimit = 20;
  employeeSearch: QueryEmployeesDto = {
    page: 1,
    limit: 20,
  };
  isLoadingEmployees = false;
  selectedEmployee: EmployeeDto | null = null;
  showEmployeeDrawer = false;
  createEmployeeForm: CreateEmployeeDto = {
    employeeCode: '',
    firstName: '',
    lastName: '',
    hireDate: '',
    department: '',
    position: '',
  };
  updateEmployeeForm: UpdateEmployeeDto = {
    firstName: '',
    lastName: '',
    department: '',
    position: '',
  };
  isEditingEmployee = false;

  // Compensation
  compensation: EmployeeCompensationDto[] = [];
  selectedCompensationEmployee: EmployeeDto | null = null;
  showCompensationDrawer = false;
  compensationForm: CreateEmployeeCompensationDto = {
    employeeId: '',
    effectiveDate: '',
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    otherAllowance: 0,
    currency: 'JPY',
  };

  // Payroll Periods
  periods: PayrollPeriodDto[] = [];
  totalPeriods = 0;
  periodPage = 1;
  periodLimit = 20;
  isLoadingPeriods = false;
  showCreatePeriod = false;
  periodForm: CreatePayrollPeriodDto = {
    periodStart: '',
    periodEnd: '',
  };

  // Payroll Runs
  runs: PayrollRunDto[] = [];
  totalRuns = 0;
  runPage = 1;
  runLimit = 20;
  isLoadingRuns = false;
  selectedRun: PayrollRunDto | null = null;
  showRunDrawer = false;
  runLines: PayrollLineDto[] = [];
  isLoadingRunLines = false;

  // Status messages
  errorMessage = '';
  successMessage = '';

  constructor() {
    effect(
      () => {
        const prop = this.orgService.activePropertyContext() as any;
        if (prop) {
          this.loadSummary(prop.id);
          this.loadEmployees(prop.id);
          this.loadPeriods(prop.id);
          this.loadRuns(prop.id);
        }
      },
      { allowSignalWrites: true },
    );

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(({ propertyId, query }) => this.loadEmployees(propertyId, query));
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getPropertyId(): string | null {
    const prop = this.orgService.activePropertyContext() as any;
    return prop?.id || null;
  }

  // ==================== Summary ====================

  loadSummary(propertyId: string) {
    this.pmsApi.getPayrollSummary(propertyId).subscribe({
      next: (res) => (this.summary = res.data),
      error: (err) => console.error('Failed to load summary', err),
    });
  }

  // ==================== Employees ====================

  loadEmployees(propertyId: string, query?: QueryEmployeesDto) {
    const q = query || { ...this.employeeSearch, propertyId };
    this.isLoadingEmployees = true;
    this.pmsApi.getEmployees(propertyId, q).subscribe({
      next: (res) => {
        this.employees = res.data.items;
        this.totalEmployees = res.data.total;
        this.employeePage = res.data.page;
        this.isLoadingEmployees = false;
      },
      error: (err) => {
        console.error('Failed to load employees', err);
        this.isLoadingEmployees = false;
        this.showError('Failed to load employees');
      },
    });
  }

  onEmployeeSearchChange() {
    this.employeeSearch.page = 1;
    const propertyId = this.getPropertyId();
    if (propertyId) this.searchSubject.next({ propertyId, query: this.employeeSearch });
  }

  onEmployeePageChange(page: number) {
    this.employeeSearch.page = page;
    const propertyId = this.getPropertyId();
    if (propertyId) this.searchSubject.next({ propertyId, query: this.employeeSearch });
  }

  openCreateEmployee() {
    this.isEditingEmployee = false;
    this.createEmployeeForm = {
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      hireDate: new Date().toISOString().slice(0, 10),
      department: '',
      position: '',
    };
    this.showEmployeeDrawer = true;
  }

  openEditEmployee(employee: EmployeeDto) {
    this.isEditingEmployee = true;
    this.selectedEmployee = employee;
    this.updateEmployeeForm = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email || '',
      phone: employee.phone || '',
      terminationDate: null,
      status: employee.status,
      department: employee.department || '',
      position: employee.position || '',
    };
    this.showEmployeeDrawer = true;
  }

  closeEmployeeDrawer() {
    this.showEmployeeDrawer = false;
    this.selectedEmployee = null;
    this.isEditingEmployee = false;
  }

  saveEmployee() {
    const propertyId = this.getPropertyId();
    if (!propertyId) return;

    if (this.isEditingEmployee && this.selectedEmployee) {
      this.pmsApi.updateEmployee(propertyId, this.selectedEmployee.id, this.updateEmployeeForm).subscribe({
        next: () => {
          this.loadEmployees(propertyId);
          this.closeEmployeeDrawer();
          this.showSuccess('Employee updated');
        },
        error: (err) => this.showError(err.error?.detail || 'Failed to update employee'),
      });
    } else {
      this.pmsApi.createEmployee(propertyId, this.createEmployeeForm).subscribe({
        next: () => {
          this.loadEmployees(propertyId);
          this.closeEmployeeDrawer();
          this.showSuccess('Employee created');
        },
        error: (err) => this.showError(err.error?.detail || 'Failed to create employee'),
      });
    }
  }

  viewEmployeeCompensation(employee: EmployeeDto) {
    this.selectedCompensationEmployee = employee;
    this.showCompensationDrawer = true;
    this.loadCompensation(employee);
  }

  // ==================== Compensation ====================

  loadCompensation(employee: EmployeeDto) {
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.pmsApi.getEmployeeCompensation(propertyId, employee.id).subscribe({
      next: (res) => (this.compensation = res.data),
      error: (err) => console.error('Failed to load compensation', err),
    });
  }

  closeCompensationDrawer() {
    this.showCompensationDrawer = false;
    this.selectedCompensationEmployee = null;
    this.compensation = [];
  }

  addCompensation() {
    if (!this.selectedCompensationEmployee) return;
    const propertyId = this.getPropertyId();
    if (!propertyId) return;

    this.compensationForm.employeeId = this.selectedCompensationEmployee.id;
    this.pmsApi.createCompensation(propertyId, this.selectedCompensationEmployee.id, this.compensationForm).subscribe({
      next: () => {
        this.loadCompensation(this.selectedCompensationEmployee!);
        this.compensationForm = {
          employeeId: '',
          effectiveDate: '',
          basicSalary: 0,
          housingAllowance: 0,
          transportAllowance: 0,
          otherAllowance: 0,
          currency: 'JPY',
        };
        this.showSuccess('Compensation added');
      },
      error: (err) => this.showError(err.error?.detail || 'Failed to add compensation'),
    });
  }

  // ==================== Payroll Periods ====================

  loadPeriods(propertyId: string) {
    this.isLoadingPeriods = true;
    this.pmsApi.getPayrollPeriods(propertyId, { page: this.periodPage, limit: this.periodLimit }).subscribe({
      next: (res) => {
        this.periods = res.data.items;
        this.totalPeriods = res.data.total;
        this.periodPage = res.data.page;
        this.isLoadingPeriods = false;
      },
      error: (err) => {
        console.error('Failed to load periods', err);
        this.isLoadingPeriods = false;
        this.showError('Failed to load payroll periods');
      },
    });
  }

  onPeriodPageChange(page: number) {
    this.periodPage = page;
    const propertyId = this.getPropertyId();
    if (propertyId) this.loadPeriods(propertyId);
  }

  openCreatePeriod() {
    this.showCreatePeriod = true;
    this.periodForm = { periodStart: '', periodEnd: '' };
  }

  closeCreatePeriod() {
    this.showCreatePeriod = false;
  }

  createPeriod() {
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.pmsApi.createPayrollPeriod(propertyId, this.periodForm).subscribe({
      next: () => {
        this.loadPeriods(propertyId);
        this.closeCreatePeriod();
        this.showSuccess('Payroll period created');
      },
      error: (err) => this.showError(err.error?.detail || 'Failed to create payroll period'),
    });
  }

  // ==================== Payroll Runs ====================

  loadRuns(propertyId: string) {
    this.isLoadingRuns = true;
    this.pmsApi.getPayrollRuns(propertyId, { page: this.runPage, limit: this.runLimit }).subscribe({
      next: (res) => {
        this.runs = res.data.items;
        this.totalRuns = res.data.total;
        this.runPage = res.data.page;
        this.isLoadingRuns = false;
      },
      error: (err) => {
        console.error('Failed to load runs', err);
        this.isLoadingRuns = false;
        this.showError('Failed to load payroll runs');
      },
    });
  }

  onRunPageChange(page: number) {
    this.runPage = page;
    const propertyId = this.getPropertyId();
    if (propertyId) this.loadRuns(propertyId);
  }

  createRun(period: PayrollPeriodDto) {
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.pmsApi.createPayrollRun(propertyId, { payrollPeriodId: period.id }).subscribe({
      next: () => {
        this.loadRuns(propertyId);
        this.showSuccess('Payroll run created');
      },
      error: (err) => this.showError(err.error?.detail || 'Failed to create payroll run'),
    });
  }

  viewRun(run: PayrollRunDto) {
    this.selectedRun = run;
    this.showRunDrawer = true;
    this.loadRunLines(run);
  }

  closeRunDrawer() {
    this.showRunDrawer = false;
    this.selectedRun = null;
    this.runLines = [];
  }

  loadRunLines(run: PayrollRunDto) {
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.isLoadingRunLines = true;
    this.pmsApi.getPayslips(propertyId, run.id).subscribe({
      next: (res) => {
        this.runLines = res.data;
        this.isLoadingRunLines = false;
      },
      error: (err) => {
        console.error('Failed to load run lines', err);
        this.isLoadingRunLines = false;
      },
    });
  }

  calculateRun(run: PayrollRunDto) {
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.pmsApi.calculatePayrollRun(propertyId, run.id, {}).subscribe({
      next: () => {
        this.loadRuns(propertyId);
        if (this.selectedRun?.id === run.id) {
          this.loadRunLines(run);
        }
        this.showSuccess('Payroll calculated');
      },
      error: (err) => this.showError(err.error?.detail || 'Failed to calculate payroll'),
    });
  }

  finalizeRun(run: PayrollRunDto) {
    this.confirmService
      .confirmDanger(
        'Finalize payroll run',
        'Finalize this payroll run? This action cannot be undone.',
        'Finalize run',
      )
      .subscribe((ok) => {
        if (!ok) return;
        const propertyId = this.getPropertyId();
        if (!propertyId) return;
        this.pmsApi.finalizePayrollRun(propertyId, run.id).subscribe({
          next: () => {
            this.loadRuns(propertyId);
            if (this.selectedRun?.id === run.id) {
              this.loadRunLines(run);
            }
            this.showSuccess('Payroll finalized');
          },
          error: (err) => this.showError(err.error?.detail || 'Failed to finalize payroll'),
        });
      });
  }

  // ==================== Helpers ====================

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  trackByEmployeeId(index: number, emp: EmployeeDto): string {
    return emp.id;
  }

  trackByPeriodId(index: number, period: PayrollPeriodDto): string {
    return period.id;
  }

  trackByRunId(index: number, run: PayrollRunDto): string {
    return run.id;
  }

  trackByLineId(index: number, line: PayrollLineDto): string {
    return line.id;
  }

  private showSuccess(message: string) {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => (this.successMessage = ''), 3000);
  }

  private showError(message: string) {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => (this.errorMessage = ''), 5000);
  }
}