"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Film, Sparkles, ArrowRight, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthModal } from "./auth-modal"
import { useAuth } from "./auth-provider"
import dynamic from "next/dynamic"

const Video2Ascii = dynamic(() => import("video2ascii"), { ssr: false })

export function WelcomeScreen() {
  const [showAuth, setShowAuth] = useState(false)
  const [videoExists, setVideoExists] = useState(true)
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check if demo video exists
  useEffect(() => {
    fetch("/demo.mp4", { method: "HEAD" })
      .then((res) => setVideoExists(res.ok))
      .catch(() => setVideoExists(false))
  }, [])

  // Show auth modal if redirected from protected route
  useEffect(() => {
    if (searchParams.get("auth") === "required") {
      setShowAuth(true)
    }
  }, [searchParams])

  const handleGetStarted = () => {
    if (user) {
      router.push("/projects")
    } else {
      setShowAuth(true)
    }
  }

  const handleAuthSuccess = () => {
    router.push("/projects")
  }

  return (
    <>
      <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background">
        {/* Video2Ascii Background */}
        <div className="absolute inset-0 z-0">
          {videoExists && (
                <Video2Ascii
                  src="/demo.mp4"
              numColumns={160}
                  colored={true}
              brightness={0.8}
              blend={20}
                  enableMouse={false}
                  enableRipple={false}
                  charset="detailed"
                  isPlaying={true}
                  autoPlay={true}
              className="h-full w-full object-cover opacity-40"
                />
          )}
          {/* Gradient overlays for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />
        </div>

        {/* Navigation */}
        <nav className="relative z-20 flex items-center justify-between px-6 py-5 lg:px-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-semibold text-foreground">Cutos</span>
          </div>
          
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <Button onClick={() => router.push("/projects")}>
                  Go to Dashboard
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowAuth(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Button>
                <Button onClick={handleGetStarted}>
                  Get started
                </Button>
              </div>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
          {/* Headline */}
          <h1 className="max-w-4xl text-center text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl leading-[1.1]">
            Edit videos at the
            <br />
            <span className="text-primary">
              speed of thought
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-center text-lg text-muted-foreground leading-relaxed">
            Search through your video clips with natural language. 
            Let AI agents apply edits, arrange timelines, and transform your footage.
          </p>

          {/* CTA Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row items-center gap-4">
            <Button 
              size="lg" 
              className="h-14 px-10 text-lg gap-2.5"
              onClick={handleGetStarted}
            >
              {user ? "Open Dashboard" : "Start Creating"}
            </Button>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-border px-6 py-8">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cutos © 2026</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </div>

      <AuthModal 
        open={showAuth} 
        onOpenChange={setShowAuth} 
        onSuccess={handleAuthSuccess}
      />
    </>
  )
}
