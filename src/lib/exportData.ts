import { dayKey } from './format.ts'

/** Downloads `data` as a pretty-printed JSON file. */
export function downloadJson(data: unknown, baseName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${baseName}-${dayKey(new Date())}.json`
  link.click()
  URL.revokeObjectURL(url)
}
