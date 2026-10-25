// Identity colors for projects and technologies. Tuned to read on the dark surfaces.
const PALETTE = [
  '#8b93ff',
  '#34d399',
  '#f472b6',
  '#fbbf24',
  '#38bdf8',
  '#c084fc',
  '#fb923c',
  '#2dd4bf',
]

const TECH_COLORS: Record<string, string> = {
  typescript: '#4f8fe6',
  javascript: '#f0db4f',
  react: '#61dafb',
  'react native': '#61dafb',
  vite: '#a78bfa',
  'node.js': '#6cc24a',
  fastify: '#cbd5e1',
  postgresql: '#6b8cff',
  sqlite: '#4fa3d9',
  docker: '#2496ed',
  rust: '#f46623',
  go: '#00add8',
  python: '#5b9bd5',
  astro: '#ff7a3d',
  mdx: '#f9ac00',
  'tailwind css': '#38bdf8',
  expo: '#cbd5e1',
  htmx: '#5b8def',
  prometheus: '#e6522c',
  clap: '#a1a1aa',
  rayon: '#d4a373',
}

function hash(value: string): number {
  let result = 0
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) | 0
  return Math.abs(result)
}

export function projectColor(projectId: string): string {
  return PALETTE[hash(projectId) % PALETTE.length]
}

export function techColor(name: string): string {
  const key = name.trim().toLowerCase()
  return TECH_COLORS[key] ?? PALETTE[hash(key) % PALETTE.length]
}
