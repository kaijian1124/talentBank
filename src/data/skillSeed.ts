// ─── Multi-domain capability seed (ESCO-referenced) ─────────────────
// Static, offline-curated taxonomy that grounds the structured (Phase 0/1)
// intake options so they are consistent and matchable across candidate and
// company graphs. ESCO (European Skills/Competences/Occupations) is used
// ONLY as a structural reference; this is NOT a runtime ESCO query. At
// runtime the LLM augments these options and candidates may add manual
// entries (validated by the LLM).

import type { CandidateDomain } from '../types'

export interface SeedRole {
  id: string
  label: string
  aliases?: string[]
  essential: string[]
  optional?: string[]
}

export interface SeedDomainData {
  domain: CandidateDomain
  label: string
  roles: SeedRole[]
}

export const DOMAIN_LABELS: Record<CandidateDomain, string> = {
  technology: 'Technology & IT',
  engineering: 'Engineering',
  healthcare: 'Healthcare & Life Sciences',
  finance: 'Finance & Accounting',
  business: 'Business & Management',
  creative: 'Creative & Design',
  media_communications: 'Media & Communications',
  education: 'Education & Training',
  research: 'Research & Academia',
  operations: 'Operations & Supply Chain',
  hospitality: 'Hospitality & Tourism',
  public_sector: 'Public Sector & Social',
  skilled_trades: 'Skilled Trades & Technical',
  general: 'General / Cross-functional',
}

// Transversal (soft) skills relevant to virtually every fresh-grad role.
// Appended after role-specific skills so candidates can always self-select.
export const TRANSVERSAL_SKILLS: string[] = [
  'Communication',
  'Teamwork',
  'Problem Solving',
  'Time Management',
  'Adaptability',
  'Critical Thinking',
  'Self-Learning',
  'Attention to Detail',
]

export const SKILL_SEED: SeedDomainData[] = [
  {
    domain: 'technology',
    label: DOMAIN_LABELS.technology,
    roles: [
      {
        id: 'software_engineer',
        label: 'Software Engineer',
        aliases: ['developer', 'programmer', 'software developer', 'swe'],
        essential: ['Programming Fundamentals', 'Data Structures & Algorithms', 'Version Control (Git)', 'Debugging', 'Web Development', 'Databases (SQL)'],
        optional: ['Cloud (AWS/Azure/GCP)', 'Docker', 'REST APIs', 'Unit Testing'],
      },
      {
        id: 'data_analyst',
        label: 'Data Analyst',
        aliases: ['data analytics', 'business intelligence', 'bi analyst'],
        essential: ['SQL', 'Data Visualization', 'Spreadsheet Analysis (Excel)', 'Statistics', 'Python or R', 'Data Cleaning'],
        optional: ['Power BI / Tableau', 'Machine Learning Basics'],
      },
      {
        id: 'it_support',
        label: 'IT Support / Helpdesk',
        aliases: ['technical support', 'helpdesk', 'system support'],
        essential: ['Troubleshooting', 'Operating Systems', 'Networking Basics', 'Customer Service', 'Hardware Setup', 'Ticketing Systems'],
        optional: ['Active Directory', 'Scripting'],
      },
    ],
  },
  {
    domain: 'engineering',
    label: DOMAIN_LABELS.engineering,
    roles: [
      {
        id: 'mechanical_engineer',
        label: 'Mechanical Engineer',
        aliases: ['mechanical', 'mech engineer'],
        essential: ['CAD Modelling', 'Thermodynamics', 'Material Science', 'Technical Drawing', 'Project Documentation', 'Problem Solving'],
        optional: ['FEA Simulation', 'Manufacturing Processes'],
      },
      {
        id: 'electrical_engineer',
        label: 'Electrical Engineer',
        aliases: ['electrical', 'electronics engineer'],
        essential: ['Circuit Design', 'Embedded Systems', 'Electronics', 'Microcontrollers', 'Schematic Reading', 'Measurement & Testing'],
        optional: ['PCB Design', 'Power Systems'],
      },
      {
        id: 'civil_engineer',
        label: 'Civil Engineer',
        aliases: ['civil', 'structural engineer'],
        essential: ['Structural Analysis', 'AutoCAD', 'Site Surveying', 'Construction Materials', 'Project Estimation', 'Technical Reporting'],
        optional: ['BIM / Revit', 'Geotechnical Basics'],
      },
    ],
  },
  {
    domain: 'healthcare',
    label: DOMAIN_LABELS.healthcare,
    roles: [
      {
        id: 'nurse',
        label: 'Registered Nurse',
        aliases: ['nursing', 'staff nurse'],
        essential: ['Patient Care', 'Clinical Assessment', 'Medication Administration', 'Vital Signs Monitoring', 'Medical Documentation', 'Infection Control'],
        optional: ['Emergency Response', 'Patient Education'],
      },
      {
        id: 'dietitian',
        label: 'Dietitian / Nutritionist',
        aliases: ['nutritionist', 'dietetics'],
        essential: ['Nutrition Assessment', 'Meal Planning', 'Patient Communication', 'Dietary Counselling', 'Health Education', 'Clinical Documentation'],
        optional: ['Community Nutrition', 'Food Service Management'],
      },
      {
        id: 'pharmacist',
        label: 'Pharmacist',
        aliases: ['pharmacy'],
        essential: ['Pharmacology', 'Dispensing', 'Drug Interactions', 'Patient Counselling', 'Inventory Management', 'Regulatory Compliance'],
        optional: ['Clinical Pharmacy', 'Compounding'],
      },
    ],
  },
  {
    domain: 'finance',
    label: DOMAIN_LABELS.finance,
    roles: [
      {
        id: 'accountant',
        label: 'Accountant',
        aliases: ['accounting', 'account executive'],
        essential: ['Financial Accounting', 'Bookkeeping', 'Taxation Basics', 'Spreadsheet Analysis (Excel)', 'Accounting Software', 'Reconciliation'],
        optional: ['Auditing', 'Financial Reporting'],
      },
      {
        id: 'financial_analyst',
        label: 'Financial Analyst',
        aliases: ['finance analyst', 'investment analyst'],
        essential: ['Financial Modelling', 'Valuation', 'Spreadsheet Analysis (Excel)', 'Data Analysis', 'Financial Statements', 'Forecasting'],
        optional: ['Power BI / Tableau', 'SQL'],
      },
      {
        id: 'auditor',
        label: 'Auditor',
        aliases: ['audit', 'internal auditor'],
        essential: ['Internal Controls', 'Risk Assessment', 'Audit Documentation', 'Compliance', 'Analytical Review', 'Attention to Detail'],
        optional: ['IFRS / GAAP', 'Fraud Detection'],
      },
    ],
  },
  {
    domain: 'business',
    label: DOMAIN_LABELS.business,
    roles: [
      {
        id: 'business_analyst',
        label: 'Business Analyst',
        aliases: ['ba', 'business analysis'],
        essential: ['Requirements Gathering', 'Process Mapping', 'Data Analysis', 'Stakeholder Management', 'Documentation', 'Presentation Skills'],
        optional: ['SQL', 'Agile / Scrum'],
      },
      {
        id: 'hr_executive',
        label: 'Human Resources Executive',
        aliases: ['hr', 'human resources', 'people operations'],
        essential: ['Recruitment', 'Employee Relations', 'HR Administration', 'Interviewing', 'Onboarding', 'Payroll Basics'],
        optional: ['HRIS Systems', 'Labour Law Basics'],
      },
      {
        id: 'sales_executive',
        label: 'Sales Executive',
        aliases: ['sales', 'account manager', 'business development'],
        essential: ['Lead Generation', 'Client Relationship Management', 'Negotiation', 'Product Knowledge', 'CRM Software', 'Presentation Skills'],
        optional: ['Cold Calling', 'Sales Forecasting'],
      },
    ],
  },
  {
    domain: 'creative',
    label: DOMAIN_LABELS.creative,
    roles: [
      {
        id: 'graphic_designer',
        label: 'Graphic Designer',
        aliases: ['designer', 'visual designer'],
        essential: ['Adobe Photoshop', 'Adobe Illustrator', 'Typography', 'Layout Design', 'Branding', 'Visual Communication'],
        optional: ['Motion Graphics', 'UI Design'],
      },
      {
        id: 'content_writer',
        label: 'Content Writer',
        aliases: ['copywriter', 'writer', 'content creator'],
        essential: ['Copywriting', 'Editing & Proofreading', 'SEO Writing', 'Research', 'Storytelling', 'Content Strategy'],
        optional: ['WordPress', 'Social Media Copy'],
      },
      {
        id: 'video_editor',
        label: 'Video Editor',
        aliases: ['videographer', 'motion designer'],
        essential: ['Video Editing', 'Adobe Premiere', 'Storyboarding', 'Color Grading', 'Audio Editing', 'Motion Graphics'],
        optional: ['After Effects', 'Cinematography'],
      },
    ],
  },
  {
    domain: 'media_communications',
    label: DOMAIN_LABELS.media_communications,
    roles: [
      {
        id: 'marketing_executive',
        label: 'Marketing Executive',
        aliases: ['marketing', 'digital marketer', 'marketing assistant'],
        essential: ['Digital Marketing', 'Social Media Management', 'Content Creation', 'Market Research', 'Campaign Planning', 'Analytics'],
        optional: ['SEO/SEM', 'Email Marketing'],
      },
      {
        id: 'pr_executive',
        label: 'Public Relations Executive',
        aliases: ['pr', 'public relations', 'communications executive'],
        essential: ['Media Relations', 'Press Release Writing', 'Event Coordination', 'Communication Strategy', 'Stakeholder Engagement', 'Copywriting'],
        optional: ['Crisis Communication', 'Brand Management'],
      },
      {
        id: 'journalist',
        label: 'Journalist',
        aliases: ['reporter', 'news writer'],
        essential: ['News Writing', 'Interviewing', 'Research', 'Editing', 'Fact-Checking', 'Storytelling'],
        optional: ['Photography', 'Video Reporting'],
      },
    ],
  },
  {
    domain: 'education',
    label: DOMAIN_LABELS.education,
    roles: [
      {
        id: 'teacher',
        label: 'Teacher',
        aliases: ['educator', 'school teacher'],
        essential: ['Lesson Planning', 'Classroom Management', 'Curriculum Design', 'Student Assessment', 'Subject Expertise', 'Communication'],
        optional: ['Educational Technology', 'Special Needs Support'],
      },
      {
        id: 'tutor',
        label: 'Tutor',
        aliases: ['private tutor', 'academic coach'],
        essential: ['Subject Expertise', 'One-on-One Instruction', 'Lesson Preparation', 'Student Motivation', 'Progress Tracking', 'Patience'],
        optional: ['Online Teaching', 'Exam Preparation'],
      },
      {
        id: 'instructional_designer',
        label: 'Instructional Designer',
        aliases: ['learning designer', 'e-learning developer'],
        essential: ['Curriculum Development', 'Learning Objectives', 'Content Creation', 'E-Learning Tools', 'Assessment Design', 'Instructional Strategy'],
        optional: ['LMS Platforms', 'Multimedia Design'],
      },
    ],
  },
  {
    domain: 'research',
    label: DOMAIN_LABELS.research,
    roles: [
      {
        id: 'research_assistant',
        label: 'Research Assistant',
        aliases: ['ra', 'research intern'],
        essential: ['Literature Review', 'Data Collection', 'Statistical Analysis', 'Academic Writing', 'Experiment Design', 'Referencing'],
        optional: ['SPSS / R', 'Lab Techniques'],
      },
      {
        id: 'lab_researcher',
        label: 'Laboratory Researcher',
        aliases: ['lab analyst', 'research scientist'],
        essential: ['Laboratory Techniques', 'Experiment Design', 'Data Recording', 'Safety Protocols', 'Analytical Instruments', 'Report Writing'],
        optional: ['Microscopy', 'Sample Preparation'],
      },
      {
        id: 'policy_researcher',
        label: 'Policy Researcher',
        aliases: ['research officer', 'social researcher'],
        essential: ['Qualitative Research', 'Quantitative Analysis', 'Report Writing', 'Policy Analysis', 'Data Interpretation', 'Literature Review'],
        optional: ['Survey Design', 'Stakeholder Interviews'],
      },
    ],
  },
  {
    domain: 'operations',
    label: DOMAIN_LABELS.operations,
    roles: [
      {
        id: 'operations_executive',
        label: 'Operations Executive',
        aliases: ['operations', 'ops executive'],
        essential: ['Process Improvement', 'Scheduling', 'Inventory Management', 'Coordination', 'Reporting', 'Problem Solving'],
        optional: ['ERP Systems', 'Lean / Six Sigma'],
      },
      {
        id: 'supply_chain_analyst',
        label: 'Supply Chain Analyst',
        aliases: ['supply chain', 'procurement analyst'],
        essential: ['Demand Planning', 'Inventory Analysis', 'Logistics Coordination', 'Data Analysis', 'Spreadsheet Analysis (Excel)', 'Vendor Management'],
        optional: ['SAP', 'Forecasting'],
      },
      {
        id: 'logistics_coordinator',
        label: 'Logistics Coordinator',
        aliases: ['logistics', 'warehouse coordinator'],
        essential: ['Shipment Scheduling', 'Warehouse Coordination', 'Documentation', 'Vendor Communication', 'Tracking Systems', 'Problem Solving'],
        optional: ['Customs Procedures', 'Route Planning'],
      },
    ],
  },
  {
    domain: 'hospitality',
    label: DOMAIN_LABELS.hospitality,
    roles: [
      {
        id: 'hotel_trainee',
        label: 'Hotel Management Trainee',
        aliases: ['hotel management', 'front office'],
        essential: ['Guest Service', 'Front Office Operations', 'Reservation Systems', 'Communication', 'Problem Solving', 'Teamwork'],
        optional: ['Revenue Management', 'Housekeeping Operations'],
      },
      {
        id: 'event_coordinator',
        label: 'Event Coordinator',
        aliases: ['event planner', 'events executive'],
        essential: ['Event Planning', 'Vendor Management', 'Budgeting', 'Scheduling', 'Client Communication', 'On-site Coordination'],
        optional: ['Marketing', 'Logistics'],
      },
      {
        id: 'fnb_supervisor',
        label: 'Food & Beverage Supervisor',
        aliases: ['f&b', 'restaurant supervisor'],
        essential: ['Customer Service', 'Team Supervision', 'Inventory Control', 'Food Safety', 'POS Systems', 'Scheduling'],
        optional: ['Menu Knowledge', 'Cost Control'],
      },
    ],
  },
  {
    domain: 'public_sector',
    label: DOMAIN_LABELS.public_sector,
    roles: [
      {
        id: 'policy_analyst',
        label: 'Policy Analyst',
        aliases: ['policy officer', 'government analyst'],
        essential: ['Policy Analysis', 'Research', 'Report Writing', 'Data Interpretation', 'Stakeholder Engagement', 'Critical Thinking'],
        optional: ['Public Administration', 'Statistical Analysis'],
      },
      {
        id: 'social_worker',
        label: 'Social Worker',
        aliases: ['social work', 'community worker'],
        essential: ['Case Management', 'Client Assessment', 'Counselling', 'Community Outreach', 'Documentation', 'Empathy'],
        optional: ['Crisis Intervention', 'Resource Coordination'],
      },
      {
        id: 'public_admin_officer',
        label: 'Public Administration Officer',
        aliases: ['admin officer', 'government officer'],
        essential: ['Administrative Operations', 'Document Management', 'Public Service', 'Policy Implementation', 'Communication', 'Record Keeping'],
        optional: ['Budgeting', 'Compliance'],
      },
    ],
  },
  {
    domain: 'skilled_trades',
    label: DOMAIN_LABELS.skilled_trades,
    roles: [
      {
        id: 'electrician',
        label: 'Electrician',
        aliases: ['electrical technician', 'wireman'],
        essential: ['Electrical Wiring', 'Circuit Installation', 'Safety Standards', 'Blueprint Reading', 'Troubleshooting', 'Hand & Power Tools'],
        optional: ['Industrial Wiring', 'Maintenance'],
      },
      {
        id: 'automotive_technician',
        label: 'Automotive Technician',
        aliases: ['mechanic', 'auto technician'],
        essential: ['Engine Diagnostics', 'Vehicle Maintenance', 'Mechanical Repair', 'Tool Handling', 'Safety Procedures', 'Troubleshooting'],
        optional: ['Electrical Systems', 'Auto AC Systems'],
      },
      {
        id: 'welder',
        label: 'Welder / Fabricator',
        aliases: ['fabricator', 'welding technician'],
        essential: ['Welding (MIG/TIG/Arc)', 'Metal Fabrication', 'Blueprint Reading', 'Measurement', 'Safety Standards', 'Tool Handling'],
        optional: ['Pipe Welding', 'Quality Inspection'],
      },
    ],
  },
  {
    domain: 'general',
    label: DOMAIN_LABELS.general,
    roles: [
      {
        id: 'management_trainee',
        label: 'Management Trainee',
        aliases: ['graduate trainee', 'management associate'],
        essential: ['Communication', 'Teamwork', 'Problem Solving', 'Time Management', 'Adaptability', 'Leadership'],
        optional: ['Project Coordination', 'Data Analysis'],
      },
      {
        id: 'admin_assistant',
        label: 'Administrative Assistant',
        aliases: ['admin', 'office assistant', 'secretary'],
        essential: ['Office Administration', 'Document Management', 'Scheduling', 'Communication', 'Spreadsheet Analysis (Excel)', 'Record Keeping'],
        optional: ['Customer Service', 'Data Entry'],
      },
      {
        id: 'customer_service',
        label: 'Customer Service Executive',
        aliases: ['customer support', 'client service'],
        essential: ['Customer Service', 'Communication', 'Problem Solving', 'CRM Software', 'Conflict Resolution', 'Patience'],
        optional: ['Call Handling', 'Complaint Management'],
      },
    ],
  },
]

// ─── Getters ────────────────────────────────────────────────────────
const seedByDomain = new Map<CandidateDomain, SeedDomainData>(
  SKILL_SEED.map((d) => [d.domain, d])
)

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/\bc\+\+\b/g, 'cpp')
    .replace(/\bc#\b/g, 'csharp')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
}

// Stable canonical id for a skill label, shared across roles/domains so
// candidate and company graphs can align on the same capability.
export function skillTaxonomyId(label: string): string {
  return `seed:${slugify(label)}`
}

export function domainOptions(): Array<{ id: CandidateDomain; label: string }> {
  return SKILL_SEED.map((d) => ({ id: d.domain, label: d.label }))
}

export function getDomain(domain: CandidateDomain): SeedDomainData | undefined {
  return seedByDomain.get(domain)
}

export function roleOptions(domain: CandidateDomain): Array<{ id: string; label: string }> {
  return (seedByDomain.get(domain)?.roles ?? []).map((r) => ({ id: r.id, label: r.label }))
}

export function getRole(domain: CandidateDomain, roleId: string): SeedRole | undefined {
  return seedByDomain.get(domain)?.roles.find((r) => r.id === roleId)
}

// Resolve a role from a loose query (id, label, or alias). Falls back to
// scanning all domains so a target direction stated before the domain is
// confirmed can still be matched.
export function resolveRole(
  query: string,
  domain?: CandidateDomain | null
): { domain: CandidateDomain; role: SeedRole } | null {
  const q = slugify(query)
  if (!q) return null
  const domainsToScan = domain && seedByDomain.has(domain)
    ? [seedByDomain.get(domain)!]
    : SKILL_SEED
  for (const d of domainsToScan) {
    for (const role of d.roles) {
      if (role.id === query || slugify(role.label) === q) return { domain: d.domain, role }
      if ((role.aliases ?? []).some((a) => slugify(a) === q)) return { domain: d.domain, role }
    }
  }
  // Looser contains-match as a fallback.
  for (const d of domainsToScan) {
    for (const role of d.roles) {
      const hay = [role.label, ...(role.aliases ?? [])].map(slugify).join(' ')
      if (hay.includes(q) || q.includes(slugify(role.label))) return { domain: d.domain, role }
    }
  }
  return null
}

export interface SeedSkillOption {
  id: string
  label: string
  essential: boolean
}

// Skills for a role: essentials first, then optionals, then transversal
// soft skills (de-duplicated). Used to build the Phase 1 checklist.
export function roleSkillOptions(domain: CandidateDomain, roleId: string): SeedSkillOption[] {
  const role = getRole(domain, roleId)
  if (!role) return TRANSVERSAL_SKILLS.map((label) => ({ id: skillTaxonomyId(label), label, essential: false }))

  const seen = new Set<string>()
  const out: SeedSkillOption[] = []
  const push = (label: string, essential: boolean) => {
    const id = skillTaxonomyId(label)
    if (seen.has(id)) return
    seen.add(id)
    out.push({ id, label, essential })
  }
  role.essential.forEach((s) => push(s, true))
  ;(role.optional ?? []).forEach((s) => push(s, false))
  TRANSVERSAL_SKILLS.forEach((s) => push(s, false))
  return out
}
