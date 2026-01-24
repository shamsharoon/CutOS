"use client"

import { useState, useRef, useEffect } from "react"
import { Eye } from "lucide-react"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])
  

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 rounded border border-input bg-background px-2 py-1.5 text-xs hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div
          className="h-5 w-5 rounded border border-border"
          style={{ backgroundColor: value }}
        />
        <span className="text-muted-foreground">{value.toUpperCase()}</span>
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-4 shadow-xl min-w-[200px]">
          <div className="space-y-3">
            {/* Color preview */}
            <div className="flex items-center gap-3">
              <div
                className="h-16 w-16 rounded border-2 border-border"
                style={{ backgroundColor: value }}
              />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground mb-1">Selected Color</p>
                <input
                  type="text"
                  value={value || "#00FF00"}
                  onChange={(e) => {
                    const val = e.target.value.trim()
                    // Allow empty temporarily while typing
                    if (val === "" || /^#?[0-9A-Fa-f]{0,6}$/i.test(val)) {
                      const formatted = val.startsWith("#") ? val : val ? `#${val}` : "#"
                      onChange(formatted)
                    }
                  }}
                  onBlur={(e) => {
                    // Ensure valid hex on blur
                    const val = e.target.value.trim()
                    if (!val || !/^#?[0-9A-Fa-f]{6}$/i.test(val)) {
                      onChange(value || "#00FF00")
                    }
                  }}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="#00FF00"
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Color input */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Choose a color:</label>
              <input
                type="color"
                value={value || "#00FF00"}
                onChange={(e) => {
                  const newColor = e.target.value
                  if (newColor) {
                    onChange(newColor)
                  }
                }}
                className="w-full h-10 rounded border border-input cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
