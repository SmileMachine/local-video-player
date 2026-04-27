import crypto from "crypto";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { buildEmbeddedCaptionTracks } from "../../shared/captionTracks.js";
import { combineVtt } from "../../shared/vtt.js";

const CAPTION_CACHE_DIR = "cache/captions";
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

const getBasePath = (videoPath) => {
  const parsed = path.parse(videoPath);
  return path.join(parsed.dir, parsed.name);
};

const getCacheDir = () => path.resolve(CAPTION_CACHE_DIR);

const hashObject = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

const getFileFingerprint = async (filePath) => {
  const stat = await fs.promises.stat(filePath);
  return {
    filePath,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
};

const externalTrack = async ({ videoPath, extension, format, label }) => {
  const filePath = `${getBasePath(videoPath)}.${extension}`;
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return {
      id: `external:${format}`,
      label,
      language: "und",
      format,
      source: "external",
      supported: true,
      filePath,
    };
  } catch {
    return null;
  }
};

const buildExternalTracks = async (videoPath) => {
  const tracks = await Promise.all([
    externalTrack({
      videoPath,
      extension: "vtt",
      format: "vtt",
      label: "同名 VTT",
    }),
    externalTrack({
      videoPath,
      extension: "srt",
      format: "srt",
      label: "同名 SRT",
    }),
  ]);

  return tracks.filter(Boolean);
};

const buildEmbeddedTracks = async (videoPath, mediaInfo) => {
  if (Array.isArray(mediaInfo?.subtitles)) {
    return mediaInfo.subtitles;
  }

  const metadata = await ffprobe(videoPath);
  return buildEmbeddedCaptionTracks(metadata.streams || []);
};

const serializeTrack = (track) => ({
  id: track.id,
  label: track.label,
  language: track.language,
  format: track.format,
  codec: track.codec,
  source: track.source,
  supported: track.supported,
  imageSubtitle: track.imageSubtitle,
  default: track.default,
});

export const getCaptionTracks = async (videoPath, mediaInfo = null) => {
  const tracks = [
    ...(await buildExternalTracks(videoPath)),
    ...(await buildEmbeddedTracks(videoPath, mediaInfo)),
  ];
  const supportedTracks = tracks.filter((track) => track.supported);
  const defaultTrack =
    supportedTracks.find((track) => track.default) ||
    supportedTracks[0] ||
    null;

  return {
    exists: Boolean(defaultTrack),
    tracks: tracks.map(serializeTrack),
    defaultTrackId: defaultTrack?.id || "",
  };
};

const findTrack = async (videoPath, trackId, mediaInfo = null) => {
  const tracks = [
    ...(await buildExternalTracks(videoPath)),
    ...(await buildEmbeddedTracks(videoPath, mediaInfo)),
  ];
  return tracks.find((track) => track.id === trackId) || null;
};

const createSingleCacheDescriptor = async (videoPath, track) => {
  const sourcePath = track.source === "external" ? track.filePath : videoPath;
  const key = hashObject({
    type: "caption-single-v1",
    video: await getFileFingerprint(videoPath),
    source: await getFileFingerprint(sourcePath),
    track: {
      id: track.id,
      source: track.source,
      format: track.format,
      codec: track.codec,
      streamIndex: track.streamIndex,
    },
  });
  const filePath = path.join(getCacheDir(), `${key}.vtt`);

  return {
    key,
    filePath,
    tempPath: path.join(getCacheDir(), `${key}.tmp.vtt`),
  };
};

const createCombinedCacheDescriptor = async (videoPath, primaryTrack, secondaryTrack) => {
  const primarySourcePath = primaryTrack.source === "external" ? primaryTrack.filePath : videoPath;
  const secondarySourcePath = secondaryTrack.source === "external" ? secondaryTrack.filePath : videoPath;
  const key = hashObject({
    type: "caption-combined-v1",
    video: await getFileFingerprint(videoPath),
    primary: {
      id: primaryTrack.id,
      source: primaryTrack.source,
      fingerprint: await getFileFingerprint(primarySourcePath),
      format: primaryTrack.format,
      codec: primaryTrack.codec,
    },
    secondary: {
      id: secondaryTrack.id,
      source: secondaryTrack.source,
      fingerprint: await getFileFingerprint(secondarySourcePath),
      format: secondaryTrack.format,
      codec: secondaryTrack.codec,
    },
  });
  const filePath = path.join(getCacheDir(), `${key}.vtt`);

  return {
    key,
    filePath,
    tempPath: path.join(getCacheDir(), `${key}.tmp.vtt`),
  };
};

const runJobOnce = async (descriptor, generator) => {
  if (fs.existsSync(descriptor.filePath)) {
    return descriptor.filePath;
  }

  if (!inFlightJobs.has(descriptor.key)) {
    const promise = (async () => {
      await fs.promises.mkdir(path.dirname(descriptor.filePath), { recursive: true });
      await fs.promises.rm(descriptor.tempPath, { force: true });
      await generator(descriptor.tempPath);
      await fs.promises.rename(descriptor.tempPath, descriptor.filePath);
      return descriptor.filePath;
    })().finally(() => {
      setTimeout(() => inFlightJobs.delete(descriptor.key), 30_000);
    });
    inFlightJobs.set(descriptor.key, promise);
  }

  await inFlightJobs.get(descriptor.key);
  return descriptor.filePath;
};

const convertExternalSubtitle = async (track, outputPath) =>
  new Promise((resolve, reject) => {
    ffmpeg(track.filePath)
      .outputOptions(["-f webvtt"])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

const convertEmbeddedSubtitle = async (videoPath, track, outputPath) =>
  new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        `-map 0:${track.streamIndex}`,
        "-f webvtt",
      ])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

const ensureSingleVtt = async (videoPath, track) => {
  if (!track?.supported) {
    const error = new Error("Subtitle track is not supported");
    error.statusCode = 415;
    throw error;
  }

  if (track.source === "external" && track.format === "vtt") {
    return track.filePath;
  }

  const descriptor = await createSingleCacheDescriptor(videoPath, track);
  return runJobOnce(descriptor, (outputPath) => {
    if (track.source === "external") {
      return convertExternalSubtitle(track, outputPath);
    }
    return convertEmbeddedSubtitle(videoPath, track, outputPath);
  });
};

export const getCaptionTrackFile = async (videoPath, trackId, mediaInfo = null) => {
  const status = await getCaptionTracks(videoPath, mediaInfo);
  const resolvedTrackId = trackId || status.defaultTrackId;
  if (!resolvedTrackId) {
    return null;
  }

  const track = await findTrack(videoPath, resolvedTrackId, mediaInfo);
  if (!track) {
    return null;
  }

  return ensureSingleVtt(videoPath, track);
};

export const getCombinedCaptionFile = async (
  videoPath,
  primaryTrackId,
  secondaryTrackId,
  mediaInfo = null
) => {
  if (!primaryTrackId || !secondaryTrackId) {
    const error = new Error("Both primary and secondary subtitle tracks are required");
    error.statusCode = 400;
    throw error;
  }

  const [primaryTrack, secondaryTrack] = await Promise.all([
    findTrack(videoPath, primaryTrackId, mediaInfo),
    findTrack(videoPath, secondaryTrackId, mediaInfo),
  ]);

  if (!primaryTrack || !secondaryTrack) {
    return null;
  }

  const descriptor = await createCombinedCacheDescriptor(videoPath, primaryTrack, secondaryTrack);
  return runJobOnce(descriptor, async (outputPath) => {
    const [primaryPath, secondaryPath] = await Promise.all([
      ensureSingleVtt(videoPath, primaryTrack),
      ensureSingleVtt(videoPath, secondaryTrack),
    ]);
    const [primaryContent, secondaryContent] = await Promise.all([
      fs.promises.readFile(primaryPath, "utf8"),
      fs.promises.readFile(secondaryPath, "utf8"),
    ]);

    await fs.promises.writeFile(outputPath, combineVtt(primaryContent, secondaryContent), "utf8");
  });
};
