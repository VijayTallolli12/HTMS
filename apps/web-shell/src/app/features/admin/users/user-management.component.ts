import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ManagedUserSummaryDto,
  AccessiblePropertyDto,
  CreateUserRequest,
  UpdateUserRequest,
} from '@hms/api-contracts';
import { UserManagementApiService } from './services/user-management-api.service';
import { AuthService } from '../../../core/services/auth.service';

interface RoleOption {
  code: string;
  name: string;
  description: string;
  gmPermitted: boolean;
}

const ALL_ROLES: RoleOption[] = [
  { code: 'CORP_ADMIN', name: 'Corporate Platform Admin', description: 'Multi-property corporate oversight', gmPermitted: false },
  { code: 'PROPERTY_GM', name: 'General Manager', description: 'Full property operational authority', gmPermitted: false },
  { code: 'FOM', name: 'Front Office Manager', description: 'Front desk operations & allocations', gmPermitted: true },
  { code: 'FDA', name: 'Front Desk Agent', description: 'Check-in, room assignments, folio cashiering', gmPermitted: true },
  { code: 'HK_SUPERVISOR', name: 'Housekeeping Supervisor', description: 'Room inspections & cleaning dispatch', gmPermitted: true },
  { code: 'ROOM_ATTENDANT', name: 'Room Attendant', description: 'Room cleaning & minibar logging', gmPermitted: true },
  { code: 'MAINT_TECH', name: 'Maintenance Technician', description: 'Work orders & asset maintenance', gmPermitted: true },
  { code: 'FNB_MANAGER', name: 'Restaurant / F&B Manager', description: 'Outlets, menu catalog & dining orders', gmPermitted: true },
  { code: 'SPA_MANAGER', name: 'Spa Manager', description: 'Wellness treatments & therapist schedules', gmPermitted: true },
];

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css'],
})
export class UserManagementComponent implements OnInit {
  private readonly api = inject(UserManagementApiService);
  private readonly auth = inject(AuthService);

  readonly users = signal<ManagedUserSummaryDto[]>([]);
  readonly accessibleProperties = signal<AccessiblePropertyDto[]>([]);
  readonly totalUsers = signal(0);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Filters
  searchTerm = '';
  roleFilter = '';
  propertyFilter = '';
  statusFilter = '';
  currentPage = 1;
  pageSize = 25;

  // Modal / Drawer state
  isCreateModalOpen = false;
  isEditModalOpen = false;
  isAssignModalOpen = false;
  selectedUser = signal<ManagedUserSummaryDto | null>(null);

  // Form Model
  formFirstName = '';
  formLastName = '';
  formEmail = '';
  formPhone = '';
  formRoleCode = 'FDA';
  formStatus: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
  formInitialPassword = '';
  selectedPropertyIds = new Set<string>();

  get canWrite(): boolean {
    return this.auth.hasPermission('user.manage.write');
  }

  get isCorporateAdmin(): boolean {
    return (
      this.auth.hasRole('CORP_ADMIN') ||
      this.auth.hasRole('PLATFORM_OWNER') ||
      this.auth.roleScopes().some((s) => s.scopeType === 'GLOBAL' || s.scopeType === 'GROUP')
    );
  }

  readonly availableRoles = computed(() => {
    if (this.isCorporateAdmin) {
      return ALL_ROLES.filter((r) => r.code !== 'PLATFORM_OWNER');
    }
    return ALL_ROLES.filter((r) => r.gmPermitted);
  });

  ngOnInit(): void {
    this.loadAccessibleProperties();
    this.loadUsers();
  }

  loadAccessibleProperties(): void {
    this.api.getAccessibleProperties().subscribe({
      next: (res) => {
        this.accessibleProperties.set(res.data || []);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to load properties.');
      },
    });
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.api
      .listUsers({
        search: this.searchTerm || undefined,
        role: this.roleFilter || undefined,
        propertyId: this.propertyFilter || undefined,
        status: this.statusFilter || undefined,
        page: this.currentPage,
        limit: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.users.set(res.data.items || []);
          this.totalUsers.set(res.data.total || 0);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.detail || 'Failed to retrieve staff users.');
          this.isLoading.set(false);
        },
      });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  openCreateModal(): void {
    this.selectedUser.set(null);
    this.formFirstName = '';
    this.formLastName = '';
    this.formEmail = '';
    this.formPhone = '';
    this.formRoleCode = this.availableRoles()[0]?.code || 'FDA';
    this.formStatus = 'ACTIVE';
    this.formInitialPassword = '';
    this.selectedPropertyIds = new Set<string>();

    const firstProp = this.accessibleProperties()[0];
    if (firstProp) {
      this.selectedPropertyIds.add(firstProp.id);
    }

    this.errorMessage.set(null);
    this.isCreateModalOpen = true;
  }

  openEditModal(user: ManagedUserSummaryDto): void {
    this.selectedUser.set(user);
    this.formFirstName = user.firstName;
    this.formLastName = user.lastName;
    this.formEmail = user.email;
    this.formPhone = user.phone || '';
    this.formRoleCode = user.role?.code || 'FDA';
    this.formStatus = (user.status === 'ACTIVE' || user.status === 'INACTIVE') ? user.status : 'ACTIVE';
    this.selectedPropertyIds = new Set<string>(user.assignedProperties.map((p) => p.id));

    this.errorMessage.set(null);
    this.isEditModalOpen = true;
  }

  openAssignModal(user: ManagedUserSummaryDto): void {
    this.selectedUser.set(user);
    this.selectedPropertyIds = new Set<string>(user.assignedProperties.map((p) => p.id));
    this.errorMessage.set(null);
    this.isAssignModalOpen = true;
  }

  closeModal(): void {
    this.isCreateModalOpen = false;
    this.isEditModalOpen = false;
    this.isAssignModalOpen = false;
    this.selectedUser.set(null);
  }

  togglePropertySelection(propertyId: string): void {
    if (this.selectedPropertyIds.has(propertyId)) {
      this.selectedPropertyIds.delete(propertyId);
    } else {
      this.selectedPropertyIds.add(propertyId);
    }
  }

  isPropertySelected(propertyId: string): boolean {
    return this.selectedPropertyIds.has(propertyId);
  }

  saveCreateUser(): void {
    if (!this.formFirstName.trim() || !this.formLastName.trim() || !this.formEmail.trim()) {
      this.errorMessage.set('First name, last name, and email are required.');
      return;
    }

    const propertyIds = Array.from(this.selectedPropertyIds);
    if (propertyIds.length === 0) {
      this.errorMessage.set('Select at least one property assignment.');
      return;
    }

    const payload: CreateUserRequest = {
      firstName: this.formFirstName.trim(),
      lastName: this.formLastName.trim(),
      email: this.formEmail.trim(),
      phone: this.formPhone.trim() || undefined,
      roleCode: this.formRoleCode,
      propertyIds,
      status: this.formStatus,
      initialPassword: this.formInitialPassword.trim() || undefined,
    };

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.api.createUser(payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.closeModal();
        const provisioned = res.data?.provisionedPassword;
        this.successMessage.set(
          provisioned
            ? `User account created. One-time initial password: ${provisioned} — share it securely; it will not be shown again.`
            : 'User account created and provisioned successfully.',
        );
        setTimeout(() => this.successMessage.set(null), provisioned ? 15000 : 4000);
        this.loadUsers();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to create user.');
      },
    });
  }

  saveEditUser(): void {
    const user = this.selectedUser();
    if (!user) return;

    const propertyIds = Array.from(this.selectedPropertyIds);
    if (propertyIds.length === 0) {
      this.errorMessage.set('A user must have at least one assigned property.');
      return;
    }

    const payload: UpdateUserRequest = {
      firstName: this.formFirstName.trim(),
      lastName: this.formLastName.trim(),
      phone: this.formPhone.trim() || undefined,
      roleCode: this.formRoleCode,
      propertyIds,
      status: this.formStatus,
    };

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.api.updateUser(user.id, payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeModal();
        this.successMessage.set('User updated successfully.');
        setTimeout(() => this.successMessage.set(null), 4000);
        this.loadUsers();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to update user.');
      },
    });
  }

  savePropertyAssignments(): void {
    const user = this.selectedUser();
    if (!user) return;

    const propertyIds = Array.from(this.selectedPropertyIds);
    if (propertyIds.length === 0) {
      this.errorMessage.set('Select at least one property assignment.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.api.updateUser(user.id, { propertyIds }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeModal();
        this.successMessage.set('Property assignments updated.');
        setTimeout(() => this.successMessage.set(null), 4000);
        this.loadUsers();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.detail || err?.message || 'Failed to update property assignments.');
      },
    });
  }

  toggleUserStatus(user: ManagedUserSummaryDto): void {
    const newStatus: 'ACTIVE' | 'INACTIVE' = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${actionLabel} ${user.firstName} ${user.lastName}?`)) {
      return;
    }

    this.isLoading.set(true);
    this.api.updateStatus(user.id, newStatus).subscribe({
      next: () => {
        this.successMessage.set(`User ${user.firstName} ${user.lastName} is now ${newStatus.toLowerCase()}.`);
        setTimeout(() => this.successMessage.set(null), 4000);
        this.loadUsers();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.detail || `Failed to ${actionLabel} user.`);
      },
    });
  }

  getRoleBadgeClass(roleCode?: string): string {
    switch (roleCode) {
      case 'CORP_ADMIN':
        return 'role-badge-corp';
      case 'PROPERTY_GM':
        return 'role-badge-gm';
      case 'FOM':
      case 'FDA':
        return 'role-badge-frontdesk';
      case 'HK_SUPERVISOR':
      case 'ROOM_ATTENDANT':
        return 'role-badge-housekeeping';
      case 'MAINT_TECH':
        return 'role-badge-maint';
      case 'FNB_MANAGER':
        return 'role-badge-fnb';
      case 'SPA_MANAGER':
        return 'role-badge-spa';
      default:
        return 'role-badge-default';
    }
  }
}

