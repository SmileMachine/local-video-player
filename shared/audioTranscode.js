const SUPPORTED_AUDIO_CODECS = new Set(["aac", "mp3", "opus", "vorbis", "flac"]);

const DEFAULT_AUDIO_TRANSCODE_CONFIG = Object.freeze({
  enabled: true,
  cacheDir: "cache/audio",
  codec: "aac",
  maxBitrate: "384k",
  maxChannels: 2,
});

const CHANNEL_BITRATE_LIMITS = Object.freeze([
  { channels: 1, bitrate: 96_000 },
  { channels: 2, bitrate: 256_000 },
  { channels: 6, bitrate: 512_000 },
  { channels: 8, bitrate: 640_000 },
]);

export const normalizeAudioCodec = (codec) => String(codec || "").toLowerCase();

export const isBrowserAudioCodecSupported = (codec) =>
  SUPPORTED_AUDIO_CODECS.has(normalizeAudioCodec(codec));

export const needsCompatibleAudio = (audioInfo) => {
  const codec = normalizeAudioCodec(audioInfo?.codec);
  return Boolean(codec) && !isBrowserAudioCodecSupported(codec);
};

export const parseBitrate = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  const match = String(value || "").trim().toLowerCase().match(/^(\d+(?:\.\d+)?)([km]?)$/);
  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (unit === "m") {
    return Math.round(amount * 1_000_000);
  }
  if (unit === "k") {
    return Math.round(amount * 1_000);
  }
  return Math.round(amount);
};

export const formatBitrate = (bitsPerSecond) => `${Math.round(bitsPerSecond / 1000)}k`;

export const normalizeAudioTranscodeConfig = (config = {}) => {
  const audioTranscode = config.audioTranscode || {};
  const maxChannels = Number.parseInt(audioTranscode.maxChannels, 10);

  return {
    enabled: audioTranscode.enabled ?? DEFAULT_AUDIO_TRANSCODE_CONFIG.enabled,
    cacheDir: audioTranscode.cacheDir || DEFAULT_AUDIO_TRANSCODE_CONFIG.cacheDir,
    codec: audioTranscode.codec || DEFAULT_AUDIO_TRANSCODE_CONFIG.codec,
    maxBitrate: audioTranscode.maxBitrate || DEFAULT_AUDIO_TRANSCODE_CONFIG.maxBitrate,
    maxChannels: Number.isFinite(maxChannels) && maxChannels > 0
      ? maxChannels
      : DEFAULT_AUDIO_TRANSCODE_CONFIG.maxChannels,
  };
};

export const chooseOutputChannels = ({ sourceChannels, maxChannels }) => {
  const source = Number.parseInt(sourceChannels, 10);
  const max = Number.parseInt(maxChannels, 10);

  if (Number.isFinite(source) && source > 0 && Number.isFinite(max) && max > 0) {
    return Math.min(source, max);
  }
  if (Number.isFinite(source) && source > 0) {
    return source;
  }
  if (Number.isFinite(max) && max > 0) {
    return Math.min(max, 2);
  }
  return 2;
};

export const getRecommendedAacBitrate = (channels) => {
  const channelCount = Number.parseInt(channels, 10);
  if (!Number.isFinite(channelCount) || channelCount <= 0) {
    return CHANNEL_BITRATE_LIMITS[1].bitrate;
  }

  return CHANNEL_BITRATE_LIMITS.find((entry) => channelCount <= entry.channels)?.bitrate
    || CHANNEL_BITRATE_LIMITS[CHANNEL_BITRATE_LIMITS.length - 1].bitrate;
};

export const chooseAacBitrate = ({ sourceBitrate, outputChannels, maxBitrate }) => {
  const candidates = [
    parseBitrate(sourceBitrate),
    parseBitrate(maxBitrate),
    getRecommendedAacBitrate(outputChannels),
  ].filter(Boolean);

  return Math.min(...candidates);
};
