import SineMark from "./SineMark";

// The product name is a brand, not translatable copy.
const WORDMARK = "Sine";

/**
 * The "Sine" wordmark: plain medium-weight type in the text color, with the
 * Aurora-colored ribbons beside it unless `withMark` is false (e.g. next to
 * the onboarding mascot, which already is the mark).
 */
const SineTextLogo = ({
  width = 120,
  withMark = true,
  className = "",
}: {
  width?: number;
  withMark?: boolean;
  className?: string;
}) => (
  <span
    role="img"
    aria-label={WORDMARK}
    className={`inline-flex items-center justify-center text-text ${className}`}
    style={{ width, gap: width * 0.06 }}
  >
    {withMark && <SineMark size={width * 0.3} aurora />}
    <span
      aria-hidden="true"
      className="font-medium leading-none"
      style={{ fontSize: width * 0.25, letterSpacing: "-0.01em" }}
    >
      {WORDMARK}
    </span>
  </span>
);

export default SineTextLogo;
