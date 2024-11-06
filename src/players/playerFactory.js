export async function createPlayer(type, options) {
  switch (type) {
    case "DPlayer":
      const { default: DPlayerAdapter } = await import("./dplayerAdapter");
      return new DPlayerAdapter(options);
    case "Plyr":
      const { default: PlyrAdapter } = await import("./plyrAdapter");
      return new PlyrAdapter(options);
    default:
      throw new Error(`Unknown player type: ${type}`);
  }
}
