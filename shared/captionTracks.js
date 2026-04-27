export const TEXT_SUBTITLE_CODECS = new Set([
  "ass",
  "ssa",
  "subrip",
  "mov_text",
  "webvtt",
  "text",
]);

export const IMAGE_SUBTITLE_CODECS = new Set([
  "dvd_subtitle",
  "hdmv_pgs_subtitle",
  "xsub",
]);

export const normalizeCaptionLanguage = (language) =>
  String(language || "und").toLowerCase();

export const getCaptionTrackLabel = (stream, fallback) => {
  const title = stream.tags?.title || stream.tags?.handler_name;
  const language = normalizeCaptionLanguage(stream.tags?.language);
  if (title) {
    return title;
  }
  if (language !== "und") {
    return language;
  }
  return fallback;
};

export const buildEmbeddedCaptionTracks = (streams = []) => {
  const subtitleStreams = streams
    .filter((stream) => stream.codec_type === "subtitle")
    .sort((a, b) => Number(a.index) - Number(b.index));

  return subtitleStreams.map((stream, index) => {
    const codec = String(stream.codec_name || "").toLowerCase();
    const language = normalizeCaptionLanguage(stream.tags?.language);
    const supported = TEXT_SUBTITLE_CODECS.has(codec);
    const imageSubtitle = IMAGE_SUBTITLE_CODECS.has(codec);

    return {
      id: `embedded:${stream.index}`,
      label: getCaptionTrackLabel(stream, `内嵌字幕 ${index + 1}`),
      language,
      codec,
      source: "embedded",
      supported,
      imageSubtitle,
      default: Boolean(stream.disposition?.default),
      streamIndex: Number(stream.index),
    };
  });
};
