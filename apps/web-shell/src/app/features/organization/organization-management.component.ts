import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  HotelGroupDto,
  RegionDto,
  CountryDto,
  PropertyDto,
  BuildingDto,
  FloorDto,
  OrganizationHierarchyTree,
} from '@hms/api-contracts';
import { OrganizationService } from '../../core/services/organization.service';
import { HmsDataTableComponent, HmsModalComponent, HmsAlertComponent, HmsButtonComponent, HmsEmptyComponent, HmsLoadingComponent } from '../../shared/index';

type NavLevel = 'group' | 'region' | 'country' | 'property' | 'building' | 'floor' | 'tree';

@Component({
  selector: 'hms-organization-management',
  standalone: true,
  imports: [CommonModule, FormsModule, HmsDataTableComponent, HmsModalComponent, HmsAlertComponent, HmsButtonComponent, HmsEmptyComponent, HmsLoadingComponent],
  templateUrl: './organization-management.component.html',
  styleUrls: ['./organization-management.component.css'],
})
export class OrganizationManagementComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);

  readonly currentLevel = signal<NavLevel>('group');
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly selectedGroup = signal<HotelGroupDto | null>(null);
  readonly selectedRegion = signal<RegionDto | null>(null);
  readonly selectedCountry = signal<CountryDto | null>(null);
  readonly selectedProperty = signal<PropertyDto | null>(null);
  readonly selectedBuilding = signal<BuildingDto | null>(null);

  readonly groups = signal<HotelGroupDto[]>([]);
  readonly regions = signal<RegionDto[]>([]);
  readonly countries = signal<CountryDto[]>([]);
  readonly properties = signal<PropertyDto[]>([]);
  readonly buildings = signal<BuildingDto[]>([]);
  readonly floors = signal<FloorDto[]>([]);
  readonly hierarchyTree = signal<OrganizationHierarchyTree | null>(null);

  readonly isModalOpen = signal<boolean>(false);
  readonly modalType = signal<NavLevel>('group');
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly editingId = signal<string | null>(null);

  formCode = '';
  formName = '';
  formDescription = '';
  formLegalName = '';
  formTimeZone = 'Asia/Tokyo';
  formCurrency = 'JPY';
  formAddressLine1 = '';
  formCity = '';
  formStateProvince = '';
  formPostalCode = '';
  formFloorNumber = 1;

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.isLoading.set(true);
    this.clearMessages();
    this.orgService.getGroups().subscribe({
      next: (res) => {
        this.groups.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  loadRegions(groupId: string): void {
    this.isLoading.set(true);
    this.clearMessages();
    this.orgService.getRegions(groupId).subscribe({
      next: (res) => {
        this.regions.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  loadCountries(regionId: string): void {
    this.isLoading.set(true);
    this.clearMessages();
    this.orgService.getCountries(regionId).subscribe({
      next: (res) => {
        this.countries.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  loadProperties(countryId: string): void {
    this.isLoading.set(true);
    this.clearMessages();
    this.orgService.getProperties(countryId).subscribe({
      next: (res) => {
        this.properties.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  loadBuildings(propertyId: string): void {
    this.isLoading.set(true);
    this.clearMessages();
    this.orgService.getBuildings(propertyId).subscribe({
      next: (res) => {
        this.buildings.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  loadFloors(buildingId: string): void {
    this.isLoading.set(true);
    this.clearMessages();
    this.orgService.getFloors(buildingId).subscribe({
      next: (res) => {
        this.floors.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  loadHierarchyTree(): void {
    this.isLoading.set(true);
    this.clearMessages();
    this.orgService.getHierarchyTree().subscribe({
      next: (res) => {
        this.hierarchyTree.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  selectGroup(group: HotelGroupDto): void {
    this.selectedGroup.set(group);
    this.selectedRegion.set(null);
    this.selectedCountry.set(null);
    this.selectedProperty.set(null);
    this.selectedBuilding.set(null);
    this.currentLevel.set('region');
    this.loadRegions(group.id);
  }

  selectRegion(region: RegionDto): void {
    this.selectedRegion.set(region);
    this.selectedCountry.set(null);
    this.selectedProperty.set(null);
    this.selectedBuilding.set(null);
    this.currentLevel.set('country');
    this.loadCountries(region.id);
  }

  selectCountry(country: CountryDto): void {
    this.selectedCountry.set(country);
    this.selectedProperty.set(null);
    this.selectedBuilding.set(null);
    this.currentLevel.set('property');
    this.loadProperties(country.id);
  }

  selectProperty(property: PropertyDto): void {
    this.selectedProperty.set(property);
    this.selectedBuilding.set(null);
    this.currentLevel.set('building');
    this.loadBuildings(property.id);
  }

  selectBuilding(building: BuildingDto): void {
    this.selectedBuilding.set(building);
    this.currentLevel.set('floor');
    this.loadFloors(building.id);
  }

  navigateTo(level: NavLevel): void {
    this.currentLevel.set(level);
    this.clearMessages();
    if (level === 'group') {
      this.selectedGroup.set(null);
      this.selectedRegion.set(null);
      this.selectedCountry.set(null);
      this.selectedProperty.set(null);
      this.selectedBuilding.set(null);
      this.loadGroups();
    } else if (level === 'region' && this.selectedGroup()) {
      this.selectedRegion.set(null);
      this.selectedCountry.set(null);
      this.selectedProperty.set(null);
      this.selectedBuilding.set(null);
      this.loadRegions(this.selectedGroup()!.id);
    } else if (level === 'country' && this.selectedRegion()) {
      this.selectedCountry.set(null);
      this.selectedProperty.set(null);
      this.selectedBuilding.set(null);
      this.loadCountries(this.selectedRegion()!.id);
    } else if (level === 'property' && this.selectedCountry()) {
      this.selectedProperty.set(null);
      this.selectedBuilding.set(null);
      this.loadProperties(this.selectedCountry()!.id);
    } else if (level === 'building' && this.selectedProperty()) {
      this.selectedBuilding.set(null);
      this.loadBuildings(this.selectedProperty()!.id);
    } else if (level === 'floor' && this.selectedBuilding()) {
      this.loadFloors(this.selectedBuilding()!.id);
    } else if (level === 'tree') {
      this.loadHierarchyTree();
    }
  }

  setActivePropertyContext(property: PropertyDto): void {
    this.orgService.setActiveProperty(property);
    this.successMessage.set(`Active Property Context set to: ${property.name} (${property.code})`);
  }

  openCreateModal(level: NavLevel): void {
    this.modalType.set(level);
    this.modalMode.set('create');
    this.editingId.set(null);
    this.resetForm();
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.resetForm();
  }

  saveEntity(): void {
    const type = this.modalType();
    this.clearMessages();

    if (type === 'group') {
      this.orgService
        .createGroup({
          code: this.formCode,
          name: this.formName,
          description: this.formDescription || undefined,
        })
        .subscribe({
          next: () => {
            this.successMessage.set(`Hotel Group '${this.formName}' created successfully.`);
            this.closeModal();
            this.loadGroups();
          },
          error: (err) => this.handleError(err),
        });
    } else if (type === 'region') {
      const group = this.selectedGroup();
      if (!group) return;
      this.orgService
        .createRegion({
          hotelGroupId: group.id,
          code: this.formCode,
          name: this.formName,
          description: this.formDescription || undefined,
        })
        .subscribe({
          next: () => {
            this.successMessage.set(`Region '${this.formName}' created successfully.`);
            this.closeModal();
            this.loadRegions(group.id);
          },
          error: (err) => this.handleError(err),
        });
    } else if (type === 'country') {
      const region = this.selectedRegion();
      if (!region) return;
      this.orgService
        .createCountry({
          regionId: region.id,
          code: this.formCode.toUpperCase(),
          name: this.formName,
        })
        .subscribe({
          next: () => {
            this.successMessage.set(`Country '${this.formName}' created successfully.`);
            this.closeModal();
            this.loadCountries(region.id);
          },
          error: (err) => this.handleError(err),
        });
    } else if (type === 'property') {
      const country = this.selectedCountry();
      if (!country) return;
      this.orgService
        .createProperty({
          countryId: country.id,
          code: this.formCode,
          name: this.formName,
          legalName: this.formLegalName || undefined,
          timeZone: this.formTimeZone,
          currency: this.formCurrency.toUpperCase(),
          addressLine1: this.formAddressLine1 || undefined,
          city: this.formCity || undefined,
          stateProvince: this.formStateProvince || undefined,
          postalCode: this.formPostalCode || undefined,
        })
        .subscribe({
          next: () => {
            this.successMessage.set(`Property '${this.formName}' created successfully.`);
            this.closeModal();
            this.loadProperties(country.id);
          },
          error: (err) => this.handleError(err),
        });
    } else if (type === 'building') {
      const property = this.selectedProperty();
      if (!property) return;
      this.orgService
        .createBuilding({
          propertyId: property.id,
          code: this.formCode,
          name: this.formName,
          description: this.formDescription || undefined,
        })
        .subscribe({
          next: () => {
            this.successMessage.set(`Building '${this.formName}' created successfully.`);
            this.closeModal();
            this.loadBuildings(property.id);
          },
          error: (err) => this.handleError(err),
        });
    } else if (type === 'floor') {
      const building = this.selectedBuilding();
      if (!building) return;
      this.orgService
        .createFloor({
          buildingId: building.id,
          code: this.formCode,
          name: this.formName,
          floorNumber: Number(this.formFloorNumber),
        })
        .subscribe({
          next: () => {
            this.successMessage.set(`Floor '${this.formName}' created successfully.`);
            this.closeModal();
            this.loadFloors(building.id);
          },
          error: (err) => this.handleError(err),
        });
    }
  }

  deleteGroup(id: string, name: string): void {
    if (!confirm(`Are you sure you want to deactivate Hotel Group '${name}'?`)) return;
    this.clearMessages();
    this.orgService.deleteGroup(id).subscribe({
      next: () => {
        this.successMessage.set(`Hotel Group '${name}' deactivated successfully.`);
        this.loadGroups();
      },
      error: (err) => this.handleError(err),
    });
  }

  deleteRegion(id: string, name: string): void {
    if (!confirm(`Are you sure you want to deactivate Region '${name}'?`)) return;
    this.clearMessages();
    this.orgService.deleteRegion(id).subscribe({
      next: () => {
        this.successMessage.set(`Region '${name}' deactivated successfully.`);
        if (this.selectedGroup()) this.loadRegions(this.selectedGroup()!.id);
      },
      error: (err) => this.handleError(err),
    });
  }

  deleteCountry(id: string, name: string): void {
    if (!confirm(`Are you sure you want to deactivate Country '${name}'?`)) return;
    this.clearMessages();
    this.orgService.deleteCountry(id).subscribe({
      next: () => {
        this.successMessage.set(`Country '${name}' deactivated successfully.`);
        if (this.selectedRegion()) this.loadCountries(this.selectedRegion()!.id);
      },
      error: (err) => this.handleError(err),
    });
  }

  deleteProperty(id: string, name: string): void {
    if (!confirm(`Are you sure you want to deactivate Property '${name}'?`)) return;
    this.clearMessages();
    this.orgService.deleteProperty(id).subscribe({
      next: () => {
        this.successMessage.set(`Property '${name}' deactivated successfully.`);
        if (this.selectedCountry()) this.loadProperties(this.selectedCountry()!.id);
      },
      error: (err) => this.handleError(err),
    });
  }

  deleteBuilding(id: string, name: string): void {
    if (!confirm(`Are you sure you want to deactivate Building '${name}'?`)) return;
    this.clearMessages();
    this.orgService.deleteBuilding(id).subscribe({
      next: () => {
        this.successMessage.set(`Building '${name}' deactivated successfully.`);
        if (this.selectedProperty()) this.loadBuildings(this.selectedProperty()!.id);
      },
      error: (err) => this.handleError(err),
    });
  }

  deleteFloor(id: string, name: string): void {
    if (!confirm(`Are you sure you want to deactivate Floor '${name}'?`)) return;
    this.clearMessages();
    this.orgService.deleteFloor(id).subscribe({
      next: () => {
        this.successMessage.set(`Floor '${name}' deactivated successfully.`);
        if (this.selectedBuilding()) this.loadFloors(this.selectedBuilding()!.id);
      },
      error: (err) => this.handleError(err),
    });
  }

  private resetForm(): void {
    this.formCode = '';
    this.formName = '';
    this.formDescription = '';
    this.formLegalName = '';
    this.formTimeZone = 'Asia/Tokyo';
    this.formCurrency = 'JPY';
    this.formAddressLine1 = '';
    this.formCity = '';
    this.formStateProvince = '';
    this.formPostalCode = '';
    this.formFloorNumber = 1;
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private handleError(err: any): void {
    this.isLoading.set(false);
    const problem = err?.error;
    if (problem && problem.detail) {
      this.errorMessage.set(`[${problem.code || 'ERROR'}] ${problem.detail}`);
    } else {
      this.errorMessage.set(err?.message || 'An unexpected error occurred during operation.');
    }
  }
}
