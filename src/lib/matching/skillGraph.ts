import type { SkillGraphEdge, SkillPathStep, SkillRelationshipType } from './types'

export type SkillGraph = Record<string, SkillGraphEdge[]>

const edges: SkillGraphEdge[] = []

function link(from: string, to: string, type: SkillRelationshipType, weight: number, bidirectional = true) {
  edges.push({ from: normalizeSkill(from), to: normalizeSkill(to), type, weight })
  if (bidirectional || type === 'related_to' || type === 'alternative_to') {
    edges.push({ from: normalizeSkill(to), to: normalizeSkill(from), type, weight: type === 'prerequisite_of' ? weight * 0.85 : weight })
  }
}

link('Java', 'Spring Boot', 'used_for', 0.92)
link('Java', 'Backend Development', 'used_for', 0.82)
link('Spring Boot', 'Backend Engineer', 'belongs_to', 0.86)
link('SQL', 'PostgreSQL', 'related_to', 0.9)
link('SQL', 'MySQL', 'related_to', 0.9)
link('PostgreSQL', 'Backend Development', 'used_for', 0.72)
link('MySQL', 'Backend Development', 'used_for', 0.72)
link('Node.js', 'Express.js', 'used_for', 0.92)
link('Express.js', 'REST API', 'used_for', 0.88)
link('REST API', 'Backend Development', 'belongs_to', 0.84)
link('Backend Development', 'Backend Engineer', 'belongs_to', 0.9)
link('React', 'Frontend Development', 'used_for', 0.9)
link('Frontend Development', 'Backend Development', 'related_to', 0.45)
link('Docker', 'DevOps Engineer', 'belongs_to', 0.78)
link('Docker', 'Kubernetes', 'prerequisite_of', 0.82, false)
link('Kubernetes', 'DevOps Engineer', 'belongs_to', 0.86)
link('AWS', 'Cloud Computing', 'belongs_to', 0.92)
link('Cloud Computing', 'DevOps Engineer', 'belongs_to', 0.82)
link('Cloud Computing', 'Backend Development', 'used_for', 0.62)
link('Python', 'AI Software Engineer', 'used_for', 0.72)
link('Python', 'Backend Development', 'used_for', 0.58)
link('LLM', 'AI Software Engineer', 'belongs_to', 0.9)
link('LLM', 'RAG', 'used_for', 0.82)
link('Embeddings', 'RAG', 'used_for', 0.84)
link('Embeddings', 'Vector Database', 'used_for', 0.8)
link('Vector Database', 'RAG', 'used_for', 0.84)
link('Graph', 'Knowledge Graph', 'related_to', 0.86)
link('Knowledge Graph', 'Recommendation System', 'used_for', 0.75)
link('Recommendation System', 'AI Software Engineer', 'belongs_to', 0.68)
link('RAG', 'AI Software Engineer', 'belongs_to', 0.88)
link('Graph', 'Recommendation System', 'used_for', 0.65)
link('REST API', 'AI Software Engineer', 'used_for', 0.5)
link('Backend Engineer', 'AI Software Engineer', 'related_to', 0.46)
link('Docker', 'Backend Engineer', 'related_to', 0.52)

export const skillGraph: SkillGraph = edges.reduce<SkillGraph>((graph, edge) => {
  graph[edge.from] = graph[edge.from] ?? []
  graph[edge.from].push(edge)
  return graph
}, {})

export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function displaySkill(skill: string): string {
  const known = new Map([
    ['node.js', 'Node.js'],
    ['express.js', 'Express.js'],
    ['rest api', 'REST API'],
    ['sql', 'SQL'],
    ['postgresql', 'PostgreSQL'],
    ['mysql', 'MySQL'],
    ['aws', 'AWS'],
    ['llm', 'LLM'],
    ['rag', 'RAG'],
  ])
  return known.get(skill) ?? skill.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function findSkillPath(fromSkills: string[], targetSkill: string, maxDepth = 3): SkillPathStep[] | null {
  const targets = new Set([normalizeSkill(targetSkill)])
  const starts = fromSkills.map(normalizeSkill).filter(Boolean)
  const queue = starts.map((skill) => ({ skill, path: [] as SkillPathStep[] }))
  const visited = new Set(starts)

  while (queue.length) {
    const current = queue.shift()
    if (!current) continue
    if (targets.has(current.skill) && current.path.length > 0) return current.path
    if (current.path.length >= maxDepth) continue

    for (const edge of skillGraph[current.skill] ?? []) {
      if (visited.has(edge.to)) continue
      const nextPath = [...current.path, { from: edge.from, to: edge.to, relationship: edge.type, weight: edge.weight }]
      if (targets.has(edge.to)) return nextPath
      visited.add(edge.to)
      queue.push({ skill: edge.to, path: nextPath })
    }
  }

  return null
}

export function getPrerequisites(skill: string, limit = 3): string[] {
  const normalized = normalizeSkill(skill)
  const prerequisites = new Set<string>()
  for (const edge of edges) {
    if (edge.to === normalized && edge.type === 'prerequisite_of') prerequisites.add(edge.from)
  }
  return [...prerequisites].slice(0, limit)
}
export function getKnownSkills(): string[] {
  return [...new Set(edges.flatMap((edge) => [edge.from, edge.to]).map(displaySkill))]
}