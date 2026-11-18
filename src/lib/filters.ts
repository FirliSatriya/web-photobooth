import type { FilterId } from "./types";

export const FILTER_CSS: Record<FilterId, string> = {
  none: "none",
  mono: "grayscale(1) contrast(1.06)",
  vintage: "sepia(0.38) saturate(0.9) contrast(1.08) brightness(1.02)",
  cinematic: "contrast(1.16) saturate(1.08)",
  dreamy: "saturate(0.92) brightness(1.06) contrast(0.95)",
  grain: "contrast(1.1) saturate(0.92)",
};

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform int u_mode;
uniform vec2 u_res;
in vec2 v_uv;
out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 c = texture(u_tex, uv).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec2 d = uv - 0.5;
  float vig = smoothstep(0.82, 0.28, length(d));

  if (u_mode == 1) {
    c = vec3(lum);
    c = (c - 0.5) * 1.06 + 0.5;
  } else if (u_mode == 2) {
    vec3 sepia = vec3(lum * 1.08 + 0.06, lum * 0.95 + 0.02, lum * 0.76);
    c = mix(c, sepia, 0.55);
    c = (c - 0.5) * 1.06 + 0.52;
    c *= mix(0.82, 1.0, vig);
    c.r += 0.02;
    c.b -= 0.012;
  } else if (u_mode == 3) {
    c = (c - 0.5) * 1.18 + 0.5;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 shadow = vec3(0.015, 0.09, 0.14);
    vec3 high = vec3(0.15, 0.06, 0.0);
    c += mix(shadow, high, smoothstep(0.2, 0.8, l)) * 0.45;
    c = mix(vec3(l), c, 1.06);
    c *= mix(0.88, 1.0, vig);
  } else if (u_mode == 4) {
    vec3 blur = texture(u_tex, uv + vec2(0.0028, 0.0028)).rgb * 0.25
      + texture(u_tex, uv - vec2(0.0028, 0.0028)).rgb * 0.25
      + c * 0.5;
    c = mix(c, blur, 0.55);
    c = c * 0.94 + 0.08;
    c = mix(vec3(lum), c, 0.9);
  } else if (u_mode == 5) {
    float n = hash(floor(uv * u_res));
    c = mix(vec3(lum), c, 0.9);
    c += (n - 0.5) * 0.16;
    c = (c - 0.5) * 1.12 + 0.5;
    c *= mix(0.84, 1.0, vig);
  }

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export const FILTER_MODE: Record<FilterId, number> = {
  none: 0,
  mono: 1,
  vintage: 2,
  cinematic: 3,
  dreamy: 4,
  grain: 5,
};

type SurfaceCanvas = HTMLCanvasElement | OffscreenCanvas;

function createSurfaceCanvas(width: number, height: number): SurfaceCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * GPU colour grading pipeline. The same shader source is used by the live
 * preview and by the export compositor (inside the worker), which keeps the
 * preview and the final download pixel-consistent.
 */
export class FilterSurface {
  readonly canvas: SurfaceCanvas;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uniforms: {
    mode?: WebGLUniformLocation | null;
    res?: WebGLUniformLocation | null;
  } = {};
  private width = 1;
  private height = 1;

  constructor(width: number, height: number, canvas?: SurfaceCanvas) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.canvas = canvas ?? createSurfaceCanvas(this.width, this.height);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.init();
  }

  private init() {
    const gl = this.canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    }) as WebGL2RenderingContext | null;
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    this.gl = gl;
    this.program = program;
    this.uniforms.mode = gl.getUniformLocation(program, "u_mode");
    this.uniforms.res = gl.getUniformLocation(program, "u_res");
    gl.viewport(0, 0, this.width, this.height);
  }

  get supported() {
    return this.gl !== null && this.program !== null;
  }

  render(source: TexImageSource, filter: FilterId) {
    const gl = this.gl;
    if (!gl || !this.program) return false;
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(this.uniforms.mode ?? null, FILTER_MODE[filter] ?? 0);
    gl.uniform2f(this.uniforms.res ?? null, this.width, this.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }
}

export function drawFilteredPhoto(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  surface: FilterSurface | null,
  source: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  filter: FilterId,
) {
  const isDrawable = (value: CanvasImageSource): boolean =>
    typeof (value as { width?: unknown }).width === "number";

  if (filter === "none" || !surface || !isDrawable(source)) {
    if (filter !== "none") {
      ctx.save();
      ctx.filter = FILTER_CSS[filter];
      ctx.drawImage(source, x, y, w, h);
      ctx.restore();
      return;
    }
    ctx.drawImage(source, x, y, w, h);
    return;
  }
  const rendered = surface.render(source as TexImageSource, filter);
  if (!rendered) {
    ctx.save();
    ctx.filter = FILTER_CSS[filter];
    ctx.drawImage(source, x, y, w, h);
    ctx.restore();
    return;
  }
  ctx.drawImage(surface.canvas, x, y, w, h);
}
