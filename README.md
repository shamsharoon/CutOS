# CutOS

Edit videos at the speed of thought with AI-powered assistance.

## Overview

CutOS is a revolutionary AI-first video editing platform that combines traditional non-linear editing capabilities with cutting-edge AI features. Edit your videos through natural language commands, apply AI-powered effects, and transform your footage with intelligent automation.

## Key Features

### AI-Powered Editing
- **Chat-Based Editor**: Describe edits in plain English - "split the clip at 10 seconds", "add a vintage effect", "remove the green screen"
- **Intelligent Agent**: GPT-4o-powered editing agent that understands context and executes complex editing operations
- **AI Dubbing**: Translate and dub your videos into 29+ languages while preserving emotion, timing, and tone (powered by ElevenLabs)
- **AI Morph Transitions**: Generate smooth, AI-powered morphing transitions between clips (powered by Kling API)

### Content Discovery
- **Natural Language Video Search**: Find specific moments in your videos using conversational queries like "person walking" or "car driving" (powered by TwelveLabs Marengo 3.0)
- **Semantic Understanding**: Search by visual content, audio, and context across your entire video library

### Professional Editing Tools
- **Multi-Track Timeline**: Non-destructive editing with 2 video tracks and 2 audio tracks
- **Real-Time Preview**: Canvas-based video playback with instant effect rendering
- **Clip Operations**: Split, trim, move, delete, copy, and paste clips with precision
- **Undo/Redo System**: Full editing history with keyboard shortcuts

### Visual Effects & Processing
- **Effect Presets**: Grayscale, sepia, noir, VHS, glitch, ASCII art, cyberpunk, and more
- **Adjustable Parameters**: Fine-tune blur, brightness, contrast, saturation, and hue
- **Chromakey (Green Screen)**: GPU-accelerated WebGL-based chroma keying with any color
- **Custom Effect Chains**: Combine multiple effects on a single clip

### Export & Publishing
- **High-Quality Export**: Export to MP4 or WebM with customizable quality settings
- **Multiple Quality Presets**: Low (2.5 Mbps), Medium (5 Mbps), High (10 Mbps)
- **1080p Resolution**: Export at 1920x1080 with full effects rendering

### Project Management
- **Cloud Storage**: Save and sync projects with Supabase
- **Auto-Save**: Never lose your work with automatic project saving
- **Project Organization**: Manage multiple projects with metadata and thumbnails
- **Collaborative Ready**: Built on Supabase with realtime capabilities

## Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19.2.1
- **Styling**: Tailwind CSS 4.x
- **Components**: Radix UI, shadcn/ui
- **Animations**: Framer Motion
- **Language**: TypeScript

### Backend & Services
- **Database & Auth**: Supabase (PostgreSQL + Authentication + Storage)
- **AI Models**:
  - OpenAI GPT-4o (editing agent)
  - TwelveLabs Marengo 3.0 (video understanding)
  - ElevenLabs (AI dubbing)
  - Kling API (morph transitions)
- **Video Processing**: WebGL, Canvas API, MediaRecorder API

## Getting Started

### Prerequisites

- Node.js 18+
- npm, pnpm, or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/shamsharoon/cutos.git
cd cutos
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Add your Supabase credentials

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Services
OPENAI_API_KEY=your_openai_api_key                    # For AI editing agent
TWELVELABS_API_KEY=your_twelvelabs_api_key            # For video search
ELEVENLABS_API_KEY=your_elevenlabs_api_key            # For AI dubbing
KLING_ACCESS_KEY=your_kling_access_key                # For morph transitions
KLING_SECRET_KEY=your_kling_secret_key
```

See `.env.example` for a template.

## How It Works

CutOS uses a combination of traditional video editing and AI assistance:

1. **Upload Your Media**: Import videos and audio files to your project
2. **Build Your Timeline**: Drag clips onto the multi-track timeline
3. **Edit with AI**: Type commands like:
   - "Split this clip at 15 seconds"
   - "Add a vintage VHS effect to the second clip"
   - "Remove the green screen from this video"
   - "Dub this video in Spanish"
   - "Find all clips with people walking"
4. **Apply Effects**: Choose from presets or fine-tune parameters
5. **Export**: Render your video in high quality MP4 or WebM

The AI agent understands your timeline context and executes complex operations automatically, making video editing as simple as having a conversation.

## Keyboard Shortcuts

- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo
- `Ctrl/Cmd + C` - Copy selected clip
- `Ctrl/Cmd + V` - Paste clip
- `Space` - Play/pause
- `Esc` - Exit fullscreen

## Architecture Highlights

- **Non-Destructive Editing**: Original media files are never modified
- **WebGL Rendering**: GPU-accelerated effects for real-time performance
- **Streaming AI Responses**: Server-sent events for responsive AI interactions
- **Cloud-Native**: Built on Supabase with automatic syncing and backup

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
