import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { OrganizationService } from '../../../core/services/organization.service';
import { AuthService } from '../../../core/services/auth.service';
import { PmsApiService } from '../services/pms-api.service';
import {
  AssetDto,
  AssetStatus,
  CreateAssetRequest,
  CreateMaintenanceScheduleRequest,
  CreateWorkOrderRequest,
  EngineeringSummaryDto,
  MaintenanceFrequency,
  MaintenanceScheduleDto,
  RoomDto,
  ScheduleDueStatus,
  UpdateAssetRequest,
  UpdateMaintenanceScheduleRequest,
  WorkOrderDetailDto,
  WorkOrderDto,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@hms/api-contracts';
import {
  HmsAlertComponent,
  HmsButtonComponent,
  HmsDataTableComponent,
  HmsEmptyComponent,
  HmsLoadingComponent,
  HmsModalComponent,
  HmsSearchComponent,
  HmsStatusPillComponent,
} from '../../../shared/index';

export interface TechnicianOption {
  id: string;
  name: string;
  role: string;
}

@Component({
  selector: 'app-engineering',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HmsDataTableComponent,
    HmsAlertComponent,
    HmsButtonComponent,
    HmsStatusPillComponent,
    HmsEmptyComponent,
    HmsLoadingComponent,
    HmsModalComponent,
    HmsSearchComponent,
  ],
  templateUrl: './engineering.component.html',
  styleUrls: ['./engineering.component.css'],
})
export class EngineeringComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly pmsApi = inject(PmsApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly activeProperty = this.orgService.activePropertyContext;
  readonly currentUser = this.authService.currentUser;

  // Active view tab: 'overview' | 'work-orders' | 'assets' | 'schedules'
  readonly activeTab = signal<'overview' | 'work-orders' | 'assets' | 'schedules'>('overview');

  // Loading & mutation state
  readonly isLoading = signal<boolean>(false);
  readonly isActionInProgress = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Summary counts
  readonly summary = signal<EngineeringSummaryDto>({
    open: 0,
    assigned: 0,
    inProgress: 0,
    overdue: 0,
    completedToday: 0,
    roomsBlocked: 0,
    schedulesDue: 0,
  });

  // Work Orders state
  readonly workOrders = signal<WorkOrderDto[]>([]);
  readonly selectedWorkOrderStatusFilter = signal<string>('ALL');
  readonly selectedWorkOrderPriorityFilter = signal<string>('ALL');
  readonly workOrderSearchQuery = signal<string>('');
  readonly selectedWorkOrder = signal<WorkOrderDetailDto | null>(null);

  // Assets state
  readonly assets = signal<AssetDto[]>([]);
  readonly assetSearchQuery = signal<string>('');
  readonly selectedAssetCategoryFilter = signal<string>('ALL');

  // Preventive Maintenance Schedules state
  readonly schedules = signal<MaintenanceScheduleDto[]>([]);

  // Rooms for dropdowns
  readonly rooms = signal<RoomDto[]>([]);

  // Technicians for assignment
  readonly technicians = signal<TechnicianOption[]>([
    { id: 'maint-tech-1', name: 'Raj Patel', role: 'Maintenance Technician' },
    { id: 'maint-tech-2', name: 'Kenji Sato', role: 'HVAC Specialist' },
    { id: 'maint-tech-3', name: 'David Miller', role: 'Plumbing Specialist' },
  ]);

  // Modals state
  readonly isCreateWorkOrderModalOpen = signal<boolean>(false);
  readonly isCreateAssetModalOpen = signal<boolean>(false);
  readonly isCreateScheduleModalOpen = signal<boolean>(false);
  readonly isAssignModalOpen = signal<boolean>(false);

  // Form states: Create Work Order
  newWorkOrder = {
    title: '',
    description: '',
    priority: WorkOrderPriority.MEDIUM,
    category: 'HVAC',
    roomId: '',
    assetId: '',
    dueAt: '',
    assignToTechnicianId: '',
    createRoomBlock: false,
    blockType: 'OUT_OF_ORDER' as 'OUT_OF_ORDER' | 'OUT_OF_SERVICE',
    blockStartDate: '',
    blockEndDate: '',
    blockReason: '',
  };

  // Form states: Create Asset
  newAsset = {
    code: '',
    name: '',
    category: 'HVAC',
    roomId: '',
    description: '',
    status: AssetStatus.ACTIVE,
  };

  // Form states: Create Schedule
  newSchedule = {
    assetId: '',
    name: '',
    frequency: MaintenanceFrequency.MONTHLY,
    nextDueDate: '',
    description: '',
  };

  // Drawer action state: note input, assign input
  drawerNoteBody = '';
  selectedTechnicianId = '';
  actionCompletionNotes = '';

  constructor() {
    effect(
      () => {
        const prop = this.activeProperty();
        if (prop?.id) {
          this.loadAllData(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const prop = this.activeProperty();
    if (prop?.id) {
      this.loadAllData(prop.id);
    }

    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab') as 'overview' | 'work-orders' | 'assets' | 'schedules' | null;
      const targetTab = tab && ['overview', 'work-orders', 'assets', 'schedules'].includes(tab) ? tab : 'overview';
      if (this.activeTab() !== targetTab) {
        this.setTab(targetTab, false);
      }
    });
  }

  setTab(tab: 'overview' | 'work-orders' | 'assets' | 'schedules', updateUrl = true): void {
    this.activeTab.set(tab);
    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: tab === 'overview' ? { tab: null } : { tab },
        queryParamsHandling: 'merge',
      });
    }
  }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  canManageAssets(): boolean {
    return this.hasPermission('engineering.asset.manage');
  }

  canCreateWorkOrder(): boolean {
    return this.hasPermission('engineering.work_order.create');
  }

  canAssignWorkOrder(): boolean {
    return this.hasPermission('engineering.work_order.assign');
  }

  canUpdateWorkOrderStatus(): boolean {
    return this.hasPermission('engineering.work_order.status_update');
  }

  canCloseWorkOrder(): boolean {
    return this.hasPermission('engineering.work_order.close');
  }

  canManageSchedules(): boolean {
    return this.hasPermission('engineering.schedule.manage');
  }

  // ── Data Loading ──────────────────────────────────────────────────

  loadAllData(propertyId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Summary
    this.pmsApi.getEngineeringSummary(propertyId).subscribe({
      next: (res) => {
        if (res.data) this.summary.set(res.data);
      },
      error: () => {},
    });

    // Work Orders
    this.pmsApi.getWorkOrders(propertyId, { limit: 100 }).subscribe({
      next: (res) => {
        if (res.data?.items) {
          this.workOrders.set(res.data.items);
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load work orders');
      },
    });

    // Assets
    this.pmsApi.getAssets(propertyId, { limit: 100 }).subscribe({
      next: (res) => {
        if (res.data?.items) {
          this.assets.set(res.data.items);
        }
      },
      error: () => {},
    });

    // Maintenance Schedules
    this.pmsApi.getMaintenanceSchedules(propertyId, { limit: 100 }).subscribe({
      next: (res) => {
        if (res.data?.items) {
          this.schedules.set(res.data.items);
        }
      },
      error: () => {},
    });

    // Rooms for selector (only if permitted)
    if (this.hasPermission('room:read')) {
      this.pmsApi.getRooms(propertyId).subscribe({
        next: (res) => {
          if (res.data) {
            this.rooms.set(res.data);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
    } else {
      this.isLoading.set(false);
    }
  }

  // ── Filtered Views ────────────────────────────────────────────────

  readonly filteredWorkOrders = computed(() => {
    let items = this.workOrders();
    const statusFilter = this.selectedWorkOrderStatusFilter();
    const priorityFilter = this.selectedWorkOrderPriorityFilter();
    const query = this.workOrderSearchQuery().toLowerCase().trim();

    if (statusFilter === 'OVERDUE') {
      items = items.filter((w) => w.isOverdue);
    } else if (statusFilter !== 'ALL') {
      items = items.filter((w) => w.status === statusFilter);
    }

    if (priorityFilter !== 'ALL') {
      items = items.filter((w) => w.priority === priorityFilter);
    }

    if (query) {
      items = items.filter(
        (w) =>
          w.code.toLowerCase().includes(query) ||
          w.title.toLowerCase().includes(query) ||
          (w.description && w.description.toLowerCase().includes(query)) ||
          (w.roomNumber && w.roomNumber.toLowerCase().includes(query)) ||
          (w.assetName && w.assetName.toLowerCase().includes(query)),
      );
    }

    return items;
  });

  readonly filteredAssets = computed(() => {
    let items = this.assets();
    const cat = this.selectedAssetCategoryFilter();
    const query = this.assetSearchQuery().toLowerCase().trim();

    if (cat !== 'ALL') {
      items = items.filter((a) => a.category === cat);
    }

    if (query) {
      items = items.filter(
        (a) =>
          a.code.toLowerCase().includes(query) ||
          a.name.toLowerCase().includes(query) ||
          (a.roomNumber && a.roomNumber.toLowerCase().includes(query)),
      );
    }

    return items;
  });

  // ── Work Order Drawer Inspection ──────────────────────────────────

  selectWorkOrder(wo: WorkOrderDto): void {
    const prop = this.activeProperty();
    if (!prop?.id) return;

    this.isActionInProgress.set(true);
    this.pmsApi.getWorkOrder(prop.id, wo.id).subscribe({
      next: (res) => {
        this.selectedWorkOrder.set(res.data);
        this.selectedTechnicianId = res.data.assignedTechnicianId || '';
        this.actionCompletionNotes = '';
        this.drawerNoteBody = '';
        this.isActionInProgress.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load work order detail');
        this.isActionInProgress.set(false);
      },
    });
  }

  closeDrawer(): void {
    this.selectedWorkOrder.set(null);
    this.drawerNoteBody = '';
  }

  // ── Work Order Actions (ACT) ──────────────────────────────────────

  assignTechnician(): void {
    const prop = this.activeProperty();
    const wo = this.selectedWorkOrder();
    if (!prop?.id || !wo || !this.selectedTechnicianId) return;

    this.isActionInProgress.set(true);
    this.pmsApi.assignWorkOrder(prop.id, wo.id, { technicianId: this.selectedTechnicianId }).subscribe({
      next: (res) => {
        this.showSuccess(`Work order assigned to technician.`);
        this.selectWorkOrder(res.data);
        this.refreshData(prop.id);
        this.isActionInProgress.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to assign technician');
        this.isActionInProgress.set(false);
      },
    });
  }

  startWork(): void {
    const prop = this.activeProperty();
    const wo = this.selectedWorkOrder();
    if (!prop?.id || !wo) return;

    this.isActionInProgress.set(true);
    this.pmsApi.updateWorkOrderStatus(prop.id, wo.id, { status: WorkOrderStatus.IN_PROGRESS }).subscribe({
      next: (res) => {
        this.showSuccess(`Work order marked in progress.`);
        this.selectWorkOrder(res.data);
        this.refreshData(prop.id);
        this.isActionInProgress.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to start work order');
        this.isActionInProgress.set(false);
      },
    });
  }

  completeWork(): void {
    const prop = this.activeProperty();
    const wo = this.selectedWorkOrder();
    if (!prop?.id || !wo) return;

    this.isActionInProgress.set(true);
    this.pmsApi
      .updateWorkOrderStatus(prop.id, wo.id, {
        status: WorkOrderStatus.COMPLETED,
        notes: this.actionCompletionNotes || undefined,
      })
      .subscribe({
        next: (res) => {
          this.showSuccess(`Work order marked as completed.`);
          this.selectWorkOrder(res.data);
          this.refreshData(prop.id);
          this.isActionInProgress.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Failed to complete work order');
          this.isActionInProgress.set(false);
        },
      });
  }

  closeWorkOrder(): void {
    const prop = this.activeProperty();
    const wo = this.selectedWorkOrder();
    if (!prop?.id || !wo) return;

    this.isActionInProgress.set(true);
    this.pmsApi
      .closeWorkOrder(prop.id, wo.id, {
        notes: this.actionCompletionNotes || undefined,
      })
      .subscribe({
        next: (res) => {
          this.showSuccess(`Work order verified and closed.`);
          this.selectWorkOrder(res.data);
          this.refreshData(prop.id);
          this.isActionInProgress.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Failed to close work order');
          this.isActionInProgress.set(false);
        },
      });
  }

  addDrawerNote(): void {
    const prop = this.activeProperty();
    const wo = this.selectedWorkOrder();
    if (!prop?.id || !wo || !this.drawerNoteBody.trim()) return;

    this.isActionInProgress.set(true);
    this.pmsApi.addWorkOrderNote(prop.id, wo.id, { body: this.drawerNoteBody.trim() }).subscribe({
      next: (res) => {
        const currentWo = this.selectedWorkOrder();
        if (currentWo) {
          this.selectedWorkOrder.set({
            ...currentWo,
            notes: [...currentWo.notes, res.data],
          });
        }
        this.drawerNoteBody = '';
        this.isActionInProgress.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to add note');
        this.isActionInProgress.set(false);
      },
    });
  }

  // ── Work Order Creation ───────────────────────────────────────────

  openCreateWorkOrderModal(): void {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    this.newWorkOrder = {
      title: '',
      description: '',
      priority: WorkOrderPriority.MEDIUM,
      category: 'HVAC',
      roomId: '',
      assetId: '',
      dueAt: '',
      assignToTechnicianId: '',
      createRoomBlock: false,
      blockType: 'OUT_OF_ORDER',
      blockStartDate: today,
      blockEndDate: tomorrow,
      blockReason: '',
    };
    this.isCreateWorkOrderModalOpen.set(true);
  }

  submitCreateWorkOrder(): void {
    const prop = this.activeProperty();
    if (!prop?.id || !this.newWorkOrder.title.trim()) return;

    const req: CreateWorkOrderRequest = {
      title: this.newWorkOrder.title.trim(),
      description: this.newWorkOrder.description?.trim() || undefined,
      priority: this.newWorkOrder.priority,
      category: this.newWorkOrder.category as any,
      roomId: this.newWorkOrder.roomId || undefined,
      assetId: this.newWorkOrder.assetId || undefined,
      dueAt: this.newWorkOrder.dueAt ? new Date(this.newWorkOrder.dueAt).toISOString() : undefined,
      assignToTechnicianId: this.newWorkOrder.assignToTechnicianId || undefined,
    };

    if (this.newWorkOrder.createRoomBlock && this.newWorkOrder.roomId) {
      req.roomBlock = {
        type: this.newWorkOrder.blockType,
        startDate: this.newWorkOrder.blockStartDate,
        endDate: this.newWorkOrder.blockEndDate,
        reason: this.newWorkOrder.blockReason || `Work Order: ${this.newWorkOrder.title}`,
      };
    }

    this.isActionInProgress.set(true);
    this.pmsApi.createWorkOrder(prop.id, req).subscribe({
      next: (res) => {
        this.showSuccess(`Work order ${res.data.code} created successfully.`);
        this.isCreateWorkOrderModalOpen.set(false);
        this.refreshData(prop.id);
        this.isActionInProgress.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to create work order');
        this.isActionInProgress.set(false);
      },
    });
  }

  // ── Asset Creation ────────────────────────────────────────────────

  openCreateAssetModal(): void {
    this.newAsset = {
      code: '',
      name: '',
      category: 'HVAC',
      roomId: '',
      description: '',
      status: AssetStatus.ACTIVE,
    };
    this.isCreateAssetModalOpen.set(true);
  }

  submitCreateAsset(): void {
    const prop = this.activeProperty();
    if (!prop?.id || !this.newAsset.code.trim() || !this.newAsset.name.trim()) return;

    const req: CreateAssetRequest = {
      code: this.newAsset.code.trim().toUpperCase(),
      name: this.newAsset.name.trim(),
      category: this.newAsset.category,
      roomId: this.newAsset.roomId || undefined,
      description: this.newAsset.description?.trim() || undefined,
      status: this.newAsset.status,
    };

    this.isActionInProgress.set(true);
    this.pmsApi.createAsset(prop.id, req).subscribe({
      next: (res) => {
        this.showSuccess(`Asset ${res.data.code} registered successfully.`);
        this.isCreateAssetModalOpen.set(false);
        this.refreshData(prop.id);
        this.isActionInProgress.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to create asset');
        this.isActionInProgress.set(false);
      },
    });
  }

  // ── Schedule Creation ─────────────────────────────────────────────

  openCreateScheduleModal(): void {
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    this.newSchedule = {
      assetId: this.assets().length > 0 ? this.assets()[0].id : '',
      name: '',
      frequency: MaintenanceFrequency.MONTHLY,
      nextDueDate: nextWeek,
      description: '',
    };
    this.isCreateScheduleModalOpen.set(true);
  }

  submitCreateSchedule(): void {
    const prop = this.activeProperty();
    if (!prop?.id || !this.newSchedule.name.trim() || !this.newSchedule.assetId) return;

    const req: CreateMaintenanceScheduleRequest = {
      assetId: this.newSchedule.assetId,
      name: this.newSchedule.name.trim(),
      frequency: this.newSchedule.frequency,
      nextDueDate: this.newSchedule.nextDueDate,
      description: this.newSchedule.description?.trim() || undefined,
    };

    this.isActionInProgress.set(true);
    this.pmsApi.createMaintenanceSchedule(prop.id, req).subscribe({
      next: (res) => {
        this.showSuccess(`Preventive schedule '${res.data.name}' created.`);
        this.isCreateScheduleModalOpen.set(false);
        this.refreshData(prop.id);
        this.isActionInProgress.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to create schedule');
        this.isActionInProgress.set(false);
      },
    });
  }

  // ── Helper methods ────────────────────────────────────────────────

  refreshData(propertyId: string): void {
    this.loadAllData(propertyId);
  }

  showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      if (this.successMessage() === msg) {
        this.successMessage.set(null);
      }
    }, 4000);
  }

  clearAlerts(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}

