import DPlayerAdapter from "./dplayerAdapter";
import PlyrAdapter from "./plyrAdapter";

export function createPlayer(type, options) {
  switch (type) {
    case "DPlayer":
      return new DPlayerAdapter(options);
    case "Plyr":
      return new PlyrAdapter(options);
    default:
      throw new Error(`Unknown player type: ${type}`);
  }
}
