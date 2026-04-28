import fs from "fs";
import os from "os";
import path from "path";
import {
  buildFileFingerprint,
  normalizeCacheFingerprintConfig,
} from "./fileFingerprint.js";

describe("file fingerprint", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "video-player-fingerprint-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("uses stat mode by default", () => {
    expect(normalizeCacheFingerprintConfig({})).toEqual({
      mode: "stat",
      sampleBytes: 1048576,
    });
  });

  it("does not include the file path in stat fingerprints", async () => {
    const firstPath = path.join(tempDir, "first.bin");
    const secondPath = path.join(tempDir, "second.bin");
    await fs.promises.writeFile(firstPath, "same content");

    const firstFingerprint = await buildFileFingerprint(firstPath, {
      cacheFingerprint: { mode: "stat" },
    });
    await fs.promises.rename(firstPath, secondPath);
    const secondFingerprint = await buildFileFingerprint(secondPath, {
      cacheFingerprint: { mode: "stat" },
    });

    expect(secondFingerprint).toEqual(firstFingerprint);
  });

  it("can add head and tail samples when configured", async () => {
    const filePath = path.join(tempDir, "sampled.bin");
    await fs.promises.writeFile(filePath, "abcdefghijklmnopqrstuvwxyz");

    const fingerprint = await buildFileFingerprint(filePath, {
      cacheFingerprint: { mode: "sampled", sampleBytes: 4 },
    });

    expect(fingerprint).toMatchObject({
      version: "file-fingerprint-sampled-v1",
      size: 26,
      sampleBytes: 4,
    });
    expect(fingerprint.headHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint.tailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint.headHash).not.toBe(fingerprint.tailHash);
  });
});
