import Groq from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function generateRoadmap(prompt: string): Promise<string> {
  const res = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  const content = res.choices[0]?.message?.content
  if (!content) throw new Error("Empty response from LLM")
  return content
}

/**
 * Uses the LLM to infer skill/keyword terms required for a target role.
 * Returns e.g. ["data analysis", "statistics", "visualization", "business", "SQL"] for Data Analyst.
 * These keywords are used to search SFU course outlines — courses that match are the relevant ones.
 */
export async function inferSkillKeywordsForRole(targetRole: string): Promise<string[]> {
  const prompt = `You are an academic advisor. For the target role below, list 6–10 short skill or knowledge keywords (phrases of 1–3 words) that someone in this role needs. These will be used to search a university course catalog, so use terms that appear in course titles/descriptions (e.g. data analysis, statistics, visualization, business, SQL, programming, machine learning, communication, reporting, economics).

Target role: ${targetRole}

Return ONLY a JSON array of strings, nothing else. Example: ["data analysis","statistics","visualization","business","SQL","programming"]`

  const raw = await generateRoadmap(prompt)
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
  try {
    const arr = JSON.parse(cleaned)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 10)
  } catch {
    return []
  }
}

/**
 * Uses the LLM to infer SFU-relevant department codes for a target role and major.
 * Kept for fallback when keyword-based outline fetch returns no data.
 */
export async function inferDepartmentCodesForRole(
  targetRole: string,
  major: string
): Promise<string[]> {
  const prompt = `You are an academic advisor for Simon Fraser University (SFU). SFU uses department codes like CMPT, STAT, ECON, MATH, MACM, BUS, BISC, etc.

Given:
- Target role: ${targetRole}
- Student's major: ${major}

List 4–8 SFU department codes that would be relevant for this target role. Include major and related departments (e.g. Data Analyst → STAT, CMPT, MATH, BUS, ECON).

Return ONLY a JSON array of strings. Example: ["STAT","CMPT","BUS"]`

  const raw = await generateRoadmap(prompt)
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
  try {
    const arr = JSON.parse(cleaned)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => String(s).trim())
      .filter(Boolean)
  } catch {
    return []
  }
}
