import { useSyncExternalStore } from 'react'

type State = { welcomeScreenClosed: boolean; mainMenuOpen: boolean; privateMode: boolean; swapTab: 'swap' | 'bridge' | 'private' }
const KEY = 'verdex-store'

function load(): Partial<State> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed?.state ?? {}
  } catch {
    return {}
  }
}

let state: State = { welcomeScreenClosed: false, mainMenuOpen: false, privateMode: false, swapTab: 'swap', ...load() }
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ state: { welcomeScreenClosed: state.welcomeScreenClosed }, version: 1 }))
  } catch {
    /* storage unavailable */
  }
}

export function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  persist()
  listeners.forEach((l) => l())
}

export function getState() {
  return state
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
    () => selector(state),
  )
}

export const actions = {
  setWelcomeScreenClosed: (v: boolean) => setState({ welcomeScreenClosed: v }),
  setMainMenuOpen: (v: boolean) => setState({ mainMenuOpen: v }),
  closeAllMenus: () => setState({ mainMenuOpen: false }),
  setPrivateMode: (v: boolean) => setState({ privateMode: v }),
  setSwapTab: (v: State['swapTab']) => setState({ swapTab: v }),
}
