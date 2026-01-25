# Documentation Assets

This folder contains images, GIFs, and other media for the README.

## Required Assets

### Main Demo
- `demo.gif` - Main demo GIF showing AI editing in action (max 10MB)

### Screenshots
Place in `images/` folder:
- `editor-interface.png` - Full editor with timeline and preview
- `ai-chat.png` - AI chat interface with example commands
- `effects-panel.png` - Effects panel showing available presets
- `effects-showcase.png` - Grid of effect examples

### Optional GIFs
- `timeline-editing.gif` - Clip manipulation demo
- `search-demo.gif` - Semantic search in action
- `dubbing-demo.gif` - Language dubbing workflow

## Creating Demo GIFs

### Method 1: Using FFmpeg (Recommended)

```bash
# Record your screen first with OBS/QuickTime/ScreenFlow
# Then convert to optimized GIF:

ffmpeg -i your-recording.mp4 \
  -vf "fps=15,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  -loop 0 \
  demo.gif

# Further optimize:
gifsicle -O3 --colors 256 demo.gif -o demo-optimized.gif
```

### Method 2: Online Tools (Easiest)

1. **Record screen** (QuickTime/OBS/Loom)
2. **Upload to converter**:
   - https://ezgif.com/video-to-gif
   - https://cloudconvert.com/mp4-to-gif
   - https://gifski.app/ (Mac app - best quality)
3. **Settings**:
   - FPS: 15-20
   - Width: 1000px (auto height)
   - Duration: 15-30 seconds max

### Method 3: Screen Recording Apps

- **Kap** (Mac, free) - https://getkap.co/
- **LICEcap** (Windows/Mac, free) - https://www.cockos.com/licecap/
- **ScreenToGif** (Windows, free) - https://www.screentogif.com/

## Best Practices

### GIF Guidelines
- **Resolution**: 1000px wide (maintains quality, reasonable size)
- **FPS**: 15-20 fps (smooth but not huge)
- **Duration**: 15-30 seconds (tells a story, stays small)
- **File Size**: Under 10MB (GitHub/README friendly)
- **Loop**: Enable looping for continuous demo

### Screenshot Guidelines
- **Resolution**: 1920x1080 or 1440x900
- **Format**: PNG for UI, JPEG for photos
- **Compression**: Use TinyPNG or ImageOptim
- **Consistency**: Use same theme (dark mode) across all screenshots

### Recording Tips
1. **Clean workspace**: Close unnecessary tabs/windows
2. **Smooth movements**: Move cursor slowly and deliberately
3. **Show one feature**: Focus on a single workflow per GIF
4. **Add delays**: Pause briefly at important moments
5. **Test first**: Do a practice run before recording

## Example Recording Flow

1. Start with a clean editor state
2. Import a video file
3. Type a natural language command
4. Show the AI executing the command
5. Preview the result
6. End on the finished edit

Keep it focused and fast!

## Optimization Commands

```bash
# Compress PNG screenshots
pngquant --quality=65-80 --ext .png --force screenshot.png

# Compress JPEG screenshots  
jpegoptim --max=85 screenshot.jpg

# Optimize GIF
gifsicle -O3 --lossy=80 --colors 256 input.gif -o output.gif

# Convert MP4 to high-quality GIF
ffmpeg -i input.mp4 -vf "fps=20,scale=1200:-1:flags=lanczos" \
  -c:v pam -f image2pipe - | \
  convert -delay 5 - -loop 0 -layers optimize output.gif
```
