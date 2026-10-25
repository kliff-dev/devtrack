/**
 * Key for comparing folder paths typed by the user with paths from the collector:
 * separators and case are ignored, as is the Windows long-path prefix.
 */
export function pathKey(path: string): string {
  return path
    .trim()
    .replace(/^\\\\\?\\/, '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()
}

export function folderName(path: string): string {
  const parts = path.trim().replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || path
}
