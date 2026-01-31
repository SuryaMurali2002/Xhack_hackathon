"use client"

import { useState } from "react"
import type { RoadmapResponse } from "@/lib/types"

type RoadmapViewProps = {
  roadmap: RoadmapResponse
}

export function RoadmapView({ roadmap }: RoadmapViewProps) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)

  const { weeks, internships } = roadmap

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-slate-100">
        Your roadmap
      </h2>

      <div className="space-y-3">
        {weeks.map((w) => {
          const isExpanded = expandedWeek === w.week
          return (
            <div
              key={w.week}
              className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedWeek(isExpanded ? null : w.week)
                }
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
              >
                <span className="font-medium text-slate-100">
                  Week {w.week}
                  {w.skill ? ` · ${w.skill}` : ""}
                  {w.sfuCourse ? (
                    <span className="text-emerald-400 font-normal"> · {w.sfuCourse}</span>
                  ) : null}
                </span>
                <span
                  className="text-slate-400 text-sm"
                  aria-hidden
                >
                  {isExpanded ? "−" : "+"}
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-700 space-y-2 text-sm text-slate-300">
                  {w.sfuCourse && (
                    <p>
                      <span className="text-slate-400">SFU course:</span>{" "}
                      <span className="text-emerald-400">{w.sfuCourse}</span>
                    </p>
                  )}
                  <p>
                    <span className="text-slate-400">Project:</span> {w.project}
                  </p>
                  <p>
                    <span className="text-slate-400">Resource:</span> {w.resource}
                  </p>
                  <p>
                    <span className="text-slate-400">Action:</span> {w.action}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {internships.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="font-semibold text-slate-100 mb-3">
            Internships to target
          </h3>
          <ul className="space-y-2">
            {internships.slice(0, 8).map((job, i) => (
              <li key={i} className="text-sm">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  {job.title}
                </a>
                <span className="text-slate-400">
                  {" "}
                  · {job.company}
                  {job.location ? ` · ${job.location}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
