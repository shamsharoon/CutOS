"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
<<<<<<< HEAD
import { Wand2 } from "lucide-react"
=======
import { Sparkles, History, Wand2, Eye, EyeOff } from "lucide-react"
>>>>>>> 99b5812 (feat: agentic greenscreen works via chromakey)
import { useEditor, DEFAULT_CLIP_TRANSFORM, DEFAULT_CLIP_EFFECTS } from "./editor-context"
import type { EffectPreset, ClipEffects, ClipTransform } from "@/lib/projects"
import { ColorPicker } from "./ui/color-picker"

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
          <TabsList className="grid w-full grid-cols-1 bg-secondary">
            <TabsTrigger value="effects" className="text-xs">
              <Wand2 className="h-3.5 w-3.5" /> Effects 
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="effects" className="m-0 h-full">
            <EffectsTab />
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

  const handleChromakeyToggle = (enabled: boolean) => {
    if (!selectedClipId) return
    const currentChromakey = effects.chromakey ?? {
      enabled: false,
      keyColor: "#00FF00",
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.3,
    }
    updateClip(selectedClipId, {
      effects: {
        ...effects,
        chromakey: {
          ...currentChromakey,
          enabled,
        },
      },
    })
  }

  const handleChromakeyChange = (key: "keyColor" | "similarity" | "smoothness" | "spill", value: string | number) => {
    if (!selectedClipId) return
    const currentChromakey = effects.chromakey ?? {
      enabled: false,
      keyColor: "#00FF00",
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.3,
    }
    updateClip(selectedClipId, {
      effects: {
        ...effects,
        chromakey: {
          ...currentChromakey,
          [key]: value,
        },
      },
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

        {/* Chromakey Accordion */}
        <AccordionItem value="chromakey" className="border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <AccordionTrigger className="flex-1 text-xs font-medium hover:no-underline py-0">
              <span>Green Screen</span>
            </AccordionTrigger>
            <button
              type="button"
              onClick={() => handleChromakeyToggle(!(effects.chromakey?.enabled ?? false))}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors ${
                effects.chromakey?.enabled
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {effects.chromakey?.enabled ? (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  <span>On</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>Off</span>
                </>
              )}
            </button>
          </div>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Key Color</label>
                <ColorPicker
                  value={effects.chromakey?.keyColor ?? "#00FF00"}
                  onChange={(color) => handleChromakeyChange("keyColor", color)}
                  disabled={!effects.chromakey?.enabled}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Similarity</span>
                  <span className="text-muted-foreground">{((effects.chromakey?.similarity ?? 0.4) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={((effects.chromakey?.similarity ?? 0.4) * 100)}
                  onChange={(e) => handleChromakeyChange("similarity", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                  disabled={!effects.chromakey?.enabled}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">How close colors must be to be removed</p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Smoothness</span>
                  <span className="text-muted-foreground">{((effects.chromakey?.smoothness ?? 0.1) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={((effects.chromakey?.smoothness ?? 0.1) * 100)}
                  onChange={(e) => handleChromakeyChange("smoothness", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                  disabled={!effects.chromakey?.enabled}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Edge softness</p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Spill Suppression</span>
                  <span className="text-muted-foreground">{((effects.chromakey?.spill ?? 0.3) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={((effects.chromakey?.spill ?? 0.3) * 100)}
                  onChange={(e) => handleChromakeyChange("spill", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                  disabled={!effects.chromakey?.enabled}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Removes color bleed from edges</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}