import { Router } from "express";
import { useVideoLibrary } from "../services/videoLibrary.js";
import { logger } from "../utils/logger.js";

const router = Router();
const { getSecureVideos, onUpdate } = useVideoLibrary();

let videos = {};
onUpdate(() => {
  videos = getSecureVideos();
});

router.get("/videos", (req, res) => {
  res.json(videos);
});

export default router;
