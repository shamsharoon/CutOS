"use client"

import dynamic from "next/dynamic"

const ProjectsDashboard = dynamic(
  () => import("@/components/projects-dashboard").then((mod) => mod.ProjectsDashboard),
  { ssr: false }
)

export default function ProjectsPage() {
  return <ProjectsDashboard />
}
