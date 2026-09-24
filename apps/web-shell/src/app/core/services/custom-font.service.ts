import { Injectable, signal } from '@angular/core';

export interface CustomFontRecord {
  id: string;
  name: string;
  fileName: string;
  format: 'woff2' | 'woff' | 'ttf';
  weight: number;
  style: 'normal' | 'italic';
  dataUrl: string;
  createdAt: number;
}

const DB_NAME = 'hms_appearance_db';
const DB_VERSION = 1;
const STORE_NAME = 'custom_fonts';

@Injectable({
  providedIn: 'root',
})
export class CustomFontService {
  readonly customFonts = signal<CustomFontRecord[]>([]);

  private db: IDBDatabase | null = null;
  private readonly registeredFontFaces = new Map<string, FontFace>();

  constructor() {
    this.initDatabase();
  }

  private async initDatabase(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    try {
      this.db = await this.openDb();
      await this.loadAllFonts();
    } catch (err) {
      console.warn('Could not initialize CustomFontService IndexedDB:', err);
    }
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async loadAllFonts(): Promise<void> {
    if (!this.db) return;

    try {
      const records = await this.getAllFromStore();
      this.customFonts.set(records);

      // Register FontFaces into document.fonts
      for (const record of records) {
        this.registerFontFace(record);
      }
    } catch (err) {
      console.warn('Failed to load custom fonts from store:', err);
    }
  }

  private getAllFromStore(): Promise<CustomFontRecord[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveFont(
    file: File,
    fontName: string,
    weight: number = 400,
    style: 'normal' | 'italic' = 'normal',
  ): Promise<CustomFontRecord> {
    const trimmedName = fontName.trim();
    if (!trimmedName) throw new Error('Font name is required.');

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['woff2', 'woff', 'ttf'].includes(ext)) {
      throw new Error('Unsupported format. Allowed formats: .woff2, .woff, .ttf');
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Font file exceeds maximum allowed size (5 MB).');
    }

    const dataUrl = await this.readFileAsDataUrl(file);
    const id = `${trimmedName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}-${weight}-${style}`;

    const record: CustomFontRecord = {
      id,
      name: trimmedName,
      fileName: file.name,
      format: ext as 'woff2' | 'woff' | 'ttf',
      weight,
      style,
      dataUrl,
      createdAt: Date.now(),
    };

    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    this.registerFontFace(record);

    this.customFonts.update((list) => {
      const filtered = list.filter((f) => f.id !== id);
      return [...filtered, record];
    });

    return record;
  }

  async removeFont(id: string): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    const fontFace = this.registeredFontFaces.get(id);
    if (fontFace && typeof document !== 'undefined' && document.fonts) {
      (document.fonts as any).delete?.(fontFace);
      this.registeredFontFaces.delete(id);
    }

    this.customFonts.update((list) => list.filter((f) => f.id !== id));
  }

  private registerFontFace(record: CustomFontRecord): void {
    if (typeof document === 'undefined' || !document.fonts) return;

    try {
      const fontFace = new FontFace(
        `'${record.name}'`,
        `url(${record.dataUrl}) format('${record.format}')`,
        {
          weight: `${record.weight}`,
          style: record.style,
        },
      );

      fontFace
        .load()
        .then((loadedFace) => {
          (document.fonts as any).add?.(loadedFace);
          this.registeredFontFaces.set(record.id, loadedFace);
        })
        .catch((err) => {
          console.warn(`Failed to load font face ${record.name}:`, err);
        });
    } catch (err) {
      console.warn('FontFace API error:', err);
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
