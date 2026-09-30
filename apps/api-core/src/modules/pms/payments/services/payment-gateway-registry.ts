import {
  CredentialFieldSchema,
  PaymentGatewayCapability,
  PaymentGatewayEnvironment,
  PaymentGatewayIntegrationStatus,
  PaymentGatewayProviderCatalogItem,
  PaymentProviderType,
} from '@hms/api-contracts';

const credentialSchemas: Partial<Record<PaymentProviderType, CredentialFieldSchema[]>> = {
  AMAZON_PAYMENT_SERVICES: [
    { name: 'merchantIdentifier', label: 'Merchant Identifier', type: 'text', required: true, secret: false, masked: true },
    { name: 'accessCode', label: 'Access Code', type: 'password', required: true, secret: true, masked: true },
    { name: 'shaRequestPhrase', label: 'Request SHA Phrase', type: 'password', required: true, secret: true, masked: true },
    { name: 'shaResponsePhrase', label: 'Response SHA Phrase', type: 'password', required: true, secret: true, masked: true },
  ],
  TELR: [
    { name: 'storeId', label: 'Store ID', type: 'text', required: true, secret: false, masked: true },
    { name: 'authKey', label: 'Authentication Key', type: 'password', required: true, secret: true, masked: true },
  ],
  NETWORK_INTERNATIONAL: [
    { name: 'outletId', label: 'Outlet ID', type: 'text', required: true, secret: false, masked: true },
    { name: 'terminalId', label: 'Terminal ID', type: 'text', required: true, secret: false, masked: true },
    { name: 'apiKey', label: 'API Key', type: 'password', required: true, secret: true, masked: true },
  ],
  TAP: [
    { name: 'publicKey', label: 'Public Key', type: 'text', required: true, secret: false, masked: true },
    { name: 'secretKey', label: 'Secret Key', type: 'password', required: true, secret: true, masked: true },
  ],
  PAYTABS: [
    { name: 'profileId', label: 'Profile ID', type: 'text', required: true, secret: false, masked: true },
    { name: 'serverKey', label: 'Server Key', type: 'password', required: true, secret: true, masked: true },
  ],
  CHECKOUT_COM: [
    { name: 'publicKey', label: 'Public Key', type: 'text', required: true, secret: false, masked: true },
    { name: 'secretKey', label: 'Secret Key', type: 'password', required: true, secret: true, masked: true },
  ],
  HYPERPAY: [
    { name: 'entityId', label: 'Entity ID', type: 'text', required: true, secret: false, masked: true },
    { name: 'accessToken', label: 'Access Token', type: 'password', required: true, secret: true, masked: true },
  ],
  MOYASAR: [
    { name: 'publishableKey', label: 'Publishable Key', type: 'text', required: true, secret: false, masked: true },
    { name: 'secretKey', label: 'Secret Key', type: 'password', required: true, secret: true, masked: true },
  ],
  GEIDEA: [
    { name: 'merchantId', label: 'Merchant ID', type: 'text', required: true, secret: false, masked: true },
    { name: 'terminalId', label: 'Terminal ID', type: 'text', required: true, secret: false, masked: true },
    { name: 'apiPassword', label: 'API Password', type: 'password', required: true, secret: true, masked: true },
  ],
  BENEFIT: [
    { name: 'merchantId', label: 'Merchant ID', type: 'text', required: true, secret: false, masked: true },
    { name: 'privateKey', label: 'Private Key', type: 'password', required: true, secret: true, masked: true },
  ],
  STRIPE: [
    { name: 'publishableKey', label: 'Publishable Key', type: 'text', required: true, secret: false, masked: true },
    { name: 'secretKey', label: 'Secret Key', type: 'password', required: true, secret: true, masked: true },
    { name: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: false, secret: true, masked: true },
  ],
  ADYEN: [
    { name: 'merchantAccount', label: 'Merchant Account', type: 'text', required: true, secret: false, masked: true },
    { name: 'apiCredential', label: 'API Credential', type: 'password', required: true, secret: true, masked: true },
    { name: 'hmacKey', label: 'Webhook HMAC Key', type: 'password', required: false, secret: true, masked: true },
  ],
  DEMO: [{ name: 'demoLabel', label: 'Demo Label', type: 'text', required: false, secret: false, masked: false }],
};
const fallbackCredentials: CredentialFieldSchema[] = [
  { name: 'merchantId', label: 'Merchant ID', type: 'text', required: true, secret: false, masked: true },
  { name: 'accessToken', label: 'Access Token', type: 'password', required: true, secret: true, masked: true },
  { name: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: false, secret: true, masked: true },
];
const globalCredentialProviders = new Set<PaymentProviderType>([
  'SQUARE', 'PAYPAL', 'RAZORPAY', 'CASHFREE', 'PAYU', 'GMO_PAYMENT_GATEWAY', 'SB_PAYMENT_SERVICE',
]);
const catalogCredentialSchema = (providerCode: PaymentProviderType): CredentialFieldSchema[] =>
  credentialSchemas[providerCode] || (globalCredentialProviders.has(providerCode) ? fallbackCredentials : []);


const allMena = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'EG'];
const cardMethods = ['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS'];
const currenciesByCountry: Record<string, string[]> = {
  AE: ['AED'], SA: ['SAR'], QA: ['QAR'], KW: ['KWD'], BH: ['BHD'], OM: ['OMR'], JO: ['JOD'], EG: ['EGP'],
};

const supportedCountries: Record<string, string[]> = {
  AMAZON_PAYMENT_SERVICES: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'EG'],
  TELR: ['AE'],
  NETWORK_INTERNATIONAL: ['AE'],
  TAP: ['AE', 'SA', 'QA', 'OM'],
  PAYTABS: ['AE', 'SA', 'QA', 'KW', 'OM', 'JO', 'EG'],
  CHECKOUT_COM: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'EG'],
  HYPERPAY: ['SA'],
  MOYASAR: ['SA'],
  GEIDEA: ['SA'],
  BENEFIT: ['BH'],
  STRIPE: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'EG', 'US', 'GB', 'CA', 'AU', 'JP', 'IN'],
  ADYEN: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'EG', 'US', 'GB', 'CA', 'AU', 'JP', 'IN'],
  SQUARE: ['US', 'CA', 'GB', 'AU', 'JP'],
  PAYPAL: allMena.concat(['US', 'GB', 'CA', 'AU', 'JP', 'IN']),
  RAZORPAY: ['IN'],
  CASHFREE: ['IN'],
  PAYU: ['IN', 'EG', 'PL', 'CO'],
  GMO_PAYMENT_GATEWAY: ['JP'],
  SB_PAYMENT_SERVICE: ['JP'],
  DEMO: allMena.concat(['US', 'GB', 'CA', 'AU', 'JP', 'IN']),
};

const providerNames: Record<string, string> = {
  AMAZON_PAYMENT_SERVICES: 'Amazon Payment Services', TELR: 'Telr', NETWORK_INTERNATIONAL: 'Network International',
  TAP: 'Tap Payments', PAYTABS: 'PayTabs', CHECKOUT_COM: 'Checkout.com', HYPERPAY: 'HyperPay',
  MOYASAR: 'Moyasar', GEIDEA: 'Geidea', BENEFIT: 'Benefit', STRIPE: 'Stripe', ADYEN: 'Adyen',
  SQUARE: 'Square', PAYPAL: 'PayPal', RAZORPAY: 'Razorpay', CASHFREE: 'Cashfree', PAYU: 'PayU',
  GMO_PAYMENT_GATEWAY: 'GMO Payment Gateway', SB_PAYMENT_SERVICE: 'SB Payment Service', DEMO: 'HMS Demo Gateway',
};

const docsUrls: Record<string, string> = {
  AMAZON_PAYMENT_SERVICES: 'https://paymentservices.amazon.com/docs/',
  TELR: 'https://telr.com/', NETWORK_INTERNATIONAL: 'https://www.network.ae/', TAP: 'https://developers.tap.company/',
  PAYTABS: 'https://site.paytabs.com/en/developers/', CHECKOUT_COM: 'https://www.checkout.com/docs',
  HYPERPAY: 'https://hyperpay.com/', MOYASAR: 'https://docs.moyasar.com/', GEIDEA: 'https://geidea.net/',
  BENEFIT: 'https://benefit.bh/', STRIPE: 'https://docs.stripe.com/', ADYEN: 'https://docs.adyen.com/',
  SQUARE: 'https://developer.squareup.com/docs', PAYPAL: 'https://developer.paypal.com/docs/',
  RAZORPAY: 'https://razorpay.com/docs/', CASHFREE: 'https://www.cashfree.com/docs/', PAYU: 'https://developers.payu.com/',
  GMO_PAYMENT_GATEWAY: 'https://www.gmo-pg.com/', SB_PAYMENT_SERVICE: 'https://www.sbpayment.jp/', DEMO: 'https://example.invalid/hms-demo-gateway',
};

const countryMethods: Record<string, string[]> = {
  AE: [...cardMethods, 'APPLE_PAY', 'JAYWAN', 'TABBY', 'TAMARA'],
  SA: [...cardMethods, 'MADA', 'STC_PAY', 'APPLE_PAY', 'TABBY', 'TAMARA'],
  QA: [...cardMethods, 'NAPS', 'QPAY'],
  KW: [...cardMethods, 'KNET'],
  BH: [...cardMethods, 'BENEFIT'],
  OM: [...cardMethods, 'OMANNET'],
  JO: [...cardMethods],
  EG: [...cardMethods],
};

export function deriveGatewayStatus(input: {
  adapterStatus: PaymentGatewayProviderCatalogItem['adapterStatus'];
  enabled: boolean;
  testPassed?: boolean;
  environment?: PaymentGatewayEnvironment;
  productionVerified?: boolean;
}): PaymentGatewayIntegrationStatus {
  if (!input.enabled) return 'DISABLED';
  if (input.adapterStatus === 'CATALOG_ONLY') return 'CATALOG_ONLY';
  if (input.adapterStatus === 'DEMO_ADAPTER') return 'DEMO_ADAPTER';
  if (!input.testPassed) return 'CONFIGURED';
  if (input.environment === 'PRODUCTION' && input.productionVerified) return 'PRODUCTION_VERIFIED';
  return 'CONNECTED';
}

export class PaymentGatewayProviderRegistry {
  private readonly providers = new Map<PaymentProviderType, PaymentGatewayProviderCatalogItem>();

  constructor() {
    this.registerCatalog();
  }

  register(item: PaymentGatewayProviderCatalogItem): void {
    this.providers.set(item.providerCode, item);
  }

  get(providerCode: PaymentProviderType): PaymentGatewayProviderCatalogItem | undefined {
    return this.providers.get(providerCode);
  }

  list(countryCode?: string, currency?: string): PaymentGatewayProviderCatalogItem[] {
    return [...this.providers.values()].filter((item) =>
      (!countryCode || item.supportedCountries.includes(countryCode.toUpperCase())) &&
      (!currency || item.supportedCurrencies.includes(currency.toUpperCase())),
    );
  }

  private registerCatalog(): void {
    for (const providerCode of Object.keys(providerNames) as PaymentProviderType[]) {
      const countries = supportedCountries[providerCode] || [];
      const isDemo = providerCode === 'DEMO';
      const methods = isDemo ? [...cardMethods, ...Object.values(countryMethods).flat()] : [...cardMethods];
      const countryPaymentMethods = Object.fromEntries(
        countries.map((country) => [country, (countryPaymentMethodsFor(providerCode, country) || methods)]),
      );
      const adapterStatus = isDemo ? 'DEMO_ADAPTER' : 'CATALOG_ONLY';
      this.register({
        providerCode,
        displayName: providerNames[providerCode],
        description: isDemo
          ? 'Deterministic simulated gateway for development and training. Never contacts a real provider.'
          : 'Catalog entry only. No provider adapter is implemented; no live or sandbox calls are made.',
        supportedCountries: countries,
        supportedCurrencies: [...new Set(countries.flatMap((country) => currenciesByCountry[country] || []))],
        supportedPaymentMethods: [...new Set(methods)],
        countryPaymentMethods,
        credentialSchema: catalogCredentialSchema(providerCode),
        capabilities: isDemo
          ? ['SALE', 'AUTHORIZE', 'CAPTURE', 'VOID', 'REFUND', 'PARTIAL_REFUND', 'PAYMENT_STATUS', 'TOKENIZATION', 'WEBHOOKS']
          : [],
        sandboxSupport: isDemo,
        productionSupport: !isDemo,
        documentationUrl: docsUrls[providerCode],
        adapterStatus,
        integrationStatus: adapterStatus,
      });
    }
  }
}

function countryPaymentMethodsFor(providerCode: PaymentProviderType, country: string): string[] | undefined {
  if (providerCode === 'DEMO') return countryMethods[country];
  if (providerCode === 'AMAZON_PAYMENT_SERVICES' || providerCode === 'PAYTABS' || providerCode === 'TAP') {
    return countryMethods[country];
  }
  if (providerCode === 'BENEFIT' && country === 'BH') return [...cardMethods, 'BENEFIT'];
  if (providerCode === 'HYPERPAY' && country === 'SA') return [...cardMethods, 'MADA', 'STC_PAY', 'APPLE_PAY', 'TABBY', 'TAMARA'];
  if (providerCode === 'MOYASAR' && country === 'SA') return [...cardMethods, 'MADA', 'APPLE_PAY'];
  if (providerCode === 'GEIDEA' && country === 'SA') return [...cardMethods, 'MADA', 'STC_PAY', 'APPLE_PAY'];
  return cardMethods;
}
