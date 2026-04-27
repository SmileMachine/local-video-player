import { ref } from 'vue'

const STORAGE_KEY = 'video-player-type'
const PLAYER_TYPES = ['Plyr', 'DPlayer']

let instance = null

export function usePlayerPreference(defaultPlayerType = 'Plyr') {
  if (instance) {
    return instance
  }

  const readPreference = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (PLAYER_TYPES.includes(stored)) {
      return stored
    }

    return PLAYER_TYPES.includes(defaultPlayerType) ? defaultPlayerType : 'Plyr'
  }

  const playerType = ref(readPreference())

  const setPlayerType = (type) => {
    if (!PLAYER_TYPES.includes(type)) {
      return
    }

    playerType.value = type
    localStorage.setItem(STORAGE_KEY, type)
  }

  instance = {
    playerType,
    setPlayerType,
    playerTypes: PLAYER_TYPES
  }

  return instance
}
