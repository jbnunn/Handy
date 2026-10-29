/**
 * Renders Sine's tray icons and app icon from the shared mark geometry
 * (src/components/icons/markGeometry.ts), using installed Chrome via Playwright.
 *
 *   bun scripts/generate-brand.ts
 *   bunx tauri icon src-tauri/icons/app-icon.png   # fan out every app icon size
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  MARK_SIZE,
  RIBBONS,
  markSvg,
} from "../src/components/icons/markGeometry";
import type { MarkState } from "../src/components/icons/markGeometry";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const resources = path.join(root, "src-tauri", "resources");
const icons = path.join(root, "src-tauri", "icons");

// Tray: white for dark menu bars, black for light ones (both used as macOS
// template images), and warm grey for Linux's colored theme.
const TRAY_SIZE = 64;
const COLORED = "#a39d8e";
const tray: {
  state: MarkState;
  light: string;
  dark: string;
  colored?: string;
}[] = [
  {
    state: "idle",
    light: "tray_idle.png",
    dark: "tray_idle_dark.png",
    colored: "sine.png",
  },
  {
    state: "recording",
    light: "tray_recording.png",
    dark: "tray_recording_dark.png",
    colored: "recording.png",
  },
  {
    state: "transcribing",
    light: "tray_transcribing.png",
    dark: "tray_transcribing_dark.png",
    colored: "transcribing.png",
  },
  {
    state: "warning",
    light: "tray_idle_warning.png",
    dark: "tray_idle_warning_dark.png",
  },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setContent("<!doctype html><body></body>");

const svgToPng = (svg: string, size: number) =>
  page.evaluate(
    async ({ svg, size }) => {
      const img = new Image();
      img.src = "data:image/svg+xml;base64," + btoa(svg);
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d")!.drawImage(img, 0, 0, size, size);
      return c.toDataURL("image/png");
    },
    { svg, size },
  );

const write = (file: string, dataUrl: string) => {
  fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("wrote", path.relative(root, file));
};

for (const t of tray) {
  write(
    path.join(resources, t.light),
    await svgToPng(markSvg(t.state, "#ffffff"), TRAY_SIZE),
  );
  write(
    path.join(resources, t.dark),
    await svgToPng(markSvg(t.state, "#000000"), TRAY_SIZE),
  );
  if (t.colored)
    write(
      path.join(resources, t.colored),
      await svgToPng(markSvg(t.state, COLORED), TRAY_SIZE),
    );
}

// App icon: dark squircle with the three ribbons glowing in Aurora's colors.
// Proportions follow the previous icon (artwork inset ~7.4% on each side).
const appIcon = await page.evaluate(
  async ({ ribbons, markSize }) => {
    const S = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const ctx = c.getContext("2d")!;
    const inset = 76,
      side = S - inset * 2,
      radius = side * 0.225;
    ctx.beginPath();
    ctx.roundRect(inset, inset, side, side, radius);
    const bg = ctx.createLinearGradient(0, inset, 0, inset + side);
    bg.addColorStop(0, "#232227");
    bg.addColorStop(1, "#141317");
    ctx.fillStyle = bg;
    ctx.fill();

    const k = 11.5; // 64-unit mark -> ~736px
    const off = (S - markSize * k) / 2;
    ctx.translate(off, off);
    ctx.scale(k, k);
    for (const r of ribbons) {
      const g = ctx.createLinearGradient(9, 0, 55, 0);
      g.addColorStop(0, `hsl(${r.hue - r.hueSpread} 90% 64%)`);
      g.addColorStop(1, `hsl(${r.hue + r.hueSpread} 90% 64%)`);
      ctx.fillStyle = g;
      ctx.globalAlpha = r.opacity;
      ctx.shadowColor = `hsl(${r.hue} 90% 60% / 0.7)`;
      ctx.shadowBlur = 36;
      ctx.fill(new Path2D(r.path));
    }
    return c.toDataURL("image/png");
  },
  { ribbons: RIBBONS, markSize: MARK_SIZE },
);
write(path.join(icons, "app-icon.png"), appIcon);

await browser.close();
