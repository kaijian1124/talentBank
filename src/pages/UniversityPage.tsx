import { GraduationCap, TrendingUp, TrendingDown, BookOpen, Briefcase } from 'lucide-react'

const mockData = {
  institution: 'Faculty of Computer Science',
  totalStudents: 248,
  cohort: 'Class of 2025',
  topStrengths: [
    { skill: 'Java Programming', score: 0.78, count: 198 },
    { skill: 'Data Structures & Algorithms', score: 0.72, count: 187 },
    { skill: 'Database Design (SQL)', score: 0.69, count: 176 },
    { skill: 'Object-Oriented Design', score: 0.67, count: 165 },
    { skill: 'Web Fundamentals (HTML/CSS/JS)', score: 0.64, count: 159 },
  ],
  topGaps: [
    { skill: 'LLM / AI Application Development', score: 0.18, count: 45, industry: 'High demand' },
    { skill: 'Cloud Deployment (AWS/GCP/Azure)', score: 0.22, count: 55, industry: 'High demand' },
    { skill: 'Docker & Containerisation', score: 0.24, count: 60, industry: 'High demand' },
    { skill: 'System Design at Scale', score: 0.28, count: 70, industry: 'Medium demand' },
    { skill: 'CI/CD & DevOps Practices', score: 0.30, count: 74, industry: 'High demand' },
    { skill: 'Real-World Project Delivery', score: 0.32, count: 80, industry: 'High demand' },
  ],
  industryTargets: [
    { role: 'Backend Engineer', interest: 0.42 },
    { role: 'AI / ML Engineer', interest: 0.28 },
    { role: 'Full Stack Developer', interest: 0.18 },
    { role: 'Data Engineer', interest: 0.12 },
  ],
  curriculumRecommendations: [
    {
      area: 'AI & LLM Integration',
      priority: 'Critical',
      suggestion: 'Introduce a practical module on LLM API integration, prompt engineering, and building AI-powered applications using Python.',
      gap: 0.82,
    },
    {
      area: 'Cloud & Deployment',
      priority: 'High',
      suggestion: 'Add hands-on cloud deployment labs covering Docker, CI/CD pipelines, and at least one major cloud provider.',
      gap: 0.76,
    },
    {
      area: 'Real-World Project Delivery',
      priority: 'High',
      suggestion: 'Expand FYP scope to require deployment, user testing, and stakeholder presentation — not just code submission.',
      gap: 0.68,
    },
    {
      area: 'System Design',
      priority: 'Medium',
      suggestion: 'Introduce system design case studies focusing on scalability, API design, and architecture trade-offs.',
      gap: 0.62,
    },
  ],
  readinessScore: 0.54,
}

export default function UniversityPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold">{mockData.institution}</h1>
            <p className="text-gray-500 text-xs">{mockData.cohort} · {mockData.totalStudents} students</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Overall readiness */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-gray-400 text-sm mb-1">Overall Industry Readiness</p>
            <p className="text-3xl font-bold text-white">{Math.round(mockData.readinessScore * 100)}%</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs mb-1">Cohort</p>
            <p className="text-gray-300 text-sm">{mockData.cohort}</p>
          </div>
        </div>
        <div className="w-full h-2.5 bg-gray-800 rounded-full">
          <div
            className="h-2.5 rounded-full bg-emerald-500"
            style={{ width: `${mockData.readinessScore * 100}%` }}
          />
        </div>
        <p className="text-gray-500 text-xs mt-2">
          Students are moderately prepared for junior roles. Critical gaps exist in AI tooling and deployment skills.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Strengths */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-emerald-400" />
            <h3 className="text-white text-sm font-semibold">Common Strengths</h3>
          </div>
          <div className="flex flex-col gap-3">
            {mockData.topStrengths.map(s => (
              <div key={s.skill}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-300 text-xs">{s.skill}</span>
                  <span className="text-emerald-400 text-xs font-semibold">{Math.round(s.score * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${s.score * 100}%` }}
                  />
                </div>
                <p className="text-gray-600 text-[10px] mt-0.5">{s.count} students</p>
              </div>
            ))}
          </div>
        </div>

        {/* Gaps */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={15} className="text-red-400" />
            <h3 className="text-white text-sm font-semibold">Critical Skill Gaps</h3>
          </div>
          <div className="flex flex-col gap-3">
            {mockData.topGaps.map(g => (
              <div key={g.skill}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-300 text-xs">{g.skill}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      g.industry === 'High demand' ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'
                    }`}>{g.industry}</span>
                    <span className="text-red-400 text-xs font-semibold">{Math.round(g.score * 100)}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full">
                  <div
                    className="h-1.5 rounded-full bg-red-500"
                    style={{ width: `${g.score * 100}%` }}
                  />
                </div>
                <p className="text-gray-600 text-[10px] mt-0.5">{g.count} students with evidence</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Industry targets */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase size={15} className="text-blue-400" />
          <h3 className="text-white text-sm font-semibold">Target Roles Distribution</h3>
        </div>
        <div className="flex flex-col gap-3">
          {mockData.industryTargets.map(t => (
            <div key={t.role} className="flex items-center gap-3">
              <span className="text-gray-300 text-xs w-44 shrink-0">{t.role}</span>
              <div className="flex-1 h-2 bg-gray-800 rounded-full">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${t.interest * 100}%` }}
                />
              </div>
              <span className="text-blue-400 text-xs font-semibold w-10 text-right">
                {Math.round(t.interest * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Curriculum recommendations */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={15} className="text-violet-400" />
          <h3 className="text-white text-sm font-semibold">Curriculum Gap Recommendations</h3>
        </div>
        <div className="flex flex-col gap-3">
          {mockData.curriculumRecommendations.map(r => (
            <div key={r.area} className="border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-medium">{r.area}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  r.priority === 'Critical' ? 'bg-red-950 text-red-400' :
                  r.priority === 'High' ? 'bg-amber-950 text-amber-400' :
                  'bg-blue-950 text-blue-400'
                }`}>{r.priority}</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed mb-2">{r.suggestion}</p>
              <div className="flex items-center gap-2">
                <span className="text-gray-600 text-[10px]">Industry gap:</span>
                <div className="flex-1 h-1 bg-gray-800 rounded-full">
                  <div className="h-1 rounded-full bg-red-500" style={{ width: `${r.gap * 100}%` }} />
                </div>
                <span className="text-red-400 text-[10px] font-semibold">{Math.round(r.gap * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}