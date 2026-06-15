import { useSessionStore } from '../store/sessionStore'
import { useCallback, useEffect, type ReactNode } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type {
  TalentGraph, SkillNode, CandidateCapabilityGraph, CapabilityNode, CapabilityNodeType,
} from '../types'
import {
  ArrowRight,
  Zap,
  Shield,
  AlertTriangle,
  MessageSquare,
  Search,
  Folder,
  FileText,
  CircleDot,
  GitBranch,
  Settings,
  SlidersHorizontal,
  Maximize2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Plus,
  Minus,
  LocateFixed,
} from 'lucide-react'
import { demoTalentGraph } from '../services/mockData'
import { demoCompanyProfile } from '../services/mockData'
import { matchCandidateToCompany } from '../services/matchingService'

// GraphPage router: capability graph (candidate) vs skill graph
export default function GraphPage() {
  const capabilityGraph = useSessionStore(s => s.session?.capabilityGraph)
  return capabilityGraph
    ? <CapabilityGraphView graph={capabilityGraph} />
    : <TalentGraphView />
}

type LayoutEdge = {
  id: string
  source: string
  target: string
  label?: string
  weight?: number
  kind?: 'cluster' | 'relation' | 'capability'
}

type LayoutPoint = { x: number; y: number }

const GRAPH_THEME = {
  canvas: '#17141d',
  canvasSoft: '#1c1724',
  rail: '#282333',
  panel: '#211c2b',
  panelSoft: '#2b2438',
  border: '#3a304b',
  text: '#eee9f7',
  muted: '#9b90ad',
  faint: '#62566f',
  primary: '#b99cff',
  primaryStrong: '#d8c8ff',
  primaryDeep: '#8b5cf6',
  secondary: '#c084fc',
  tertiary: '#7c6ee6',
  danger: '#ef8fa2',
}

function createRadialLayout({
  nodeIds,
  edges,
  anchorIds = [],
  center = { x: 620, y: 390 },
  baseRadius = 210,
  ringGap = 145,
}: {
  nodeIds: string[]
  edges: LayoutEdge[]
  anchorIds?: string[]
  center?: LayoutPoint
  baseRadius?: number
  ringGap?: number
}): Map<string, LayoutPoint> {
  const ids = Array.from(new Set(nodeIds))
  const idSet = new Set(ids)
  const adjacency = new Map<string, Set<string>>()
  const degree = new Map<string, number>()

  ids.forEach((id) => {
    adjacency.set(id, new Set())
    degree.set(id, 0)
  })

  edges.forEach((edge) => {
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) return
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  })

  const root = anchorIds.find((id) => idSet.has(id))
    ?? [...ids].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0))[0]
  const positions = new Map<string, LayoutPoint>()
  if (!root) return positions

  const depth = new Map<string, number>([[root, 0]])
  const parent = new Map<string, string | null>([[root, null]])
  const queue = [root]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    const neighbours = [...(adjacency.get(current) ?? [])]
      .sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b))
    neighbours.forEach((next) => {
      if (depth.has(next)) return
      depth.set(next, (depth.get(current) ?? 0) + 1)
      parent.set(next, current)
      queue.push(next)
    })
  }

  const maxConnectedDepth = Math.max(0, ...depth.values())
  ids.filter((id) => !depth.has(id)).forEach((id, index) => {
    depth.set(id, maxConnectedDepth + 1 + (degree.get(id) ? 0 : 1))
    parent.set(id, null)
    degree.set(id, Math.max(0, (degree.get(id) ?? 0) - index * 0.0001))
  })

  positions.set(root, center)
  const levels = new Map<number, string[]>()
  ids.forEach((id) => {
    const d = depth.get(id) ?? 1
    if (d === 0) return
    levels.set(d, [...(levels.get(d) ?? []), id])
  })

  const parentAngles = new Map<string, number>([[root, -Math.PI / 2]])
  Array.from(levels.keys()).sort((a, b) => a - b).forEach((d) => {
    const nodes = (levels.get(d) ?? []).sort((a, b) => {
      const parentA = parent.get(a)
      const parentB = parent.get(b)
      const parentAngleA = parentA ? parentAngles.get(parentA) ?? 0 : 0
      const parentAngleB = parentB ? parentAngles.get(parentB) ?? 0 : 0
      return parentAngleA - parentAngleB || (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b)
    })
    const count = Math.max(nodes.length, 1)
    const radius = baseRadius + (d - 1) * ringGap + Math.max(0, count - 12) * 7
    const offset = d % 2 === 0 ? Math.PI / count : 0

    nodes.forEach((id, index) => {
      const angle = -Math.PI / 2 + offset + (index / count) * Math.PI * 2
      positions.set(id, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      })
      parentAngles.set(id, angle)
    })
  })

  return positions
}

function edgeKey(source: string, target: string) {
  return `${source}->${target}`
}

function filterConnectedEdges(edges: LayoutEdge[], nodeIds: Set<string>) {
  const seen = new Set<string>()
  return edges.filter((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) return false
    const key = edgeKey(edge.source, edge.target)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildFlowNodes(graph: TalentGraph): Node[] {
  const superNodeIds = new Set(graph.superNodes.flatMap(s => s.contains))
  const nodeIds = [
    ...graph.nodes.map((node) => node.id),
    ...graph.superNodes.map((superNode) => superNode.id),
  ]
  const visualEdges = buildTalentVisualEdges(graph)
  const largestSuperNode = [...graph.superNodes]
    .sort((a, b) => b.contains.length - a.contains.length)[0]?.id
  const positions = createRadialLayout({
    nodeIds,
    edges: visualEdges,
    anchorIds: largestSuperNode ? [largestSuperNode] : [],
    center: { x: 620, y: 390 },
    baseRadius: 220,
    ringGap: 155,
  })
  const nodes: Node[] = []

  graph.nodes.forEach((node) => {
    const isSuperMember = superNodeIds.has(node.id)

    nodes.push({
      id: node.id,
      position: positions.get(node.id) ?? { x: 620, y: 390 },
      data: { label: node.label, node, isSuperMember },
      type: 'skillNode',
    })
  })

  graph.superNodes.forEach((sn) => {
    nodes.push({
      id: sn.id,
      position: positions.get(sn.id) ?? { x: 620, y: 390 },
      data: { label: sn.label, isSuperNode: true, superNode: sn },
      type: 'superNode',
    })
  })

  return nodes
}

function buildTalentVisualEdges(graph: TalentGraph): LayoutEdge[] {
  const nodeIds = new Set([
    ...graph.nodes.map((node) => node.id),
    ...graph.superNodes.map((superNode) => superNode.id),
  ])
  const relationEdges = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.edgeType,
    weight: edge.weight,
    kind: 'relation' as const,
  }))
  const clusterEdges = graph.superNodes.flatMap((superNode) =>
    superNode.contains.map((nodeId) => ({
      id: `cluster_${superNode.id}_${nodeId}`,
      source: superNode.id,
      target: nodeId,
      label: 'contains',
      weight: superNode.confidence,
      kind: 'cluster' as const,
    }))
  )

  return filterConnectedEdges([...clusterEdges, ...relationEdges], nodeIds)
}

function buildFlowEdges(graph: TalentGraph): Edge[] {
  return buildTalentVisualEdges(graph).map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: 'center-source',
    targetHandle: 'center-target',
    label: e.label ?? (e.kind === 'cluster' ? 'contains' : 'related'),
    type: 'straight',
    animated: e.kind === 'cluster',
    style: {
      stroke: e.kind === 'cluster' ? GRAPH_THEME.primaryStrong : GRAPH_THEME.primaryDeep,
      strokeWidth: e.kind === 'cluster' ? Math.max(1.4, (e.weight ?? 0.6) * 2.6) : Math.max(0.8, (e.weight ?? 0.45) * 1.8),
      opacity: e.kind === 'cluster' ? 0.9 : 0.5,
    },
    labelStyle: { fill: '#f7f2ff', fontSize: 10, fontWeight: 700 },
    labelBgStyle: { fill: '#33254a', fillOpacity: 0.92 },
    labelBgPadding: [5, 3] as [number, number],
    labelBgBorderRadius: 4,
  }))
}

const nodeTypes = {
  skillNode: SkillNodeCard,
  superNode: SuperNodeCard,
}

function SkillNodeCard({ data }: { data: Record<string, unknown> }) {
  const node = data.node as SkillNode
  const isSuperMember = data.isSuperMember as boolean
  const pct = Math.round(node.confidence * 100)
  const size = node.confidence >= 0.80 ? 24 : node.confidence >= 0.60 ? 19 : 15
  const nodeColor =
    isSuperMember ? '#ffd166' :
    node.evidenceLevel === 'conversation_verified' ? '#38bdf8' :
    node.evidenceLevel === 'project_supported' ? '#22c55e' :
    node.evidenceLevel === 'artifact_supported' ? '#f472b6' :
    node.evidenceLevel === 'externally_validated' ? '#fb923c' :
    node.evidenceLevel === 'conversation_supported' ? '#a78bfa' :
    node.confidence >= 0.60 ? '#c084fc' : '#7c7288'

  const confidenceColor =
    node.confidence >= 0.80 ? 'text-[#eadfff]' :
    node.confidence >= 0.60 ? 'text-[#c4b5fd]' : 'text-[#b4a8c9]'

  return (
    <div className="group relative flex w-40 flex-col items-center">
      <Handle
        type="target"
        id="center-target"
        position={Position.Left}
        style={{ left: '50%', top: size / 2, transform: 'translate(-50%, -50%)' }}
        className="!h-3 !w-3 !border-0 !bg-transparent !opacity-0"
      />
      <div
        className="rounded-full border border-black/30 transition-transform duration-200 group-hover:scale-125"
        style={{
          width: size,
          height: size,
          backgroundColor: nodeColor,
          boxShadow: `0 0 0 2px rgba(0, 0, 0, 0.35), 0 0 ${isSuperMember ? 22 : 14}px ${nodeColor}55`,
        }}
      />
      <Handle
        type="source"
        id="center-source"
        position={Position.Right}
        style={{ left: '50%', top: size / 2, transform: 'translate(-50%, -50%)' }}
        className="!h-3 !w-3 !border-0 !bg-transparent !opacity-0"
      />
      <p className="mt-1 max-w-36 truncate text-center text-[10px] font-semibold text-[#d9d2e8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] transition-colors group-hover:text-white">
        {node.label}
      </p>
      <div className="pointer-events-none absolute left-1/2 top-9 z-20 w-52 -translate-x-1/2 rounded-md border border-[#3a3a3a] bg-[#222]/95 px-3 py-2 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100">
        <p className="truncate text-xs font-semibold text-[#e7e2d8]">{node.label}</p>
        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <span className={confidenceColor}>{pct}% confidence</span>
          <span className="text-[#8f8a83]">{node.evidenceLevel.replace(/_/g, ' ')}</span>
        </div>
      </div>
    </div>
  )
}

function SuperNodeCard({ data }: { data: Record<string, unknown> }) {
  const sn = data.superNode as { label: string; meaning: string; confidence: number; contains: string[] }
  const size = 34 + Math.min(sn.contains.length, 8) * 2
  return (
    <div className="group relative flex w-64 flex-col items-center">
      <Handle
        type="target"
        id="center-target"
        position={Position.Left}
        style={{ left: '50%', top: size / 2, transform: 'translate(-50%, -50%)' }}
        className="!h-4 !w-4 !border-0 !bg-transparent !opacity-0"
      />
      <div
        className="flex items-center justify-center rounded-full border border-[#ede9fe]/50 text-[#21162f] shadow-2xl transition-transform duration-200 group-hover:scale-110"
        style={{
          width: size,
          height: size,
          backgroundColor: GRAPH_THEME.primaryStrong,
          boxShadow: '0 0 0 3px rgba(0,0,0,0.35), 0 0 30px rgba(185,156,255,0.54)',
        }}
      >
        <Zap size={14} />
      </div>
      <Handle
        type="source"
        id="center-source"
        position={Position.Right}
        style={{ left: '50%', top: size / 2, transform: 'translate(-50%, -50%)' }}
        className="!h-4 !w-4 !border-0 !bg-transparent !opacity-0"
      />
      <p className="mt-1 max-w-56 truncate text-center text-sm font-semibold text-[#fff7cc] drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] transition-colors group-hover:text-white">
        {sn.label}
      </p>
      <div className="pointer-events-none absolute left-1/2 top-14 z-20 w-64 -translate-x-1/2 rounded-md border border-[#4b3b63] bg-[#251d31]/95 px-3 py-2 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100">
        <p className="text-xs font-semibold text-[#e7e2d8]">{sn.label}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#cbb8ff]">{sn.meaning}</p>
        <p className="mt-1.5 text-[10px] text-[#8f8a83]">
          {Math.round(sn.confidence * 100)}% confidence - {sn.contains.length} linked nodes
        </p>
      </div>
    </div>
  )
}

function GraphWorkspaceShell({
  sidebar,
  children,
  heightClass = 'h-[calc(100vh-57px)]',
}: {
  sidebar: ReactNode
  children: ReactNode
  heightClass?: string
}) {
  return (
    <div className={`flex overflow-hidden bg-[#17141d] text-[#eee9f7] ${heightClass}`}>
      <GraphIconRail />
      <aside className="hidden w-64 shrink-0 border-r border-[#3a304b] bg-[#211c2b] md:flex md:flex-col">
        {sidebar}
      </aside>
      <section className="relative min-w-0 flex-1 bg-[#17141d]">
        {children}
      </section>
    </div>
  )
}

function GraphIconRail() {
  const icons = [
    { icon: CircleDot, label: 'Graph', active: true },
    { icon: Folder, label: 'Vault' },
    { icon: Search, label: 'Search' },
    { icon: GitBranch, label: 'Links' },
    { icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="hidden w-9 shrink-0 flex-col items-center gap-2 border-r border-[#3a304b] bg-[#282333] py-2 md:flex">
      {icons.map(({ icon: Icon, label, active }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            active ? 'bg-[#3d3154] text-[#f3e8ff]' : 'text-[#9b90ad] hover:bg-[#332a44] hover:text-[#eee9f7]'
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}

function GraphSidebarHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="border-b border-[#3a304b] px-2 py-2.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Folder size={15} className="shrink-0 text-[#b99cff]" />
          <h2 className="truncate text-sm font-semibold text-[#eee9f7]">{title}</h2>
        </div>
        <button type="button" aria-label="Graph settings" className="text-[#9b90ad] hover:text-[#eee9f7]">
          <SlidersHorizontal size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-[#3a304b] bg-[#17141d] px-2.5 py-1.5 text-xs text-[#9b90ad]">
        <Search size={12} />
        <span>Filter graph...</span>
      </div>
      <p className="mt-2 text-[11px] text-[#9b90ad]">{subtitle}</p>
    </div>
  )
}

function VaultFolder({
  label,
  color,
  children,
}: {
  label: string
  color: string
  children: ReactNode
}) {
  return (
    <div className="mb-1">
      <div
        className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium"
        style={{ backgroundColor: `${color}1c`, color }}
      >
        <ChevronDown size={13} />
        <Folder size={13} />
        <span className="truncate">{label}</span>
      </div>
      <div className="ml-3 border-l border-[#3a304b] pl-2">{children}</div>
    </div>
  )
}

function VaultSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="border-b border-[#3a304b] px-2 py-2.5">
      <p className="mb-2 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#7d718f]">
        <ChevronRight size={11} />
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function VaultRow({
  icon,
  label,
  value,
  active = false,
}: {
  icon: ReactNode
  label: string
  value?: string
  active?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs ${
      active ? 'bg-[#342947] text-[#efe7ff]' : 'text-[#b8aec8] hover:bg-[#2b2438]'
    }`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[#9b90ad]">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      {value && <span className="shrink-0 text-[10px] text-[#887b9c]">{value}</span>}
    </div>
  )
}

function LegendItem({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-[#b8aec8]">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}66` }} />
        <span className="truncate">{label}</span>
      </div>
      {value && <span className="text-[10px] text-[#887b9c]">{value}</span>}
    </div>
  )
}

function GraphCanvasChrome({
  title,
  meta,
  children,
}: {
  title: string
  meta: string
  children: ReactNode
}) {
  return (
    <div className="relative h-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 grid h-11 grid-cols-[1fr_auto_1fr] items-center border-b border-[#3a304b]/90 bg-[#1c1724]/92 px-3 backdrop-blur">
        <div className="pointer-events-auto flex items-center gap-1 text-[#9b90ad]">
          <button type="button" aria-label="New graph tab" className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#332a44] hover:text-[#eee9f7]">
            <Plus size={14} />
          </button>
          <div className="flex h-8 items-center gap-2 rounded-t-md border border-b-0 border-[#3a304b] bg-[#2b2438] px-3 text-xs text-[#f3e8ff] shadow-[0_1px_0_#2b2438]">
            <GitBranch size={13} className="text-[#b99cff]" />
            <span>{title}</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-[#eee9f7]">{title}</p>
          <p className="text-[10px] text-[#9b90ad]">{meta}</p>
        </div>
        <div className="pointer-events-auto flex justify-end text-[#9b90ad]">
          <button type="button" aria-label="More graph options" className="rounded-md p-1.5 hover:bg-[#332a44] hover:text-[#eee9f7]">
            <MoreVertical size={15} />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

function GraphFloatingTools() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const tools = [
    { icon: Plus, label: 'Zoom in', onClick: () => zoomIn({ duration: 180 }) },
    { icon: Minus, label: 'Zoom out', onClick: () => zoomOut({ duration: 180 }) },
    { icon: Maximize2, label: 'Fit graph', onClick: () => fitView({ duration: 220, padding: 0.24 }) },
    { icon: LocateFixed, label: 'Center graph', onClick: () => fitView({ duration: 220, padding: 0.36 }) },
  ]

  return (
    <div className="pointer-events-auto absolute right-3 top-16 z-10 flex flex-col gap-2">
      {tools.map(({ icon: Icon, label, onClick }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          onClick={onClick}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#3a304b] bg-[#211c2b]/88 text-[#b8aec8] shadow-lg backdrop-blur transition-colors hover:border-[#6d5a8b] hover:bg-[#332a44] hover:text-[#f3e8ff]"
        >
          <Icon size={15} />
        </button>
      ))}
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
    <GraphWorkspaceShell
      sidebar={(
        <>
          <GraphSidebarHeader
            title="Talent Vault"
            subtitle={`${graph.nodes.length} nodes - ${graph.edges.length} links - ${graph.superNodes.length} hubs`}
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <VaultSection title="Vault">
              <VaultFolder label="_graphs" color="#b99cff">
                <VaultRow icon={<GitBranch size={13} />} label="Talent Graph" value="canvas" active />
                <VaultRow icon={<CircleDot size={13} />} label="Skill nodes" value={String(graph.nodes.length)} />
                <VaultRow icon={<Zap size={13} />} label="Super nodes" value={String(graph.superNodes.length)} />
              </VaultFolder>
              <VaultFolder label="signals" color="#c084fc">
                <LegendItem color="#d8c8ff" label="Strong confidence" />
                <LegendItem color="#b99cff" label="Moderate confidence" />
                <LegendItem color="#62566f" label="Needs evidence" />
              </VaultFolder>
            </VaultSection>

            {profile && 'careerGoal' in profile && (
              <VaultSection title="Profile">
                <VaultFolder label="candidate" color="#d8c8ff">
                  <VaultRow icon={<BookOpen size={13} />} label={profile.careerGoal ?? 'Unknown goal'} active />
                  {profile.targetRoles.map(r => (
                    <VaultRow key={r} icon={<FileText size={13} />} label={r} />
                  ))}
                </VaultFolder>
              </VaultSection>
            )}

            {graph.superNodes.length > 0 && (
              <VaultSection title="Hubs">
                <VaultFolder label="clusters" color="#c084fc">
                  {graph.superNodes.map(sn => (
                    <VaultRow
                      key={sn.id}
                      icon={<Zap size={13} />}
                      label={sn.label}
                      value={`${Math.round(sn.confidence * 100)}%`}
                    />
                  ))}
                </VaultFolder>
              </VaultSection>
            )}

            {profile && 'missingInfo' in profile && profile.missingInfo.length > 0 && (
              <VaultSection title="Missing Evidence">
                {profile.missingInfo.map(m => (
                  <VaultRow key={m} icon={<AlertTriangle size={13} />} label={sanitizeGraphText(m)} />
                ))}
              </VaultSection>
            )}
          </div>

          <div className="border-t border-[#3a304b] p-3">
            <button
              onClick={handleRunMatch}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[#6d5a8b] bg-[#33254a] px-3 py-2 text-xs font-semibold text-[#f3e8ff] transition-colors hover:border-[#b99cff] hover:bg-[#46315f]"
            >
              <Shield size={14} />
              Match to Company Role
              <ArrowRight size={13} />
            </button>
            <p className="mt-2 text-center text-[10px] text-[#887b9c]">Uses demo company profile</p>
          </div>
        </>
      )}
    >
      <GraphCanvasChrome
        title="Graph view"
        meta={`${graph.nodes.length} notes - ${graph.edges.length} relationships`}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.32 }}
          proOptions={{ hideAttribution: true }}
          className="talent-knowledge-flow"
        >
          <GraphFloatingTools />
          <Background color="#2d2638" gap={28} />
          <MiniMap
            className="knowledge-flow-minimap"
            nodeColor={n => {
              if (n.type === 'superNode') return GRAPH_THEME.primaryStrong
              return GRAPH_THEME.primary
            }}
            maskColor="rgba(23, 20, 29, 0.74)"
          />
        </ReactFlow>
      </GraphCanvasChrome>
    </GraphWorkspaceShell>
  )
}

// Candidate Capability Graph view
const CAP_TYPE_STYLE: Record<CapabilityNodeType, { label: string; border: string; text: string; dot: string; edge: string }> = {
  target_direction: { label: 'Target', border: 'border-[#facc15]', text: 'text-[#fef3c7]', dot: 'bg-[#facc15]', edge: '#facc15' },
  experience: { label: 'Experience', border: 'border-[#22c55e]', text: 'text-[#bbf7d0]', dot: 'bg-[#22c55e]', edge: '#22c55e' },
  capability: { label: 'Capability', border: 'border-[#38bdf8]', text: 'text-[#bae6fd]', dot: 'bg-[#38bdf8]', edge: '#38bdf8' },
  outcome: { label: 'Outcome', border: 'border-[#fb923c]', text: 'text-[#fed7aa]', dot: 'bg-[#fb923c]', edge: '#fb923c' },
  trait: { label: 'Trait', border: 'border-[#ef4444]', text: 'text-[#fecaca]', dot: 'bg-[#ef4444]', edge: '#ef4444' },
  context: { label: 'Context', border: 'border-[#94a3b8]', text: 'text-[#e2e8f0]', dot: 'bg-[#94a3b8]', edge: '#94a3b8' },
  evidence_gap: { label: 'Evidence Gap', border: 'border-[#f97316]', text: 'text-[#ffedd5]', dot: 'bg-[#f97316]', edge: '#f97316' },
  preference: { label: 'Preference', border: 'border-[#e879f9]', text: 'text-[#f5d0fe]', dot: 'bg-[#e879f9]', edge: '#e879f9' },
  credential: { label: 'Credential', border: 'border-[#14b8a6]', text: 'text-[#ccfbf1]', dot: 'bg-[#14b8a6]', edge: '#14b8a6' },
}

const CAP_TYPE_ORDER: CapabilityNodeType[] = [
  'target_direction', 'preference', 'credential', 'experience', 'capability', 'outcome', 'trait', 'context', 'evidence_gap',
]

function buildCapFlowNodes(graph: CandidateCapabilityGraph): Node[] {
  const nodeIds = graph.nodes.map((node) => node.id)
  const visualEdges = buildCapabilityVisualEdges(graph)
  const anchors = graph.nodes
    .filter((node) => node.type === 'target_direction')
    .map((node) => node.id)
  const positions = createRadialLayout({
    nodeIds,
    edges: visualEdges,
    anchorIds: anchors,
    center: { x: 620, y: 390 },
    baseRadius: 215,
    ringGap: 150,
  })

  return graph.nodes.map(node => {
    return {
      id: node.id,
      position: positions.get(node.id) ?? { x: 620, y: 390 },
      data: { node },
      type: 'capabilityNode',
    }
  })
}

function buildCapabilityVisualEdges(graph: CandidateCapabilityGraph): LayoutEdge[] {
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  return filterConnectedEdges(
    graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.type.replace(/_/g, ' '),
      weight: edge.weight,
      kind: 'capability' as const,
    })),
    nodeIds
  )
}

function buildCapFlowEdges(graph: CandidateCapabilityGraph): Edge[] {
  const anchorIds = new Set(graph.nodes.filter((node) => node.type === 'target_direction').map((node) => node.id))
  return buildCapabilityVisualEdges(graph)
    .map(e => {
      const fromNode = graph.nodes.find(n => n.id === e.source)
      const stroke = fromNode ? CAP_TYPE_STYLE[fromNode.type].edge : '#8b5cf6'
      const isAnchorSpoke = anchorIds.has(e.source) || anchorIds.has(e.target)
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: 'center-source',
        targetHandle: 'center-target',
        label: e.label ?? 'related',
        type: 'straight',
        animated: isAnchorSpoke,
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
        zIndex: 10,
        interactionWidth: 28,
        style: {
          stroke,
          strokeWidth: isAnchorSpoke ? Math.max(1.8, (e.weight ?? 0.65) * 2.8) : Math.max(0.8, (e.weight ?? 0.45) * 1.7),
          opacity: isAnchorSpoke ? 0.92 : 0.56,
        },
        labelStyle: { fill: '#ffffff', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: '#211c2b', fillOpacity: 0.94 },
        labelBgPadding: [5, 3] as [number, number],
        labelBgBorderRadius: 4,
      }
    })
}

function CapabilityNodeCard({ data }: { data: Record<string, unknown> }) {
  const node = data.node as CapabilityNode
  const style = CAP_TYPE_STYLE[node.type]
  const pct = Math.round((node.confidence ?? 0) * 100)
  const size =
    node.type === 'target_direction' ? 34 :
    node.type === 'evidence_gap' ? 15 :
    node.confidence >= 0.80 ? 24 :
    node.confidence >= 0.50 ? 19 : 16

  return (
    <div className="group relative flex w-40 flex-col items-center">
      <Handle
        type="target"
        id="center-target"
        position={Position.Left}
        style={{ left: '50%', top: size / 2, transform: 'translate(-50%, -50%)' }}
        className="!h-3 !w-3 !border-0 !bg-transparent !opacity-0"
      />
      <div
        className={`rounded-full border border-black/30 transition-transform duration-200 group-hover:scale-125 ${node.type === 'target_direction' ? 'flex items-center justify-center' : ''}`}
        style={{
          width: size,
          height: size,
          backgroundColor: style.edge,
          boxShadow: `0 0 0 2px rgba(0,0,0,0.38), 0 0 ${node.type === 'target_direction' ? 28 : 16}px ${style.edge}66`,
        }}
      >
        {node.type === 'target_direction' && <Zap size={14} className="text-[#161616]" />}
      </div>
      <Handle
        type="source"
        id="center-source"
        position={Position.Right}
        style={{ left: '50%', top: size / 2, transform: 'translate(-50%, -50%)' }}
        className="!h-3 !w-3 !border-0 !bg-transparent !opacity-0"
      />
      <p className="mt-1 max-w-36 truncate text-center text-[10px] font-semibold text-[#e9e2f7] drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] transition-colors group-hover:text-white">
        {node.label}
      </p>
      <div className="pointer-events-none absolute left-1/2 top-9 z-20 w-56 -translate-x-1/2 rounded-md border border-[#3a3a3a] bg-[#222]/95 px-3 py-2 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.edge }} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${style.text}`}>{style.label}</span>
        </div>
        <p className="text-xs font-semibold text-[#e7e2d8]">{node.label}</p>
        {node.confidence > 0 && (
          <p className="mt-1 text-[10px] text-[#8f8a83]">{pct}% confidence</p>
        )}
      </div>
    </div>
  )
}

function sanitizeGraphText(text: string): string {
  return text
    .replace(/^\?{2,}/, '')
    .replace(/\?{2,}/g, '')
    .replace(/[\u0080-\u009f]/g, '')
    .replace(/[\ue000-\uf8ff]/g, '')
    .trim()
}

const capNodeTypes = { capabilityNode: CapabilityNodeCard }

export function CapabilityGraphView({
  graph,
  title = 'Capability Graph',
  ownerLabel = 'Candidate',
  domain,
  target,
  backLabel = 'Back to Conversation',
  footerText = 'Continue the chat to add real experiences and raise your confidence scores',
  heightClass = 'h-[calc(100vh-57px)]',
  onBack = () => window.dispatchEvent(new CustomEvent('goto', { detail: 'chat' })),
}: {
  graph: CandidateCapabilityGraph
  title?: string
  ownerLabel?: string
  domain?: string | null
  target?: string | null
  backLabel?: string
  footerText?: string
  heightClass?: string
  onBack?: () => void
}) {
  const sessionDomain = useSessionStore(s => s.session?.candidateDomain)
  const sessionTarget = useSessionStore(s => s.session?.targetDirection)
  const displayDomain = domain ?? sessionDomain
  const displayTarget = target ?? sessionTarget

  const [nodes, setNodes, onNodesChange] = useNodesState(buildCapFlowNodes(graph))
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildCapFlowEdges(graph))

  useEffect(() => {
    setNodes(buildCapFlowNodes(graph))
    setEdges(buildCapFlowEdges(graph))
  }, [graph, setEdges, setNodes])

  const usedTypes = CAP_TYPE_ORDER.filter(t => graph.nodes.some(n => n.type === t))

  return (
    <GraphWorkspaceShell
      heightClass={heightClass}
      sidebar={(
        <>
          <GraphSidebarHeader
            title={title}
            subtitle={`${graph.nodes.length} nodes - ${graph.edges.length} links - ${Math.round(graph.confidence * 100)}% confidence`}
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <VaultSection title={ownerLabel}>
              <VaultFolder label="profile" color="#d8c8ff">
                <VaultRow icon={<BookOpen size={13} />} label="Domain" value={displayDomain ?? '-'} active />
                <VaultRow icon={<GitBranch size={13} />} label="Target direction" value={displayTarget ?? '-'} />
              </VaultFolder>
            </VaultSection>

            <VaultSection title="Graph Layers">
              <VaultFolder label="node-types" color="#b99cff">
                {usedTypes.map(t => (
                  <LegendItem
                    key={t}
                    color={CAP_TYPE_STYLE[t].edge}
                    label={CAP_TYPE_STYLE[t].label}
                    value={String(graph.nodes.filter(n => n.type === t).length)}
                  />
                ))}
              </VaultFolder>
            </VaultSection>

            {graph.missingEvidence.length > 0 && (
              <VaultSection title="Missing Evidence">
                <VaultFolder label="evidence-gaps" color="#ef8fa2">
                  {graph.missingEvidence.map(m => (
                    <VaultRow key={m} icon={<AlertTriangle size={13} />} label={sanitizeGraphText(m)} />
                  ))}
                </VaultFolder>
              </VaultSection>
            )}
          </div>

          <div className="border-t border-[#3a304b] p-3">
            <button
              onClick={onBack}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[#6d5a8b] bg-[#33254a] px-3 py-2 text-xs font-semibold text-[#f3e8ff] transition-colors hover:border-[#b99cff] hover:bg-[#46315f]"
            >
              <MessageSquare size={14} />
              {backLabel}
            </button>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-[#887b9c]">{footerText}</p>
          </div>
        </>
      )}
    >
      <GraphCanvasChrome
        title="Graph view"
        meta={`${displayTarget ?? title} - ${graph.nodes.length} notes - ${graph.edges.length} relationships`}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={capNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.34 }}
          proOptions={{ hideAttribution: true }}
          className="talent-knowledge-flow"
        >
          <GraphFloatingTools />
          <Background color="#2d2638" gap={28} />
          <MiniMap
            className="knowledge-flow-minimap"
            nodeColor={n => {
              const capabilityNode = graph.nodes.find(node => node.id === n.id)
              return capabilityNode ? CAP_TYPE_STYLE[capabilityNode.type].edge : '#555'
            }}
            maskColor="rgba(23, 20, 29, 0.74)"
          />
        </ReactFlow>
      </GraphCanvasChrome>
    </GraphWorkspaceShell>
  )
}
