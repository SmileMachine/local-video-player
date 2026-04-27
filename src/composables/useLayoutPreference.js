import { ref } from 'vue'

const STORAGE_KEY = 'video-layout-preference'
const LAYOUT_PREFERENCES = ['auto', 'desktop', 'mobile']

let instance = null

export function useLayoutPreference() {
  if (instance) {
    return instance
  }

  const readPreference = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return LAYOUT_PREFERENCES.includes(stored) ? stored : 'auto'
  }

  const layoutPreference = ref(readPreference())

  const setLayoutPreference = (preference) => {
    if (!LAYOUT_PREFERENCES.includes(preference)) {
      return
    }

    layoutPreference.value = preference
    localStorage.setItem(STORAGE_KEY, preference)
  }

  instance = {
    layoutPreference,
    setLayoutPreference,
    layoutPreferenceOptions: LAYOUT_PREFERENCES
  }

  return instance
}
