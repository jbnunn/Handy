import React, { useEffect, useRef } from "react";
import type { OverlayIndicator } from "@/bindings";

// Animated shape shown while recording and transcribing, in place of the pill.
// Each indicator is one fragment shader with five inputs: motion time, mic level
// (0..1), how far it has appeared (0..1), how far it has settled into the
// "thinking" state after the key is released (0..1), and that state's breathing
// pulse (0..1). Motion time slows to a stop as it starts thinking. Color is additive light, so brightness becomes alpha and
// the shape floats on the transparent overlay window with no card behind it.

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const COMMON = `
precision highp float;
uniform vec2 res; uniform float t, lvl, show, think, pulse;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 hsl(float h, float s, float l){
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
// Additive light -> premultiplied output; brightness becomes alpha.
vec4 light(vec3 c){ c = max(c, 0.0); return vec4(min(c, 1.0), min(max(c.r, max(c.g, c.b)), 1.0)); }
`;

// Spinning spectral ring. Opens from a point, bulges and brightens with the voice;
// while thinking it holds still and breathes, with a faint color filling it.
const HALO = `${COMMON}
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / (0.5 * min(res.x, res.y));
  float r = length(p), th = atan(p.y, p.x);
  float a = th - t * 2.6; // spin, ~0.4 rev/s: shape, color and bright head ride on it
  float open = 1.0 - pow(1.0 - show, 3.0);
  float R = 0.6 * (0.35 + 0.65 * open)
          + 0.04 * sin(3.0 * a) + 0.025 * sin(6.0 * a + t * 0.8)
          + lvl * (0.05 + 0.07 * (0.5 + 0.5 * sin(4.0 * a + t * 3.0)))
          + think * 0.025 * pulse;
  float d = abs(r - R);
  float w = 0.05 + 0.03 * lvl;
  float I = exp(-pow(d / w, 2.0)) * 1.1 + exp(-pow(d / 0.16, 2.0)) * (0.3 + 0.35 * lvl);
  float head = 0.65 + 0.7 * pow(0.5 + 0.5 * cos(a), 3.0);
  vec3 col = hsl(a / 6.2831853 + 0.08 * sin(r * 6.0), 0.92, 0.6) * I * head;
  if (r < R) col += hsl(0.62 + t * 0.05, 0.7, 0.6) * (0.08 + 0.1 * lvl) * smoothstep(0.0, R, r);
  col += exp(-pow(d / 0.016, 2.0)) * (0.4 + 0.3 * lvl);
  col *= 1.0 - think * (0.3 - 0.3 * pulse);
  float inside = 1.0 - smoothstep(R * 0.7, R, r);
  col += hsl(0.62 + 0.12 * p.y - 0.06 * p.x, 0.8, 0.62) * inside * think * (0.1 + 0.2 * pulse);
  // Fade the outer glow before the canvas edge so it never shows a hard border.
  gl_FragColor = light(col * show * smoothstep(1.0, 0.8, r));
}`;

// Three luminous ribbons drifting sideways. They spread out from the center on
// show, and the voice drives how tall the ripples get; while thinking they hold
// still and breathe over a faint band of color.
const AURORA = `${COMMON}
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / (0.5 * res.x);
  float x = p.x, y = p.y * 2.0;
  float reach = max(show, 0.001);
  float env = smoothstep(0.98, 0.4, abs(x) / reach) * smoothstep(0.75, 0.2, abs(y));
  float amp = 0.45 + 1.5 * lvl;
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float i = float(k);
    float yc = amp * (0.17 * sin(x * 2.6 + i * 2.1 + t * (0.8 + 0.25 * i))
                    + 0.05 * sin(x * 5.1 + i - t * 1.1));
    float w = 0.085 + 0.035 * sin(x * 1.6 + i * 1.7 + t * 0.5) + 0.04 * lvl;
    float I = exp(-pow((y - yc) / w, 2.0)) + 0.25 * exp(-pow((y - yc) / (w * 3.5), 2.0));
    I *= 0.8 + 0.2 * noise(vec2(x * 4.0 + i * 10.0 - t * 0.5, i + t * 0.2));
    col += hsl(0.45 + i * 0.19 + x * 0.22 + t * 0.04, 0.92, 0.6) * I;
  }
  col *= 1.0 - think * (0.35 - 0.35 * pulse);
  col += hsl(0.55 + x * 0.2, 0.8, 0.6) * exp(-pow(y / 0.3, 2.0)) * think * (0.08 + 0.18 * pulse);
  gl_FragColor = light(col * env * (0.95 + 0.6 * lvl) * show);
}`;

// Four soft clouds (cyan, magenta, amber, violet) orbiting a white core. The
// voice pulls them inward and brightens the core; while thinking they hold still
// and breathe.
const NEBULA = `${COMMON}
vec3 lobeColor(int k){
  if (k == 0) return hsl(0.52, 0.95, 0.55);
  if (k == 1) return hsl(0.90, 0.90, 0.60);
  if (k == 2) return hsl(0.11, 0.95, 0.58);
  return hsl(0.74, 0.85, 0.62);
}
void main(){
  vec2 q = (gl_FragCoord.xy - 0.5 * res) / (0.5 * min(res.x, res.y));
  float open = 1.0 - pow(1.0 - show, 3.0);
  vec2 p = q * 1.15 / (0.25 + 0.75 * open);
  p += 0.14 * (vec2(noise(p * 2.0 + t * 0.35), noise(p * 2.0 + 7.0 - t * 0.3)) - 0.5);
  vec3 col = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    float i = float(k);
    float ang = i * 1.5708 + t * (0.55 + 0.1 * i);
    float rad = (0.34 + 0.06 * sin(t * 0.8 + i * 1.3)) * (1.0 - 0.4 * lvl);
    vec2 c = rad * vec2(cos(ang), sin(ang));
    float s = 0.3 + 0.04 * sin(t * 1.1 + i) + 0.05 * lvl;
    col += lobeColor(k) * exp(-dot(p - c, p - c) / (s * s));
  }
  float core = exp(-dot(p, p) / (0.02 + 0.04 * lvl)) * (0.45 + 0.6 * lvl);
  col = col * (0.95 + 0.4 * lvl) + core;
  col *= 1.0 - think * (0.35 - 0.35 * pulse);
  gl_FragColor = light(col * show * smoothstep(1.0, 0.7, length(q)));
}`;

interface BlobSpec {
  frag: string;
  /** Visible size in CSS px; must fit the overlay window (overlay.rs). */
  width: number;
  height: number;
  /** Extra level smoothing, so the shape swells instead of twitching. */
  soft: boolean;
}

const BLOBS: Record<OverlayIndicator, BlobSpec> = {
  halo: { frag: HALO, width: 100, height: 100, soft: false },
  aurora: { frag: AURORA, width: 240, height: 90, soft: true },
  nebula: { frag: NEBULA, width: 100, height: 100, soft: false },
};

type Renderer = (
  w: number,
  h: number,
  t: number,
  lvl: number,
  show: number,
  think: number,
  pulse: number,
) => void;

function createRenderer(
  canvas: HTMLCanvasElement,
  frag: string,
): Renderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  // One oversized triangle covers the viewport.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "res");
  const uT = gl.getUniformLocation(prog, "t");
  const uLvl = gl.getUniformLocation(prog, "lvl");
  const uShow = gl.getUniformLocation(prog, "show");
  const uThink = gl.getUniformLocation(prog, "think");
  const uPulse = gl.getUniformLocation(prog, "pulse");
  return (w, h, t, lvl, show, think, pulse) => {
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uT, t);
    gl.uniform1f(uLvl, lvl);
    gl.uniform1f(uShow, show);
    gl.uniform1f(uThink, think);
    gl.uniform1f(uPulse, pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

// Probed once so the overlay can fall back to the classic pill without WebGL.
export const BLOB_SUPPORTED = (() => {
  try {
    return createRenderer(document.createElement("canvas"), HALO) !== null;
  } catch {
    return false;
  }
})();

interface ListeningBlobProps {
  indicator: OverlayIndicator;
  /** Recording or transcribing: the shape opens while true, collapses when false. */
  active: boolean;
  /** Key released, transcribing: motion stops and the shape breathes. */
  thinking: boolean;
  /** False while the mic is still arming: the shape waits half-open and dim. */
  ready: boolean;
  /** Latest raw mic level, 0..1. Read every frame; smoothed here. */
  levelRef: React.MutableRefObject<number>;
}

const ListeningBlob: React.FC<ListeningBlobProps> = ({
  indicator,
  active,
  thinking,
  ready,
  levelRef,
}) => {
  const spec = BLOBS[indicator] ?? BLOBS.halo;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(0);
  const thinkingRef = useRef(false);
  const loopRef = useRef<(() => void) | null>(null);

  targetRef.current = active ? (ready || thinking ? 1 : 0.55) : 0;
  thinkingRef.current = thinking;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = createRenderer(canvas, spec.frag);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let raf = 0;
    let running = false;
    let last = 0;
    let clock = 0;
    let show = 0;
    let lvl = 0;
    let soft = 0;
    let think = 0;
    let breath = 0;

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const pace = reduce.matches ? 0.3 : 1;
      const target = targetRef.current;
      // Ease into thinking over ~0.5s; motion time slows to a stop with it.
      const thinkGoal = thinkingRef.current ? 1 : 0;
      think += (thinkGoal - think) * (1 - Math.exp(-dt * 5));
      clock += dt * pace * (1 - think);
      // Breathing phase only advances while thinking, so each pulse starts dim.
      breath = thinkGoal ? breath + dt * pace : 0;
      const pulse = 0.5 - 0.5 * Math.cos(breath * Math.PI * 1.5);
      // Open fast, collapse faster: the window hides ~300ms after release.
      show += (target - show) * (1 - Math.exp(-dt * (target > show ? 9 : 12)));
      const goal =
        target > 0 && !thinkGoal ? Math.min(1, levelRef.current * 1.4) : 0;
      // Fast attack, slower release, so syllables punch and pauses settle.
      lvl += (goal - lvl) * (1 - Math.exp(-dt * (goal > lvl ? 18 : 7)));
      soft += (lvl - soft) * (1 - Math.exp(-dt * 4));
      const dpr = window.devicePixelRatio || 1;
      render?.(
        Math.round(spec.width * dpr),
        Math.round(spec.height * dpr),
        clock,
        spec.soft ? soft : lvl,
        show,
        think,
        pulse,
      );
      if (target === 0 && show < 0.002) {
        running = false; // idle: stop drawing until the next show
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    loopRef.current = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    if (targetRef.current > 0) loopRef.current();

    return () => {
      cancelAnimationFrame(raf);
      loopRef.current = null;
    };
  }, [spec, levelRef]);

  useEffect(() => {
    if (active) loopRef.current?.();
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="blob"
      style={{ width: spec.width, height: spec.height }}
      aria-hidden="true"
    />
  );
};

export default ListeningBlob;
