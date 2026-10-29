import React, { useEffect, useRef } from "react";

// Spinning spectral ring shown while recording. A single fragment shader with
// three inputs: time, mic level (0..1), and how far it has appeared (0..1).
// The ring opens from a point on show, bulges and brightens with the voice, and
// collapses on hide. Color is additive light, so brightness becomes alpha and
// the ring floats on the transparent overlay window with no card behind it.

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 res; uniform float t, lvl, show;
vec3 hsl(float h, float s, float l){
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / (0.5 * min(res.x, res.y));
  float r = length(p), th = atan(p.y, p.x);
  float a = th - t * 2.6; // spin, ~0.4 rev/s: shape, color and bright head ride on it
  float open = 1.0 - pow(1.0 - show, 3.0);
  float R = 0.6 * (0.35 + 0.65 * open)
          + 0.04 * sin(3.0 * a) + 0.025 * sin(6.0 * a + t * 0.8)
          + lvl * (0.05 + 0.07 * (0.5 + 0.5 * sin(4.0 * a + t * 3.0)));
  float d = abs(r - R);
  float w = 0.05 + 0.03 * lvl;
  float I = exp(-pow(d / w, 2.0)) * 1.1 + exp(-pow(d / 0.16, 2.0)) * (0.3 + 0.35 * lvl);
  float head = 0.65 + 0.7 * pow(0.5 + 0.5 * cos(a), 3.0);
  vec3 col = hsl(a / 6.2831853 + 0.08 * sin(r * 6.0), 0.92, 0.6) * I * head;
  if (r < R) col += hsl(0.62 + t * 0.05, 0.7, 0.6) * (0.08 + 0.1 * lvl) * smoothstep(0.0, R, r);
  col += exp(-pow(d / 0.016, 2.0)) * (0.4 + 0.3 * lvl);
  // Fade the outer glow before the canvas edge so it never shows a hard border.
  col *= show * smoothstep(1.0, 0.8, r);
  col = max(col, 0.0);
  gl_FragColor = vec4(min(col, 1.0), min(max(col.r, max(col.g, col.b)), 1.0));
}`;

type Renderer = (
  w: number,
  h: number,
  t: number,
  lvl: number,
  show: number,
) => void;

function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
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
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
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
  return (w, h, t, lvl, show) => {
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

// Probed once so the overlay can fall back to the classic pill without WebGL.
export const HALO_SUPPORTED = (() => {
  try {
    return createRenderer(document.createElement("canvas")) !== null;
  } catch {
    return false;
  }
})();

// Visible square in CSS px; must fit the overlay window height (overlay.rs).
const HALO_SIZE = 100;

interface HaloProps {
  /** Recording: the ring opens while true and collapses when false. */
  active: boolean;
  /** False while the mic is still arming: the ring waits half-open and dim. */
  ready: boolean;
  /** Latest raw mic level, 0..1. Read every frame; smoothed here. */
  levelRef: React.MutableRefObject<number>;
}

const Halo: React.FC<HaloProps> = ({ active, ready, levelRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const targetRef = useRef(0);
  const loopRef = useRef<(() => void) | null>(null);

  targetRef.current = active ? (ready ? 1 : 0.55) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = createRenderer(canvas);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let raf = 0;
    let running = false;
    let last = 0;
    let clock = 0;
    let show = 0;
    let lvl = 0;

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      clock += dt * (reduce.matches ? 0.3 : 1);
      const target = targetRef.current;
      // Open fast, collapse faster: the window hides ~300ms after release.
      show += (target - show) * (1 - Math.exp(-dt * (target > show ? 9 : 12)));
      const goal = target > 0 ? Math.min(1, levelRef.current * 1.4) : 0;
      // Fast attack, slower release, so syllables punch and pauses settle.
      lvl += (goal - lvl) * (1 - Math.exp(-dt * (goal > lvl ? 18 : 7)));
      const dpr = window.devicePixelRatio || 1;
      const px = Math.round(HALO_SIZE * dpr);
      rendererRef.current?.(px, px, clock, lvl, show);
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
  }, [levelRef]);

  useEffect(() => {
    if (active) loopRef.current?.();
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="halo"
      style={{ width: HALO_SIZE, height: HALO_SIZE }}
      aria-hidden="true"
    />
  );
};

export default Halo;
