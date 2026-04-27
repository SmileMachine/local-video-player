import { combineVtt, parseVttCues } from "./vtt.js";

describe("vtt helpers", () => {
  it("parses cues with identifiers", () => {
    const cues = parseVttCues(`WEBVTT

cue-1
00:00:01.000 --> 00:00:03.500
Hello
`);

    expect(cues).toEqual([{ start: 1, end: 3.5, text: "Hello" }]);
  });

  it("combines overlapping cues into bilingual text", () => {
    const primary = `WEBVTT

00:00:01.000 --> 00:00:04.000
你好
`;
    const secondary = `WEBVTT

00:00:02.000 --> 00:00:05.000
Hello
`;

    expect(combineVtt(primary, secondary)).toContain(`00:00:02.000 --> 00:00:04.000
你好
Hello`);
  });
});
