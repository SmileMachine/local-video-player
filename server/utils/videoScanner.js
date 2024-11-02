import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { logger } from "./logger.js";
import { Cache } from "./cache.js";

export class VideoScanner {
  // options: { cacheName: string, getDuration: boolean }
  // cache is used when getDuration is true
  constructor(options = {}) {
    this.supportedExtensions = [".mp4", ".webm", ".mkv", ".avi", ".mov"];
    this.getDuration = options.getDuration ?? true;
    this.cache = new Cache(this.getDuration ? options.cacheName : null);
  }

  async getVideoDuration(filePath) {
    if (!this.getDuration) {
      return null;
    }
    const stats = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stats.mtime.getTime()}`;

    // Check if the duration is cached
    if (this.cache.get(cacheKey)) {
      return this.cache.get(cacheKey);
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

  async scanPath(currentPath) {
    try {
      const stats = fs.statSync(currentPath);
      const name = path.basename(currentPath);
      const baseInfo = {
        name,
        type: stats.isDirectory() ? "directory" : "file",
        path: currentPath,
        mtime: stats.mtime,
      };

      if (this.isVideoFile(currentPath)) {
        const duration = await this.getVideoDuration(currentPath);
        return {
          ...baseInfo,
          size: stats.size,
          duration,
        };
      } else if (stats.isDirectory()) {
        // Ignore hidden directories
        if (name.startsWith(".")) {
          return null;
        }

        const items = fs.readdirSync(currentPath);
        const children = await Promise.all(
          items.map((item) => this.scanPath(path.join(currentPath, item)))
        );

        // Filter out null items
        const validChildren = children.filter(Boolean);
        if (validChildren.length > 0) {
          // Statistic
          const totalVideoCount = validChildren.reduce(
            (sum, child) => sum + (child.videoCount ?? 1),
            0
          );
          const totalVideoDuration = validChildren.reduce(
            (sum, child) => sum + (child.duration ?? 0),
            0
          );
          const totalVideoSize = validChildren.reduce(
            (sum, child) => sum + (child.size ?? 0),
            0
          );
          return {
            ...baseInfo,
            // Directory first, then by name
            children: validChildren.sort((a, b) =>
              a.type !== b.type
                ? a.type === "directory"
                  ? -1
                  : 1
                : a.name.localeCompare(b.name)
            ),
            videoCount: totalVideoCount,
            size: totalVideoSize,
            duration: totalVideoDuration,
          };
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error scanning ${currentPath}: ${error}`);
      return null;
    }
  }

  // Wrapper for scanPath so that we can save the cache
  async scan(path) {
    try {
      const result = await this.scanPath(path);
      this.cache.save();
      return result;
    } catch (error) {
      logger.error(`Error in scan: ${error}`);
      return null;
    }
  }
}
