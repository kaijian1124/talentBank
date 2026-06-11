import { useSessionStore } from '../store/sessionStore'
import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type {
  TalentGraph, SkillNode, CandidateCapabilityGraph, CapabilityNode, CapabilityNodeType,
} from '../types'
import { ArrowRight, Zap, Shield, AlertTriangle, MessageSquare } from 'lucide-react'
import { demoTalentGraph } from '../services/mockData'
import { demoCompanyProfile } from '../services/mockData'
import { matchCandidateToCompany } from '../services/matchingService'

// ─── GraphPage router: capability graph (candidate) vs skill graph ──
export default function GraphPage() {
  const capabilityGraph = useSessionStore(s => s.session?.capabilityGraph)
  return capabilityGraph
    ? <CapabilityGraphView graph={capabilityGraph} />
    : <TalentGraphView />
}

function buildFlowNodes(graph: TalentGraph): Node[] {
  const superNodeIds = new Set(graph.superNodes.flatMap(s => s.contains))
  const nodes: Node[] = []
  const cols = 4
  const xGap = 220
  const yGap = 120

  graph.nodes.forEach((node, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const isSuperMember = superNodeIds.has(node.id)

    nodes.push({
      id: node.id,
      position: { x: col * xGap + 40, y: row * yGap + 40 },
      data: { label: node.label, node, isSuperMember },
      type: 'skillNode',
    })
  })

  // Super nodes placed at bottom
  graph.superNodes.forEach((sn, i) => {
    nodes.push({
      id: sn.id,
      position: { x: i * 300 + 100, y: Math.ceil(graph.nodes.length / cols) * yGap + 80 },
      data: { label: sn.label, isSuperNode: true, superNode: sn },
      type: 'superNode',
    })
  })

  return nodes
}

function buildFlowEdges(graph: TalentGraph): Edge[] {
  return graph.edges.map(e => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.edgeType,
    animated: e.edgeType === 'empowers',
    style: {
      stroke: e.edgeType === 'empowers' ? '#7c3aed' :
              e.edgeType === 'supports' ? '#2563eb' :
              e.edgeType === 'weakens' ? '#dc2626' : '#4b5563',
      strokeWidth: Math.max(1, e.weight * 3),
    },
    labelStyle: { fill: '#9ca3af', fontSize: 10 },
    labelBgStyle: { fill: '#111827' },
  }))
}

const nodeTypes = {
  skillNode: SkillNodeCard,
  superNode: SuperNodeCard,
}

function SkillNodeCard({ data }: { data: Record<string, unknown> }) {
  const node = data.node as SkillNode
  const isSuperMember = data.isSuperMember as boolean

  const confidenceColor =
    node.confidence >= 0.80 ? 'text-emerald-400' :
    node.confidence >= 0.60 ? 'text-amber-400' : 'text-red-400'

  const evidenceBadge: Record<string, string> = {
    self_claimed: 'bg-gray-800 text-gray-400',
    conversation_supported: 'bg-blue-950 text-blue-400',
    conversation_verified: 'bg-violet-950 text-violet-400',
    project_supported: 'bg-emerald-950 text-emerald-400',
    artifact_supported: 'bg-teal-950 text-teal-400',
    externally_validated: 'bg-yellow-950 text-yellow-400',
  }

  return (
    <div className={`bg-gray-900 border ${isSuperMember ? 'border-violet-600' : 'border-gray-700'} rounded-xl px-3 py-2.5 w-44 shadow-lg`}>
      <p className="text-white text-xs font-semibold leading-tight mb-1.5">{node.label}</p>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-bold ${confidenceColor}`}>
          {Math.round(node.confidence * 100)}%
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${evidenceBadge[node.evidenceLevel] ?? 'bg-gray-800 text-gray-400'}`}>
          {node.evidenceLevel.replace(/_/g, ' ')}
        </span>
      </div>
      {/* Confidence bar */}
      <div className="w-full h-1 bg-gray-800 rounded-full">
        <div
          className={`h-1 rounded-full ${node.confidence >= 0.80 ? 'bg-emerald-500' : node.confidence >= 0.60 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${node.confidence * 100}%` }}
        />
      </div>
    </div>
  )
}

function SuperNodeCard({ data }: { data: Record<string, unknown> }) {
  const sn = data.superNode as { label: string; meaning: string; confidence: number; contains: string[] }
  return (
    <div className="bg-violet-950 border-2 border-violet-500 rounded-xl px-4 py-3 w-64 shadow-xl">
      <div className="flex items-center gap-1.5 mb-1">
        <Zap size={12} className="text-violet-400" />
        <p className="text-violet-300 text-[10px] font-semibold uppercase tracking-widest">Super Node</p>
      </div>
      <p className="text-white text-sm font-bold mb-1">{sn.label}</p>
      <p className="text-violet-300 text-xs leading-relaxed mb-2">{sn.meaning}</p>
      <div className="flex items-center justify-between">
        <span className="text-violet-400 text-xs font-bold">{Math.round(sn.confidence * 100)}% confidence</span>
        <span className="text-violet-500 text-[10px]">{sn.contains.length} nodes</span>
      </div>
    </div>
  )
}

function TalentGraphView() {
  const { session, setMatchResult } = useSessionStore()
  const graph = session?.graph ?? demoTalentGraph

  const initialNodes = buildFlowNodes(graph)
  const initialEdges = buildFlowEdges(graph)

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const handleRunMatch = useCallback(() => {
    const result = matchCandidateToCompany(graph, demoCompanyProfile)
    setMatchResult(result)
  }, [graph, setMatchResult])

  const profile = session?.structuredProfile

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-800 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold mb-1">Talent Graph</h2>
          <p className="text-gray-500 text-xs">
            {graph.nodes.length} nodes · {graph.edges.length} edges · {graph.superNodes.length} super node(s)
          </p>
        </div>

        {/* Profile summary */}
        {profile && 'careerGoal' in profile && (
          <div className="p-4 border-b border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Profile</p>
            <p className="text-white text-sm font-medium mb-1">{profile.careerGoal ?? 'Unknown goal'}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.targetRoles.map(r => (
                <span key={r} className="bg-violet-950 text-violet-300 text-[10px] px-2 py-0.5 rounded-full">{r}</span>
              ))}
            </div>
          </div>
        )}

        {/* Super nodes */}
        {graph.superNodes.length > 0 && (
          <div className="p-4 border-b border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Super Nodes</p>
            {graph.superNodes.map(sn => (
              <div key={sn.id} className="bg-violet-950 border border-violet-800 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap size={11} className="text-violet-400" />
                  <p className="text-violet-300 text-xs font-semibold">{sn.label}</p>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">{sn.meaning}</p>
                <p className="text-violet-500 text-[10px] mt-1">{Math.round(sn.confidence * 100)}% confidence</p>
              </div>
            ))}
          </div>
        )}

        {/* Node confidence legend */}
        <div className="p-4 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Confidence</p>
          {[
            { color: 'bg-emerald-500', label: '80–100% Strong' },
            { color: 'bg-amber-500', label: '60–79% Moderate' },
            { color: 'bg-red-500', label: 'Below 60% Weak' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 mb-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-gray-400 text-xs">{label}</span>
            </div>
          ))}
        </div>

        {/* Missing info */}
        {profile && 'missingInfo' in profile && profile.missingInfo.length > 0 && (
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={12} className="text-amber-400" />
              <p className="text-xs text-amber-400 uppercase tracking-widest">Missing Evidence</p>
            </div>
            {profile.missingInfo.map(m => (
              <p key={m} className="text-gray-400 text-xs mb-1">· {m}</p>
            ))}
          </div>
        )}

        {/* Match CTA */}
        <div className="p-4 mt-auto">
          <button
            onClick={handleRunMatch}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Shield size={14} />
            Match to Company Role
            <ArrowRight size={14} />
          </button>
          <p className="text-gray-600 text-xs text-center mt-2">Uses demo company profile</p>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-950"
        >
          <Background color="#1f2937" gap={20} />
          <Controls className="bg-gray-900 border-gray-700" />
          <MiniMap
            className="bg-gray-900"
            nodeColor={n => {
              if (n.type === 'superNode') return '#7c3aed'
              return '#374151'
            }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}

// ─── Candidate Capability Graph view ────────────────────────────────
const CAP_TYPE_STYLE: Record<CapabilityNodeType, { label: string; border: string; text: string; dot: string; edge: string }> = {
  target_direction: { label: 'Target', border: 'border-amber-500', text: 'text-amber-300', dot: 'bg-amber-500', edge: '#f59e0b' },
  experience: { label: 'Experience', border: 'border-blue-500', text: 'text-blue-300', dot: 'bg-blue-500', edge: '#3b82f6' },
  capability: { label: 'Capability', border: 'border-violet-500', text: 'text-violet-300', dot: 'bg-violet-500', edge: '#7c3aed' },
  outcome: { label: 'Outcome', border: 'border-emerald-500', text: 'text-emerald-300', dot: 'bg-emerald-500', edge: '#10b981' },
  trait: { label: 'Trait', border: 'border-teal-500', text: 'text-teal-300', dot: 'bg-teal-500', edge: '#14b8a6' },
  context: { label: 'Context', border: 'border-gray-500', text: 'text-gray-300', dot: 'bg-gray-500', edge: '#6b7280' },
  evidence_gap: { label: 'Evidence Gap', border: 'border-red-500', text: 'text-red-300', dot: 'bg-red-500', edge: '#dc2626' },
}

const CAP_TYPE_ORDER: CapabilityNodeType[] = [
  'target_direction', 'experience', 'capability', 'outcome', 'trait', 'context', 'evidence_gap',
]

function buildCapFlowNodes(graph: CandidateCapabilityGraph): Node[] {
  const perTypeCount: Partial<Record<CapabilityNodeType, number>> = {}
  return graph.nodes.map(node => {
    const col = Math.max(0, CAP_TYPE_ORDER.indexOf(node.type))
    const row = perTypeCount[node.type] ?? 0
    perTypeCount[node.type] = row + 1
    return {
      id: node.id,
      position: { x: col * 250 + 40, y: row * 120 + 40 },
      data: { node },
      type: 'capabilityNode',
    }
  })
}

function buildCapFlowEdges(graph: CandidateCapabilityGraph): Edge[] {
  return graph.edges.map(e => {
    const fromNode = graph.nodes.find(n => n.id === e.from)
    const stroke = fromNode ? CAP_TYPE_STYLE[fromNode.type].edge : '#4b5563'
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      label: e.type.replace(/_/g, ' '),
      animated: e.type === 'demonstrates' || e.type === 'transfers_to',
      style: { stroke, strokeWidth: Math.max(1.2, (e.weight ?? 0.6) * 3) },
      labelStyle: { fill: '#9ca3af', fontSize: 10 },
      labelBgStyle: { fill: '#111827' },
    }
  })
}

function CapabilityNodeCard({ data }: { data: Record<string, unknown> }) {
  const node = data.node as CapabilityNode
  const style = CAP_TYPE_STYLE[node.type]
  const pct = Math.round((node.confidence ?? 0) * 100)
  return (
    <div className={`bg-gray-900 border ${style.border} rounded-xl px-3 py-2.5 w-48 shadow-lg`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
        <span className={`text-[10px] uppercase tracking-wider font-semibold ${style.text}`}>{style.label}</span>
      </div>
      <p className="text-white text-xs font-semibold leading-tight mb-1.5">{node.label}</p>
      {node.confidence > 0 && (
        <div className="w-full h-1 bg-gray-800 rounded-full">
          <div className={`h-1 rounded-full ${style.dot}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

const capNodeTypes = { capabilityNode: CapabilityNodeCard }

function CapabilityGraphView({ graph }: { graph: CandidateCapabilityGraph }) {
  const domain = useSessionStore(s => s.session?.candidateDomain)
  const target = useSessionStore(s => s.session?.targetDirection)

  const [nodes, , onNodesChange] = useNodesState(buildCapFlowNodes(graph))
  const [edges, , onEdgesChange] = useEdgesState(buildCapFlowEdges(graph))

  const usedTypes = CAP_TYPE_ORDER.filter(t => graph.nodes.some(n => n.type === t))

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-800 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold mb-1">Capability Graph</h2>
          <p className="text-gray-500 text-xs">
            {graph.nodes.length} nodes · {graph.edges.length} edges · {Math.round(graph.confidence * 100)}% confidence
          </p>
        </div>

        <div className="p-4 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Candidate</p>
          <p className="text-gray-500 text-xs">Domain</p>
          <p className="text-white text-sm font-medium capitalize mb-2">{domain ?? '—'}</p>
          <p className="text-gray-500 text-xs">Target direction</p>
          <p className="text-white text-sm font-medium">{target ?? '—'}</p>
        </div>

        {/* Node type legend */}
        <div className="p-4 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Node Types</p>
          {usedTypes.map(t => (
            <div key={t} className="flex items-center gap-2 mb-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${CAP_TYPE_STYLE[t].dot}`} />
              <span className="text-gray-400 text-xs">{CAP_TYPE_STYLE[t].label}</span>
            </div>
          ))}
        </div>

        {/* Missing evidence */}
        {graph.missingEvidence.length > 0 && (
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={12} className="text-amber-400" />
              <p className="text-xs text-amber-400 uppercase tracking-widest">Missing Evidence</p>
            </div>
            {graph.missingEvidence.map(m => (
              <p key={m} className="text-gray-400 text-xs mb-1">· {m}</p>
            ))}
          </div>
        )}

        {/* Back to chat */}
        <div className="p-4 mt-auto">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('goto', { detail: 'chat' }))}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare size={14} />
            Back to Conversation
          </button>
          <p className="text-gray-600 text-xs text-center mt-2">Keep chatting to refine the graph</p>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={capNodeTypes}
          fitView
          className="bg-gray-950"
        >
          <Background color="#1f2937" gap={20} />
          <Controls className="bg-gray-900 border-gray-700" />
          <MiniMap className="bg-gray-900" nodeColor="#374151" />
        </ReactFlow>
      </div>
    </div>
  )
}