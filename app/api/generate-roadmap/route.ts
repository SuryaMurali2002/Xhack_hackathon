import { NextResponse } from "next/server"
import { UserProfileSchema } from "@/lib/validators"
import {
  searchSFUCoursesForRoadmap,
  fetchOutlinesForRoadmap,
  fetchOutlinesBySkillKeywords,
  slimOutlinesForPrompt,
} from "@/lib/sfuCourses"
import { fetchInternships } from "@/lib/adzuna"
import { generateRoadmap, inferSkillKeywordsForRole, inferDepartmentCodesForRole } from "@/lib/ai"
import type { UserProfile } from "@/lib/types"
import fallbackInternships from "@/lib/fallbackInternships.json"

function buildPrompt(
  profile: UserProfile,
  sfuCourseData: unknown[],
  internships: { title: string; company: string; location: string; url: string }[],
  weeks: number,
  usingOutlines: boolean
) {
  const deptNote = profile.departmentCode
    ? `\nDepartment code: ${profile.departmentCode}. Prioritize courses from this department when they fit.`
    : ""

  return `
You are an expert SFU academic advisor AND internship career coach.

Your job:
Create a ${weeks}-week internship preparation roadmap that tightly aligns:
- The student's MAJOR
- The TARGET ROLE
- Relevant SFU COURSES
- Practical PROJECTS
- Clear weekly ACTIONS

--------------------
STUDENT PROFILE
Major: ${profile.major}${deptNote}
Target Role: ${profile.targetRole}
Completed Courses: ${(profile.completedCourses ?? []).join(", ") || "None"}

--------------------
AVAILABLE SFU COURSE DATA
These are REAL SFU courses or outlines. You MUST prioritize these.

${usingOutlines
  ? `These entries are course outlines with short descriptions. Choose courses whose DESCRIPTION directly supports the week's skill.`
  : `These entries are course search results. Choose courses that clearly support the week's skill.`}

${JSON.stringify(sfuCourseData)}

--------------------
INTERNSHIPS (include TOP 5 exactly as provided)
${JSON.stringify(internships)}

--------------------
PLANNING PRINCIPLES (FOLLOW STRICTLY)

1) Start with FOUNDATION skills, then move to INTERMEDIATE, then ADVANCED.
2) Prefer SFU courses from departments that match the MAJOR.
3) Prefer courses that clearly support the TARGET ROLE.
4) Do NOT repeat the same SFU course across weeks.
5) If no SFU course fits a skill, leave "sfuCourse" empty and use "resource".
6) Each week must feel like a logical step from the previous week.
7) Projects must directly practice the week's skill AND resemble real internship work.
8) Prefer 1xx/2xx courses in the first 30% of weeks. Prefer 3xx/4xx courses in later weeks.

--------------------
OUTPUT FORMAT (RETURN ONLY VALID JSON)

{
  "weeks": [
    {
      "week": 1,
      "skill": "",
      "sfuCourse": "",
      "project": "",
      "resource": "",
      "action": ""
    }
  ],
  "internships": []
}

--------------------
HOW TO THINK (IMPORTANT)

Step 1: Infer 8–12 core skills required for the TARGET ROLE.
Step 2: Order them from beginner → advanced.
Step 3: For each skill:
  - Check SFU courses that teach it.
  - Prefer MAJOR-relevant department courses.
  - Assign ONE unique SFU course if applicable.
Step 4: Create a small project that proves that skill.
Step 5: Add one concrete action (apply, resume update, networking, mock interview, etc.)

--------------------
INTERNSHIPS RULE
Copy the TOP 5 internships into the "internships" array exactly as provided.

Return JSON only. No markdown. No explanations.
`
}

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not set. Add it to .env.local and restart the dev server." },
        { status: 503 }
      )
    }

    const body = await req.json()
    const profile = UserProfileSchema.parse(body)

    const keywords = await inferSkillKeywordsForRole(profile.targetRole)
    const sfuQueries: string[] = [...keywords]
    if (profile.major?.trim()) sfuQueries.push(profile.major.trim())
    if (profile.targetRole?.trim()) sfuQueries.push(profile.targetRole.trim())
    if (sfuQueries.length === 0) sfuQueries.push(profile.targetRole || "course")

    const [outlines, internshipsRaw] = await Promise.all([
      keywords.length > 0
        ? fetchOutlinesBySkillKeywords(keywords, 20)
        : Promise.resolve([]),
      fetchInternships(profile.targetRole, "Canada"),
    ])

    let sfuCourseData: unknown[]
    let usingOutlines = outlines.length > 0
    if (usingOutlines) {
      sfuCourseData = slimOutlinesForPrompt(outlines, 150)
    } else {
      const departmentCodes: string[] = []
      if (profile.departmentCode?.trim()) departmentCodes.push(profile.departmentCode.trim())
      const inferredDepts = await inferDepartmentCodesForRole(profile.targetRole, profile.major)
      inferredDepts.forEach((code) => departmentCodes.push(code))
      if (departmentCodes.length > 0) {
        const fallbackOutlines = await fetchOutlinesForRoadmap(departmentCodes, 20, 3)
        if (fallbackOutlines.length > 0) {
          sfuCourseData = slimOutlinesForPrompt(fallbackOutlines, 150)
          usingOutlines = true
        } else {
          sfuCourseData = await searchSFUCoursesForRoadmap(sfuQueries, 20)
        }
      } else {
        sfuCourseData = await searchSFUCoursesForRoadmap(sfuQueries, 20)
      }
    }

    const internships =
      internshipsRaw.length > 0
        ? internshipsRaw
        : (fallbackInternships as { title: string; company: string; location: string; url: string }[])

    const weekCount = profile.timelineMonths * 4
    const prompt = buildPrompt(profile, sfuCourseData, internships, weekCount, usingOutlines)

    const roadmapText = await generateRoadmap(prompt)

    let parsed: { weeks: unknown[]; internships: unknown[] }
    try {
      const cleaned = roadmapText.replace(/```json\n?|\n?```/g, "").trim()
      parsed = JSON.parse(cleaned) as { weeks: unknown[]; internships: unknown[] }
    } catch {
      return NextResponse.json(
        { error: "Invalid roadmap response from AI" },
        { status: 500 }
      )
    }

    let weeks = (parsed.weeks ?? []).map((w: unknown) => {
      const row = w as Record<string, unknown>
      return {
        week: Number(row.week) || 0,
        skill: String(row.skill ?? ""),
        sfuCourse: row.sfuCourse ? String(row.sfuCourse) : undefined,
        project: String(row.project ?? ""),
        resource: String(row.resource ?? ""),
        action: String(row.action ?? ""),
      }
    })

    weeks = weeks
      .filter((w) => w.skill && (w.sfuCourse || w.resource))
      .map((w, i) => ({ ...w, week: i + 1 }))

    const internshipList =
      Array.isArray(parsed.internships) && parsed.internships.length > 0
        ? (parsed.internships as { title?: string; company?: string; location?: string; url?: string }[]).map(
            (j) => ({
              title: j.title ?? "",
              company: j.company ?? "",
              location: j.location ?? "",
              url: j.url ?? "#",
            })
          )
        : internships

    return NextResponse.json({
      weeks,
      internships: internshipList,
    })
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "ZodError") {
        return NextResponse.json(
          { error: "Invalid input", details: err.message },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? err.message : "Failed to generate roadmap" },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: "Failed to generate roadmap" },
      { status: 500 }
    )
  }
}
