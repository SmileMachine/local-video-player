import path from "path";
import fs from "fs";
import { logger } from "./logger.js";

export class Cache {
  constructor(name) {
    // if no name is provided, return a mock cache
    if (!name) {
      this.load = () => {};
      this.save = () => {};
      this.set = () => {};
      this.get = () => {};
      return;
    }
    this.cachePath = path.join(process.cwd(), "cache", `${name}.json`);
    this.cache = this.load();
    this.cacheDirty = false;
  }

  load() {
    try {
      if (fs.existsSync(this.cachePath)) {
        return JSON.parse(fs.readFileSync(this.cachePath, "utf8"));
      }
    } catch (error) {
      logger.warn(`Failed to load cache: ${error}`);
    }
    return {};
  }

  save() {
    if (!this.cacheDirty) {
      return;
    }

    try {
      const cacheDir = path.dirname(this.cachePath);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      logger.warn(`Failed to save cache: ${error}`);
    }
  }

  set(key, value) {
    this.cache[key] = value;
    this.cacheDirty = true;
  }

  get(key) {
    return this.cache[key];
  }
}
