"use client"

import dynamic from "next/dynamic"
import { use } from "react"

const EditorShell = dynamic(
  () => import("@/components/editor-shell").then((mod) => mod.EditorShell),
  { ssr: false }
)

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <EditorShell projectId={id} />
}
