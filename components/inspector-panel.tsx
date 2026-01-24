"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Sparkles, History, Wand2 } from "lucide-react"
import { useEditor, DEFAULT_CLIP_TRANSFORM, DEFAULT_CLIP_EFFECTS } from "./editor-context"
import type { EffectPreset, ClipEffects, ClipTransform } from "@/lib/projects"

const EFFECT_PRESETS: { id: EffectPreset; label: string }[] = [
  { id: "none", label: "None" },
  { id: "grayscale", label: "Black & White" },
  { id: "sepia", label: "Sepia" },
  { id: "invert", label: "Invert" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "noir", label: "Film Noir" },
  { id: "vhs", label: "VHS Retro" },
  { id: "glitch", label: "Glitch" },
  { id: "ascii", label: "Dreamy" },
]

export function InspectorPanel() {
  const [activeTab, setActiveTab] = useState("effects")

  return (
    <div className="flex h-full flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
        <div className="border-b border-border px-3 py-2">
          <TabsList className="grid w-full grid-cols-3 bg-secondary">
            <TabsTrigger value="effects" className="text-xs">
              <Wand2 className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">
              <Sparkles className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="h-3.5 w-3.5" />
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="effects" className="m-0 h-full">
            <EffectsTab />
          </TabsContent>
          <TabsContent value="ai" className="m-0 h-full">
            <AITab />
          </TabsContent>
          <TabsContent value="history" className="m-0 h-full">
            <HistoryTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function EffectsTab() {
  const { selectedClipId, timelineClips, updateClip } = useEditor()

  const selectedClip = timelineClips.find(c => c.id === selectedClipId)
  
  if (!selectedClip) {
    return (
      <div className="flex h-full items-center justify-center p-3">
        <p className="text-xs text-muted-foreground">Select a clip to edit</p>
      </div>
    )
  }
  
  const transform = selectedClip.transform ?? DEFAULT_CLIP_TRANSFORM
  const effects = selectedClip.effects ?? DEFAULT_CLIP_EFFECTS

  const handleTransformChange = (key: keyof ClipTransform, value: number) => {
    if (!selectedClipId) return
    updateClip(selectedClipId, {
      transform: { ...transform, [key]: value }
    })
  }

  const handlePresetChange = (preset: EffectPreset) => {
    if (!selectedClipId) return
    updateClip(selectedClipId, {
      effects: { ...effects, preset }
    })
  }

  const handleEffectChange = (key: keyof ClipEffects, value: number) => {
    if (!selectedClipId) return
    updateClip(selectedClipId, {
      effects: { ...effects, [key]: value }
    })
  }

  const resetAll = () => {
    if (!selectedClipId) return
    updateClip(selectedClipId, { 
      transform: DEFAULT_CLIP_TRANSFORM,
      effects: DEFAULT_CLIP_EFFECTS 
    })
  }

  const currentPresetLabel = EFFECT_PRESETS.find(p => p.id === effects.preset)?.label ?? "None"

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-foreground truncate max-w-[60%]">
          {selectedClip.label}
        </span>
        <button 
          onClick={resetAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset All
        </button>
      </div>
      
      <Accordion type="multiple" className="w-full">
        {/* Transform Accordion */}
        <AccordionItem value="transform" className="border-border">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
            Transform
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Position X</label>
                  <input
                    type="number"
                    value={transform.positionX}
                    onChange={(e) => handleTransformChange("positionX", parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Position Y</label>
                  <input
                    type="number"
                    value={transform.positionY}
                    onChange={(e) => handleTransformChange("positionY", parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Scale</span>
                  <span className="text-muted-foreground">{transform.scale}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={transform.scale}
                  onChange={(e) => handleTransformChange("scale", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Opacity</span>
                  <span className="text-muted-foreground">{transform.opacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={transform.opacity}
                  onChange={(e) => handleTransformChange("opacity", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Presets Accordion */}
        <AccordionItem value="presets" className="border-border">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2">
              <span>Presets</span>
              <span className="text-muted-foreground font-normal">{currentPresetLabel}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="flex flex-col gap-0.5">
              {EFFECT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetChange(preset.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    effects.preset === preset.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Adjustments Accordion */}
        <AccordionItem value="adjustments" className="border-border">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
            Adjustments
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Blur</span>
                  <span className="text-muted-foreground">{effects.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={effects.blur}
                  onChange={(e) => handleEffectChange("blur", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Brightness</span>
                  <span className="text-muted-foreground">{effects.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={effects.brightness}
                  onChange={(e) => handleEffectChange("brightness", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Contrast</span>
                  <span className="text-muted-foreground">{effects.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={effects.contrast}
                  onChange={(e) => handleEffectChange("contrast", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Saturation</span>
                  <span className="text-muted-foreground">{effects.saturate}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={effects.saturate}
                  onChange={(e) => handleEffectChange("saturate", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Hue Rotate</span>
                  <span className="text-muted-foreground">{effects.hueRotate}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={effects.hueRotate}
                  onChange={(e) => handleEffectChange("hueRotate", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function AITab() {
  const [prompt, setPrompt] = useState("")

  return (
    <div className="flex h-full flex-col">
      {/* Agent Chat Area */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="rounded-full bg-primary/10 p-3 mb-3">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Edit Agent</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            Ask the AI agent to edit your timeline
          </p>
          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <p className="italic">"Apply noir effect to selected clip"</p>
            <p className="italic">"Split clip at the loud part"</p>
            <p className="italic">"Add intro clip to timeline"</p>
          </div>
        </div>
      </div>

      {/* Prompt Input */}
      <div className="border-t border-border p-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask the agent to edit..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryTab() {
  return (
    <div className="h-full overflow-y-auto p-3 scrollbar-thin">
      <div className="space-y-1">
        {["Added clip to timeline", "Trimmed clip end", "Adjusted audio level", "Applied color correction"].map(
          (action, i) => (
            <div
              key={i}
              className="rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {action}
            </div>
          ),
        )}
      </div>
    </div>
  )
}
