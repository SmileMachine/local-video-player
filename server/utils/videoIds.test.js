import { createUniqueVideoId } from "./videoIds.js";

describe("video ids", () => {
  it("keeps the first fingerprint id unchanged and suffixes later collisions", () => {
    const counts = new Map();

    expect(createUniqueVideoId("f:abc", counts)).toBe("f:abc");
    expect(createUniqueVideoId("f:abc", counts)).toBe("f:abc:2");
    expect(createUniqueVideoId("f:def", counts)).toBe("f:def");
    expect(createUniqueVideoId("f:abc", counts)).toBe("f:abc:3");
  });
});
