import React from "react";
import SineMark from "../icons/SineMark";

interface MascotProps {
  /** Height in px. */
  size: number;
  /** Wave once on arrival, or high-five (re-key it to play again). */
  animation?: "wave" | "slap" | null;
}

/** Sine's mark with its iridescent halo, optionally animated. */
export const Mascot: React.FC<MascotProps> = ({ size, animation = null }) => (
  <span
    style={{ width: size, height: size }}
    className={`relative block origin-[50%_90%] select-none text-logo-primary ${animation === "wave" ? "animate-wave" : animation === "slap" ? "animate-slap" : ""}`}
  >
    <SineMark size={size} iridescent />
  </span>
);
