export const VIDEO_CONTENT_TYPES = Object.freeze({
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
});

export const getVideoContentType = (fileNameOrPath = "") => {
  const extension = String(fileNameOrPath).toLowerCase().match(/\.[^./\\]+$/)?.[0];
  return VIDEO_CONTENT_TYPES[extension] || "application/octet-stream";
};
