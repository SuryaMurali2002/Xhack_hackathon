"use client"

import type { RecommendCoursesResponse } from "@/lib/types"

type CourseResultsProps = {
  result: RecommendCoursesResponse
  onStartOver?: () => void
}

export function CourseResults({ result, onStartOver }: CourseResultsProps) {
  const { major, target_role, total_credits_completed = 0, credits_remaining = 0, recommended_courses } = result

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-slate-100">
          Your course plan
        </h2>
        {onStartOver && (
          <button
            type="button"
            onClick={onStartOver}
            className="text-sm text-emerald-400 hover:underline"
          >
            Start over
          </button>
        )}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
        <h3 className="font-medium text-slate-200 text-sm">
          Transcript details
        </h3>
        <ul className="text-slate-300 text-sm space-y-1">
          <li>
            <span className="text-slate-500">Major:</span>{" "}
            <span className="text-slate-100">{major}</span>
          </li>
          <li>
            <span className="text-slate-500">Units completed:</span>{" "}
            <span className="text-slate-100">{total_credits_completed}</span>
          </li>
          <li>
            <span className="text-slate-500">Units left until 120 credits:</span>{" "}
            <span className="text-slate-100">{credits_remaining}</span>
          </li>
          <li>
            <span className="text-slate-500">Target role:</span>{" "}
            <span className="text-slate-100">{target_role}</span>
          </li>
        </ul>
      </div>

      {recommended_courses.length === 0 ? (
        <p className="text-slate-400 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          No additional courses to recommend right now. You may have already completed the most relevant ones, or try a different target role.
        </p>
      ) : (
        <ul className="space-y-3">
          {recommended_courses.map((c, i) => (
            <li
              key={`${c.course_code}-${i}`}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
            >
              <div className="font-medium text-slate-100">
                {c.course_code}
                {c.course_name ? ` — ${c.course_name}` : ""}
              </div>
              <p className="text-sm text-slate-300 mt-1">
                {c.reason}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
