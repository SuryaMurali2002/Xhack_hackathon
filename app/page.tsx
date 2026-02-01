"use client"

import { useState } from "react"
import { UploadTranscript } from "./components/UploadTranscript"
import { CourseResults } from "./components/CourseResults"
import type { ParsedTranscript } from "@/lib/types"
import type { RecommendCoursesResponse } from "@/lib/types"

const SUGGESTED_ROLES = [
  "Software Engineer",
  "Data Scientist",
  "Web Developer",
  "Machine Learning Engineer",
  "Product Manager",
]

export default function Home() {
  const [parsedTranscript, setParsedTranscript] = useState<ParsedTranscript | null>(null)
  const [targetRole, setTargetRole] = useState("")
  const [recommendResult, setRecommendResult] = useState<RecommendCoursesResponse | null>(null)
  const [loadingRecommend, setLoadingRecommend] = useState(false)
  const [recommendError, setRecommendError] = useState<string | null>(null)

  function startOver() {
    setParsedTranscript(null)
    setRecommendResult(null)
    setRecommendError(null)
  }

  async function handleGetRecommendations() {
    const role = targetRole.trim()
    if (!parsedTranscript || !role) return
    setRecommendError(null)
    setLoadingRecommend(true)
    try {
      const res = await fetch("/api/recommend-courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedTranscript, targetRole: role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRecommendError(data.error ?? "Failed to get recommendations")
        return
      }
      setRecommendResult(data)
    } catch {
      setRecommendError("Network error. Please try again.")
    } finally {
      setLoadingRecommend(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">
          GoSFU Smart Course Planner
        </h1>
        <p className="text-slate-400">
          Upload your transcript, pick a target job, and get SFU course recommendations that help you graduate and move toward that role.
        </p>
      </div>

      {!recommendResult ? (
        <div className="w-full max-w-2xl mx-auto space-y-6">
          <UploadTranscript onParsed={setParsedTranscript} />

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
            <label htmlFor="targetRole" className="block text-sm font-medium text-slate-300">
              Target job role
            </label>
            <p className="text-slate-500 text-sm -mt-1">
              Recommendations will be tailored to this role (only relevant courses are shown).
            </p>
            <input
              id="targetRole"
              type="text"
              value={targetRole}
              onChange={(e) => {
                setTargetRole(e.target.value)
                setRecommendError(null)
              }}
              placeholder="e.g. Data Scientist, Software Engineer"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              list="suggested-roles"
            />
            <datalist id="suggested-roles">
              {SUGGESTED_ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>

            {parsedTranscript && (
              <p className="text-slate-400 text-sm">
                Transcript parsed: <span className="text-slate-200">{parsedTranscript.student_major}</span>
                {" · "}
                {parsedTranscript.completed_courses?.length ?? 0} courses
              </p>
            )}

            {recommendError && (
              <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
                {recommendError}
              </p>
            )}

            <button
              type="button"
              disabled={!parsedTranscript || !targetRole.trim() || loadingRecommend}
              onClick={handleGetRecommendations}
              className="w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {loadingRecommend ? "Getting recommendations…" : "Get course recommendations"}
            </button>
          </div>
        </div>
      ) : (
        <CourseResults result={recommendResult} onStartOver={startOver} />
      )}
    </main>
  )
}
