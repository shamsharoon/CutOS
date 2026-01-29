"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "./auth-provider"
import { Loader2, Film, ArrowRight } from "lucide-react"

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AuthModal({ open, onOpenChange, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { signIn, signUp } = useAuth()
  // Feature flag to control signup during beta - default is false (disabled)
  const allowSignup = process.env.NEXT_PUBLIC_ENABLE_SIGNUP === 'true'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          onOpenChange(false)
          onSuccess?.()
        }
      } else if (mode === "signup" && allowSignup) {
        const { error } = await signUp(email, password, name)
        if (error) {
          setError(error.message)
        } else {
          setError(null)
          setMode("signin")
          setError("Check your email to confirm your account!")
        }
      } else {
        // Signup not allowed
        setError("Sign up is currently disabled. Beta access only.")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-background border-border overflow-hidden">
        <DialogTitle className="sr-only">
          {mode === "signin" ? "Sign in to CutOS" : "Create a CutOS account"}
        </DialogTitle>
        
        {/* Header */}
        <div className="p-8 pb-6 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground">
            <Film className="h-7 w-7 text-background" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {mode === "signin"
              ? "Sign in to continue editing"
              : "Get started with CutOS"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
          {/* Name field for signup */}
          {mode === "signup" && allowSignup && (
            <Input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 bg-muted/30 border-border placeholder:text-muted-foreground/50"
            />
          )}

          {/* Email */}
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 bg-muted/30 border-border placeholder:text-muted-foreground/50"
          />

          {/* Password */}
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-12 bg-muted/30 border-border placeholder:text-muted-foreground/50"
          />

          {/* Error message */}
          {error && (
            <div className={`text-sm text-center py-2.5 px-3 rounded-lg ${
              error.includes("Check your email") 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {error}
            </div>
          )}

          {/* Submit button */}
          <Button 
            type="submit" 
            className="w-full h-12 text-sm font-medium gap-2" 
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {mode === "signin" ? "Sign in" : "Create account"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {/* Toggle mode - only show if signup is allowed */}
          {allowSignup ? (
            <p className="text-center text-sm text-muted-foreground pt-2">
              {mode === "signin" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup")
                      setError(null)
                    }}
                    className="text-foreground hover:underline font-medium cursor-pointer"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin")
                      setError(null)
                    }}
                    className="text-foreground hover:underline font-medium cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          ) : (
            <p className="text-center text-sm text-muted-foreground pt-2">
              Beta access only. Contact us to get access.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
