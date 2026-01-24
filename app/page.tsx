"use client"

import { Suspense } from "react"
import { WelcomeScreen } from "@/components/welcome-screen"

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <WelcomeScreen />
    </Suspense>
  )
}
