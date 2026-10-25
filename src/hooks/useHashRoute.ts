import { useSyncExternalStore } from 'react'
import type { View } from '../types.ts'

// Views live in the URL hash (#/projects) so refresh and the back button keep
// their place without pulling in a router.

const VIEWS: readonly View[] = ['dashboard', 'projects', 'activity', 'settings']

function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value)
}

function readView(): View {
  const path = window.location.hash.replace(/^#\/?/, '')
  return isView(path) ? path : 'dashboard'
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function viewHref(view: View): string {
  return `#/${view}`
}

export function useHashRoute(): View {
  return useSyncExternalStore(subscribe, readView)
}
