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
    this.countedFiles = 0;
    this.countedDirs = 0;
    this.countProgressBar = null;
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
  
  // Multithreaded file counting, hope it's faster
  async countFiles(dirPath, isRoot = true) {
    try {
      // 如果是根目录，初始化进度条
      if (isRoot) {
        this.countedFiles = 0;
        this.countedDirs = 0;
        this.countProgressBar = createProgressBar({
          format: 'Counting | {countedFiles} files, {countedDirs} dirs | Current: {currentPath}',
          noTotalFormat: true,  // 不显示总数和百分比
          clearOnComplete: true
        });
        this.countProgressBar.start(100, 0); // 使用虚拟总数
      }

      const items = await fs.promises.readdir(dirPath);
      this.countedDirs++;
      this.updateCountProgress(dirPath);
      
      const counts = await Promise.all(
        items.map(async (item) => {
          const fullPath = path.join(dirPath, item);
          try {
            const stats = await fs.promises.stat(fullPath);
            if (stats.isDirectory() && !item.startsWith(".")) {
              return this.countFiles(fullPath, false);
            }
            if (this.isVideoFile(fullPath)) {
              this.countedFiles++;
              // wait for 1ms
              this.updateCountProgress(fullPath);
              return 1;
            }
            return 0;
          } catch (error) {
            logger.warn(`Error counting file ${fullPath}: ${error.message}`);
            return 0;
          }
        })
      );
      
      const total = counts.reduce((sum, count) => sum + count, 0);

      // 如果是根调用，停止进度条
      if (isRoot) {
        this.countProgressBar.stop();
        logger.info(`Found ${this.countedFiles} video files in ${this.countedDirs} directories`);
      }

      return total;
    } catch (error) {
      logger.error(`Error counting files in ${dirPath}: ${error.message}`);
      if (isRoot) {
        this.countProgressBar?.stop();
      }
      return 0;
    }
  }

  updateCountProgress(currentPath) {
    if (this.countProgressBar) {
      this.countProgressBar.update(50, {  // 使用固定值，因为我们不知道总数
        countedFiles: this.countedFiles,
        countedDirs: this.countedDirs,
        currentPath: path.basename(currentPath)
      });
    }
  }

  // 更新进度
  updateProgress(currentFile) {
    this.processedFiles++;
    if (this.progressBar) {
      this.progressBar.updatep(this.processedFiles, {
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
        this.updateProgress(currentPath);
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
  async scan(dirPath) {
    try {
      // 统计文件总数
      this.totalFiles = await this.countFiles(dirPath);
      this.processedFiles = 0;
      const cacheHit = this.cacheHit;
      const cacheMiss = this.cacheMiss;

      // 创建进度条
      this.progressBar = createProgressBar({
        total: this.totalFiles,
        format:
          "Scanning |{bar}| {percentage}% | {processedFiles}/{totalFiles} files ETA:{eta}s | {filename}",
      });

      const startTime = Date.now();
      const result = await this.scanPath(dirPath);
      const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(3);

      // 完成进度条
      this.progressBar.stop();

      // 输出统计信息
      const cacheHitRate =
        ((this.cacheHit - cacheHit) /
          (this.cacheHit + this.cacheMiss - cacheMiss - cacheHit)) *
        100;
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
