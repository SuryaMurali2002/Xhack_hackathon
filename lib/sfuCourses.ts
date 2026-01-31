import axios from "axios"

const SFU_API_BASE = "https://api.sfucourses.com/v1"

/** SFU course outline from /v1/rest/outlines (description, prerequisites, etc.). */
export type CourseOutline = {
  dept: string
  number: string
  title: string
  description?: string
  prerequisites?: string
  corequisites?: string
  designation?: string
  degreeLevel?: string
  units?: string
  notes?: string
  [k: string]: unknown
}

/** Single SFU search; returns up to limit courses. */
export async function searchSFUCourses(keyword: string, limit = 8) {
  if (!keyword?.trim()) return []
  try {
    const res = await axios.get(
      `${SFU_API_BASE}/search?q=${encodeURIComponent(keyword.trim())}`,
      { timeout: 8000 }
    )
    return (res.data?.courses ?? []).slice(0, limit)
  } catch {
    return []
  }
}

/** Course-like shape from SFU API for deduping. */
type CourseLike = { id?: string; code?: string; title?: string; name?: string; dept?: string; number?: string; [k: string]: unknown }

function courseKey(c: CourseLike): string {
  const code = c.code ?? c.id ?? ""
  const title = (c.title ?? c.name ?? "").toString()
  return `${code}-${title}`.toLowerCase() || JSON.stringify(c)
}

/** Extract (dept, number) from a search result for outline fetch. */
function parseDeptNumber(c: CourseLike): { dept: string; number: string } | null {
  const dept = c.dept ? String(c.dept).trim() : ""
  const number = c.number ? String(c.number).trim() : ""
  if (dept && number) return { dept: dept.toUpperCase(), number }
  const code = (c.code ?? c.id ?? "").toString().trim()
  if (!code) return null
  const parts = code.split(/\s+/)
  if (parts.length >= 2) return { dept: parts[0].toUpperCase(), number: parts[1] }
  if (parts.length === 1 && /^[A-Za-z]+\d+$/.test(parts[0])) {
    const match = parts[0].match(/^([A-Za-z]+)(\d+)$/)
    if (match) return { dept: match[1].toUpperCase(), number: match[2] }
  }
  return null
}

/**
 * Search SFU by skill keywords (from target role), then fetch full outlines for the courses returned.
 * The courses that pop up from the search are the target-role-relevant SFU courses.
 */
export async function fetchOutlinesBySkillKeywords(
  keywords: string[],
  maxCourses = 20
): Promise<CourseOutline[]> {
  if (keywords.length === 0) return []

  const searchResults = await Promise.all(
    keywords.map((q) => searchSFUCourses(q, 8))
  )

  const wanted = new Set<string>()
  for (const list of searchResults) {
    for (const c of list as CourseLike[]) {
      const dn = parseDeptNumber(c)
      if (dn) wanted.add(`${dn.dept} ${dn.number}`.toLowerCase())
    }
  }
  if (wanted.size === 0) return []

  const uniqueDepts = Array.from(
    new Set(
      Array.from(wanted).map((s) => s.split(/\s+/)[0]?.toUpperCase()).filter(Boolean)
    )
  ).slice(0, 5)

  const outlineLists = await Promise.all(
    uniqueDepts.map((d) => fetchOutlinesByDepartment(d))
  )

  const seen = new Set<string>()
  const merged: CourseOutline[] = []
  for (const list of outlineLists) {
    for (const o of list) {
      const key = `${o.dept} ${o.number}`.toLowerCase()
      if (wanted.has(key) && !seen.has(key)) {
        seen.add(key)
        merged.push(o)
        if (merged.length >= maxCourses) return merged
      }
    }
  }
  return merged
}

/**
 * Fetch full course outlines for a department from SFU outlines API.
 * Returns courses with description, prerequisites, etc. for better matching.
 */
export async function fetchOutlinesByDepartment(dept: string): Promise<CourseOutline[]> {
  if (!dept?.trim()) return []
  const deptCode = dept.trim().toLowerCase()
  try {
    const res = await axios.get(`${SFU_API_BASE}/rest/outlines`, {
      params: { dept: deptCode },
      timeout: 10000,
    })
    const list = Array.isArray(res.data) ? res.data : []
    return list.map((o: Record<string, unknown>) => ({
      dept: String(o.dept ?? ""),
      number: String(o.number ?? ""),
      title: String(o.title ?? ""),
      description: o.description ? String(o.description) : undefined,
      prerequisites: o.prerequisites ? String(o.prerequisites) : undefined,
      corequisites: o.corequisites ? String(o.corequisites) : undefined,
      designation: o.designation ? String(o.designation) : undefined,
      degreeLevel: o.degreeLevel ? String(o.degreeLevel) : undefined,
      units: o.units ? String(o.units) : undefined,
      notes: o.notes ? String(o.notes) : undefined,
    }))
  } catch {
    return []
  }
}

/** Slim course payload for the LLM prompt (reduces tokens). */
export type SlimCourse = {
  dept: string
  number: string
  title: string
  description?: string
}

const DEFAULT_DESC_MAX_LEN = 150

/**
 * Trim outlines to dept, number, title, and truncated description for smaller prompts.
 */
export function slimOutlinesForPrompt(
  outlines: CourseOutline[],
  maxDescLen = DEFAULT_DESC_MAX_LEN
): SlimCourse[] {
  return outlines.map((o) => ({
    dept: o.dept,
    number: o.number,
    title: o.title,
    description: o.description
      ? o.description.slice(0, maxDescLen) + (o.description.length > maxDescLen ? "…" : "")
      : undefined,
  }))
}

/**
 * Fetch outlines for multiple department codes, merge and dedupe, cap at maxCourses.
 * Limits to first maxDepts to avoid huge payloads and token limits.
 */
export async function fetchOutlinesForRoadmap(
  departmentCodes: string[],
  maxCourses = 20,
  maxDepts = 3
): Promise<CourseOutline[]> {
  const uniqueDepts = Array.from(new Set(departmentCodes.map((d) => d.trim().toUpperCase()).filter(Boolean)))
  if (uniqueDepts.length === 0) return []

  const deptsToFetch = uniqueDepts.slice(0, maxDepts)
  const results = await Promise.all(
    deptsToFetch.map((d) => fetchOutlinesByDepartment(d))
  )

  const seen = new Set<string>()
  const merged: CourseOutline[] = []
  for (const list of results) {
    for (const o of list) {
      const code = `${o.dept} ${o.number}`.trim()
      const key = code.toLowerCase()
      if (key && !seen.has(key)) {
        seen.add(key)
        merged.push(o)
        if (merged.length >= maxCourses) break
      }
    }
    if (merged.length >= maxCourses) break
  }
  return merged
}

/**
 * Search SFU with multiple keywords (e.g. department code, major, target role),
 * merge and dedupe, return up to maxCourses for the roadmap.
 * Used as fallback when outline API returns no data.
 */
export async function searchSFUCoursesForRoadmap(queries: string[], maxCourses = 18) {
  const results = await Promise.all(
    queries.map((q) => searchSFUCourses(q, 8))
  )
  const seen = new Set<string>()
  const merged: CourseLike[] = []
  for (const list of results) {
    for (const c of list) {
      const key = courseKey(c)
      if (key && !seen.has(key)) {
        seen.add(key)
        merged.push(c)
        if (merged.length >= maxCourses) break
      }
    }
    if (merged.length >= maxCourses) break
  }
  return merged
}
