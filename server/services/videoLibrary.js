import { VideoScanner } from "../utils/videoScanner.js";
import { useConfig } from "../utils/config.js";
import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";
import moment from "moment";
import path from "path";
import fs from "fs";
import os from "os";

class VideoLibrary extends EventEmitter {
  constructor() {
    super();
    this.videos = [];
    this.secureVideos = [];
    this.idMap = {}; // used when `usePathIds` is true
    this.reloadPromise = null;
    this.init();
  }

  async init() {
    const { onUpdate } = await useConfig();
    onUpdate(this.handleConfigUpdate.bind(this));
    this.handleConfigUpdate();
  }

  // delete path from object
  // add id to object if `usePathIds` is true
  processPathSecurity(obj, usePathIds) {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.processPathSecurity(item, usePathIds));
    }

    if (typeof obj === "object" && obj !== null) {
      const newObj = { ...obj };
      if (newObj.path) {
        if (usePathIds && newObj.type === "file") {
          const id = crypto.randomUUID();
          this.idMap[id] = newObj.path;
          newObj.id = id;
        }
        delete newObj.path;
      }

      if (newObj.children) {
        newObj.children = this.processPathSecurity(newObj.children, usePathIds);
      }

      return newObj;
    }

    return obj;
  }

  async handleConfigUpdate() {
    await this.reloadVideos({ useCache: Boolean(process.env.USE_CACHE) });
  }

  async reloadVideos({ useCache = false } = {}) {
    if (this.reloadPromise) {
      return this.reloadPromise;
    }

    this.reloadPromise = (async () => {
      const config = (await useConfig()).getConfig();
      const { videoPaths = [], usePathIds = true } = config;
      this.videoScanner = new VideoScanner({
        cacheName: config.cacheName,
        getInfo: config.getVideoInfo ?? true,
      });
      this.idMap = {};
      this.videos = await this.scanVideoPaths(videoPaths, { useCache });
      this.secureVideos = this.processPathSecurity(this.videos, usePathIds);
      this.emit("updated");
      return this.secureVideos;
    })().finally(() => {
      this.reloadPromise = null;
    });

    return this.reloadPromise;
  }

  async saveCache(results) {
    try {
      const cachePath = path.join(process.cwd(), "cache", "scan-cache.json");
      const cacheDir = path.dirname(cachePath);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cachePath, JSON.stringify(results, null, 2));
    } catch (error) {
      logger.warn(`Failed to save cache: ${error}`);
    }
  }

  async loadCache() {
    const cachePath = path.join(process.cwd(), "cache", "scan-cache.json");
    try {
      if (fs.existsSync(cachePath)) {
        return JSON.parse(fs.readFileSync(cachePath, "utf8"));
      }
    } catch (error) {
      logger.warn(`Failed to load cache: ${error}`);
    }
    logger.info(`cache not found: ${cachePath}`);
    return null;
  }

  async scanVideoPaths(videoPaths, { useCache = false } = {}) {
    // try to load cache
    if (useCache) {
      logger.info(`Loading cache...`);
      const cache = await this.loadCache();
      if (cache?.results) {
        logger.info(
          `Cache from ${moment(cache.time).format("YYYY-MM-DD HH:mm:ss")} loaded.`
        );
        return cache.results;
      }
    }

    const results = [];
    logger.info(`Scanning ${videoPaths.length} video paths...`);
    // scan video paths
    const startTime = Date.now();
    for (const { path: videoPath, name } of videoPaths) {
      try {
        // Convert ~ to user home directory
        const expandedPath = videoPath.replace(/^~/, os.homedir());
        const resolvedPath = path.resolve(expandedPath);

        // read one video path (recursively)
        if (fs.existsSync(resolvedPath)) {
          const result = await this.videoScanner.scan(resolvedPath);
          if (result) {
            result.name = name;
            results.push(result);
          }
        }
      } catch (error) {
        console.error(`Error scanning path ${videoPath}:`, error);
      }
    }

    // log stats
    const timeElapsed = ((ms) => {
      return moment
        .utc(ms)
        .format(ms >= 60000 ? "m [m] s.SSS [s]" : "s.SSS [s]");
    })(Date.now() - startTime);
    const videoCount = results.reduce(
      (sum, result) => sum + (result.videoCount ?? 1),
      0
    );
    logger.info(
      `Scaned ${videoCount} videos in ${results.length} directories in ${timeElapsed}.`
    );
    const cacheHitRate =
      (this.videoScanner.cacheHit /
        (this.videoScanner.cacheHit + this.videoScanner.cacheMiss)) *
      100;
    logger.info(`Cache hit rate: ${cacheHitRate.toFixed(2)}%`);

    await this.saveCache({ time: Date.now(), results });
    return results;
  }

  // /video when relative path is used (when usePathIds is false)
  getVideos() {
    return this.videos;
  }

  // /api/videos
  getSecureVideos() {
    return this.secureVideos;
  }

  // /video when usePathIds is true
  getIdMap() {
    return this.idMap;
  }
}

const videoLibrary = new VideoLibrary();

export const useVideoLibrary = () => {
  return {
    getVideos: () => videoLibrary.getVideos(),
    getSecureVideos: () => videoLibrary.getSecureVideos(),
    getIdMap: () => videoLibrary.getIdMap(),
    reloadVideos: (options) => videoLibrary.reloadVideos(options),
    onUpdate: (callback) => videoLibrary.on("updated", callback),
  };
};
