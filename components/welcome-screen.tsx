"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, LogOut, Play, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthModal } from "./auth-modal"
import { useAuth } from "./auth-provider"
import { motion, useScroll, useTransform } from "framer-motion"
import { EditorDemo } from "./editor-demo"
import dynamic from "next/dynamic"

const Video2Ascii = dynamic(() => import("video2ascii"), { ssr: false })

// Cycling font text component
function CyclingFontText({ children }: { children: string }) {
  const [fontIndex, setFontIndex] = useState(0)
  const [isFlashing, setIsFlashing] = useState(false)

  const fonts = [
    { className: "font-[family-name:var(--font-instrument)] italic", label: "Instrument Serif" },
    { className: "font-[family-name:var(--font-space-mono)] uppercase tracking-widest text-[0.85em]", label: "Space Mono" },
    { className: "font-sans font-bold", label: "Sans Bold" },
    { className: "font-serif tracking-wide", label: "Serif" },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlashing(true)
      setTimeout(() => {
        setFontIndex((prev) => (prev + 1) % fonts.length)
      }, 75)
      setTimeout(() => {
        setIsFlashing(false)
      }, 150)
    }, 1200)
    return () => clearInterval(interval)
  }, [fonts.length])

  return (
    <span className="relative inline-block">
      <span
        className={`inline-block transition-all duration-75 ${fonts[fontIndex].className} ${
          isFlashing ? "text-white" : ""
        }`}
      >
        {children}
      </span>
      <span
        className={`absolute inset-0 bg-white rounded-sm transition-opacity duration-75 ${
          isFlashing ? "opacity-30" : "opacity-0"
        }`}
        style={{ mixBlendMode: "overlay" }}
      />
    </span>
  )
}

// Subtle grain overlay
function GrainOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 opacity-[0.015]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
  )
}

// Feature card with minimal styling
function FeatureCard({
  title,
  description,
  index
}: {
  title: string
  description: string
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      <div className="relative bg-neutral-950 border border-neutral-800/60 p-8 h-full hover:border-neutral-700 transition-colors duration-300">
        <span className="font-mono text-[11px] text-neutral-600 tracking-widest">0{index + 1}</span>
        <h3 className="mt-4 text-lg font-normal tracking-tight text-white">
          {title}
        </h3>
        <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  )
}

export function WelcomeScreen() {
  const [showAuth, setShowAuth] = useState(false)
  const [videoExists, setVideoExists] = useState(true)
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  })

  // Check if demo video exists
  useEffect(() => {
    fetch("/demo.mp4", { method: "HEAD" })
      .then((res) => setVideoExists(res.ok))
      .catch(() => setVideoExists(false))
  }, [])

  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.97])
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, 80])

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

  const features = [
    {
      title: "Natural Language Search",
      description: "Describe what you're looking for. Find the exact moment in hours of footage instantly.",
    },
    {
      title: "Intelligent Editing",
      description: "AI agents that understand context. Apply effects, arrange timelines, transform footage.",
    },
    {
      title: "Automatic Transcription",
      description: "Generated captions in any language. Styled to match your vision.",
    },
    {
      title: "Precision Cutting",
      description: "Split, trim, arrange with frame-perfect accuracy. Full history, zero friction.",
    },
    {
      title: "Multi-Track Compositing",
      description: "Layer video, apply chromakey, composite multiple sources with professional tools.",
    },
    {
      title: "Real-Time Preview",
      description: "See every edit instantly. Smooth playback, live effects, no waiting.",
    },
  ]

  return (
    <>
      <GrainOverlay />

      <div className="relative min-h-screen w-full overflow-x-hidden bg-neutral-950 ">
        {/* Video2Ascii Background */}
        <div className="fixed inset-0 z-0">
          {videoExists && (
            <Video2Ascii
              src="/demo.mp4"
              numColumns={200}
              colored={true}
              brightness={2.2}
              blend={8}
              enableMouse={false}
              enableRipple={false}
              charset="detailed"
              isPlaying={true}
              autoPlay={true}
              className="h-full w-full object-cover opacity-60"
            />
          )}
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/70 via-neutral-950/50 to-neutral-950/70" />
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-neutral-950 to-transparent" />
        </div>

        {/* Navigation */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative z-20 flex items-center justify-between px-6 py-5 lg:px-16 xl:px-24"
        >
          <div className="flex items-center gap-3">
            <img src="/cutos.svg" alt="CutOS" className="h-24 w-24 lg:h-36 lg:w-36" />
          </div>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-9 w-20 animate-pulse rounded bg-neutral-800" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => router.push("/projects")}
                  variant="ghost"
                  className="text-neutral-400 hover:text-white hover:bg-neutral-800/50 text-sm"
                >
                  Dashboard
                </Button>
                <Button
                  onClick={() => router.push("/projects")}
                  className="bg-white text-black hover:bg-neutral-200 text-sm"
                >
                  Open Editor
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut()}
                  className="text-neutral-500 hover:text-white hover:bg-neutral-800/50"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowAuth(true)}
                  className="text-neutral-400 hover:text-white hover:bg-neutral-800/50 text-sm"
                >
                  Sign in
                </Button>
                <Button
                  onClick={handleGetStarted}
                  className="bg-white text-black hover:bg-neutral-200 gap-2 text-sm group"
                >
                  Get started
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            )}
          </div>
        </motion.nav>

        {/* Hero Section */}
        <motion.section
          ref={heroRef}
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          className="relative z-10 flex flex-col items-center px-6 pt-20 pb-32 lg:pt-28 lg:pb-40 xl:px-24"
        >
          <div className="max-w-5xl w-full text-center">
            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-normal tracking-tight text-white leading-[1.05]"
            >
              Edit videos at the
              <br />
              <span className="text-neutral-500"><CyclingFontText>speed of thought</CyclingFontText></span>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 max-w-xl mx-auto text-lg text-neutral-500 leading-relaxed"
            >
              Search through footage with natural language. Let AI agents apply edits,
              arrange timelines, and transform your vision into reality.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button
                size="lg"
                className="h-12 px-7 bg-white hover:bg-neutral-100 text-black text-sm group"
                onClick={handleGetStarted}
              >
                {user ? "Open Dashboard" : "Start Creating"}
                <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
              {!user && (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7 border-neutral-800 bg-transparent text-neutral-300 hover:bg-neutral-900 hover:text-white text-sm group"
                  onClick={() => setShowAuth(true)}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Watch Demo
                </Button>
              )}
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mt-16 flex items-center justify-center gap-6 text-xs text-neutral-600"
            >
              <span>Free to start</span>
              <span className="w-1 h-1 bg-neutral-700 rounded-full" />
              <span>No credit card</span>
              <span className="w-1 h-1 bg-neutral-700 rounded-full" />
              <span>AI-powered</span>
            </motion.div>
          </div>
        </motion.section>

        {/* Trusted By Section */}
        <section className="relative z-10 py-16 border-t border-neutral-900/50">
          <div className="mx-auto max-w-7xl px-6 mb-10">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center text-xs text-neutral-600 uppercase tracking-widest"
            >
              Trusted by Engineers from
            </motion.p>
          </div>

          {/* Logo Carousel - Full Width */}
          <div className="relative overflow-hidden w-full">
            {/* Fade edges - positioned relative to viewport */}
            <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-neutral-950 via-neutral-950/80 to-transparent z-10 pointer-events-none" />

            {/* Scrolling logos */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex"
            >
              <div className="flex animate-scroll items-center gap-16 pr-16">
                {[
                  { name: "Shopify", logo: "/shopify-logo-white.png", width: "w-28" },
                  { name: "Wealthsimple", logo: "/logos/wealthsimple.png", width: "w-36" },
                  { name: "Intuit", logo: "/logos/intuit.png", width: "w-24" },
                  { name: "RBC", logo: "/logos/rbc.png", width: "w-42" },
                  { name: "Fidelity", logo: "/logos/fidelity.png", width: "w-36" },
                  { name: "TypeOS", logo: "/logos/typeos.png", width: "w-36" },
                  { name: "Y Combinator", logo: "/logos/ycombinator.png", width: "w-36" },
                  { name: "Verily", logo: "/logos/verily.png", width: "w-36" },
                ].map((company) => (
                  <div
                    key={company.name}
                    className={`flex-shrink-0 flex items-center justify-center ${company.width}`}
                  >
                    <img src={company.logo} alt={company.name} className="w-full h-auto opacity-50" />
                  </div>
                ))}
              </div>
              <div className="flex animate-scroll items-center gap-16 pr-16" aria-hidden="true">
                {[
                  { name: "Shopify", logo: "/shopify-logo-white.png", width: "w-28" },
                  { name: "Wealthsimple", logo: "/logos/wealthsimple.png", width: "w-36" },
                  { name: "Intuit", logo: "/logos/intuit.png", width: "w-24" },
                  { name: "RBC", logo: "/logos/rbc.png", width: "w-42" },
                  { name: "Fidelity", logo: "/logos/fidelity.png", width: "w-36" },
                  { name: "TypeOS", logo: "/logos/typeos.png", width: "w-36" },
                  { name: "Y Combinator", logo: "/logos/ycombinator.png", width: "w-36" },
                  { name: "Verily", logo: "/logos/verily.png", width: "w-36" },
                ].map((company) => (
                  <div
                    key={company.name}
                    className={`flex-shrink-0 flex items-center justify-center ${company.width}`}
                  >
                    <img src={company.logo} alt={company.name} className="w-full h-auto opacity-50" />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Demo Section */}
        <section className="relative z-10 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-16 xl:px-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl lg:text-4xl font-normal tracking-tight text-white">
                See it in action
              </h2>
              <p className="mt-4 text-neutral-500 max-w-lg mx-auto">
                Watch AI assist you in real-time. Natural commands, instant results.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <EditorDemo />
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative z-10 py-20 lg:py-28 border-t border-neutral-900">
          <div className="mx-auto max-w-7xl px-6 lg:px-16 xl:px-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl lg:text-4xl font-normal tracking-tight text-white">
                Everything you need
              </h2>
              <p className="mt-4 text-neutral-500 max-w-lg mx-auto">
                Professional tools that feel intuitive. Power without complexity.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative z-10 py-28 lg:py-36">
          <div className="relative mx-auto max-w-3xl px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl sm:text-5xl font-normal tracking-tight text-white">
                Ready to transform
                <br />
                <span className="text-neutral-500">your workflow?</span>
              </h2>
              <p className="mt-6 text-lg text-neutral-500 max-w-md mx-auto">
                Join creators who edit faster with AI. Get started in seconds.
              </p>
              <div className="mt-10">
                <Button
                  size="lg"
                  className="h-12 px-8 bg-white hover:bg-neutral-100 text-black text-sm group"
                  onClick={handleGetStarted}
                >
                  {user ? "Open Dashboard" : "Start Creating Free"}
                  <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-neutral-900 px-6 py-10 lg:px-16 xl:px-24">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img src="/cutos.svg" alt="CutOS" className="h-24 w-24 opacity-40" />
              <span className="text-xs text-neutral-600">
                © 2026 CutOS
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs text-neutral-600">
              <a href="#" className="hover:text-neutral-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-neutral-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-neutral-400 transition-colors">Contact</a>
              <a href="#" className="hover:text-neutral-400 transition-colors">Docs</a>
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
