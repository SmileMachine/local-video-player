import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { logger } from "./logger.js";
import { Cache } from "./cache.js";
import { createProgressBar } from "./progressBar.js";

export class VideoScanner {
  // options: { cacheName: string, getDuration: boolean }
  // cache is used when getDuration is true
  constructor(options = {}) {
    this.supportedExtensions = [".mp4", ".webm", ".mkv", ".avi", ".mov"];
    this.getDuration = options.getDuration ?? true;
    this.cache = new Cache(this.getDuration ? options.cacheName : null);
    this.cacheHit = 0;
    this.cacheMiss = 0;
    this.totalFiles = 0;
    this.processedFiles = 0;
    this.progressBar = null;
  }

  async getVideoDuration(filePath) {
    if (!this.getDuration) {
      return null;
    }
    const stats = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stats.mtime.getTime()}`;

    // Check if the duration is cached
    if (this.cache.get(cacheKey)) {
      this.cacheHit++;
      return this.cache.get(cacheKey);
    }
    this.cacheMiss++;

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

  // 统计总文件数
  countFiles(dirPath) {
    let count = 0;
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory() && !item.startsWith(".")) {
          count += this.countFiles(fullPath);
        } else if (this.isVideoFile(fullPath)) {
          count++;
        }
      } catch (error) {
        logger.warn(`Error counting file ${fullPath}: ${error.message}`);
      }
    }
    return count;
  }

  // 更新进度
  updateProgress(currentFile) {
    this.processedFiles++;
    if (this.progressBar) {
      this.progressBar.update(this.processedFiles, {
        filename: path.basename(currentFile),
      });
    }
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
        this.updateProgress(currentPath);
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
  async scan(dirPath) {
    try {
      // 统计文件总数
      this.totalFiles = this.countFiles(dirPath);
      this.processedFiles = 0;

      // 创建进度条
      this.progressBar = createProgressBar({
        total: this.totalFiles,
        format:
          "Scanning |{bar}| {percentage}% | {processedFiles}/{totalFiles} files | {filename}",
      });

      const startTime = Date.now();
      const result = await this.scanPath(dirPath);
      const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(3);

      // 完成进度条
      this.progressBar.stop();

      // 输出统计信息
      const cacheHitRate =
        (this.cacheHit / (this.cacheHit + this.cacheMiss)) * 100;
      logger.info(
        `videos: ${this.totalFiles
          .toString()
          .padStart(4)}, time: ${timeElapsed}s, cache: ${cacheHitRate.toFixed(
          2
        )}% in ${path.basename(dirPath)}`
      );
      this.cache.save();
      return result;
    } catch (error) {
      if (this.progressBar) {
        this.progressBar.stop();
      }
      logger.error(`Error in scan: ${error}`);
      return null;
    }
  }
}
