import { RoadmapForm } from "./components/RoadmapForm"

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">
          Career Roadmap
        </h1>
        <p className="text-slate-400">
          Get a personalized learning path and internship targets for your
          target role.
        </p>
      </div>
      <RoadmapForm />
    </main>
  )
}
