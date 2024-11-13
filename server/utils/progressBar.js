import cliProgress from "cli-progress";
import { logger } from "./logger.js";

export function createProgressBar(options) {
  const bar = new cliProgress.SingleBar({
    // from grey-scale preset
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    // hideCursor: true,
    // clearOnComplete: true,
    stopOnComplete: true,
    emptyOnZero: true,
    ...options,
  });

  logger.debug(`createProgressBar: ${JSON.stringify(options)}`);

  return bar;
}

// accumulative, options not used
export function createScanProgressBar() {
  const bar = createProgressBar({
    format:
      "Scanning | {scannedFiles} files, {scannedDirs} dirs, {videosFound} videos found | Current: {currentDir}",
  });

  bar.start(100, 0, {
    scannedFiles: 0,
    scannedDirs: 0,
    videosFound: 0,
    currentDir: "",
  });

  const originalUpdate = bar.update.bind(bar);
  // payload:
  // - scannedFiles
  // - scannedDirs
  // - videosFound
  // - currentDir
  bar.update = (current, payload = {}) => {
    originalUpdate(current, {
      scannedFiles: current,
      ...payload,
    });
  };

  return bar;
}

// options: total
export function createInfoProgressBar(options) {
  const bar = createProgressBar({
    format:
      "Getting info |{bar}| {percentage}% | {processedFiles}/{totalFiles} files ETA:{eta}s | {filename}",
  });

  bar.start(options.total, 0, {
    filename: "",
    processedFiles: 0,
    totalFiles: options.total,
  });

  const originalUpdate = bar.update.bind(bar);
  // payload:
  // - filename
  // - processedFiles (current)
  bar.update = (current, payload = {}) => {
    originalUpdate(current, {
      processedFiles: current,
      ...payload,
    });
  };

  return bar;
}

export const mockProgressBar = {
  start: () => {},
  update: () => {},
  stop: () => {},
};
