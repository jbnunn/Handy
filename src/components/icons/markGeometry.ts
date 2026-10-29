/**
 * Geometry for Sine's mark: three tapered sine ribbons in their own lanes,
 * drawn like the Aurora recording animation, on a 64×64 grid. The single
 * source for the in-app icons (SineMark, TrayIcon) and the generated tray/app
 * PNGs (scripts/generate-brand.ts), so they never drift.
 */

export const MARK_SIZE = 64;

/** [lobes, amplitude, phase]: one wobble term of a ring's radius. */
type Wobble = [number, number, number];

/**
 * Closed wavy ring: radius R plus a few wobble terms. Mixing two lobe counts
 * keeps it organic; a single term reads as a regular polygon.
 */
function wavyRing(R: number, wobbles: Wobble[], steps = 180): string {
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const r = wobbles.reduce(
      (acc, [lobes, amp, phase]) => acc + amp * Math.sin(lobes * th + phase),
      R,
    );
    const x = 32 + r * Math.cos(th);
    const y = 32 + r * Math.sin(th);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${pts.join("")}Z`;
}

interface RibbonSpec {
  /** Lane center. */
  y: number;
  amp: number;
  phase: number;
  /** Half thickness at the middle; the ends taper to a quarter of it. */
  halfWidth: number;
  /** Relative strength: outer ribbons are fainter, like Aurora's. */
  opacity: number;
}

const X0 = 9;
const X1 = 55;
const PERIODS = 1;

/** A sine ribbon as a filled outline, thickest in the middle. */
function ribbon({ y, amp, phase, halfWidth }: RibbonSpec, steps = 64): string {
  const k = (PERIODS * Math.PI * 2) / (X1 - X0);
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = X0 + (X1 - X0) * t;
    const cy = y - amp * Math.sin(k * (x - X0) + phase);
    // Offset along the normal so steep parts keep their thickness.
    const slope = -amp * k * Math.cos(k * (x - X0) + phase);
    const len = Math.hypot(1, slope);
    const w = halfWidth * (0.25 + 0.75 * Math.pow(Math.sin(Math.PI * t), 0.7));
    const nx = (-slope / len) * w;
    const ny = (1 / len) * w;
    top.push(`${(x + nx).toFixed(2)} ${(cy - ny).toFixed(2)}`);
    bottom.push(`${(x - nx).toFixed(2)} ${(cy + ny).toFixed(2)}`);
  }
  return `M${top.join("L")}L${bottom.reverse().join("L")}Z`;
}

const RIBBON_SPECS: RibbonSpec[] = [
  { y: 20, amp: 4.2, phase: -0.35, halfWidth: 2.5, opacity: 0.75 },
  { y: 32, amp: 4.8, phase: 0, halfWidth: 3.3, opacity: 1 },
  { y: 44, amp: 4.2, phase: 0.35, halfWidth: 2.5, opacity: 0.75 },
];

/** The three ribbons, top to bottom, with their Aurora hues (degrees). */
export const RIBBONS = RIBBON_SPECS.map((spec, i) => ({
  path: ribbon(spec),
  opacity: spec.opacity,
  // Aurora's shader: hue = 0.45 + i * 0.19, drifting ±0.22 across x.
  hue: (0.45 + i * 0.19) * 360,
  hueSpread: 0.22 * 360,
}));

/** One calm, nearly flat ribbon: the "transcribing" glyph. */
export const CALM = ribbon({
  y: 32,
  amp: 2,
  phase: 0,
  halfWidth: 3.4,
  opacity: 1,
});

/** Filled wavy disc behind the knocked-out glyph in the busy states. */
export const DISC = wavyRing(28.5, [
  [3, 0.9, 0.4],
  [5, 0.6, 1.9],
]);

/** The ribbons shrunk to sit inside the disc. */
const IN_DISC = "translate(32 32) scale(0.74) translate(-32 -32)";

/** Warning badge, bottom right, cut out of the idle mark. */
export const BADGE = {
  cx: 49,
  cy: 49,
  gap: 14,
  r: 11,
  bar: { x: 47.6, y: 41.5, width: 2.8, height: 9, radius: 1.4 },
  dot: { cx: 49, cy: 55, r: 1.7 },
};

export type MarkState = "idle" | "recording" | "transcribing" | "warning";

export interface MarkSvgOptions {
  /** Prefix for mask/gradient ids, so several inline marks can share a page. */
  id?: string;
  /** Rendered width/height; defaults to the 64px grid. */
  size?: string | number;
  /** Paint each idle ribbon with its Aurora gradient instead of `color`. */
  aurora?: boolean;
}

/** Horizontal Aurora gradients, one per ribbon, for `aurora` marks. */
function auroraDefs(id: string): string {
  return RIBBONS.map(
    (r, i) =>
      `<linearGradient id="${id}r${i}" x1="${X0}" x2="${X1}" y1="0" y2="0" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="hsl(${(r.hue - r.hueSpread).toFixed(0)} 90% 62%)"/>` +
      `<stop offset="1" stop-color="hsl(${(r.hue + r.hueSpread).toFixed(0)} 90% 62%)"/>` +
      `</linearGradient>`,
  ).join("");
}

/**
 * A full SVG of the mark in `color`. Knockouts are real transparency via
 * masks, so the tray PNGs work as macOS template images.
 */
export function markSvg(
  state: MarkState,
  color: string,
  { id = "", size = MARK_SIZE, aurora = false }: MarkSvgOptions = {},
): string {
  const m = `${id}m`;
  const bm = `${id}b`;
  const ribbons = (paint: (i: number) => string, withOpacity = true) =>
    RIBBONS.map(
      (r, i) =>
        `<path d="${r.path}" fill="${paint(i)}"${withOpacity && r.opacity < 1 ? ` fill-opacity="${r.opacity}"` : ""}/>`,
    ).join("");
  const idlePaint = (i: number) => (aurora ? `url(#${id}r${i})` : color);
  let defs = aurora ? auroraDefs(id) : "";
  let body: string;
  if (state === "idle") {
    body = ribbons(idlePaint);
  } else if (state === "warning") {
    const b = BADGE;
    defs += `<mask id="${m}"><rect width="64" height="64" fill="white"/><circle cx="${b.cx}" cy="${b.cy}" r="${b.gap}" fill="black"/></mask><mask id="${bm}"><circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="white"/><rect x="${b.bar.x}" y="${b.bar.y}" width="${b.bar.width}" height="${b.bar.height}" rx="${b.bar.radius}" fill="black"/><circle cx="${b.dot.cx}" cy="${b.dot.cy}" r="${b.dot.r}" fill="black"/></mask>`;
    body = `<g mask="url(#${m})">${ribbons(idlePaint)}</g><circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${color}" mask="url(#${bm})"/>`;
  } else {
    // Busy states: a soft blob with the glyph cut out of it.
    const glyph =
      state === "recording"
        ? `<g transform="${IN_DISC}">${ribbons(() => "black", false)}</g>`
        : `<path d="${CALM}" fill="black" transform="${IN_DISC}"/>`;
    defs += `<mask id="${m}"><rect width="64" height="64" fill="white"/>${glyph}</mask>`;
    body = `<path d="${DISC}" fill="${color}" mask="url(#${m})"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;
}
