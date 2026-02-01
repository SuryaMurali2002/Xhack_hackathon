"use client"

import { useState, useRef } from "react"
import type { ParsedTranscript } from "@/lib/types"

type UploadTranscriptProps = {
  onParsed: (parsed: ParsedTranscript) => void
}

export function UploadTranscript({ onParsed }: UploadTranscriptProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      const res = await fetch("/api/parse-transcript", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to parse transcript")
        return
      }
      onParsed({
        student_major: data.student_major ?? "",
        completed_courses: Array.isArray(data.completed_courses) ? data.completed_courses : [],
        total_credits_completed: typeof data.total_credits_completed === "number" ? data.total_credits_completed : 0,
      })
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDrag(true)
  }

  function onDragLeave() {
    setDrag(false)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${drag ? "border-emerald-500 bg-emerald-500/10" : "border-slate-600 bg-slate-800/30"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ""
          }}
        />
        <p className="text-slate-300 mb-2">
          Upload your SFU transcript PDF
        </p>
        <p className="text-sm text-slate-500 mb-4">
          We’ll extract your major and completed courses (no AI until after extraction).
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {loading ? "Parsing…" : "Choose PDF"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
