import crypto from "crypto";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { useConfig } from "../utils/config.js";
import {
  chooseAacBitrate,
  chooseOutputChannels,
  formatBitrate,
  needsCompatibleAudio,
  normalizeAudioTranscodeConfig,
} from "../../shared/audioTranscode.js";

const inFlightJobs = new Map();

const ffprobe = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(metadata);
    });
  });

const getAudioInfo = async (filePath) => {
  const metadata = await ffprobe(filePath);
  const audioStream = metadata.streams?.find((stream) => stream.codec_type === "audio");
  if (!audioStream) {
    return null;
  }

  return {
    codec: audioStream.codec_name,
    profile: audioStream.profile || null,
    channels: audioStream.channels || null,
    sampleRate: audioStream.sample_rate || null,
    bitRate: audioStream.bit_rate ? Number(audioStream.bit_rate) : null,
  };
};

const createCacheKey = ({ filePath, stat, audioInfo, output }) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify({
      filePath,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      audio: audioInfo,
      output,
    }))
    .digest("hex");

const buildDescriptor = async (filePath) => {
  const { getConfig } = await useConfig();
  const transcodeConfig = normalizeAudioTranscodeConfig(getConfig());
  const audioInfo = await getAudioInfo(filePath);
  const compatibleNeeded = needsCompatibleAudio(audioInfo);

  if (!transcodeConfig.enabled || !compatibleNeeded) {
    return {
      enabled: transcodeConfig.enabled,
      needed: compatibleNeeded,
      exists: false,
      audioInfo,
      filePath: null,
      output: null,
    };
  }

  const stat = fs.statSync(filePath);
  const outputChannels = chooseOutputChannels({
    sourceChannels: audioInfo?.channels,
    maxChannels: transcodeConfig.maxChannels,
  });
  const outputBitrate = chooseAacBitrate({
    sourceBitrate: audioInfo?.bitRate,
    outputChannels,
    maxBitrate: transcodeConfig.maxBitrate,
  });
  const output = {
    codec: transcodeConfig.codec,
    channels: outputChannels,
    bitrate: formatBitrate(outputBitrate),
  };
  const key = createCacheKey({ filePath, stat, audioInfo, output });
  const cacheDir = path.resolve(transcodeConfig.cacheDir);
  const outputPath = path.join(cacheDir, `${key}.m4a`);

  return {
    key,
    enabled: transcodeConfig.enabled,
    needed: compatibleNeeded,
    exists: fs.existsSync(outputPath),
    audioInfo,
    filePath: outputPath,
    tempPath: path.join(cacheDir, `${key}.tmp`),
    output,
  };
};

const getProgressForKey = (key) => {
  const job = inFlightJobs.get(key);
  return {
    generating: Boolean(job && !job.done && !job.error),
    progress: job?.progress ?? null,
    error: job?.error ?? null,
  };
};

const buildStatus = (descriptor) => ({
  key: descriptor.key || null,
  enabled: descriptor.enabled,
  needed: descriptor.needed,
  exists: descriptor.exists,
  ...getProgressForKey(descriptor.key),
  audioInfo: descriptor.audioInfo,
  output: descriptor.output,
});

const generateAudio = async (sourcePath, descriptor, job) => {
  await fs.promises.mkdir(path.dirname(descriptor.filePath), { recursive: true });
  await fs.promises.rm(descriptor.tempPath, { force: true });

  await new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .outputOptions([
        "-map 0:a:0",
        "-vn",
        "-movflags +faststart",
      ])
      .audioCodec(descriptor.output.codec)
      .audioChannels(descriptor.output.channels)
      .audioBitrate(descriptor.output.bitrate)
      .format("ipod")
      .output(descriptor.tempPath)
      .on("progress", (progress) => {
        if (Number.isFinite(progress.percent)) {
          job.progress = Math.max(job.progress ?? 0, Math.min(99, progress.percent));
        }
      })
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  await fs.promises.rename(descriptor.tempPath, descriptor.filePath);
  job.progress = 100;
};

export const getCompatibleAudioStatus = async (filePath) => {
  const descriptor = await buildDescriptor(filePath);
  return buildStatus(descriptor);
};

export const startCompatibleAudio = async (filePath) => {
  const descriptor = await buildDescriptor(filePath);

  if (!descriptor.enabled) {
    const error = new Error("Audio transcode is disabled");
    error.statusCode = 404;
    throw error;
  }

  if (!descriptor.needed) {
    const error = new Error("Compatible audio is not needed");
    error.statusCode = 404;
    throw error;
  }

  if (descriptor.exists) {
    return descriptor;
  }

  const jobKey = descriptor.key;
  if (!inFlightJobs.has(jobKey)) {
    const job = { done: false, error: null, progress: 0, promise: null };
    job.promise = generateAudio(filePath, descriptor, job)
      .then(() => {
        job.done = true;
      })
      .catch((error) => {
        job.error = error.message || "Failed to generate compatible audio";
      })
      .finally(() => {
        setTimeout(() => inFlightJobs.delete(jobKey), 30_000);
      });
    inFlightJobs.set(jobKey, job);
  }

  return { ...descriptor, ...getProgressForKey(descriptor.key) };
};

export const ensureCompatibleAudio = async (filePath) => {
  const descriptor = await startCompatibleAudio(filePath);
  if (descriptor.exists) {
    return descriptor;
  }

  await inFlightJobs.get(descriptor.key)?.promise;
  const job = inFlightJobs.get(descriptor.key);
  if (job?.error) {
    const error = new Error(job.error);
    error.statusCode = 500;
    throw error;
  }
  if (!fs.existsSync(descriptor.filePath)) {
    const error = new Error("Compatible audio was not generated");
    error.statusCode = 500;
    throw error;
  }
  return { ...descriptor, exists: true, generating: false, progress: 100 };
};

export const getAudioCachePath = async (key) => {
  if (!/^[a-f0-9]{64}$/.test(String(key || ""))) {
    return null;
  }

  const { getConfig } = await useConfig();
  const transcodeConfig = normalizeAudioTranscodeConfig(getConfig());
  return path.join(path.resolve(transcodeConfig.cacheDir), `${key}.m4a`);
};

export const getAudioCacheStatus = async (key) => {
  const filePath = await getAudioCachePath(key);
  if (!filePath) {
    return null;
  }

  return {
    key,
    exists: fs.existsSync(filePath),
    ...getProgressForKey(key),
  };
};
