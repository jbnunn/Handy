// The product name is a brand, not translatable copy.
const WORDMARK = "Sine";

/** The "Sine" wordmark: sand fill outlined in ink, like the old Handy wordmark. */
const SineTextLogo = ({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => (
  <svg
    width={width}
    height={height}
    className={className}
    viewBox="0 0 150 72"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label={WORDMARK}
  >
    <text
      x="75"
      y="56"
      textAnchor="middle"
      fontSize="64"
      fontWeight="800"
      letterSpacing="-1.5"
      paintOrder="stroke"
      strokeWidth="4"
      strokeLinejoin="round"
      style={{
        fontFamily: '"Figtree Variable", ui-rounded, system-ui, sans-serif',
        fill: "var(--color-wordmark)",
        stroke: "var(--color-wordmark-stroke)",
      }}
    >
      {WORDMARK}
    </text>
  </svg>
);

export default SineTextLogo;
