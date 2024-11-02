import { VideoScanner } from "../utils/videoScanner.js";
import { useConfig } from "../utils/config.js";
import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs";

class VideoLibrary extends EventEmitter {
  constructor() {
    super();
    this.videos = [];
    this.idMap = {}; // used when `usePathIds` is true
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
    const config = (await useConfig()).getConfig();
    const { videoPaths = [], usePathIds = true} = config;
    this.videoScanner = new VideoScanner({
      cacheName: config.cacheName,
      getDuration: config.getDuration ?? true,
    });
    this.videos = await this.scanVideoPaths(videoPaths);
    this.secureVideos = this.processPathSecurity(this.videos, usePathIds);
    this.emit("updated");
  }

  async scanVideoPaths(videoPaths) {
    const results = [];

    const startTime = Date.now();
    for (const { path: videoPath, name } of videoPaths) {
      try {
        // Convert ~ to user home directory
        const expandedPath = videoPath.replace(
          /^~/,
          process.env.HOME || process.env.USERPROFILE
        );
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
    const timeElapsed = Date.now() - startTime;
    const videoCount = results.reduce(
      (sum, result) => sum + (result.videoCount ?? 1),
      0
    );
    const totalDuration = results.reduce(
      (sum, result) => sum + (result.duration ?? 0),
      0
    );
    logger.info(
      `Scaned ${videoCount} videos in ${results.length} directories in ${timeElapsed}ms.`
    );
    logger.info(`Total duration: ${totalDuration}`);
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
    onUpdate: (callback) => videoLibrary.on("updated", callback),
  };
};
