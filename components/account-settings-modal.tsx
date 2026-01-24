"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "./auth-provider"
import { createClient } from "@/lib/supabase/client"
import { Loader2, User, Mail, Key } from "lucide-react"

interface AccountSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccountSettingsModal({ open, onOpenChange }: AccountSettingsModalProps) {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || "")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleUpdateProfile = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const supabase = createClient()
    
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName }
    })

    setIsLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess("Profile updated successfully!")
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match")
      return
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const supabase = createClient()
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    setIsLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess("Password changed successfully!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Profile Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Profile</h3>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Display Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <Button onClick={handleUpdateProfile} disabled={isLoading} size="sm">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Profile"}
            </Button>
          </div>

          <div className="border-t border-border" />

          {/* Password Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Change Password
            </h3>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button onClick={handleChangePassword} disabled={isLoading || !newPassword} size="sm">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change Password"}
            </Button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-emerald-500 bg-emerald-500/10 p-2 rounded-md">
            {success}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

