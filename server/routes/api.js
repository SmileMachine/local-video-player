import { Router } from "express";
import { useVideoLibrary } from "../services/videoLibrary.js";
import { useConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";

const router = Router();
const { getSecureVideos, reloadVideos, onUpdate } = useVideoLibrary();

let videos = {};
onUpdate(() => {
  videos = getSecureVideos();
});

router.get("/videos", (req, res) => {
  res.json(videos);
});

router.post("/videos/reload", async (req, res) => {
  try {
    videos = await reloadVideos({ useCache: false });
    res.json({ videos });
  } catch (error) {
    logger.error("Error reloading videos:", error);
    res.status(500).json({ error: "Failed to reload videos" });
  }
});

// Config endpoints
router.get("/config", async (req, res) => {
  try {
    const { getConfig } = await useConfig();
    res.json(getConfig());
  } catch (error) {
    logger.error("Error getting config:", error);
    res.status(500).json({ error: "Failed to get config" });
  }
});

router.put("/config", async (req, res) => {
  try {
    const newConfig = req.body;
    const configPath = path.resolve("config.json");

    logger.info("Attempting to save config:", newConfig);

    // Validate config structure
    if (!newConfig.videoPaths || !Array.isArray(newConfig.videoPaths)) {
      logger.error("Invalid config structure - videoPaths missing or not array");
      return res.status(400).json({ error: "Invalid config structure" });
    }

    // Validate each video path
    for (const vp of newConfig.videoPaths) {
      if (!vp.name || !vp.path) {
        logger.error("Invalid video path entry:", vp);
        return res.status(400).json({ error: "Each video path must have name and path" });
      }
    }

    // Validate boolean fields
    if (newConfig.getVideoInfo !== undefined && typeof newConfig.getVideoInfo !== 'boolean') {
      logger.error("Invalid getVideoInfo value:", newConfig.getVideoInfo);
      return res.status(400).json({ error: "getVideoInfo must be a boolean" });
    }

    if (newConfig.usePathIds !== undefined && typeof newConfig.usePathIds !== 'boolean') {
      logger.error("Invalid usePathIds value:", newConfig.usePathIds);
      return res.status(400).json({ error: "usePathIds must be a boolean" });
    }

    if (newConfig.audioTranscode !== undefined) {
      const audioTranscode = newConfig.audioTranscode;
      if (typeof audioTranscode !== 'object' || audioTranscode === null || Array.isArray(audioTranscode)) {
        logger.error("Invalid audioTranscode value:", audioTranscode);
        return res.status(400).json({ error: "audioTranscode must be an object" });
      }

      if (audioTranscode.enabled !== undefined && typeof audioTranscode.enabled !== 'boolean') {
        logger.error("Invalid audioTranscode.enabled value:", audioTranscode.enabled);
        return res.status(400).json({ error: "audioTranscode.enabled must be a boolean" });
      }

      if (audioTranscode.maxChannels !== undefined) {
        const maxChannels = Number.parseInt(audioTranscode.maxChannels, 10);
        if (!Number.isFinite(maxChannels) || maxChannels <= 0) {
          logger.error("Invalid audioTranscode.maxChannels value:", audioTranscode.maxChannels);
          return res.status(400).json({ error: "audioTranscode.maxChannels must be a positive number" });
        }
      }
    }

    // Write to config file
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), "utf8");
    logger.info("Config saved successfully");

    // ConfigManager will automatically detect the change and reload
    const { getConfig } = await useConfig();
    res.json(getConfig());
  } catch (error) {
    logger.error("Error saving config:", error);
    res.status(500).json({ error: "Failed to save config: " + error.message });
  }
});

export default router;
