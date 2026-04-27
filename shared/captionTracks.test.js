import { buildEmbeddedCaptionTracks } from "./captionTracks.js";

describe("caption track helpers", () => {
  it("extracts supported text subtitle tracks from ffprobe streams", () => {
    const tracks = buildEmbeddedCaptionTracks([
      { index: 0, codec_type: "video", codec_name: "h264" },
      {
        index: 2,
        codec_type: "subtitle",
        codec_name: "ass",
        tags: { language: "chi", title: "简体中文" },
        disposition: { default: 1 },
      },
    ]);

    expect(tracks).toEqual([
      {
        id: "embedded:2",
        label: "简体中文",
        language: "chi",
        codec: "ass",
        source: "embedded",
        supported: true,
        imageSubtitle: false,
        default: true,
        streamIndex: 2,
      },
    ]);
  });

  it("marks image subtitle tracks as unsupported", () => {
    const tracks = buildEmbeddedCaptionTracks([
      {
        index: 3,
        codec_type: "subtitle",
        codec_name: "hdmv_pgs_subtitle",
        tags: { language: "eng" },
      },
    ]);

    expect(tracks[0]).toMatchObject({
      id: "embedded:3",
      language: "eng",
      supported: false,
      imageSubtitle: true,
    });
  });
});
