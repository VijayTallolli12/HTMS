import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PaymentGatewayConfigDto, PaymentGatewayProviderCatalogItem, SavePaymentGatewayConfigDto } from '@hms/api-contracts';
import { OrganizationService } from '../../core/services/organization.service';
import { CountryDto } from '@hms/api-contracts';
import { AuthService } from '../../core/services/auth.service';
import { PaymentGatewaysApiService } from './payment-gateways-api.service';

@Component({
  selector: 'hms-payment-gateways',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-gateways.component.html',
  styleUrls: ['./payment-gateways.component.css'],
})
export class PaymentGatewaysComponent implements OnInit, OnDestroy {
  private readonly organization = inject(OrganizationService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(PaymentGatewaysApiService);
  private readonly destroy$ = new Subject<void>();

  readonly activeProperty = this.organization.activePropertyContext;
  readonly countryName = signal<string | null>(null);
  readonly countryCode = signal<string | null>(null);
  readonly catalog = signal<PaymentGatewayProviderCatalogItem[]>([]);
  readonly configs = signal<PaymentGatewayConfigDto[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly selectedProvider = signal<PaymentGatewayProviderCatalogItem | null>(null);
  readonly selectedConfig = signal<PaymentGatewayConfigDto | null>(null);
  readonly environment = signal<'SANDBOX' | 'PRODUCTION'>('SANDBOX');
  readonly credentials: Record<string, string> = {};
  readonly enabledMethods = signal<string[]>([]);
  readonly priority = signal(100);
  readonly isPrimary = signal(false);

  credentialConfigured(name: string): boolean {
    return Boolean(this.selectedConfig()?.credentialFields.find((field) => field.name === name)?.configured);
  }

  get canView(): boolean { return this.auth.hasPermission('payment_gateway:view'); }
  get canConfigure(): boolean { return this.auth.hasPermission('payment_gateway:configure'); }
  get canTest(): boolean { return this.auth.hasPermission('payment_gateway:test'); }
  get canEnable(): boolean { return this.auth.hasPermission('payment_gateway:enable'); }
  get canDisable(): boolean { return this.auth.hasPermission('payment_gateway:disable'); }

  constructor() {
    effect(() => {
      const property = this.activeProperty();
      if (property?.id) {
        this.load();
        this.loadCountry(property.countryId);
      } else {
        this.countryName.set(null);
        this.countryCode.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private loadCountry(countryId: string): void {
    this.organization.getCountries().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const country = res.data.find((item: CountryDto) => item.id === countryId);
        this.countryName.set(country?.name || null);
        this.countryCode.set(country?.code || null);
      },
      error: () => { this.countryName.set(null); this.countryCode.set(null); },
    });
  }

  load(): void {
    const property = this.activeProperty();
    if (!property?.id || !this.canView) return;
    this.loading.set(true); this.error.set(null);
    this.api.getCatalog(property.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => this.catalog.set(res.data || []),
      error: (err) => this.error.set(err?.error?.detail || 'Unable to load gateway catalog.'),
    });
    this.api.getConfigs(property.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.configs.set(res.data || []); this.loading.set(false); },
      error: (err) => { this.loading.set(false); this.error.set(err?.error?.detail || 'Unable to load property gateway configuration.'); },
    });
  }

  configFor(provider: PaymentGatewayProviderCatalogItem): PaymentGatewayConfigDto | undefined {
    return this.configs().find((config) => config.providerCode === provider.providerCode);
  }

  recommended(provider: PaymentGatewayProviderCatalogItem): boolean {
    return provider.providerCode === 'DEMO' || provider.adapterStatus === 'SANDBOX_READY';
  }

  openConfiguration(provider: PaymentGatewayProviderCatalogItem): void {
    if (!this.canConfigure) return;
    this.selectedProvider.set(provider);
    const config = this.configFor(provider) || null;
    this.selectedConfig.set(config);
    this.environment.set(config?.environment || 'SANDBOX');
    this.enabledMethods.set([...(config?.enabledPaymentMethods || [])]);
    this.priority.set(config?.priority ?? 100);
    this.isPrimary.set(config?.isPrimary ?? false);
    for (const field of provider.credentialSchema) this.credentials[field.name] = '';
  }

  toggleMethod(method: string, checked: boolean): void {
    const next = new Set(this.enabledMethods());
    checked ? next.add(method) : next.delete(method);
    this.enabledMethods.set([...next]);
  }

  saveConfiguration(): void {
    const property = this.activeProperty();
    const provider = this.selectedProvider();
    if (!property?.id || !provider || !this.canConfigure) return;
    this.saving.set(true); this.error.set(null); this.notice.set(null);
    const credentials = Object.fromEntries(Object.entries(this.credentials).filter(([, value]) => !!value.trim()));
    const propertyCurrency = property.currency.toUpperCase();
    const currencies = provider.supportedCurrencies.includes(propertyCurrency) ? [propertyCurrency] : [];
    if (!currencies.length) { this.saving.set(false); this.error.set('This provider does not support the active property currency.'); return; }
    const dto: SavePaymentGatewayConfigDto = {
      providerCode: provider.providerCode,
      environment: this.environment(),
      isPrimary: this.isPrimary(),
      credentials,
      supportedCurrencies: currencies,
      enabledPaymentMethods: this.enabledMethods(),
      priority: this.priority(),
    };
    const existing = this.selectedConfig();
    const request = existing
      ? this.api.updateConfig(property.id, existing.id, { ...dto, isPrimary: this.isPrimary() })
      : this.api.createConfig(property.id, dto);
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.saving.set(false); this.notice.set('Gateway configuration saved. Secret values are not returned.');
        this.selectedConfig.set(res.data); this.load();
      },
      error: (err) => { this.saving.set(false); this.error.set(err?.error?.detail || 'Unable to save gateway configuration.'); },
    });
  }

  testConnection(config: PaymentGatewayConfigDto): void {
    const propertyId = this.activeProperty()?.id;
    if (!propertyId || !this.canTest) return;
    this.testing.set(true); this.error.set(null); this.notice.set(null);
    this.api.testConnection(propertyId, config.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.testing.set(false); this.notice.set(res.data.message); this.load(); },
      error: (err) => { this.testing.set(false); this.error.set(err?.error?.detail || 'Connection test failed.'); },
    });
  }

  setEnabled(config: PaymentGatewayConfigDto, enabled: boolean): void {
    const propertyId = this.activeProperty()?.id;
    if (!propertyId || (enabled ? !this.canEnable : !this.canDisable)) return;
    this.api.setEnabled(propertyId, config.id, enabled).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.notice.set(enabled ? 'Gateway enabled.' : 'Gateway disabled.'); this.load(); },
      error: (err) => this.error.set(err?.error?.detail || 'Unable to update gateway status.'),
    });
  }

  closeConfiguration(): void { this.selectedProvider.set(null); this.selectedConfig.set(null); }
}
