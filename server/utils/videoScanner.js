import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { logger } from "./logger.js";
import { Cache } from "./cache.js";
import {
  createScanProgressBar,
  createInfoProgressBar,
  mockProgressBar,
} from "./progressBar.js";

export class VideoScanner {
  // options: { cacheName: string, getDuration: boolean }
  // cache is used when getDuration is true
  constructor({ getDuration = true, cacheName } = {}) {
    this.supportedExtensions = [".mp4", ".webm", ".mkv", ".avi", ".mov"];
    this.getDuration = getDuration;
    // 初始化计数器
    this.cacheHit = 0;
    this.cacheMiss = 0;

    const cacheInstance = new Cache(this.getDuration ? cacheName : null);
    this.cache = {
      _cache: cacheInstance,
      get: function (key) {
        const value = cacheInstance.get(key);
        if (value) {
          this.cacheHit++;
        } else {
          this.cacheMiss++;
        }
        return value;
      }.bind(this), // 绑定外部的 this
      set: cacheInstance.set.bind(cacheInstance),
      save: cacheInstance.save.bind(cacheInstance),
    };
    // Stats for progress bar
    this.processedFiles = 0;
    this.scanStats = {
      scannedFiles: 0,
      scannedDirs: 0,
      videosFound: 0,
      currentDir: "",
    };
  }

  async getVideoDuration(filePath) {
    if (!this.getDuration) {
      return null;
    }
    const stats = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stats.mtime.getTime()}`;

    // Check if the duration is cached
    const duration = this.cache.get(cacheKey);
    if (duration) {
      return duration;
    }

    // If not cached, get the duration
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.warn(`Could not get duration for ${filePath}: ${err.message}`);
          resolve(null);
          return;
        }

        const duration = parseFloat(metadata.format.duration);
        logger.debug(`duration: ${duration}`);
        // Save to cache
        this.cache.set(cacheKey, duration);
        resolve(duration);
      });
    });
  }

  // Check if the file is a video file
  isVideoFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  async scanVideos(dirPath, bar = mockProgressBar, ignoreHidden = true) {
    try {
      const name = path.basename(dirPath);
      // Ignore hidden directories
      if (ignoreHidden && name.startsWith(".")) {
        return null;
      }
      const stats = fs.statSync(dirPath);
      const baseInfo = {
        name,
        type: stats.isDirectory() ? "directory" : "file",
        path: dirPath,
        mtime: stats.mtime,
      };

      if (this.isVideoFile(dirPath)) {
        this.scanStats.scannedFiles++;
        this.scanStats.videosFound++;
        bar.update(this.scanStats.scannedFiles, {
          videosFound: this.scanStats.videosFound,
        });
        return {
          ...baseInfo,
          size: stats.size,
        };
      } else if (!stats.isDirectory()) {
        this.scanStats.scannedFiles++;
        bar.update(this.scanStats.scannedFiles);
        return null;
      }
      this.scanStats.scannedDirs++;
      bar.update(this.scanStats.scannedFiles, {
        scannedDirs: this.scanStats.scannedDirs,
        currentDir: name,
      });

      const items = await fs.promises.readdir(dirPath);
      const children = await Promise.all(
        items.map((item) =>
          this.scanVideos(path.join(dirPath, item), bar, ignoreHidden)
        )
      );
      // Filter out null items
      // Sort by dsirectory first, then by name ascending
      const validChildren = children
        .filter(Boolean)
        .sort((a, b) =>
          a.type !== b.type
            ? a.type === "directory"
              ? -1
              : 1
            : a.name.localeCompare(b.name)
        );
      if (validChildren.length === 0) {
        return null;
      }
      const totalVideoCount = validChildren.reduce(
        (sum, child) => sum + (child.videoCount ?? 1),
        0
      );
      const totalSize = validChildren.reduce(
        (sum, child) => sum + (child.size ?? 0),
        0
      );

      return {
        ...baseInfo,
        children: validChildren,
        videoCount: totalVideoCount,
        size: totalSize,
      };
    } catch (error) {
      logger.error(`Error scanning videos in ${dirPath}: ${error.message}`);
      return null;
    }
  }

  async enrichWithDurations(videoData, bar = mockProgressBar) {
    try {
      const result = { ...videoData };

      if (result.type === "file") {
        this.processedFiles++;
        bar.update(this.processedFiles, { filename: result.name });
        result.duration = await this.getVideoDuration(result.path);
        return result;
      }

      result.children = await Promise.all(
        videoData.children.map((item) => this.enrichWithDurations(item, bar))
      );

      return result;
    } catch (error) {
      logger.error(`Error enriching items with duration: ${error.message}`);
      throw error;
    }
  }

  // Wrapper for scanPath so that we can save the cache
  async scan(dirPath, useProgressBar = true) {
    let scanProgressbar, infoProgressBar;
    const startTime = Date.now();
    try {
      if (useProgressBar) {
        scanProgressbar = createScanProgressBar();
      }
      const videos = await this.scanVideos(dirPath, scanProgressbar);
      logger.debug(videos, "videos-raw.json");

      const cacheHitStart = this.cacheHit;
      if (useProgressBar) {
        infoProgressBar = createInfoProgressBar({
          total: videos.videoCount,
        });
      }
      const enrichedVideos = await this.enrichWithDurations(
        videos,
        infoProgressBar
      );
      infoProgressBar.stop();
      const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(3);
      const deltaHit = this.cacheHit - cacheHitStart;

      // 输出统计信息
      const cacheHitRate = (deltaHit / videos.videoCount) * 100;
      logger.info(
        `videos: ${videos.videoCount
          .toString()
          .padStart(4)}, time: ${timeElapsed}s, cache: ${cacheHitRate.toFixed(
          2
        )}% in ${path.basename(dirPath)}`
      );
      this.cache.save();
      return enrichedVideos;
    } catch (error) {
      logger.error(`Error in scan: ${error}`);
      scanProgressbar?.stop();
      infoProgressBar?.stop();
      return null;
    }
  }
}
