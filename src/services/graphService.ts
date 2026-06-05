import { v4 as uuidv4 } from 'uuid'
import type { CandidateProfile, TalentGraph, SkillNode, GraphEdge, SuperNode } from '../types'

export function buildTalentGraph(profile: CandidateProfile, sessionId: string): TalentGraph {
  const now = Date.now()
  const nodes: SkillNode[] = []
  const edges: GraphEdge[] = []

  // Build nodes from verified + claimed skills
  const allSkills = [
    ...profile.verifiedSkills,
    ...profile.claimedSkills.map(c => ({
      id: c.skillName.toLowerCase().replace(/\s+/g, '_'),
      label: c.skillName,
      type: 'technical_skill' as const,
      confidence: c.confidence,
      evidenceLevel: 'self_claimed' as const,
      evidence: [{ type: 'conversation' as const, text: c.rawUserText, strength: c.confidence }],
      sourceMessages: [],
      relatedProjects: [],
      createdAt: now,
      updatedAt: now,
    }))
  ]

  // Deduplicate by id
  const seen = new Set<string>()
  for (const node of allSkills) {
    if (!seen.has(node.id)) {
      seen.add(node.id)
      nodes.push(node)
    }
  }

  // Add project evidence nodes
  for (const project of profile.projects) {
    const nodeId = project.name.toLowerCase().replace(/\s+/g, '_')
    if (!seen.has(nodeId)) {
      seen.add(nodeId)
      nodes.push({
        id: nodeId,
        label: project.name,
        type: 'project_evidence',
        confidence: project.hasCompetitionResult ? 0.88 : project.hasDeployment ? 0.80 : 0.65,
        evidenceLevel: project.hasCompetitionResult
          ? 'externally_validated'
          : project.hasDeployment
          ? 'artifact_supported'
          : 'project_supported',
        evidence: [{
          type: 'project',
          text: project.outcome,
          strength: project.hasCompetitionResult ? 0.88 : 0.75,
        }],
        sourceMessages: [],
        relatedProjects: [project.name],
        createdAt: now,
        updatedAt: now,
      })
    }

    // Connect project to its technologies
    for (const tech of project.technologies) {
      const techId = tech.toLowerCase().replace(/\s+/g, '_')
      const techNode = nodes.find(n => n.id === techId)
      if (techNode) {
        edges.push({
          id: uuidv4(),
          from: nodeId,
          to: techId,
          edgeType: 'supports',
          weight: 0.75,
          condition: 'project uses this technology',
          reason: `${project.name} required ${tech}`,
        })
      }
    }
  }

  // Add behavioral traits based on evidence
  if (profile.projects.some(p => p.hasUserTesting)) {
    const id = 'field_testing'
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push({
        id, label: 'Field Testing Experience', type: 'execution_skill',
        confidence: 0.80, evidenceLevel: 'project_supported',
        evidence: [{ type: 'project', text: 'Conducted real-world user testing', strength: 0.80 }],
        sourceMessages: [], relatedProjects: [], createdAt: now, updatedAt: now,
      })
    }
  }

  if (profile.projects.length > 0) {
    const id = 'self_learning'
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push({
        id, label: 'Self-Learning Ability', type: 'behavioral_trait',
        confidence: 0.78, evidenceLevel: 'conversation_supported',
        evidence: [{ type: 'conversation', text: 'Independently learned multiple technologies for projects', strength: 0.78 }],
        sourceMessages: [], relatedProjects: [], createdAt: now, updatedAt: now,
      })
    }

    const id2 = 'prototype_building'
    if (!seen.has(id2)) {
      seen.add(id2)
      nodes.push({
        id: id2, label: 'Prototype Building', type: 'execution_skill',
        confidence: 0.82, evidenceLevel: 'project_supported',
        evidence: [{ type: 'project', text: 'Built working prototypes in projects', strength: 0.82 }],
        sourceMessages: [], relatedProjects: [], createdAt: now, updatedAt: now,
      })
    }
  }

  // Career goal node
  if (profile.careerGoal) {
    const id = 'career_goal'
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push({
        id, label: profile.careerGoal, type: 'career_preference',
        confidence: 0.90, evidenceLevel: 'conversation_supported',
        evidence: [{ type: 'conversation', text: `Stated goal: ${profile.careerGoal}`, strength: 0.90 }],
        sourceMessages: [], relatedProjects: [], createdAt: now, updatedAt: now,
      })
    }
  }

  // Dynamic edges
  if (seen.has('self_learning') && seen.has('prototype_building')) {
    edges.push({ id: uuidv4(), from: 'self_learning', to: 'prototype_building', edgeType: 'empowers', weight: 0.85, condition: 'ambiguous fast-prototype task', reason: 'Self-learning enables rapid prototype delivery' })
  }
  if (seen.has('prototype_building') && seen.has('field_testing')) {
    edges.push({ id: uuidv4(), from: 'prototype_building', to: 'field_testing', edgeType: 'empowers', weight: 0.80, condition: 'product needs real-world validation', reason: 'Builder mindset leads to real-world testing' })
  }
  if (seen.has('field_testing') && seen.has('self_learning')) {
    edges.push({ id: uuidv4(), from: 'field_testing', to: 'self_learning', edgeType: 'empowers', weight: 0.78, condition: 'iterative learning cycle', reason: 'Field testing reveals new skills to learn' })
  }

  // Detect High-Agency Builder super node
  const superNodes: SuperNode[] = []
  const agentIds = ['self_learning', 'prototype_building', 'field_testing']
  const hasAgentLoop = agentIds.every(id => seen.has(id))
  if (hasAgentLoop) {
    superNodes.push({
      id: 'high_agency_builder',
      label: 'High-Agency Builder',
      contains: agentIds,
      meaning: 'Candidate can independently learn, build, test, and improve a product under uncertainty.',
      confidence: 0.83,
      evidence: [{
        type: 'project',
        text: 'Full cycle demonstrated: learned tools → built prototype → tested in field',
        strength: 0.83,
      }],
    })
  }

  return {
    id: uuidv4(),
    ownerType: 'candidate',
    ownerId: sessionId,
    nodes,
    edges,
    superNodes,
    confidence: profile.confidence,
    generatedAt: now,
  }
}