import { VideoScanner } from "./videoScanner.js";
import { logger } from "./logger.js";
import os from "os";
import path from "path";
describe("VideoScanner", () => {
  let scanner;

  beforeEach(() => {
    jest.clearAllMocks();
    scanner = new VideoScanner({ getInfo: true });
  });

  describe("getVideoInfo", () => {
    test("should return the info of a video file", async () => {
      const info = await scanner.getVideoInfo("public/vid1.mp4");
      logger.info(info);
    });
  });

  // describe('enrichWithDurations', () => {
  //   test('should process a single video file', async () => {
  //     const input = {
  //       type: 'file',
  //       path: '/path/to/video.mp4',
  //       name: 'video.mp4'
  //     };

  //     const result = await scanner.enrichWithDurations(input, mockProgressBar);

  //     expect(result).toEqual({
  //       ...input,
  //       duration: 120
  //     });
  //     expect(mockProgressBar.increment).toHaveBeenCalledTimes(1);
  //     expect(scanner.getVideoDuration).toHaveBeenCalledWith('/path/to/video.mp4');
  //   });

  // });

  describe('scanVideos', () => {
    test('should scan directory and return video files', async () => {
      const moviesPath = path.join(os.homedir(), "Movies");
      const result = await scanner.scanVideos(moviesPath);
      logger.info(result);
    });
  });
});
