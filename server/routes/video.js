import express from "express";
import path from "path";
import fs from "fs";
import { loggerMiddleware } from "../middleware/logger.js";
import { useConfig } from "../utils/config.js";
import { useVideoLibrary } from "../services/videoLibrary.js";
import { logger } from "../utils/logger.js";

const router = express.Router();
const videoLibrary = useVideoLibrary();

router.get("/", loggerMiddleware, async (req, res) => {
  const { usePathIds } = (await useConfig()).getConfig();
  let filePath;

  // const filePath = decodeURIComponent(req.query.path);
  if (usePathIds) {
    filePath = videoLibrary.getIdMap()[decodeURIComponent(req.query.id)];
    logger.debug(`filePath: ${filePath}`);
  } else {
    // TODO: relative path
    filePath = decodeURIComponent(req.query.path);
  }
  // check if exists
  if (!fs.existsSync(filePath)) {
    res.status(404).send("File" + filePath + " not found");
    return;
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

export default router;
