import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrganizationService } from '../../../core/services/organization.service';
import { AuthService } from '../../../core/services/auth.service';
import { PmsApiService } from '../services/pms-api.service';
import {
  HousekeepingTaskDto,
  HousekeepingTaskStatus,
  InspectionResult,
} from '@hms/api-contracts';

export interface AttendantOption {
  id: string;
  name: string;
  role: string;
  email: string;
}

@Component({
  selector: 'app-housekeeping',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './housekeeping.component.html',
  styleUrls: ['./housekeeping.component.css'],
})
export class HousekeepingComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly pmsApi = inject(PmsApiService);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly currentUser = this.authService.currentUser;

  readonly isLoading = signal<boolean>(false);
  readonly isActionInProgress = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly tasks = signal<HousekeepingTaskDto[]>([]);
  readonly filteredTasks = signal<HousekeepingTaskDto[]>([]);

  // Filters
  readonly selectedStatusFilter = signal<string>('ACTIVE');
  readonly priorityFilter = signal<string>('ALL');
  readonly searchQuery = signal<string>('');

  // Selected Task & Command Panel
  readonly selectedTask = signal<HousekeepingTaskDto | null>(null);

  // Command inputs
  selectedAttendantId = '';
  inspectionNotes = '';

  // Dynamically derived attendants from authenticated user context and loaded task activity
  readonly availableAttendants = computed<AttendantOption[]>(() => {
    const list: AttendantOption[] = [];
    const current = this.currentUser();
    if (current) {
      list.push({
        id: current.id,
        name: `${current.firstName} ${current.lastName} (Active User)`,
        role: current.role || 'Staff Member',
        email: current.email,
      });
    }

    // Dynamically include any distinct attendant IDs already observed in loaded property tasks
    const seenIds = new Set<string>(list.map((a) => a.id));
    for (const t of this.tasks()) {
      if (t.assignedAttendantId && !seenIds.has(t.assignedAttendantId)) {
        seenIds.add(t.assignedAttendantId);
        list.push({
          id: t.assignedAttendantId,
          name: `Staff Member (${t.assignedAttendantId.slice(0, 8)})`,
          role: 'Attendant',
          email: '',
        });
      }
    }

    return list;
  });

  // Operational KPI Metrics
  readonly pendingCount = computed(
    () => this.tasks().filter((t) => t.status === HousekeepingTaskStatus.PENDING).length,
  );
  readonly assignedCount = computed(
    () => this.tasks().filter((t) => t.status === HousekeepingTaskStatus.ASSIGNED).length,
  );
  readonly inProgressCount = computed(
    () => this.tasks().filter((t) => t.status === HousekeepingTaskStatus.IN_PROGRESS).length,
  );
  readonly cleanedCount = computed(
    () => this.tasks().filter((t) => t.status === HousekeepingTaskStatus.CLEANED).length,
  );
  readonly inspectedCount = computed(
    () => this.tasks().filter((t) => t.status === HousekeepingTaskStatus.INSPECTED).length,
  );
  readonly rejectedCount = computed(
    () => this.tasks().filter((t) => t.status === HousekeepingTaskStatus.REJECTED).length,
  );

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop) {
          this.loadTasks(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop) {
      this.loadTasks(prop.id);
    }
  }

  loadTasks(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pmsApi.getHousekeepingTasks(propertyId, { limit: 100 }).subscribe({
      next: (res) => {
        const items = res.data?.items || [];
        this.tasks.set(items);
        this.applyFilters();
        this.isLoading.set(false);

        // If a task was selected, refresh its reference
        const currentSelected = this.selectedTask();
        if (currentSelected) {
          const fresh = items.find((t) => t.id === currentSelected.id);
          if (fresh) {
            this.selectedTask.set(fresh);
          }
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.message || err?.error?.detail || 'Failed to load housekeeping tasks.',
        );
      },
    });
  }

  applyFilters(): void {
    let result = [...this.tasks()];

    // Status Filter
    const status = this.selectedStatusFilter();
    if (status === 'ACTIVE') {
      result = result.filter((t) => t.status !== HousekeepingTaskStatus.INSPECTED);
    } else if (status !== 'ALL') {
      result = result.filter((t) => t.status === status);
    }

    // Priority Filter
    const priority = this.priorityFilter();
    if (priority !== 'ALL') {
      result = result.filter((t) => t.priority === priority);
    }

    // Search Query
    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      result = result.filter(
        (t) =>
          t.roomNumber?.toLowerCase().includes(query) ||
          t.confirmationNumber?.toLowerCase().includes(query) ||
          t.guestName?.toLowerCase().includes(query) ||
          this.getAttendantDisplayName(t.assignedAttendantId).toLowerCase().includes(query),
      );
    }

    this.filteredTasks.set(result);
  }

  setStatusFilter(status: string): void {
    this.selectedStatusFilter.set(status);
    this.applyFilters();
  }

  setPriorityFilter(priority: string): void {
    this.priorityFilter.set(priority);
    this.applyFilters();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.applyFilters();
  }

  openTaskCommand(task: HousekeepingTaskDto): void {
    this.selectedTask.set(task);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.selectedAttendantId =
      task.assignedAttendantId ||
      this.currentUser()?.id ||
      '';
    this.inspectionNotes = '';
  }

  closeTaskCommand(): void {
    this.selectedTask.set(null);
  }

  assignAttendant(): void {
    const prop = this.activeProperty();
    const task = this.selectedTask();
    if (!prop || !task || !this.selectedAttendantId) return;

    this.isActionInProgress.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.pmsApi
      .assignHousekeepingTask(prop.id, task.id, this.selectedAttendantId)
      .subscribe({
        next: (res) => {
          this.isActionInProgress.set(false);
          const updated = res.data;
          this.selectedTask.set(updated);
          this.updateTaskInList(updated);
          const attendantName = this.getAttendantDisplayName(updated.assignedAttendantId);
          this.successMessage.set(
            `Room ${updated.roomNumber} departure cleaning task assigned to ${attendantName}.`,
          );
        },
        error: (err) => {
          this.isActionInProgress.set(false);
          this.handleTaskError(err);
        },
      });
  }

  claimTask(): void {
    const prop = this.activeProperty();
    const task = this.selectedTask();
    if (!prop || !task) return;

    this.isActionInProgress.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.pmsApi.claimHousekeepingTask(prop.id, task.id).subscribe({
      next: (res) => {
        this.isActionInProgress.set(false);
        const updated = res.data;
        this.selectedTask.set(updated);
        this.updateTaskInList(updated);
        this.successMessage.set(
          `You have claimed Room ${updated.roomNumber} departure cleaning task.`,
        );
      },
      error: (err) => {
        this.isActionInProgress.set(false);
        this.handleTaskError(err);
      },
    });
  }

  startCleaning(): void {
    const prop = this.activeProperty();
    const task = this.selectedTask();
    if (!prop || !task) return;

    this.isActionInProgress.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.pmsApi.startHousekeepingCleaning(prop.id, task.id).subscribe({
      next: (res) => {
        this.isActionInProgress.set(false);
        const updated = res.data;
        this.selectedTask.set(updated);
        this.updateTaskInList(updated);
        this.successMessage.set(
          `Cleaning started for Room ${updated.roomNumber}. Room status changed to CLEANING.`,
        );
      },
      error: (err) => {
        this.isActionInProgress.set(false);
        this.handleTaskError(err);
      },
    });
  }

  completeCleaning(): void {
    const prop = this.activeProperty();
    const task = this.selectedTask();
    if (!prop || !task) return;

    this.isActionInProgress.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.pmsApi.completeHousekeepingCleaning(prop.id, task.id).subscribe({
      next: (res) => {
        this.isActionInProgress.set(false);
        const updated = res.data;
        this.selectedTask.set(updated);
        this.updateTaskInList(updated);
        this.successMessage.set(
          `Cleaning completed for Room ${updated.roomNumber}. Room marked CLEAN — awaiting supervisor inspection.`,
        );
      },
      error: (err) => {
        this.isActionInProgress.set(false);
        this.handleTaskError(err);
      },
    });
  }

  passInspection(): void {
    this.submitInspection(InspectionResult.PASSED);
  }

  failInspection(): void {
    if (!this.inspectionNotes.trim()) {
      this.errorMessage.set('Please provide inspection deficiency notes explaining the rejection.');
      return;
    }
    this.submitInspection(InspectionResult.FAILED);
  }

  private submitInspection(result: InspectionResult): void {
    const prop = this.activeProperty();
    const task = this.selectedTask();
    if (!prop || !task) return;

    this.isActionInProgress.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.pmsApi
      .inspectHousekeepingTask(
        prop.id,
        task.id,
        result,
        this.inspectionNotes.trim() || undefined,
      )
      .subscribe({
        next: (res) => {
          this.isActionInProgress.set(false);
          const updated = res.data;
          this.selectedTask.set(updated);
          this.updateTaskInList(updated);
          if (result === InspectionResult.PASSED) {
            this.successMessage.set(
              `Room ${updated.roomNumber} PASSED inspection! Room certified INSPECTED & ready for arrival.`,
            );
          } else {
            this.successMessage.set(
              `Room ${updated.roomNumber} REJECTED. Room reverted to DIRTY and returned to cleaning queue.`,
            );
          }
        },
        error: (err) => {
          this.isActionInProgress.set(false);
          this.handleTaskError(err);
        },
      });
  }

  private updateTaskInList(updated: HousekeepingTaskDto): void {
    const list = this.tasks().map((t) => (t.id === updated.id ? updated : t));
    this.tasks.set(list);
    this.applyFilters();
  }

  private handleTaskError(err: any): void {
    if (err?.status === 409) {
      this.errorMessage.set(
        'Task was updated by another user or is in a conflicting state. Refreshing latest task state...',
      );
      const prop = this.activeProperty();
      if (prop) {
        this.loadTasks(prop.id);
      }
    } else if (err?.status === 403) {
      this.errorMessage.set('You do not have permission to perform this housekeeping action.');
    } else {
      this.errorMessage.set(
        err?.error?.message || err?.error?.detail || 'An unexpected operational error occurred.',
      );
    }
  }

  getAttendantDisplayName(attendantId: string | null): string {
    if (!attendantId) return 'Unassigned';
    const found = this.availableAttendants().find((a) => a.id === attendantId);
    if (found) return found.name;
    const current = this.currentUser();
    if (current && current.id === attendantId) {
      return `${current.firstName} ${current.lastName} (You)`;
    }
    return `Attendant (${attendantId.slice(0, 8)})`;
  }

  getAttendantInitials(attendantId: string | null): string {
    if (!attendantId) return '??';
    const current = this.currentUser();
    if (current && current.id === attendantId) {
      const f = current.firstName?.[0] || 'U';
      const l = current.lastName?.[0] || 'U';
      return (f + l).toUpperCase();
    }
    return attendantId.slice(0, 2).toUpperCase();
  }
}
