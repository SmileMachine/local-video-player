import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import {
  convertBilibiliXmlToDPlayer,
  decodeDanmakuResponse,
  getDPlayerDanmaku,
  getDanmakuStatus,
} from "./danmakuFiles.js";

describe("danmaku file service", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "video-player-danmaku-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("matches a same-basename .dplayer.json next to the video", async () => {
    const videoPath = path.join(tempDir, "movie.mp4");
    await Promise.all([
      fs.promises.writeFile(videoPath, ""),
      fs.promises.writeFile(
        path.join(tempDir, "movie.dplayer.json"),
        JSON.stringify({
          code: 0,
          data: [
            [3, 0, 16777215, "u3", "third"],
            [1, 5, 99999999, "u1", "<first>"],
            [-1, 0, 16777215, "bad", "bad"],
          ],
        })
      ),
      fs.promises.writeFile(
        path.join(tempDir, "other.dplayer.json"),
        JSON.stringify({ code: 0, data: [[2, 0, 16777215, "other", "other"]] })
      ),
    ]);

    await expect(getDanmakuStatus(videoPath)).resolves.toEqual({
      exists: true,
      fileName: "movie.dplayer.json",
    });
    await expect(getDPlayerDanmaku(videoPath)).resolves.toEqual({
      code: 0,
      data: [
        [1, 0, 16777215, "u1", "&lt;first&gt;"],
        [3, 0, 16777215, "u3", "third"],
      ],
    });
  });

  it("uses suffixed .dplayer.json files when the exact file is absent", async () => {
    const videoPath = path.join(tempDir, "movie.mp4");
    await Promise.all([
      fs.promises.writeFile(videoPath, ""),
      fs.promises.writeFile(
        path.join(tempDir, "movie.zh.dplayer.json"),
        JSON.stringify({ code: 0, data: [[1, 0, 16777215, "u1", "zh"]] })
      ),
    ]);

    await expect(getDanmakuStatus(videoPath)).resolves.toEqual({
      exists: true,
      fileName: "movie.zh.dplayer.json",
    });
  });

  it("prefers cache/danmaku video-id .dplayer.json files", async () => {
    const videoPath = path.join(tempDir, "movie.mp4");
    const cacheDir = path.join(tempDir, "cache", "danmaku");
    await fs.promises.mkdir(cacheDir, { recursive: true });
    await Promise.all([
      fs.promises.writeFile(videoPath, ""),
      fs.promises.writeFile(
        path.join(tempDir, "movie.dplayer.json"),
        JSON.stringify({ code: 0, data: [[1, 0, 16777215, "sidecar", "sidecar"]] })
      ),
      fs.promises.writeFile(
        path.join(cacheDir, "video-id.dplayer.json"),
        JSON.stringify({ code: 0, data: [[2, 0, 16777215, "cache", "cache"]] })
      ),
    ]);

    await expect(getDanmakuStatus(videoPath, { videoId: "video-id", cacheDir })).resolves.toEqual({
      exists: true,
      fileName: "video-id.dplayer.json",
    });
    await expect(getDPlayerDanmaku(videoPath, { videoId: "video-id", cacheDir })).resolves.toEqual({
      code: 0,
      data: [[2, 0, 16777215, "cache", "cache"]],
    });
  });

  it("converts bilibili xml to DPlayer danmaku rows", () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?><i>',
      '<d p="1.5,1,25,16777215,0,0,user-a,1">hello &amp; hi</d>',
      '<d p="2.5,5,25,15138834,0,0,user-b,1">&lt;top&gt;</d>',
      '<d p="3.5,4,25,38979,0,0,user-c,1">bottom</d>',
      '<d p="4.5,7,25,16777215,0,0,user-d,1">unsupported</d>',
      "</i>",
    ].join("");

    expect(convertBilibiliXmlToDPlayer(xml)).toEqual({
      danmaku: {
        code: 0,
        data: [
          [1.5, 0, 16777215, "user-a", "hello &amp; hi"],
          [2.5, 1, 15138834, "user-b", "&lt;top&gt;"],
          [3.5, 2, 38979, "user-c", "bottom"],
        ],
      },
      stats: {
        total: 4,
        converted: 3,
        unsupported: {
          7: 1,
        },
      },
    });
  });

  it("decodes raw deflate bilibili xml responses", () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><i></i>';
    expect(decodeDanmakuResponse(zlib.deflateRawSync(Buffer.from(xml)))).toBe(xml);
  });
});
