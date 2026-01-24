/**
 * WebGL-based chromakey (green screen) processor
 * Provides GPU-accelerated chroma key removal for video frames
 */

export interface ChromakeyOptions {
  keyColor: string      // Hex color to remove (e.g., "#00FF00")
  similarity: number    // 0-1: How close colors must be to be removed
  smoothness: number    // 0-1: Edge softness
  spill: number         // 0-1: Spill suppression strength
}

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_image;
  uniform vec3 u_keyColor;
  uniform float u_similarity;
  uniform float u_smoothness;
  uniform float u_spill;

  varying vec2 v_texCoord;

  // Convert RGB to YCbCr color space for better chroma matching
  vec3 rgbToYCbCr(vec3 rgb) {
    float y  =  0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    float cb = -0.169 * rgb.r - 0.331 * rgb.g + 0.500 * rgb.b;
    float cr =  0.500 * rgb.r - 0.419 * rgb.g - 0.081 * rgb.b;
    return vec3(y, cb, cr);
  }

  void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 ycbcr = rgbToYCbCr(color.rgb);
    vec3 keyYcbcr = rgbToYCbCr(u_keyColor);

    // Compare only chroma (CbCr) values, ignoring luminance
    float dist = distance(ycbcr.yz, keyYcbcr.yz);

    // Create smooth alpha transition
    float alpha = smoothstep(u_similarity, u_similarity + u_smoothness, dist);

    // Apply spill suppression (remove color bleed from edges)
    vec3 result = color.rgb;
    if (u_spill > 0.0) {
      // For green screen: reduce green where it exceeds other channels
      float spillAmount = max(0.0, color.g - max(color.r, color.b));
      result.g -= spillAmount * u_spill;

      // For blue screen: reduce blue where it exceeds other channels
      float blueSpill = max(0.0, color.b - max(color.r, color.g));
      result.b -= blueSpill * u_spill;
    }

    gl_FragColor = vec4(result, color.a * alpha);
  }
`

/**
 * Parse hex color to RGB values (0-1 range)
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    return [0, 1, 0] // Default to green
  }
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ]
}

/**
 * Compile a WebGL shader
 */
function compileShader(gl: WebGLRenderingContext, source: string, type: number): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

/**
 * Create a WebGL program from vertex and fragment shaders
 */
function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram()
  if (!program) return null

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }

  return program
}

export class ChromakeyProcessor {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private positionBuffer: WebGLBuffer | null = null
  private texCoordBuffer: WebGLBuffer | null = null

  // Uniform locations
  private uniformLocations: {
    image: WebGLUniformLocation | null
    keyColor: WebGLUniformLocation | null
    similarity: WebGLUniformLocation | null
    smoothness: WebGLUniformLocation | null
    spill: WebGLUniformLocation | null
  } = {
    image: null,
    keyColor: null,
    similarity: null,
    smoothness: null,
    spill: null,
  }

  // Attribute locations
  private attribLocations: {
    position: number
    texCoord: number
  } = {
    position: -1,
    texCoord: -1,
  }

  private initialized = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.init()
  }

  private init(): boolean {
    // Get WebGL context with alpha support
    const gl = this.canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      console.error("WebGL not supported")
      return false
    }

    this.gl = gl

    // Compile shaders
    const vertexShader = compileShader(gl, VERTEX_SHADER, gl.VERTEX_SHADER)
    const fragmentShader = compileShader(gl, FRAGMENT_SHADER, gl.FRAGMENT_SHADER)

    if (!vertexShader || !fragmentShader) {
      return false
    }

    // Create program
    this.program = createProgram(gl, vertexShader, fragmentShader)
    if (!this.program) {
      return false
    }

    // Get attribute locations
    this.attribLocations.position = gl.getAttribLocation(this.program, "a_position")
    this.attribLocations.texCoord = gl.getAttribLocation(this.program, "a_texCoord")

    // Get uniform locations
    this.uniformLocations.image = gl.getUniformLocation(this.program, "u_image")
    this.uniformLocations.keyColor = gl.getUniformLocation(this.program, "u_keyColor")
    this.uniformLocations.similarity = gl.getUniformLocation(this.program, "u_similarity")
    this.uniformLocations.smoothness = gl.getUniformLocation(this.program, "u_smoothness")
    this.uniformLocations.spill = gl.getUniformLocation(this.program, "u_spill")

    // Create position buffer (full-screen quad)
    this.positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), gl.STATIC_DRAW)

    // Create texture coordinate buffer
    this.texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ]), gl.STATIC_DRAW)

    // Create texture for video frames
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    // Set texture parameters for video
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // Enable blending for transparency
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    this.initialized = true
    return true
  }

  /**
   * Process a video frame and render it to the canvas with chromakey applied
   */
  processFrame(video: HTMLVideoElement, options: ChromakeyOptions): boolean {
    if (!this.initialized || !this.gl || !this.program) {
      return false
    }

    const gl = this.gl

    // Update canvas size to match video
    if (this.canvas.width !== video.videoWidth || this.canvas.height !== video.videoHeight) {
      this.canvas.width = video.videoWidth
      this.canvas.height = video.videoHeight
      gl.viewport(0, 0, video.videoWidth, video.videoHeight)
    }

    // Clear with transparent background
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Use our program
    gl.useProgram(this.program)

    // Upload video frame to texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

    // Set uniforms
    const [r, g, b] = hexToRgb(options.keyColor)
    gl.uniform3f(this.uniformLocations.keyColor, r, g, b)
    gl.uniform1f(this.uniformLocations.similarity, options.similarity)
    gl.uniform1f(this.uniformLocations.smoothness, options.smoothness)
    gl.uniform1f(this.uniformLocations.spill, options.spill)
    gl.uniform1i(this.uniformLocations.image, 0)

    // Set up position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(this.attribLocations.position)
    gl.vertexAttribPointer(this.attribLocations.position, 2, gl.FLOAT, false, 0, 0)

    // Set up texture coordinate attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.enableVertexAttribArray(this.attribLocations.texCoord)
    gl.vertexAttribPointer(this.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0)

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    return true
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    if (!this.gl) return

    const gl = this.gl

    if (this.texture) {
      gl.deleteTexture(this.texture)
      this.texture = null
    }

    if (this.positionBuffer) {
      gl.deleteBuffer(this.positionBuffer)
      this.positionBuffer = null
    }

    if (this.texCoordBuffer) {
      gl.deleteBuffer(this.texCoordBuffer)
      this.texCoordBuffer = null
    }

    if (this.program) {
      gl.deleteProgram(this.program)
      this.program = null
    }

    this.gl = null
    this.initialized = false
  }

  /**
   * Check if the processor is ready to use
   */
  isReady(): boolean {
    return this.initialized
  }
}
