import { ref } from 'vue'

export function useSidebar() {
  const DEFAULT_WIDTH = 250
  const MIN_WIDTH = 150
  const MAX_WIDTH = 600
  let isResizing = false

  const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth')) || DEFAULT_WIDTH)
  const isCollapsed = ref(false)

  const startResize = (e) => {
    isResizing = true
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)
    document.body.classList.add('resizing')
  }

  const handleResize = (e) => {
    if (!isResizing) return

    const newWidth = e.clientX
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      sidebarWidth.value = newWidth
      localStorage.setItem('sidebarWidth', newWidth)
    }
  }

  const stopResize = () => {
    isResizing = false
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.classList.remove('resizing')
  }

  const resetWidth = () => {
    sidebarWidth.value = DEFAULT_WIDTH
    localStorage.setItem('sidebarWidth', DEFAULT_WIDTH)
  }


  const handleToggleClick = (event) => {
    isCollapsed.value = !isCollapsed.value
    // Remove focus when clicked
    if(event.target) {
      event.target.blur();
    }
  }

  return {
    sidebarWidth,
    isCollapsed,
    startResize,
    resetWidth,
    handleToggleClick
  }
} 
