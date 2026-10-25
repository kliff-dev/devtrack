import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { gitAvailable, gitCommits, gitOriginUrl, toHttpsUrl } from '../collector/git.ts'

const hasGit = await gitAvailable()

test('toHttpsUrl normalises remotes', () => {
  assert.equal(toHttpsUrl('git@github.com:user/repo.git'), 'https://github.com/user/repo')
  assert.equal(toHttpsUrl('https://github.com/user/repo.git'), 'https://github.com/user/repo')
  assert.equal(toHttpsUrl('ssh://git@github.com/user/repo.git'), 'https://github.com/user/repo')
  assert.equal(toHttpsUrl('https://gitlab.com/group/sub/repo'), 'https://gitlab.com/group/sub/repo')
  assert.equal(toHttpsUrl('C:\\repos\\local'), undefined)
  assert.equal(toHttpsUrl('/srv/git/repo.git'), undefined)
})

test('gitCommits reads the configured author’s commits', { skip: !hasGit }, async () => {
  const repo = mkdtempSync(join(tmpdir(), 'devtrack-git-'))
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    git('init', '-q')
    git('config', 'user.email', 'dev@example.com')
    git('config', 'user.name', 'Dev')
    git('config', 'commit.gpgsign', 'false')
    git('commit', '-q', '--allow-empty', '-m', 'feat: first')
    git('-c', 'user.email=other@example.com', '-c', 'user.name=Other', 'commit', '-q', '--allow-empty', '-m', 'chore: someone else')
    git('remote', 'add', 'origin', 'git@github.com:dev/repo.git')

    const commits = await gitCommits(repo, new Date(Date.now() - 24 * 60 * 60 * 1000))
    assert.deepEqual(commits.map((commit) => commit.summary), ['feat: first'])
    assert.equal(commits[0].kind, 'commit')
    assert.equal(commits[0].source, 'git')
    assert.match(commits[0].id, /^git:[0-9a-f]{12}$/)
    assert.equal(commits[0].projectPath, repo)
    assert.ok(Number.isFinite(Date.parse(commits[0].timestamp)))
    assert.equal(await gitOriginUrl(repo), 'https://github.com/dev/repo')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('gitCommits returns nothing for a folder that is not a repository', { skip: !hasGit }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'devtrack-nogit-'))
  try {
    assert.deepEqual(await gitCommits(dir, new Date(0)), [])
    assert.equal(await gitOriginUrl(dir), undefined)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
