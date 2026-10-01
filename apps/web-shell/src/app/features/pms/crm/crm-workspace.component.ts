import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { PmsApiService } from '../services/pms-api.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import {
  GuestSearchDto,
  GuestSearchResultDto,
  GuestCrmProfileDto,
  GuestPreferenceDto,
  GuestRelationshipViewDto,
  LoyaltyMembershipDto,
  LoyaltyTransactionDto,
  LoyaltyTier,
  LoyaltyTierThresholds,
  CreateGuestPreferenceDto,
  UpdateGuestPreferenceDto,
  CreateLoyaltyMembershipDto,
  AwardPointsDto,
  RedeemPointsDto,
  AdjustPointsDto,
  UpdateGuestCrmProfileDto,
  GuestPreferenceCategory,
} from '@hms/api-contracts';

interface SearchState {
  query: string;
  vipOnly: boolean;
  tier: LoyaltyTier | '';
  page: number;
  limit: number;
}

@Component({
  selector: 'app-crm-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-workspace.component.html',
  styleUrls: ['./crm-workspace.component.css'],
})
export class CrmWorkspaceComponent implements OnInit, OnDestroy {
  private readonly orgService = inject(OrganizationService);
  private readonly pmsApi = inject(PmsApiService);
  private readonly confirmService = inject(ConfirmService);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<SearchState>();

  searchState: SearchState = {
    query: '',
    vipOnly: false,
    tier: '',
    page: 1,
    limit: 20,
  };

  searchResults: GuestSearchResultDto[] = [];
  totalResults = 0;
  isSearching = false;

  selectedGuest: GuestRelationshipViewDto | null = null;
  showDetailDrawer = false;
  detailTabs = ['Profile', 'Preferences', 'Loyalty', 'History', 'Reservations', 'Folios'];
  activeTab = 'Profile';

  tierThresholds: LoyaltyTierThresholds | null = null;
  loyaltyTiers: LoyaltyTier[] = [LoyaltyTier.STANDARD, LoyaltyTier.SILVER, LoyaltyTier.GOLD, LoyaltyTier.PLATINUM];

  newPreference: CreateGuestPreferenceDto = {
    category: GuestPreferenceCategory.ROOM,
    preference: '',
    value: '',
  };
  editingPreference: { pref: GuestPreferenceDto; value: string } | null = null;

  createMembershipDto: CreateLoyaltyMembershipDto = {
    guestId: '',
    tier: LoyaltyTier.STANDARD,
    pointsBalance: 0,
  };

  awardPointsDto: AwardPointsDto = {
    membershipId: '',
    points: 0,
    description: '',
  };
  redeemPointsDto: RedeemPointsDto = {
    membershipId: '',
    points: 0,
    description: '',
  };
  adjustPointsDto: AdjustPointsDto = {
    membershipId: '',
    points: 0,
    description: '',
  };

  showCreateMembership = false;
  showAwardPoints = false;
  showRedeemPoints = false;
  showAdjustPoints = false;

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor() {
    effect(
      () => {
        const prop = this.orgService.activePropertyContext() as any;
        if (prop) {
          this.loadTierThresholds(prop.id);
          this.performSearch(prop.id);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit() {
    const prop = this.orgService.activePropertyContext() as any;
    if (prop) {
      this.loadTierThresholds(prop.id);
      this.performSearch(prop.id);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getPropertyId(): string | null {
    const prop = this.orgService.activePropertyContext() as any;
    return prop?.id || null;
  }

  loadTierThresholds(propertyId: string) {
    this.pmsApi.getLoyaltyTiers(propertyId).subscribe({
      next: (res) => (this.tierThresholds = res.data),
      error: (err) => console.error('Failed to load tier thresholds', err),
    });
  }

  onSearchChange() {
    this.searchState.page = 1;
    this.searchSubject.next({ ...this.searchState });
  }

  onPageChange(page: number) {
    this.searchState.page = page;
    const propertyId = this.getPropertyId();
    if (propertyId) this.performSearch(propertyId);
  }

  performSearch(propertyId: string) {
    this.isSearching = true;
    const query: GuestSearchDto = {
      query: this.searchState.query || undefined,
      vipOnly: this.searchState.vipOnly || undefined,
      tier: this.searchState.tier || undefined,
      page: this.searchState.page,
      limit: this.searchState.limit,
    };

    this.pmsApi.searchGuests(propertyId, query).subscribe({
      next: (res) => {
        this.searchResults = res.data.items;
        this.totalResults = res.data.total;
        this.isSearching = false;
      },
      error: (err) => {
        console.error('Search failed', err);
        this.isSearching = false;
        this.showError('Failed to search guests');
      },
    });
  }

  selectGuest(guest: GuestSearchResultDto) {
    const propertyId = this.getPropertyId();
    if (!propertyId) return;

    this.isLoading = true;
    this.pmsApi.getGuestRelationshipView(propertyId, guest.id).subscribe({
      next: (res) => {
        this.selectedGuest = res.data;
        this.showDetailDrawer = true;
        this.activeTab = 'Profile';
        this.isLoading = false;
        // Initialize forms
        if (this.selectedGuest?.loyaltyMembership) {
          this.awardPointsDto.membershipId = this.selectedGuest.loyaltyMembership.id;
          this.redeemPointsDto.membershipId = this.selectedGuest.loyaltyMembership.id;
          this.adjustPointsDto.membershipId = this.selectedGuest.loyaltyMembership.id;
        }
        this.createMembershipDto.guestId = guest.id;
      },
      error: (err) => {
        console.error('Failed to load guest details', err);
        this.isLoading = false;
        this.showError('Failed to load guest details');
      },
    });
  }

  closeDetailDrawer() {
    this.showDetailDrawer = false;
    this.selectedGuest = null;
    this.resetForms();
  }

  onTabChange(tab: string) {
    this.activeTab = tab;
  }

  // Profile actions
  updateVipFlag(vipFlag: boolean) {
    if (!this.selectedGuest) return;
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    const dto: UpdateGuestCrmProfileDto = { vipFlag };
    this.pmsApi.updateGuestProfile(propertyId, this.selectedGuest.guest.id, dto).subscribe({
      next: (res) => {
        if (this.selectedGuest?.crmProfile) {
          this.selectedGuest.crmProfile = res.data;
        }
        this.showSuccess('VIP status updated');
      },
      error: (err) => {
        console.error('Failed to update VIP flag', err);
        this.showError('Failed to update VIP flag');
      },
    });
  }

  updateMarketingConsent(marketingConsent: boolean) {
    if (!this.selectedGuest) return;
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    const dto: UpdateGuestCrmProfileDto = { marketingConsent };
    this.pmsApi.updateGuestProfile(propertyId, this.selectedGuest.guest.id, dto).subscribe({
      next: (res) => {
        if (this.selectedGuest?.crmProfile) {
          this.selectedGuest.crmProfile = res.data;
        }
        this.showSuccess('Marketing consent updated');
      },
      error: (err) => {
        console.error('Failed to update marketing consent', err);
        this.showError('Failed to update marketing consent');
      },
    });
  }

  // Preference actions
  createPreference() {
    if (!this.selectedGuest || !this.newPreference.preference || !this.newPreference.value) return;
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.pmsApi
      .createPreference(propertyId, this.selectedGuest.guest.id, this.newPreference)
      .subscribe({
        next: (res) => {
          this.selectedGuest?.preferences.push(res.data);
          this.newPreference = { category: GuestPreferenceCategory.ROOM, preference: '', value: '' };
          this.showSuccess('Preference created');
        },
        error: (err) => {
          console.error('Failed to create preference', err);
          this.showError('Failed to create preference');
        },
      });
  }

  startEditPreference(pref: GuestPreferenceDto) {
    this.editingPreference = { pref, value: pref.value };
  }

  savePreference() {
    if (!this.selectedGuest || !this.editingPreference) return;
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    const dto: UpdateGuestPreferenceDto = { value: this.editingPreference.value };
    this.pmsApi
      .updatePreference(
        propertyId,
        this.selectedGuest.guest.id,
        this.editingPreference.pref.category,
        this.editingPreference.pref.preference,
        dto,
      )
      .subscribe({
        next: (res) => {
          const idx = this.selectedGuest?.preferences.findIndex(
            (p) => p.id === this.editingPreference!.pref.id,
          );
          if (idx !== undefined && idx >= 0 && this.selectedGuest) {
            this.selectedGuest.preferences[idx] = res.data;
          }
          this.editingPreference = null;
          this.showSuccess('Preference updated');
        },
        error: (err) => {
          console.error('Failed to update preference', err);
          this.showError('Failed to update preference');
        },
      });
  }

  cancelEditPreference() {
    this.editingPreference = null;
  }

  deletePreference(pref: GuestPreferenceDto) {
    if (!this.selectedGuest) return;
    const guest = this.selectedGuest;
    this.confirmService
      .confirmDanger('Delete preference', `Delete preference "${pref.preference}"?`, 'Delete')
      .subscribe((ok) => {
        if (!ok) return;
        const propertyId = this.getPropertyId();
        if (!propertyId) return;
        this.pmsApi
          .deletePreference(propertyId, guest.guest.id, pref.category, pref.preference)
          .subscribe({
            next: () => {
              if (!this.selectedGuest) return;
              this.selectedGuest.preferences = this.selectedGuest.preferences.filter(
                (p) => p.id !== pref.id,
              );
              this.showSuccess('Preference deleted');
            },
            error: (err) => {
              console.error('Failed to delete preference', err);
              this.showError('Failed to delete preference');
            },
          });
      });
  }

  // Loyalty actions
  createMembership() {
    if (!this.selectedGuest) return;
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.pmsApi.createLoyaltyMembership(propertyId, this.createMembershipDto).subscribe({
      next: (res) => {
        this.selectedGuest!.loyaltyMembership = res.data;
        this.awardPointsDto.membershipId = res.data.id;
        this.redeemPointsDto.membershipId = res.data.id;
        this.adjustPointsDto.membershipId = res.data.id;
        this.showCreateMembership = false;
        this.showSuccess('Loyalty membership created');
      },
      error: (err) => {
        console.error('Failed to create membership', err);
        this.showError('Failed to create membership');
      },
    });
  }

  awardPoints() {
    if (!this.awardPointsDto.points || this.awardPointsDto.points <= 0) return;
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.pmsApi.awardPoints(propertyId, this.awardPointsDto).subscribe({
      next: (res) => {
        if (this.selectedGuest?.loyaltyMembership) {
          this.selectedGuest.loyaltyMembership.pointsBalance += this.awardPointsDto.points;
          this.selectedGuest.loyaltyMembership.lifetimePoints += this.awardPointsDto.points;
          this.updateTier();
        }
        this.selectedGuest?.loyaltyTransactions.unshift(res.data);
        this.awardPointsDto = { membershipId: this.awardPointsDto.membershipId, points: 0, description: '' };
        this.showAwardPoints = false;
        this.showSuccess(`Awarded ${res.data.points} points`);
      },
      error: (err) => {
        console.error('Failed to award points', err);
        this.showError(err.error?.detail || 'Failed to award points');
      },
    });
  }

  redeemPoints() {
    if (!this.redeemPointsDto.points || this.redeemPointsDto.points <= 0) return;
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.pmsApi.redeemPoints(propertyId, this.redeemPointsDto).subscribe({
      next: (res) => {
        if (this.selectedGuest?.loyaltyMembership) {
          this.selectedGuest.loyaltyMembership.pointsBalance -= this.redeemPointsDto.points;
        }
        this.selectedGuest?.loyaltyTransactions.unshift(res.data);
        this.redeemPointsDto = { membershipId: this.redeemPointsDto.membershipId, points: 0, description: '' };
        this.showRedeemPoints = false;
        this.showSuccess(`Redeemed ${res.data.points * -1} points`);
      },
      error: (err) => {
        console.error('Failed to redeem points', err);
        this.showError(err.error?.detail || 'Failed to redeem points');
      },
    });
  }

  adjustPoints() {
    if (this.adjustPointsDto.points === 0 || !this.adjustPointsDto.description) return;
    const propertyId = this.getPropertyId();
    if (!propertyId) return;
    this.pmsApi.adjustPoints(propertyId, this.adjustPointsDto).subscribe({
      next: (res) => {
        if (this.selectedGuest?.loyaltyMembership) {
          this.selectedGuest.loyaltyMembership.pointsBalance += this.adjustPointsDto.points;
          if (this.adjustPointsDto.points > 0) {
            this.selectedGuest.loyaltyMembership.lifetimePoints += this.adjustPointsDto.points;
            this.updateTier();
          }
        }
        this.selectedGuest?.loyaltyTransactions.unshift(res.data);
        this.adjustPointsDto = { membershipId: this.adjustPointsDto.membershipId, points: 0, description: '' };
        this.showAdjustPoints = false;
        this.showSuccess('Points adjusted');
      },
      error: (err) => {
        console.error('Failed to adjust points', err);
        this.showError(err.error?.detail || 'Failed to adjust points');
      },
    });
  }

  private updateTier() {
    if (!this.selectedGuest?.loyaltyMembership || !this.tierThresholds) return;
    const lp = this.selectedGuest.loyaltyMembership.lifetimePoints;
    if (lp >= (this.tierThresholds.PLATINUM.min || 20000)) this.selectedGuest.loyaltyMembership.tier = LoyaltyTier.PLATINUM;
    else if (lp >= (this.tierThresholds.GOLD.min || 5000)) this.selectedGuest.loyaltyMembership.tier = LoyaltyTier.GOLD;
    else if (lp >= (this.tierThresholds.SILVER.min || 1000)) this.selectedGuest.loyaltyMembership.tier = LoyaltyTier.SILVER;
    else this.selectedGuest.loyaltyMembership.tier = LoyaltyTier.STANDARD;
  }

  getTierClass(tier: LoyaltyTier): string {
    switch (tier) {
      case 'PLATINUM':
        return 'tier-platinum';
      case 'GOLD':
        return 'tier-gold';
      case 'SILVER':
        return 'tier-silver';
      default:
        return 'tier-standard';
    }
  }

  getTierIcon(tier: LoyaltyTier): string {
    switch (tier) {
      case 'PLATINUM':
        return '💎';
      case 'GOLD':
        return '🥇';
      case 'SILVER':
        return '🥈';
      default:
        return '🥉';
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByGuestId(index: number, guest: GuestSearchResultDto): string {
    return guest.id;
  }

  trackByTransactionId(index: number, tx: LoyaltyTransactionDto): string {
    return tx.id;
  }

  private resetForms() {
    this.newPreference = { category: GuestPreferenceCategory.ROOM, preference: '', value: '' };
    this.editingPreference = null;
    this.showCreateMembership = false;
    this.showAwardPoints = false;
    this.showRedeemPoints = false;
    this.showAdjustPoints = false;
    this.awardPointsDto = { membershipId: '', points: 0, description: '' };
    this.redeemPointsDto = { membershipId: '', points: 0, description: '' };
    this.adjustPointsDto = { membershipId: '', points: 0, description: '' };
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