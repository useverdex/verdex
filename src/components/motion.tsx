import { motion, useReducedMotion } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'

const EASE = [0.4, 0, 0.2, 1] as const

export function Reveal({ children, delay = 0, y = 24, onMount = false, style, className }: { children: ReactNode; delay?: number; y?: number; onMount?: boolean; style?: CSSProperties; className?: string }) {
  const reduced = useReducedMotion()
  const initial = { opacity: 0, y: reduced ? 0 : y }
  const shown = { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay } }
  return (
    <motion.div className={className} style={style} initial={initial} {...(onMount ? { animate: shown } : { whileInView: shown, viewport: { once: true, amount: 0.2 } })}>
      {children}
    </motion.div>
  )
}

const container = (stagger = 0.08, delayChildren = 0.1) => ({ hidden: {}, shown: { transition: { staggerChildren: stagger, delayChildren } } })
const item = (reduced: boolean, x = 0, y = 16) => ({ hidden: { opacity: 0, x: reduced ? 0 : x, y: reduced ? 0 : y }, shown: { opacity: 1, x: 0, y: 0, transition: { duration: 0.5, ease: EASE } } })

export function Stagger({ children, stagger = 0.08, delayChildren = 0.1, style, onMount = false }: { children: ReactNode; stagger?: number; delayChildren?: number; style?: CSSProperties; onMount?: boolean }) {
  return (
    <motion.div style={style} variants={container(stagger, delayChildren)} initial="hidden" {...(onMount ? { animate: 'shown' } : { whileInView: 'shown', viewport: { once: true, amount: 0.25 } })}>
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, x = 0, y = 16, style }: { children: ReactNode; x?: number; y?: number; style?: CSSProperties }) {
  const reduced = useReducedMotion()
  return (
    <motion.div style={style} variants={item(!!reduced, x, y)}>
      {children}
    </motion.div>
  )
}
