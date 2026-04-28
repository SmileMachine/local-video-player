import crypto from "crypto";
import fs from "fs";
import { useConfig } from "./config.js";

const DEFAULT_CACHE_FINGERPRINT_CONFIG = {
  mode: "stat",
  sampleBytes: 1024 * 1024,
};

export const normalizeCacheFingerprintConfig = (config = {}) => {
  const fingerprintConfig = config.cacheFingerprint || {};
  const mode = fingerprintConfig.mode === "sampled" ? "sampled" : "stat";
  const sampleBytes = Number.parseInt(fingerprintConfig.sampleBytes, 10);

  return {
    mode,
    sampleBytes: Number.isFinite(sampleBytes) && sampleBytes > 0
      ? sampleBytes
      : DEFAULT_CACHE_FINGERPRINT_CONFIG.sampleBytes,
  };
};

const hashBuffer = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const readFileRange = async (filePath, start, length) => {
  if (length <= 0) {
    return Buffer.alloc(0);
  }

  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

export const buildFileFingerprint = async (filePath, config = {}) => {
  const fingerprintConfig = normalizeCacheFingerprintConfig(config);
  const stat = await fs.promises.stat(filePath);
  const baseFingerprint = {
    version: `file-fingerprint-${fingerprintConfig.mode}-v1`,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };

  if (fingerprintConfig.mode !== "sampled") {
    return baseFingerprint;
  }

  const sampleBytes = Math.min(fingerprintConfig.sampleBytes, stat.size);
  const tailStart = Math.max(0, stat.size - sampleBytes);
  const [head, tail] = await Promise.all([
    readFileRange(filePath, 0, sampleBytes),
    readFileRange(filePath, tailStart, sampleBytes),
  ]);

  return {
    ...baseFingerprint,
    sampleBytes,
    headHash: hashBuffer(head),
    tailHash: hashBuffer(tail),
  };
};

export const buildConfiguredFileFingerprint = async (filePath) => {
  const { getConfig } = await useConfig();
  return buildFileFingerprint(filePath, getConfig());
};
