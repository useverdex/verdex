// Public assets are referenced root-relative in code and data. Production serves from '/', while the hosted
// preview serves from a sub-path, so every local path is prefixed with Vite's base URL here.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
export const pub = (p: string) => (p.startsWith('/') && !p.startsWith('//') ? BASE + p : p)
