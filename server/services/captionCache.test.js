import fs from "fs";
import os from "os";
import path from "path";
import { getCaptionTracks } from "./captionCache.js";

describe("caption cache service", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "video-player-captions-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("matches multiple external subtitle suffixes for the same video basename", async () => {
    const videoPath = path.join(tempDir, "movie.mp4");
    await Promise.all([
      fs.promises.writeFile(videoPath, ""),
      fs.promises.writeFile(path.join(tempDir, "movie.vtt"), "WEBVTT\n"),
      fs.promises.writeFile(path.join(tempDir, "movie.srt"), "1\n00:00:01,000 --> 00:00:02,000\nHi\n"),
      fs.promises.writeFile(path.join(tempDir, "movie.zh.srt"), "1\n00:00:01,000 --> 00:00:02,000\n你好\n"),
      fs.promises.writeFile(path.join(tempDir, "movie.en.ass"), ""),
      fs.promises.writeFile(path.join(tempDir, "other.zh.srt"), ""),
    ]);

    const status = await getCaptionTracks(videoPath, { subtitles: [] });

    expect(status.defaultTrackId).toBe("external:vtt");
    expect(status.tracks.map((track) => track.fileName)).toEqual([
      "movie.vtt",
      "movie.srt",
      "movie.zh.srt",
      "movie.en.ass",
    ]);
    expect(status.tracks.find((track) => track.fileName === "movie.zh.srt")).toMatchObject({
      label: "zh SRT",
      language: "zh",
      format: "srt",
      source: "external",
      supported: true,
    });
  });
});
