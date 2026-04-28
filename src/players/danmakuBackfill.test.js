import {
  assignDanmakuBackfillLanes,
  collectVisibleDanmakuBeforeTime,
  getDanmakuDuration,
  normalizeDanmakuType,
} from "./danmakuBackfill.js";

describe("danmaku backfill", () => {
  it("normalizes DPlayer numeric and string danmaku types", () => {
    expect(normalizeDanmakuType(0)).toBe(0);
    expect(normalizeDanmakuType("right")).toBe(0);
    expect(normalizeDanmakuType(1)).toBe(1);
    expect(normalizeDanmakuType("top")).toBe(1);
    expect(normalizeDanmakuType(2)).toBe(2);
    expect(normalizeDanmakuType("bottom")).toBe(2);
  });

  it("uses DPlayer durations adjusted by danmaku speed", () => {
    expect(getDanmakuDuration(0, { speedRate: 0.5 })).toBe(10);
    expect(getDanmakuDuration(1, { speedRate: 0.5 })).toBe(8);
    expect(getDanmakuDuration(0, { speedRate: 0.5, fullscreen: true })).toBe(16);
    expect(getDanmakuDuration(2, { speedRate: 0.5, fullscreen: true })).toBe(12);
  });

  it("returns only historical danmaku that should still be visible", () => {
    const rows = [
      { time: 93, type: 0, color: 16777215, text: "too old" },
      { time: 95.5, type: 0, color: 16777215, text: "rolling" },
      { time: 96.5, type: 1, color: 16777215, text: "top" },
      { time: 99.5, type: "bottom", color: 16777215, text: "bottom" },
      { time: 100, type: 0, color: 16777215, text: "current" },
      { time: 101, type: 0, color: 16777215, text: "future" },
    ];

    expect(collectVisibleDanmakuBeforeTime(rows, 100).map((item) => item.danmaku.text)).toEqual([
      "rolling",
      "top",
      "bottom",
    ]);
  });

  it("keeps older danmaku visible for longer at slower speed", () => {
    const rows = [
      { time: 91, type: 0, color: 16777215, text: "visible at half speed" },
      { time: 91, type: 1, color: 16777215, text: "center too old" },
    ];

    expect(
      collectVisibleDanmakuBeforeTime(rows, 100, { speedRate: 0.5 }).map(
        (item) => item.danmaku.text
      )
    ).toEqual(["visible at half speed"]);
  });

  it("caps the number of restored danmaku near the current time", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      time: index + 1,
      type: 0,
      color: 16777215,
      text: `danmaku-${index + 1}`,
    }));

    expect(
      collectVisibleDanmakuBeforeTime(rows, 6, { maxCount: 2 }).map((item) => item.danmaku.text)
    ).toEqual(["danmaku-4", "danmaku-5"]);
  });

  it("assigns overlapping restored rolling danmaku to different lanes", () => {
    const items = [
      { danmaku: { time: 98, type: 0, text: "first" }, elapsed: 2, duration: 5 },
      { danmaku: { time: 98, type: 0, text: "second" }, elapsed: 2, duration: 5 },
    ];

    expect(
      assignDanmakuBackfillLanes(items, {
        containerWidth: 1000,
        rowCount: 4,
        measureText: () => 100,
      }).map((item) => item.lane)
    ).toEqual([0, 1]);
  });

  it("allows separated restored rolling danmaku to share a lane", () => {
    const items = [
      { danmaku: { time: 95.5, type: 0, text: "older" }, elapsed: 4.5, duration: 5 },
      { danmaku: { time: 99.5, type: 0, text: "newer" }, elapsed: 0.5, duration: 5 },
    ];

    expect(
      assignDanmakuBackfillLanes(items, {
        containerWidth: 1000,
        rowCount: 4,
        measureText: () => 100,
      }).map((item) => item.lane)
    ).toEqual([0, 0]);
  });

  it("assigns restored top and bottom danmaku independently", () => {
    const items = [
      { danmaku: { time: 99, type: 1, text: "top 1" }, elapsed: 1, duration: 4 },
      { danmaku: { time: 99, type: 1, text: "top 2" }, elapsed: 1, duration: 4 },
      { danmaku: { time: 99, type: 2, text: "bottom 1" }, elapsed: 1, duration: 4 },
    ];

    expect(
      assignDanmakuBackfillLanes(items, {
        containerWidth: 1000,
        rowCount: 2,
        measureText: () => 100,
      }).map((item) => [item.danmaku.text, item.lane])
    ).toEqual([
      ["top 1", 0],
      ["top 2", 1],
      ["bottom 1", 0],
    ]);
  });
});
