import { useId } from "react";
import { markSvg } from "./markGeometry";

/** Mask ids must be valid in url(#…); React's useId contains colons. */
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");

/**
 * Sine's mark (mic in a wavy halo) in currentColor. `iridescent` paints the
 * halo with the spectrum, as on the app icon.
 */
const SineMark = ({
  size,
  width,
  height,
  className = "",
  iridescent = false,
}: {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  className?: string;
  iridescent?: boolean;
}) => {
  const id = safeId(useId());
  const s = size ?? width ?? height ?? 24;
  const gradient = `${id}g`;
  const svg = markSvg("idle", "currentColor", {
    echo: true,
    id,
    size: "100%",
    ...(iridescent && {
      haloPaint: `url(#${gradient})`,
      defs: `<linearGradient id="${gradient}" x1="0" y1="0" x2="1" y2="1">${[
        190, 260, 320, 30, 60, 150,
      ]
        .map(
          (h, i) => `<stop offset="${i / 5}" stop-color="hsl(${h} 85% 62%)"/>`,
        )
        .join("")}</linearGradient>`,
    }),
  });
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{ width: s, height: s }}
      // Our own static geometry (markGeometry.ts), not user content.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default SineMark;
