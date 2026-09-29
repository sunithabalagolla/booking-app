import { useEffect } from 'react'
import { useThemeStore } from '../store/themeStore.js'
import { applyTheme } from './themeMode.js'
import { motion } from './motion.js'

// UI-02: puts the current theme on the page. Draws nothing.
export default function ThemeManager() {
  const choice = useThemeStore((state) => state.choice)
  const theme = useThemeStore((state) => state.theme)
  const refreshAuto = useThemeStore((state) => state.refreshAuto)

  // Fade time from motion.js, used by the CSS in theme.css
  useEffect(() => {
    document.documentElement.style.setProperty('--theme-fade', `${motion.themeFade}ms`)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Auto: check the time every minute and switch by itself
  useEffect(() => {
    if (choice !== 'auto') return
    const timer = setInterval(refreshAuto, 60 * 1000)
    return () => clearInterval(timer)
  }, [choice, refreshAuto])

  return null
}
