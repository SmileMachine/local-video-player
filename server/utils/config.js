import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { VideoScanner } from "./videoScanner.js";
import { logger } from "./logger.js";

class ConfigManager extends EventEmitter {
  static #instance;
  #initialized = false;

  static async getInstance() {
    if (!this.#instance) {
      this.#instance = new ConfigManager();
      await this.#instance.init();
    }
    return this.#instance;
  }

  constructor() {
    super();
    this.config = {};
    this.configPath = path.resolve("config.json");
  }

  async init() {
    if (this.#initialized) return;
    await this.load();
    this.watchConfig();
    this.#initialized = true;
  }

  async load() {
    try {
      const configData = fs.readFileSync(this.configPath, "utf8");
      this.config = JSON.parse(configData);
      this.emit("updated", this.config);
    } catch (error) {
      console.error("Error loading video config:", error);
    }
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

  getConfig() {
    return this.config;
  }
}

// 使用方式
export const useConfig = async () => {
  const configManager = await ConfigManager.getInstance();
  return {
    getConfig: () => configManager.getConfig(),
    onUpdate: (callback) => configManager.on("updated", callback),
  };
};
