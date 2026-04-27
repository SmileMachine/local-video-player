import {
  chooseAacBitrate,
  chooseOutputChannels,
  needsCompatibleAudio,
  normalizeAudioTranscodeConfig,
  parseBitrate,
} from "./audioTranscode.js";

describe("audio transcode policy", () => {
  it("detects codecs that need compatible audio", () => {
    expect(needsCompatibleAudio({ codec: "aac" })).toBe(false);
    expect(needsCompatibleAudio({ codec: "eac3" })).toBe(true);
    expect(needsCompatibleAudio({ codec: "pcm_u8" })).toBe(true);
  });

  it("treats configured channels as an upper bound", () => {
    expect(chooseOutputChannels({ sourceChannels: 1, maxChannels: 2 })).toBe(1);
    expect(chooseOutputChannels({ sourceChannels: 6, maxChannels: 2 })).toBe(2);
    expect(chooseOutputChannels({ sourceChannels: 6, maxChannels: 8 })).toBe(6);
  });

  it("parses common bitrate values", () => {
    expect(parseBitrate("384k")).toBe(384000);
    expect(parseBitrate("1.5m")).toBe(1500000);
    expect(parseBitrate(192000)).toBe(192000);
    expect(parseBitrate("auto")).toBeNull();
  });

  it("uses source bitrate and configured bitrate as upper bounds", () => {
    expect(chooseAacBitrate({
      sourceBitrate: 160000,
      outputChannels: 2,
      maxBitrate: "384k",
    })).toBe(160000);
    expect(chooseAacBitrate({
      sourceBitrate: 640000,
      outputChannels: 2,
      maxBitrate: "384k",
    })).toBe(256000);
    expect(chooseAacBitrate({
      sourceBitrate: 640000,
      outputChannels: 6,
      maxBitrate: "384k",
    })).toBe(384000);
  });

  it("normalizes missing audio transcode config", () => {
    expect(normalizeAudioTranscodeConfig({})).toEqual({
      enabled: true,
      cacheDir: "cache/audio",
      codec: "aac",
      maxBitrate: "384k",
      maxChannels: 2,
    });
  });
});
