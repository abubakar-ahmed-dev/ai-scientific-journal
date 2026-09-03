import { describe, it, expect } from "vitest";
import {
  detectMediaTypeFromBuffer,
  validateFileConsistency,
} from "../../src/schemas/mediaSchema";
import { AppError } from "../../src/types/errors";

// Sample magic-byte signatures for each supported family
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 0x00)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 0x00),
]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4, 0x00), Buffer.from("WEBP")]);
const WAV = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4, 0x00), Buffer.from("WAVE")]);
const MP3_ID3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(16, 0x00)]);
const MP3_SYNC = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(16, 0x00)]);
const MP4 = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(8, 0x00)]);
const HEIC = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(8, 0x00)]);
const EXECUTABLE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(32, 0x00)]);
const TEXT = Buffer.from("hello world, definitely not media");

describe("detectMediaTypeFromBuffer (magic-byte sniffing, SECURITY §15)", () => {
  it("identifies JPEG, PNG, WebP as image", () => {
    expect(detectMediaTypeFromBuffer(JPEG)).toBe("image");
    expect(detectMediaTypeFromBuffer(PNG)).toBe("image");
    expect(detectMediaTypeFromBuffer(WEBP)).toBe("image");
  });

  it("identifies HEIC brand as image", () => {
    expect(detectMediaTypeFromBuffer(HEIC)).toBe("image");
  });

  it("identifies WAV, MP3 (ID3 and sync) as audio", () => {
    expect(detectMediaTypeFromBuffer(WAV)).toBe("audio");
    expect(detectMediaTypeFromBuffer(MP3_ID3)).toBe("audio");
    expect(detectMediaTypeFromBuffer(MP3_SYNC)).toBe("audio");
  });

  it("identifies MP4 (isom brand) as video", () => {
    expect(detectMediaTypeFromBuffer(MP4)).toBe("video");
  });

  it("rejects executables, plain text, and unknown ftyp brands", () => {
    expect(detectMediaTypeFromBuffer(EXECUTABLE)).toBeNull();
    expect(detectMediaTypeFromBuffer(TEXT)).toBeNull();
    const unknownBrand = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from("ftypxxxx"), Buffer.alloc(8, 0x00)]);
    expect(detectMediaTypeFromBuffer(unknownBrand)).toBeNull();
  });

  it("rejects buffers too short to contain a signature", () => {
    expect(detectMediaTypeFromBuffer(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectMediaTypeFromBuffer(Buffer.alloc(0))).toBeNull();
  });
});

describe("validateFileConsistency (declared MIME vs content vs extension)", () => {
  it("accepts matching content, MIME, and extension", () => {
    expect(validateFileConsistency(JPEG, "image/jpeg", "photo.jpg")).toBe("image");
    expect(validateFileConsistency(PNG, "image/png", "chart.png")).toBe("image");
    expect(validateFileConsistency(MP4, "video/mp4", "clip.mp4")).toBe("video");
    expect(validateFileConsistency(WAV, "audio/wav", "song.wav")).toBe("audio");
  });

  it("accepts files without an extension (extension is advisory)", () => {
    expect(validateFileConsistency(JPEG, "image/jpeg", "noext")).toBe("image");
  });

  it("rejects content that contradicts the declared MIME type", () => {
    expect(() => validateFileConsistency(EXECUTABLE, "image/jpeg", "evil.jpg")).toThrow(AppError);
    expect(() => validateFileConsistency(TEXT, "image/png", "notes.txt")).toThrow(AppError);
  });

  it("rejects a PNG declared as audio (family mismatch)", () => {
    expect(() => validateFileConsistency(PNG, "audio/mpeg", "fake.mp3")).toThrow(AppError);
  });

  it("rejects mismatched extensions", () => {
    expect(() => validateFileConsistency(JPEG, "image/jpeg", "photo.exe")).toThrow(AppError);
    expect(() => validateFileConsistency(MP4, "video/mp4", "clip.jpg")).toThrow(AppError);
  });
});
