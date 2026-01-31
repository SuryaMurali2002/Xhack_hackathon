"use client"

import { useState } from "react"
import type { UserProfile } from "@/lib/types"
import type { RoadmapResponse } from "@/lib/types"
import { RoadmapView } from "./RoadmapView"

export function RoadmapForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null)
  const [completedCourses, setCompletedCourses] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setRoadmap(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    const profile: UserProfile = {
      major: (formData.get("major") as string) ?? "",
      departmentCode: (formData.get("departmentCode") as string)?.trim() || undefined,
      completedCourses: completedCourses
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      targetRole: (formData.get("targetRole") as string) ?? "",
      timelineMonths: Number(formData.get("timelineMonths")) || 3,
    }

    if (!profile.major || !profile.targetRole) {
      setError("Major and target role are required.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to generate roadmap")
        return
      }
      setRoadmap(data)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-slate-100">
          Your profile
        </h2>

        <div>
          <label htmlFor="major" className="block text-sm text-slate-300 mb-1">
            Major
          </label>
          <input
            id="major"
            name="major"
            type="text"
            placeholder="e.g. Computing Science"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label htmlFor="departmentCode" className="block text-sm text-slate-300 mb-1">
            Department code (optional)
          </label>
          <input
            id="departmentCode"
            name="departmentCode"
            type="text"
            placeholder="e.g. CMPT, STAT, MATH — improves SFU course suggestions"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label htmlFor="completedCourses" className="block text-sm text-slate-300 mb-1">
            Completed courses (optional, comma-separated)
          </label>
          <input
            id="completedCourses"
            type="text"
            value={completedCourses}
            onChange={(e) => setCompletedCourses(e.target.value)}
            placeholder="e.g. CMPT 120, CMPT 125"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label htmlFor="targetRole" className="block text-sm text-slate-300 mb-1">
            Target role
          </label>
          <input
            id="targetRole"
            name="targetRole"
            type="text"
            placeholder="e.g. Web Developer, Data Analyst"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label htmlFor="timelineMonths" className="block text-sm text-slate-300 mb-1">
            Timeline (months)
          </label>
          <select
            id="timelineMonths"
            name="timelineMonths"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {[1, 2, 3, 4, 5, 6, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "month" : "months"}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {loading ? "Generating roadmap…" : "Generate roadmap"}
        </button>
      </form>

      {roadmap && <RoadmapView roadmap={roadmap} />}
    </div>
  )
}
