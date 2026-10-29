import { useId } from "react";
import { markSvg } from "./markGeometry";

/** The tray icon, drawn from the same geometry as src-tauri/resources/tray_*.png; uses currentColor like a macOS template image. */
type TrayIconState = "idle" | "recording" | "transcribing";

const TrayIcon = ({
  state,
  size,
}: {
  state: TrayIconState;
  size: number | string;
}) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
      // Our own static geometry (markGeometry.ts), not user content.
      dangerouslySetInnerHTML={{
        __html: markSvg(state, "currentColor", { id, size: "100%" }),
      }}
    />
  );
};

export default TrayIcon;
