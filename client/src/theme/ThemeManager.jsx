import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore.js'
import { useThemeStore } from '../store/themeStore.js'
import { applyTheme } from './themeMode.js'
import { motion } from './motion.js'
import { syncThemeAtLogin } from './themeSync.js'

// UI-02: puts the current theme on the page. Draws nothing.
export default function ThemeManager() {
  const choice = useThemeStore((state) => state.choice)
  const theme = useThemeStore((state) => state.theme)
  const refreshAuto = useThemeStore((state) => state.refreshAuto)
  const userId = useAuthStore((state) => state.user?.id)

  // Timings from motion.js, used by the CSS in theme.css
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--theme-fade', `${motion.themeFade}ms`)
    root.setProperty('--bulb-cycle', `${motion.bulbCycle}ms`) // UI-14
    root.setProperty('--sepia-fade', `${motion.sepiaFade}ms`) // UI-46
    root.setProperty('--curtain-sway', `${motion.curtainSway}ms`) // UI-15
    root.setProperty('--grain-jitter', `${motion.grainJitter}ms`) // UI-45
    root.setProperty('--ticker-loop', `${motion.tickerLoop}ms`) // UI-26
    root.setProperty('--spotlight-sweep', `${motion.spotlightSweep}ms`) // UI-15
    root.setProperty('--neon-flicker', `${motion.neonFlicker}ms`) // UI-15
    root.setProperty('--rise-in', `${motion.riseIn}ms`) // UI-15
    root.setProperty('--rise-stagger', `${motion.riseStagger}ms`) // UI-15
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Someone logged in (or a reload restored the login): profile rule (themeSync.js)
  useEffect(() => {
    if (userId) syncThemeAtLogin()
  }, [userId])

  // Auto: check the time every minute and switch by itself
  useEffect(() => {
    if (choice !== 'auto') return
    const timer = setInterval(refreshAuto, 60 * 1000)
    return () => clearInterval(timer)
  }, [choice, refreshAuto])

  return null
}
