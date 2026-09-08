import { pipeline } from "stream/promises";
import type { Readable } from "stream";
import { getFirebaseStorage } from "../lib/firebaseAdmin";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export interface IStorageService {
  upload(storagePath: string, buffer: Buffer, mimeType: string): Promise<void>;
  uploadStream(storagePath: string, source: Readable, mimeType: string): Promise<void>;
  getSignedReadUrl(storagePath: string, ttlMinutes: number): Promise<string>;
  delete(storagePath: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

export class FirebaseStorageService implements IStorageService {
  private getBucket() {
    return getFirebaseStorage().bucket(env.STORAGE_BUCKET);
  }

  async upload(storagePath: string, buffer: Buffer, mimeType: string): Promise<void> {
    const file = this.getBucket().file(storagePath);
    await file.save(buffer, {
      metadata: { contentType: mimeType },
      resumable: false,
    });
  }

  // Streams the source into the object without buffering it in memory —
  // the media route stages uploads to a temp file and streams it here.
  async uploadStream(storagePath: string, source: Readable, mimeType: string): Promise<void> {
    const file = this.getBucket().file(storagePath);
    await pipeline(source, file.createWriteStream({
      metadata: { contentType: mimeType },
      resumable: false,
    }));
  }

  async getSignedReadUrl(storagePath: string, ttlMinutes: number): Promise<string> {
    const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    if (emulatorHost) {
      const bucketName = env.STORAGE_BUCKET;
      return `http://${emulatorHost}/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
    }

    // A signing failure must surface as AI/media-unavailable rather than degrade
    // to an unsigned public URL that would 403 on a private bucket (or worse,
    // serve an unexpiring link if the bucket were public). Callers decide how to
    // respond; the fallback URL silently masked broken IAM configuration.
    const file = this.getBucket().file(storagePath);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + ttlMinutes * 60 * 1000,
      version: "v4",
    });
    return url;
  }

  async delete(storagePath: string): Promise<void> {
    const file = this.getBucket().file(storagePath);
    try {
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
      }
    } catch (err) {
      logger.warn({ err, storagePath }, "Failed to delete storage object");
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    try {
      await this.getBucket().deleteFiles({ prefix });
    } catch (err) {
      logger.warn({ err, prefix }, "Failed to delete storage prefix");
    }
  }
}

export class MockStorageService implements IStorageService {
  public files = new Map<string, { buffer: Buffer; mimeType: string }>();

  async upload(storagePath: string, buffer: Buffer, mimeType: string): Promise<void> {
    this.files.set(storagePath, { buffer, mimeType });
  }

  async uploadStream(storagePath: string, source: Readable, mimeType: string): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of source) {
      chunks.push(chunk as Buffer);
    }
    this.files.set(storagePath, { buffer: Buffer.concat(chunks), mimeType });
  }

  async getSignedReadUrl(storagePath: string, ttlMinutes: number): Promise<string> {
    const file = this.files.get(storagePath);
    if (!file) {
      throw new Error(`File not found: ${storagePath}`);
    }
    const expires = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
    return `https://storage.mock.local/${storagePath}?expires=${expires}&signature=mock_sig`;
  }

  async delete(storagePath: string): Promise<void> {
    this.files.delete(storagePath);
  }

  async deletePrefix(prefix: string): Promise<void> {
    for (const key of Array.from(this.files.keys())) {
      if (key.startsWith(prefix)) {
        this.files.delete(key);
      }
    }
  }

  clear(): void {
    this.files.clear();
  }
}

let currentStorageService: IStorageService =
  process.env.NODE_ENV === "test" ? new MockStorageService() : new FirebaseStorageService();

export function getStorageService(): IStorageService {
  return currentStorageService;
}

export function setStorageService(service: IStorageService): void {
  currentStorageService = service;
}
