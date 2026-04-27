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

const generateAudio = async (sourcePath, descriptor) => {
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
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  await fs.promises.rename(descriptor.tempPath, descriptor.filePath);
};

export const getCompatibleAudioStatus = async (filePath) => {
  const descriptor = await buildDescriptor(filePath);
  return {
    key: descriptor.key || null,
    enabled: descriptor.enabled,
    needed: descriptor.needed,
    exists: descriptor.exists,
    audioInfo: descriptor.audioInfo,
    output: descriptor.output,
  };
};

export const ensureCompatibleAudio = async (filePath) => {
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

  const jobKey = descriptor.filePath;
  if (!inFlightJobs.has(jobKey)) {
    inFlightJobs.set(
      jobKey,
      generateAudio(filePath, descriptor).finally(() => inFlightJobs.delete(jobKey))
    );
  }

  await inFlightJobs.get(jobKey);
  return { ...descriptor, exists: true };
};

export const getAudioCachePath = async (key) => {
  if (!/^[a-f0-9]{64}$/.test(String(key || ""))) {
    return null;
  }

  const { getConfig } = await useConfig();
  const transcodeConfig = normalizeAudioTranscodeConfig(getConfig());
  return path.join(path.resolve(transcodeConfig.cacheDir), `${key}.m4a`);
};
