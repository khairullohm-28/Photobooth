/**
 * 3D LUT (.cube) Parser & WebGL Color Grading Engine
 * Supports trilinear interpolation, half-texel clamping, intensity mixing,
 * and procedural extra effects (grain, softness, vignette).
 */

export interface ParsedCubeLut {
  title: string;
  size: number; // N
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array; // N^3 * 3 float RGB in [0, 1]
}

export interface ExtraEffects {
  grain?: number; // 0 - 100
  softness?: number; // 0 - 100
  vignette?: number; // 0 - 100
}

/**
 * Parses a .cube file format.
 * Validates:
 * - Rejects LUT_1D_SIZE with explicit message: "File ini LUT 1D, hanya LUT 3D yang didukung"
 * - LUT_3D_SIZE must be between 2 and 65
 * - Row count must equal N^3
 * - Normalizes values via DOMAIN_MIN / DOMAIN_MAX
 * - Red cycles fastest, then green, then blue
 */
export function parseCubeFile(cubeText: string, fallbackTitle: string = 'Custom Filter'): ParsedCubeLut {
  const lines = cubeText.split(/\r?\n/);

  let title = fallbackTitle;
  let size = 0;
  let domainMin: [number, number, number] = [0.0, 0.0, 0.0];
  let domainMax: [number, number, number] = [1.0, 1.0, 1.0];
  const rgbValues: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('#')) {
      continue;
    }

    const parts = rawLine.split(/\s+/);
    const keyword = parts[0].toUpperCase();

    if (keyword === 'LUT_1D_SIZE') {
      throw new Error('File ini LUT 1D, hanya LUT 3D yang didukung');
    }

    if (keyword === 'TITLE') {
      const match = rawLine.match(/TITLE\s+"?([^"]+)"?/i);
      if (match && match[1]) {
        title = match[1].trim();
      }
      continue;
    }

    if (keyword === 'LUT_3D_SIZE') {
      const parsedSize = parseInt(parts[1], 10);
      if (isNaN(parsedSize) || parsedSize < 2 || parsedSize > 65) {
        throw new Error(`Ukuran LUT tidak valid: ${parts[1]} (harus antara 2 dan 65)`);
      }
      size = parsedSize;
      continue;
    }

    if (keyword === 'DOMAIN_MIN') {
      if (parts.length >= 4) {
        domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      }
      continue;
    }

    if (keyword === 'DOMAIN_MAX') {
      if (parts.length >= 4) {
        domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      }
      continue;
    }

    // Number lines (RGB data)
    if (parts.length >= 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        rgbValues.push(r, g, b);
      }
    }
  }

  if (size === 0) {
    throw new Error('File .cube tidak memiliki tag LUT_3D_SIZE yang valid');
  }

  const expectedValues = size * size * size * 3;
  if (rgbValues.length !== expectedValues) {
    throw new Error(
      `Jumlah baris data tidak sesuai: ditemukan ${rgbValues.length / 3} data RGB, diharapkan ${size * size * size}`
    );
  }

  // Normalize with DOMAIN_MIN and DOMAIN_MAX
  const diffR = domainMax[0] - domainMin[0] || 1.0;
  const diffG = domainMax[1] - domainMin[1] || 1.0;
  const diffB = domainMax[2] - domainMin[2] || 1.0;

  const data = new Float32Array(expectedValues);
  for (let i = 0; i < rgbValues.length; i += 3) {
    const normR = Math.min(1.0, Math.max(0.0, (rgbValues[i] - domainMin[0]) / diffR));
    const normG = Math.min(1.0, Math.max(0.0, (rgbValues[i + 1] - domainMin[1]) / diffG));
    const normB = Math.min(1.0, Math.max(0.0, (rgbValues[i + 2] - domainMin[2]) / diffB));

    data[i] = normR;
    data[i + 1] = normG;
    data[i + 2] = normB;
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data,
  };
}

/**
 * Trilinearly resamples a 3D LUT Float32Array from oldSize to targetSize.
 * Used when N*N > 4096 (e.g. N=65 -> 4225px) to safely downsample to N=33 (1089px).
 */
export function resampleLut3D(lutData: Float32Array, oldSize: number, targetSize: number): Float32Array {
  if (oldSize === targetSize) return lutData;

  const outData = new Float32Array(targetSize * targetSize * targetSize * 3);

  const sampleOld = (r: number, g: number, b: number, channel: number): number => {
    const clampedR = Math.max(0, Math.min(oldSize - 1, r));
    const clampedG = Math.max(0, Math.min(oldSize - 1, g));
    const clampedB = Math.max(0, Math.min(oldSize - 1, b));
    const idx = (clampedR + clampedG * oldSize + clampedB * oldSize * oldSize) * 3 + channel;
    return lutData[idx];
  };

  const trilinear = (normR: number, normG: number, normB: number, channel: number): number => {
    const rx = normR * (oldSize - 1);
    const gy = normG * (oldSize - 1);
    const bz = normB * (oldSize - 1);

    const r0 = Math.floor(rx);
    const r1 = Math.min(oldSize - 1, r0 + 1);
    const g0 = Math.floor(gy);
    const g1 = Math.min(oldSize - 1, g0 + 1);
    const b0 = Math.floor(bz);
    const b1 = Math.min(oldSize - 1, b0 + 1);

    const fr = rx - r0;
    const fg = gy - g0;
    const fb = bz - b0;

    const c000 = sampleOld(r0, g0, b0, channel);
    const c100 = sampleOld(r1, g0, b0, channel);
    const c010 = sampleOld(r0, g1, b0, channel);
    const c110 = sampleOld(r1, g1, b0, channel);
    const c001 = sampleOld(r0, g0, b1, channel);
    const c101 = sampleOld(r1, g0, b1, channel);
    const c011 = sampleOld(r0, g1, b1, channel);
    const c111 = sampleOld(r1, g1, b1, channel);

    const c00 = c000 * (1 - fr) + c100 * fr;
    const c10 = c010 * (1 - fr) + c110 * fr;
    const c01 = c001 * (1 - fr) + c101 * fr;
    const c11 = c011 * (1 - fr) + c111 * fr;

    const c0 = c00 * (1 - fg) + c10 * fg;
    const c1 = c01 * (1 - fg) + c11 * fg;

    return c0 * (1 - fb) + c1 * fb;
  };

  let writeIdx = 0;
  for (let b = 0; b < targetSize; b++) {
    const normB = b / (targetSize - 1);
    for (let g = 0; g < targetSize; g++) {
      const normG = g / (targetSize - 1);
      for (let r = 0; r < targetSize; r++) {
        const normR = r / (targetSize - 1);
        outData[writeIdx++] = trilinear(normR, normG, normB, 0);
        outData[writeIdx++] = trilinear(normR, normG, normB, 1);
        outData[writeIdx++] = trilinear(normR, normG, normB, 2);
      }
    }
  }

  return outData;
}

/**
 * Creates a horizontal Strip PNG from 3D LUT data:
 * Width = N * N, Height = N.
 * Slices of B are placed horizontally: slice B occupies x in [B * N, (B+1) * N - 1].
 * Within each slice: x = R, y = G.
 * If N * N > 4096 (e.g. N=65), it automatically resamples to N=33 first.
 */
export function createLutStripCanvas(lut: ParsedCubeLut): { canvas: HTMLCanvasElement; finalSize: number } {
  let activeSize = lut.size;
  let activeData = lut.data;

  // Max texture dimension safety check
  if (activeSize * activeSize > 4096) {
    activeSize = 33;
    activeData = resampleLut3D(lut.data, lut.size, 33);
  }

  const width = activeSize * activeSize;
  const height = activeSize;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2D canvas context for LUT strip generation');

  const imgData = ctx.createImageData(width, height);
  const pixels = imgData.data;

  // Red cycles fastest, then green, then blue in cube data:
  // idx in cube = (r + g * N + b * N * N) * 3
  // In strip canvas:
  // For slice b in [0..N-1], row g in [0..N-1], col r in [0..N-1]:
  // canvas X = b * N + r
  // canvas Y = g
  // pixel index = (Y * width + X) * 4
  for (let b = 0; b < activeSize; b++) {
    for (let g = 0; g < activeSize; g++) {
      for (let r = 0; r < activeSize; r++) {
        const cubeIdx = (r + g * activeSize + b * activeSize * activeSize) * 3;
        const canvasX = b * activeSize + r;
        const canvasY = g;
        const pixelIdx = (canvasY * width + canvasX) * 4;

        pixels[pixelIdx] = Math.round(activeData[cubeIdx] * 255);
        pixels[pixelIdx + 1] = Math.round(activeData[cubeIdx + 1] * 255);
        pixels[pixelIdx + 2] = Math.round(activeData[cubeIdx + 2] * 255);
        pixels[pixelIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { canvas, finalSize: activeSize };
}

export function createLutStripDataUrl(lut: ParsedCubeLut): { dataUrl: string; finalSize: number } {
  const { canvas, finalSize } = createLutStripCanvas(lut);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    finalSize,
  };
}

// --------------------------------------------------------------------------
// WebGL LUT Shaders & Context Cache
// --------------------------------------------------------------------------

const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER_SRC = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform sampler2D u_lut;
  uniform float u_lut_size;
  uniform float u_intensity;
  uniform float u_grain;
  uniform float u_softness;
  uniform float u_vignette;
  uniform vec2 u_resolution;

  // Sample 3D LUT from horizontal strip with half-texel clamping
  vec3 sampleLutStrip(vec3 color) {
    float size = u_lut_size;
    float maxColor = size - 1.0;
    
    // Scale blue to slice indices
    float b = clamp(color.b * maxColor, 0.0, maxColor);
    float b0 = floor(b);
    float b1 = min(b0 + 1.0, maxColor);
    float f_b = b - b0;

    float stripWidth = size * size;
    float stripHeight = size;

    // Half-texel offset clamped inside slice bounds
    // u = (b * size + 0.5 + r * (size - 1)) / (size * size)
    // v = (0.5 + g * (size - 1)) / size
    float u0 = (b0 * size + 0.5 + color.r * (size - 1.0)) / stripWidth;
    float u1 = (b1 * size + 0.5 + color.r * (size - 1.0)) / stripWidth;
    float v = (0.5 + color.g * (size - 1.0)) / stripHeight;

    vec3 s0 = texture2D(u_lut, vec2(u0, v)).rgb;
    vec3 s1 = texture2D(u_lut, vec2(u1, v)).rgb;

    return mix(s0, s1, f_b);
  }

  // Procedural pseudo-random noise for film grain
  float randomNoise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec4 baseColor = texture2D(u_image, v_texCoord);
    vec3 col = baseColor.rgb;

    // Optional softness: subtle 4-sample box blur
    if (u_softness > 0.001) {
      vec2 off = (1.5 * u_softness) / u_resolution;
      vec3 blurCol = (
        texture2D(u_image, v_texCoord + vec2(-off.x, -off.y)).rgb +
        texture2D(u_image, v_texCoord + vec2( off.x, -off.y)).rgb +
        texture2D(u_image, v_texCoord + vec2(-off.x,  off.y)).rgb +
        texture2D(u_image, v_texCoord + vec2( off.x,  off.y)).rgb
      ) * 0.25;
      col = mix(col, blurCol, u_softness * 0.7);
    }

    // Apply LUT color grading with intensity mix
    vec3 lutColor = sampleLutStrip(col);
    vec3 graded = mix(col, lutColor, u_intensity);

    // Vignette effect
    if (u_vignette > 0.001) {
      vec2 centerCoord = (v_texCoord - 0.5) * 2.0;
      float dist = length(centerCoord);
      float vigFactor = smoothstep(0.7, 1.4, dist);
      graded *= (1.0 - vigFactor * u_vignette * 0.85);
    }

    // Procedural film grain
    if (u_grain > 0.001) {
      float noise = (randomNoise(v_texCoord * u_resolution) - 0.5) * (u_grain * 0.28);
      graded = clamp(graded + noise, 0.0, 1.0);
    }

    gl_FragColor = vec4(graded, baseColor.a);
  }
`;

interface GlContextCache {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  texCoordBuffer: WebGLBuffer;
  lutTextures: Map<string, WebGLTexture>;
}

let glCache: GlContextCache | null = null;

function initGlContext(): GlContextCache | null {
  if (glCache) return glCache;

  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', {
    preserveDrawingBuffer: true,
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
  });

  if (!gl) {
    console.warn('WebGL is not supported in this environment');
    return null;
  }

  // Compile shaders
  const compileShader = (type: number, src: string): WebGLShader => {
    const s = gl.createShader(type);
    if (!s) throw new Error('Cannot create WebGL shader');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`WebGL shader compile failed: ${err}`);
    }
    return s;
  };

  let vertShader: WebGLShader;
  let fragShader: WebGLShader;
  let program: WebGLProgram;
  try {
    vertShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    fragShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    const p = gl.createProgram();
    if (!p) throw new Error('Cannot create WebGL program');
    gl.attachShader(p, vertShader);
    gl.attachShader(p, fragShader);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`WebGL program link error: ${gl.getProgramInfoLog(p)}`);
    }
    program = p;
  } catch (e) {
    console.warn('WebGL program setup failed:', e);
    return null;
  }

  // Set up quad buffers
  const positionBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  const texCoordBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  // Invert Y for proper canvas orientation
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
    gl.STATIC_DRAW
  );

  glCache = {
    canvas,
    gl,
    program,
    positionBuffer,
    texCoordBuffer,
    lutTextures: new Map(),
  };

  return glCache;
}

/**
 * Loads an image from a URL or data URL if not already an HTMLImageElement
 */
export async function loadLutImage(src: CanvasImageSource | string): Promise<CanvasImageSource> {
  if (typeof src !== 'string') return src;

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for LUT processing'));
    img.src = src;
  });
}

/**
 * Applies a 3D LUT (strip image) and extra effects to a source image using WebGL.
 * Caps processing resolution at 4096px.
 * Falls back safely to 2D canvas if WebGL or LUT is unavailable.
 */
export async function applyLut(
  source: CanvasImageSource | string,
  lutStrip: CanvasImageSource | string | null,
  intensity: number = 100, // 0 - 100
  extraEffects?: ExtraEffects,
  lutSize: number = 33
): Promise<HTMLCanvasElement> {
  const srcImg = await loadLutImage(source);

  const rawW =
    srcImg instanceof HTMLVideoElement
      ? srcImg.videoWidth
      : (srcImg as HTMLImageElement).naturalWidth || (srcImg as any).width || 800;
  const rawH =
    srcImg instanceof HTMLVideoElement
      ? srcImg.videoHeight
      : (srcImg as HTMLImageElement).naturalHeight || (srcImg as any).height || 600;

  // Cap max resolution at 4096px
  let outW = rawW;
  let outH = rawH;
  const maxDim = 4096;
  if (Math.max(rawW, rawH) > maxDim) {
    if (rawW >= rawH) {
      outW = maxDim;
      outH = Math.round((rawH * maxDim) / rawW);
    } else {
      outH = maxDim;
      outW = Math.round((rawW * maxDim) / rawH);
    }
  }

  // If no LUT or intensity === 0 and no extra effects, return simple 2D canvas
  const normIntensity = Math.max(0, Math.min(100, intensity)) / 100;
  const grain = Math.max(0, Math.min(100, extraEffects?.grain || 0)) / 100;
  const softness = Math.max(0, Math.min(100, extraEffects?.softness || 0)) / 100;
  const vignette = Math.max(0, Math.min(100, extraEffects?.vignette || 0)) / 100;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;

  if (!lutStrip || (normIntensity <= 0 && grain === 0 && softness === 0 && vignette === 0)) {
    const ctx = outCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(srcImg as any, 0, 0, outW, outH);
    }
    return outCanvas;
  }

  const cache = initGlContext();
  if (!cache) {
    // Fallback: 2D canvas
    const ctx = outCanvas.getContext('2d');
    if (ctx) ctx.drawImage(srcImg as any, 0, 0, outW, outH);
    return outCanvas;
  }

  const { gl, program, positionBuffer, texCoordBuffer, lutTextures } = cache;
  cache.canvas.width = outW;
  cache.canvas.height = outH;
  gl.viewport(0, 0, outW, outH);

  gl.useProgram(program);

  // Bind attribute buffers
  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const texLoc = gl.getAttribLocation(program, 'a_texCoord');
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.enableVertexAttribArray(texLoc);
  gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

  // Upload source image texture (Unit 0)
  const imageTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, imageTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcImg as any);

  // Load and cache LUT texture (Unit 1)
  const lutImg = await loadLutImage(lutStrip);
  let lutTexKey = typeof lutStrip === 'string' ? lutStrip : (lutStrip as any).src || 'lut_obj';
  let lutTex = lutTextures.get(lutTexKey);

  if (!lutTex) {
    lutTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lutImg as any);
    if (lutTexKey.length < 500) {
      lutTextures.set(lutTexKey, lutTex);
    }
  }

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, lutTex);

  // Set Uniforms
  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'u_lut'), 1);
  gl.uniform1f(gl.getUniformLocation(program, 'u_lut_size'), lutSize);
  gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), normIntensity);
  gl.uniform1f(gl.getUniformLocation(program, 'u_grain'), grain);
  gl.uniform1f(gl.getUniformLocation(program, 'u_softness'), softness);
  gl.uniform1f(gl.getUniformLocation(program, 'u_vignette'), vignette);
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), outW, outH);

  // Render quad
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Copy to outCanvas
  const outCtx = outCanvas.getContext('2d');
  if (outCtx) {
    outCtx.drawImage(cache.canvas, 0, 0);
  }

  // Cleanup temporary source image texture
  gl.deleteTexture(imageTex);

  return outCanvas;
}
