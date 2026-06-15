import type { CandidateProfile, JobProfile } from './types'

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
}

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private endpoint: string

  constructor(endpoint = '/api/matching/embeddings') {
    this.endpoint = endpoint
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model: DEFAULT_EMBEDDING_MODEL }),
    })

    if (!res.ok) {
      const detail = await safeReadError(res)
      throw new Error(detail ?? `Embedding request failed with status ${res.status}`)
    }

    const data = (await res.json()) as { embedding?: number[] }
    if (!Array.isArray(data.embedding)) throw new Error('Embedding response did not include an embedding array.')
    return data.embedding
  }
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  private dimensions: number

  constructor(dimensions = 256) {
    this.dimensions = dimensions
  }

  async embed(text: string): Promise<number[]> {
    const vector = Array.from({ length: this.dimensions }, () => 0)
    const tokens = tokenize(text)
    for (const token of tokens) {
      const primary = hash(`${token}:primary`) % this.dimensions
      const secondary = hash(`${token}:secondary`) % this.dimensions
      const sign = hash(`${token}:sign`) % 2 === 0 ? 1 : -1
      vector[primary] += sign * 1
      vector[secondary] += sign * 0.5
    }
    return normalize(vector)
  }
}

export function buildCandidateText(candidate: CandidateProfile): string {
  return [
    candidate.name,
    candidate.summary ?? '',
    candidate.skills.map((skill) => skill.name).join(', '),
    candidate.projects.map((project) => `${project.name}: ${project.description} ${(project.skills ?? []).join(', ')}`).join('\n'),
    (candidate.preferredRoles ?? []).join(', '),
  ].filter(Boolean).join('\n')
}

export function buildJobText(job: JobProfile): string {
  return [
    job.title,
    job.company,
    job.description,
    job.requiredSkills.join(', '),
    (job.niceToHaveSkills ?? []).join(', '),
  ].filter(Boolean).join('\n')
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function calculateVectorScore(
  candidate: CandidateProfile,
  job: JobProfile,
  embeddingProvider: EmbeddingProvider
): Promise<number> {
  const [candidateEmbedding, jobEmbedding] = await Promise.all([
    embeddingProvider.embed(buildCandidateText(candidate)),
    embeddingProvider.embed(buildJobText(job)),
  ])
  const similarity = cosineSimilarity(candidateEmbedding, jobEmbedding)
  return clampScore(Math.round(((similarity + 1) / 2) * 100))
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').split(/\s+/).filter(Boolean)
}

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return norm === 0 ? vector : vector.map((value) => value / norm)
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}

async function safeReadError(res: Response): Promise<string | null> {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error ?? null
  } catch {
    return null
  }
}