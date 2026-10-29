import { useId } from "react";
import { markSvg } from "./markGeometry";

/** Mask ids must be valid in url(#…); React's useId contains colons. */
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");

/**
 * Sine's mark (three sine ribbons) in currentColor. `aurora` paints each
 * ribbon with its Aurora gradient, as on the app icon.
 */
const SineMark = ({
  size,
  width,
  height,
  className = "",
  aurora = false,
}: {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  className?: string;
  aurora?: boolean;
}) => {
  const id = safeId(useId());
  const s = size ?? width ?? height ?? 24;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{ width: s, height: s }}
      // Our own static geometry (markGeometry.ts), not user content.
      dangerouslySetInnerHTML={{
        __html: markSvg("idle", "currentColor", { id, size: "100%", aurora }),
      }}
    />
  );
};

export default SineMark;
