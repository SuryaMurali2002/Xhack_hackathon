/**
 * Local (regex) extraction from SFU advising transcript text.
 * Production-style: normalize text, multiple robust patterns, department whitelist.
 * No character cap — scans full transcript. LLM is only used for major/credits fallback.
 */

/** Step 1 — Normalize: uppercase + collapse whitespace for consistent regex matching. */
function normalizeForCourseExtraction(text: string): string {
  return text.toUpperCase().replace(/\s+/g, " ").trim()
}

/**
 * Step 2–4 — Robust patterns for SFU course codes.
 * Matches: CMPT 225, CMPT225, CMPT-225, with grade or transfer as completed signal.
 */

/** Primary: course code + optional units/term + letter grade. Handles "CMPT 120 3.0 B+" and "CMPT 120 3.0 1231 B+". */
const COURSE_AND_GRADE_RE = /\b([A-Z]{3,4})[- ]?(\d{3}[A-Z]?)(?:\s+[\d.]+)?(?:\s+\d+)?\s+([A-F][+-]?|CR)(?=\s|$)/g

/** Transfer completed/credit: e.g. "CMPT 125 3.0 B TR-C". Grade may be B+ so use lookahead. */
const COURSE_AND_TRANSFER_RE = /\b([A-Z]{3,4})[- ]?(\d{3}[A-Z]?)\s+[\d.]+\s+[A-F][+-]?(?=\s+TR-[CT])/g

/** Fallback: course code only (3–4 letter dept, optional - or space, 3 digits optional letter). Use only if nearby grade/TR. */
const COURSE_CODE_ONLY_RE = /\b([A-Z]{3,4})[- ]?(\d{3}[A-Z]?)\b/g

/** Step 6 — Whitelist of valid SFU department codes. Filters out GPA, TERM, etc. */
const VALID_DEPTS = new Set([
  "ARCH", "BISC", "BUS", "CA", "CHEM", "CMNS", "CMPT", "EDUC", "ENGL", "ENSC", "GEOG", "HUM",
  "IAT", "MACM", "MATH", "PHIL", "PHYS", "POL", "PSYC", "STAT",
])

function isWhitelistedDept(dept: string): boolean {
  return VALID_DEPTS.has(dept.toUpperCase())
}

const DEBUG_TRANSCRIPT = process.env.DEBUG_TRANSCRIPT === "true" || process.env.NODE_ENV === "development"

/**
 * Extract all completed course codes from full transcript text.
 * Uses normalized text, grade-inclusive and transfer patterns, and dept whitelist.
 */
export function extractCompletedCoursesFromTranscript(rawText: string): { code: string }[] {
  const seen = new Set<string>()
  const text = normalizeForCourseExtraction(rawText)

  if (DEBUG_TRANSCRIPT) {
    console.log("[transcriptParser] rawText.length:", rawText.length)
    console.log("[transcriptParser] normalized text.length:", text.length)
    console.log("[transcriptParser] normalized sample (first 400 chars):", JSON.stringify(text.slice(0, 400)))
  }

  // Pattern 1: Course + grade (A–F, CR)
  const fromGrade: string[] = []
  let m: RegExpExecArray | null
  COURSE_AND_GRADE_RE.lastIndex = 0
  while ((m = COURSE_AND_GRADE_RE.exec(text)) !== null) {
    const dept = m[1].toUpperCase()
    const num = m[2]
    const code = `${dept} ${num}`
    if (isWhitelistedDept(dept)) {
      seen.add(code)
      fromGrade.push(code)
    } else if (DEBUG_TRANSCRIPT) {
      console.log("[transcriptParser] pattern1 skipped (not whitelisted):", dept, num)
    }
  }
  if (DEBUG_TRANSCRIPT) console.log("[transcriptParser] pattern1 (course+grade) matches:", fromGrade.length, fromGrade.slice(0, 15))

  // Pattern 2: Course + transfer (TR-C, TR-T)
  const fromTransfer: string[] = []
  COURSE_AND_TRANSFER_RE.lastIndex = 0
  while ((m = COURSE_AND_TRANSFER_RE.exec(text)) !== null) {
    const dept = m[1].toUpperCase()
    const num = m[2]
    const code = `${dept} ${num}`
    if (isWhitelistedDept(dept)) {
      seen.add(code)
      fromTransfer.push(code)
    }
  }
  if (DEBUG_TRANSCRIPT) console.log("[transcriptParser] pattern2 (transfer) matches:", fromTransfer.length, fromTransfer.slice(0, 10))

  // Pattern 3: Course code only, but only if context has a real grade/transfer (avoid GPA, TERM, and STUDENT GROUP "CF PREQ")
  // Require grade followed by space+digit (e.g. "B+ 9.99") or TR-C/TR-T so we don't match lone "C" in "CF PREQ" or "CMPT"
  const fromFallback: string[] = []
  const realGradeOrTransfer = /(?:[A-F][+-]?|CR)\s+[\d.]|\bTR-[CT]\b/
  const studentGroupOrPreq = /CF\s+PREQ|PREQ\s+SET|STUDENT\s+GROUP|CS\d+\s+-/i
  COURSE_CODE_ONLY_RE.lastIndex = 0
  while ((m = COURSE_CODE_ONLY_RE.exec(text)) !== null) {
    const dept = m[1].toUpperCase()
    const num = m[2]
    if (!isWhitelistedDept(dept)) continue
    if (seen.has(`${dept} ${num}`)) continue
    const start = Math.max(0, m.index - 30)
    const end = Math.min(text.length, m.index + m[0].length + 50)
    const context = text.slice(start, end)
    if (studentGroupOrPreq.test(context)) continue
    const hasRealGrade = realGradeOrTransfer.test(context)
    if (hasRealGrade) {
      seen.add(`${dept} ${num}`)
      fromFallback.push(`${dept} ${num}`)
    }
  }
  if (DEBUG_TRANSCRIPT) console.log("[transcriptParser] pattern3 (fallback) added:", fromFallback.length, fromFallback.slice(0, 10))

  const result = Array.from(seen, (code) => ({ code })).sort((a, b) => a.code.localeCompare(b.code))
  if (DEBUG_TRANSCRIPT) {
    console.log("[transcriptParser] total unique courses:", result.length)
    console.log("[transcriptParser] courses:", result.map((r) => r.code).join(", "))
  }
  return result
}

/**
 * Extract student major from transcript text (e.g. "Major - Computing Science", "BSC Computing Science").
 * Uses raw text so casing can be preserved for display.
 */
export function extractMajorFromTranscript(rawText: string): string | null {
  const majorMatch = rawText.match(/\bMajor\s*-\s*([^\n\r]+)/i)
  if (majorMatch) {
    const s = majorMatch[1].replace(/\s*(CMPT|STAT|MATH|BUS|APSC|DCMPT|MAJ|MIN)\w*\s*\d*\s*$/i, "").trim()
    if (s) return s
  }
  const bscMatch = rawText.match(/\bBSC\s+([A-Za-z\s]+?)(?:\s+WQB|\s+Active|\n)/i)
  if (bscMatch) return bscMatch[1].trim()
  const programMatch = rawText.match(/Program:\s*Bachelor of Science\s*(?:\n|Active)/i)
  if (programMatch) return "Computing Science"
  return null
}

/**
 * Extract total credits completed (Total Units or Passed total).
 */
export function extractTotalCreditsFromTranscript(rawText: string): number | null {
  const totalMatch = rawText.match(/Total\s+Units:\s*(\d+(?:\.\d+)?)/i)
  if (totalMatch) return parseFloat(totalMatch[1])
  const passedMatch = rawText.match(/Passed:\s*[\d.]+\s+[\d.]+\s+(\d+(?:\.\d+)?)/i)
  if (passedMatch) return parseFloat(passedMatch[1])
  return null
}

export type ParsedTranscriptLocal = {
  student_major: string
  completed_courses: { code: string }[]
  total_credits_completed: number
}

/**
 * Parse transcript using only local extraction (no OpenAI).
 * Returns null if major could not be determined.
 */
export function parseTranscriptLocal(rawText: string): ParsedTranscriptLocal | null {
  const completed_courses = extractCompletedCoursesFromTranscript(rawText)
  const student_major = extractMajorFromTranscript(rawText)
  const total_credits_completed = extractTotalCreditsFromTranscript(rawText)

  if (!student_major) return null
  const credits = total_credits_completed != null ? total_credits_completed : 0

  return {
    student_major,
    completed_courses,
    total_credits_completed: credits,
  }
}
