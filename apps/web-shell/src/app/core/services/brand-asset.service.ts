import { Injectable } from '@angular/core';

export interface BrandAsset {
  id: 'logo' | 'favicon';
  fileName: string;
  mimeType: string;
  dataUrl: string;
  fileSize: number;
  width?: number;
  height?: number;
  uploadedAt: number;
}

const DB_NAME = 'hms_brand_assets_db';
const DB_VERSION = 1;
const STORE_NAME = 'brand_assets';

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_FAVICON_SIZE_BYTES = 512 * 1024; // 512KB

const ALLOWED_LOGO_EXTENSIONS = ['svg', 'png', 'webp', 'jpg', 'jpeg'];
const ALLOWED_LOGO_MIMES = ['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'];

const ALLOWED_FAVICON_EXTENSIONS = ['svg', 'png', 'ico'];
const ALLOWED_FAVICON_MIMES = [
  'image/svg+xml',
  'image/png',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

@Injectable({
  providedIn: 'root',
})
export class BrandAssetService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDatabase().catch((err) => {
      console.warn('Could not initialize BrandAssetService IndexedDB:', err);
    });
  }

  private async initDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not available');
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async getAsset(id: 'logo' | 'favicon'): Promise<BrandAsset | null> {
    try {
      const db = await this.initDatabase();
      return new Promise<BrandAsset | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async saveAsset(asset: BrandAsset): Promise<void> {
    const db = await this.initDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(asset);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async removeAsset(id: 'logo' | 'favicon'): Promise<void> {
    try {
      const db = await this.initDatabase();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignored if DB is not available
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.initDatabase();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignored if DB is not available
    }
  }

  async processLogoFile(file: File): Promise<BrandAsset> {
    if (!file) throw new Error('No file provided.');

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      const maxMb = (MAX_LOGO_SIZE_BYTES / (1024 * 1024)).toFixed(1);
      throw new Error(`Logo file size exceeds the ${maxMb}MB limit.`);
    }

    const ext = this.getFileExtension(file.name);
    if (!ALLOWED_LOGO_EXTENSIONS.includes(ext)) {
      throw new Error(
        `Unsupported logo format (.${ext}). Supported formats: SVG, PNG, WebP, JPG/JPEG.`,
      );
    }

    if (file.type && !ALLOWED_LOGO_MIMES.includes(file.type)) {
      throw new Error(`Unsupported logo MIME type: ${file.type}`);
    }

    let dataUrl: string;
    let width: number | undefined;
    let height: number | undefined;

    if (ext === 'svg' || file.type === 'image/svg+xml') {
      const text = await file.text();
      const sanitized = this.sanitizeSvg(text);
      dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`;
      // Verify image decode
      const dims = await this.verifyImageLoad(dataUrl);
      width = dims.width;
      height = dims.height;
    } else {
      dataUrl = await this.readFileAsDataUrl(file);
      const dims = await this.verifyImageLoad(dataUrl);
      width = dims.width;
      height = dims.height;
    }

    const record: BrandAsset = {
      id: 'logo',
      fileName: file.name,
      mimeType: file.type || (ext === 'svg' ? 'image/svg+xml' : `image/${ext}`),
      dataUrl,
      fileSize: file.size,
      width,
      height,
      uploadedAt: Date.now(),
    };

    await this.saveAsset(record);
    return record;
  }

  async processFaviconFile(file: File): Promise<BrandAsset> {
    if (!file) throw new Error('No file provided.');

    if (file.size > MAX_FAVICON_SIZE_BYTES) {
      const maxKb = Math.round(MAX_FAVICON_SIZE_BYTES / 1024);
      throw new Error(`Favicon file size exceeds the ${maxKb}KB limit.`);
    }

    const ext = this.getFileExtension(file.name);
    if (!ALLOWED_FAVICON_EXTENSIONS.includes(ext)) {
      throw new Error(`Unsupported favicon format (.${ext}). Supported formats: SVG, PNG, ICO.`);
    }

    let dataUrl: string;
    let width: number | undefined;
    let height: number | undefined;

    if (ext === 'svg' || file.type === 'image/svg+xml') {
      const text = await file.text();
      const sanitized = this.sanitizeSvg(text);
      dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`;
      const dims = await this.verifyImageLoad(dataUrl);
      width = dims.width;
      height = dims.height;
    } else {
      dataUrl = await this.readFileAsDataUrl(file);
      if (ext !== 'ico') {
        const dims = await this.verifyImageLoad(dataUrl);
        width = dims.width;
        height = dims.height;
      }
    }

    const record: BrandAsset = {
      id: 'favicon',
      fileName: file.name,
      mimeType: file.type || (ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/x-icon'),
      dataUrl,
      fileSize: file.size,
      width,
      height,
      uploadedAt: Date.now(),
    };

    await this.saveAsset(record);
    return record;
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase().trim() : '';
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  private sanitizeSvg(svgContent: string): string {
    if (!svgContent || typeof svgContent !== 'string') {
      throw new Error('Invalid SVG content.');
    }

    // Strip script tags and content
    let cleaned = svgContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Strip event handler attributes (onload, onerror, onclick, onmouseover, etc.)
    cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

    // Strip javascript: uris
    cleaned = cleaned.replace(/(href|src|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""');

    // Strip external entity declarations <!ENTITY ...>
    cleaned = cleaned.replace(/<!ENTITY[\s\S]*?>/gi, '');

    if (!cleaned.includes('<svg') || !cleaned.includes('</svg>')) {
      throw new Error('Malformed SVG: Missing <svg> root element.');
    }

    return cleaned;
  }

  private verifyImageLoad(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        return resolve({ width: 0, height: 0 });
      }

      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth === 0 && img.naturalHeight === 0) {
          reject(new Error('Invalid image dimensions or corrupted image.'));
        } else {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        }
      };
      img.onerror = () => reject(new Error('Failed to parse or decode image. The file may be corrupted.'));
      img.src = dataUrl;
    });
  }
}
