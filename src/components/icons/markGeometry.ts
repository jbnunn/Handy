/**
 * Geometry for Sine's mark: a podcast mic inside a wavy halo, on a 64×64 grid.
 * The single source for the in-app icons (SineMark, TrayIcon) and the
 * generated tray/app PNGs (scripts/generate-brand.ts), so they never drift.
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

/** Open sine stroke across the middle, used as the "transcribing" glyph. */
function sineStroke(x0: number, x1: number, amp: number, steps = 60): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = 32 - amp * Math.sin(t * Math.PI * 2);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join("");
}

/**
 * Two braided rings: a solid one and a fainter, phase-shifted echo. The echo
 * turns to fuzz at menu bar size, so the tray icons leave it out.
 */
export const HALO = {
  main: wavyRing(26, [
    [3, 1.1, 0.4],
    [5, 0.8, 1.9],
  ]),
  echo: wavyRing(26, [
    [3, 1.1, 2.2],
    [5, 0.8, 4.3],
  ]),
  mainWidth: 3.2,
  echoWidth: 1.8,
  echoOpacity: 0.55,
};

/** Filled wavy disc behind the knocked-out glyph in the busy states. */
export const DISC = wavyRing(28.5, [
  [3, 0.9, 0.4],
  [5, 0.6, 1.9],
]);

export const MIC = {
  capsule: { x: 25, y: 12, width: 14, height: 24, radius: 7 },
  /** Grille slots knocked out of the capsule. */
  grille: [19, 23.5, 28].map((y) => `M28.5 ${y}H35.5`),
  grilleWidth: 1.7,
  yoke: "M19.5 25V27A12.5 12.5 0 0 0 44.5 27V25",
  stem: "M32 39.5V47",
  base: "M25.5 48.5H38.5",
  strokeWidth: 3,
};

/** The mic shrunk to sit inside the disc. */
export const MIC_IN_DISC = "translate(32 32) scale(0.82) translate(-32 -32)";

export const SINE = { path: sineStroke(14, 50, 7.5), width: 4.4 };

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

/** The mic as SVG markup, in `color`, for the generator. */
function micMarkup(color: string, grilleColor: string): string {
  const c = MIC.capsule;
  const s = `stroke="${color}" stroke-width="${MIC.strokeWidth}" stroke-linecap="round" fill="none"`;
  return [
    `<rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" rx="${c.radius}" fill="${color}"/>`,
    ...MIC.grille.map(
      (d) =>
        `<path d="${d}" stroke="${grilleColor}" stroke-width="${MIC.grilleWidth}" stroke-linecap="round"/>`,
    ),
    `<path d="${MIC.yoke}" ${s}/>`,
    `<path d="${MIC.stem}" ${s}/>`,
    `<path d="${MIC.base}" ${s}/>`,
  ].join("");
}

/** Just the mic (grille knocked out), for the app icon's colored halo. */
export function micSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><mask id="m"><rect width="64" height="64" fill="white"/>${MIC.grille
    .map(
      (d) =>
        `<path d="${d}" stroke="black" stroke-width="${MIC.grilleWidth}" stroke-linecap="round"/>`,
    )
    .join("")}</mask><g mask="url(#m)">${micMarkup(color, color)}</g></svg>`;
}

export interface MarkSvgOptions {
  /** Draw the faint second halo ring (skip it at menu bar size). */
  echo?: boolean;
  /** Prefix for mask ids, so several inline marks can share a page. */
  id?: string;
  /** Rendered width/height; defaults to the 64px grid. */
  size?: string | number;
  /** Paint for the halo instead of `color`, e.g. `url(#gradient)`. */
  haloPaint?: string;
  /** Extra `<defs>` content, e.g. the gradient `haloPaint` points at. */
  defs?: string;
}

/**
 * A full SVG of the mark in `color`. Knockouts are real transparency via
 * masks, so the tray PNGs work as macOS template images.
 */
export function markSvg(
  state: MarkState,
  color: string,
  {
    echo = false,
    id = "",
    size = MARK_SIZE,
    haloPaint = color,
    defs = "",
  }: MarkSvgOptions = {},
): string {
  const m = `${id}m`;
  const bm = `${id}b`;
  const knockGrille = MIC.grille
    .map(
      (d) =>
        `<path d="${d}" stroke="black" stroke-width="${MIC.grilleWidth}" stroke-linecap="round"/>`,
    )
    .join("");
  const halo =
    `<path d="${HALO.main}" stroke="${haloPaint}" stroke-width="${HALO.mainWidth}" fill="none"/>` +
    (echo
      ? `<path d="${HALO.echo}" stroke="${haloPaint}" stroke-width="${HALO.echoWidth}" stroke-opacity="${HALO.echoOpacity}" fill="none"/>`
      : "");
  let body: string;
  if (state === "idle") {
    body = `<mask id="${m}"><rect width="64" height="64" fill="white"/>${knockGrille}</mask><g mask="url(#${m})">${halo}${micMarkup(color, color)}</g>`;
  } else if (state === "warning") {
    const b = BADGE;
    body = `<mask id="${m}"><rect width="64" height="64" fill="white"/>${knockGrille}<circle cx="${b.cx}" cy="${b.cy}" r="${b.gap}" fill="black"/></mask><g mask="url(#${m})">${halo}${micMarkup(color, color)}</g><mask id="${bm}"><circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="white"/><rect x="${b.bar.x}" y="${b.bar.y}" width="${b.bar.width}" height="${b.bar.height}" rx="${b.bar.radius}" fill="black"/><circle cx="${b.dot.cx}" cy="${b.dot.cy}" r="${b.dot.r}" fill="black"/></mask><circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${color}" mask="url(#${bm})"/>`;
  } else {
    const glyph =
      state === "recording"
        ? `<g transform="${MIC_IN_DISC}">${micMarkup("black", "white")}</g>`
        : `<path d="${SINE.path}" stroke="black" stroke-width="${SINE.width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    body = `<mask id="${m}"><rect width="64" height="64" fill="white"/>${glyph}</mask><path d="${DISC}" fill="${color}" mask="url(#${m})"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;
}
