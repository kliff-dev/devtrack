import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { displayPath, findProjectRoot, pathKey, stripLongPathPrefix } from '../collector/paths.ts'

const onWindows = process.platform === 'win32'

test('stripLongPathPrefix removes the \\\\?\\ and UNC prefixes', () => {
  assert.equal(stripLongPathPrefix('\\\\?\\C:\\Users\\x'), 'C:\\Users\\x')
  assert.equal(stripLongPathPrefix('\\\\?\\UNC\\server\\share\\x'), '\\\\server\\share\\x')
  assert.equal(stripLongPathPrefix('C:\\plain'), 'C:\\plain')
})

test('pathKey ignores case, prefix and trailing separators', { skip: !onWindows }, () => {
  assert.equal(pathKey('c:\\Users\\X\\Proj\\'), pathKey('\\\\?\\C:\\users\\x\\proj'))
  assert.equal(pathKey('C:/Users/x/proj'), pathKey('C:\\Users\\x\\proj'))
  assert.equal(displayPath('c:\\Users\\X\\Proj\\'), 'C:\\Users\\X\\Proj')
})

test('findProjectRoot climbs to the nearest git repository', () => {
  const base = mkdtempSync(join(tmpdir(), 'devtrack-paths-'))
  try {
    const repo = join(base, 'repo')
    const nested = join(repo, 'src', 'deep')
    const plain = join(base, 'plain')
    mkdirSync(join(repo, '.git'), { recursive: true })
    mkdirSync(nested, { recursive: true })
    mkdirSync(plain)

    assert.equal(findProjectRoot(nested), displayPath(repo))
    assert.equal(findProjectRoot(repo), displayPath(repo))
    assert.equal(findProjectRoot(plain), displayPath(plain), 'a folder without a repo is its own root')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
