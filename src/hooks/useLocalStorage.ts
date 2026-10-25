import { useEffect, useState } from 'react'
import { readStorage, writeStorage } from '../lib/storage.ts'

/**
 * State loaded from localStorage on first render and written back on every change.
 * `parse` rejects stored values that don't fit the expected shape, in which case
 * `createInitial` provides the starting value (and it is saved straight away).
 */
export function useLocalStorage<T>(
  key: string,
  createInitial: () => T,
  parse: (stored: unknown) => T | undefined,
) {
  const [value, setValue] = useState<T>(() => parse(readStorage(key)) ?? createInitial())

  useEffect(() => {
    writeStorage(key, value)
  }, [key, value])

  return [value, setValue] as const
}
