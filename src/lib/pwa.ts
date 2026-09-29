// Home-screen app helpers: standalone detection, the Android install prompt and the install sheet event.
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferredPrompt: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    promptListeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    promptListeners.forEach((l) => l())
  })
}

export const INSTALL_EVENT = 'verdex-install'

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function canPromptInstall() {
  return deferredPrompt !== null
}

export function onInstallPromptChange(listener: () => void) {
  promptListeners.add(listener)
  return () => {
    promptListeners.delete(listener)
  }
}

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable' as const
  const ev = deferredPrompt
  deferredPrompt = null
  await ev.prompt()
  const { outcome } = await ev.userChoice
  return outcome
}

// Any part of the site can open the install sheet ("Get the app" links).
export function openInstallSheet() {
  window.dispatchEvent(new Event(INSTALL_EVENT))
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD || import.meta.env.VITE_HASH_ROUTER === '1') return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
