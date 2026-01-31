import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Career Roadmap | SFU",
  description: "Personalized learning roadmap for your target role",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  )
}
