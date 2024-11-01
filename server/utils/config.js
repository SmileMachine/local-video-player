import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { VideoScanner } from "./videoScanner.js";
import { logger } from "./logger.js";

class ConfigManager extends EventEmitter {
  constructor() {
    super();
    this.videos = [];
    this.configPath = path.resolve("config.json");
    this.videoScanner = new VideoScanner();
    this.load();
    this.watchConfig();
  }

  async load() {
    try {
      const configData = fs.readFileSync(this.configPath, "utf8");
      const { videoPaths = [] } = JSON.parse(configData);
      this.videos = await this.scanVideoPaths(videoPaths);
      this.emit("updated", this.videos);
      return this.videos;
    } catch (error) {
      console.error("Error loading video config:", error);
      return [];
    }
  }

  async scanVideoPaths(videoPaths) {
    const results = [];

    for (const { path: videoPath, name } of videoPaths) {
      try {
        const expandedPath = videoPath.replace(
          /^~/,
          process.env.HOME || process.env.USERPROFILE
        );
        const resolvedPath = path.resolve(expandedPath);

        if (fs.existsSync(resolvedPath)) {
          const result = await this.videoScanner.scanPath(resolvedPath);
          if (result) {
            result.name = name
            results.push(result);
          }
        }
      } catch (error) {
        console.error(`Error scanning path ${videoPath}:`, error);
      }
    }

    logger.info(`Scaned ${results.length} videos`);
    return results;
  }

  watchConfig() {
    fs.watch(this.configPath, (eventType) => {
      if (eventType === "change") {
        this.load();
      }
    });

    const watchedDirs = new Set();
    const watchDir = (dirPath) => {
      if (watchedDirs.has(dirPath)) return;

      try {
        fs.watch(dirPath, (eventType) => {
          if (eventType === "change") {
            this.load();
          }
        });
        watchedDirs.add(dirPath);
      } catch (error) {
        console.error(`Error watching directory ${dirPath}:`, error);
      }
    };

    this.on("updated", () => {
      const { videoPaths = [] } = JSON.parse(
        fs.readFileSync(this.configPath, "utf8")
      );
      videoPaths.forEach((videoPath) => {
        const expandedPath = videoPath.path.replace(
          /^~/,
          process.env.HOME || process.env.USERPROFILE
        );
        const resolvedPath = path.resolve(expandedPath);
        if (
          fs.existsSync(resolvedPath) &&
          fs.statSync(resolvedPath).isDirectory()
        ) {
          watchDir(resolvedPath);
        }
      });
    });
  }

  getVideos() {
    return this.videos;
  }
}

const configManager = new ConfigManager();

export const useConfig = () => {
  return {
    getVideos: () => configManager.getVideos(),
    onUpdate: (callback) => configManager.on("updated", callback),
  };
};
