import { getVideoContentType } from "./mediaTypes.js";

describe("getVideoContentType", () => {
  it.each([
    ["movie.mp4", "video/mp4"],
    ["movie.M4V", "video/mp4"],
    ["movie.mov", "video/quicktime"],
    ["movie.webm", "video/webm"],
    ["movie.mkv", "video/x-matroska"],
    ["movie.avi", "video/x-msvideo"],
  ])("returns the media type for %s", (fileName, expectedType) => {
    expect(getVideoContentType(fileName)).toBe(expectedType);
  });

  it("falls back to application/octet-stream for unknown extensions", () => {
    expect(getVideoContentType("movie.unknown")).toBe("application/octet-stream");
  });
});
