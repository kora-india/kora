/**
 * The small school drawing in the Settings header. Decorative only; drawn in
 * the theme color (currentColor), so it follows the school's chosen color.
 */
export function SettingsHeaderArt({
  className,
}: Readonly<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 260 120"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={className}
    >
      {/* Soft hill behind */}
      <path d="M0 120 C60 70 140 62 260 84 V120 Z" opacity="0.18" />
      {/* Trees */}
      <ellipse cx="38" cy="86" rx="14" ry="18" opacity="0.35" />
      <rect x="36.5" y="96" width="3" height="16" opacity="0.4" />
      <ellipse cx="226" cy="82" rx="16" ry="21" opacity="0.35" />
      <rect x="224.5" y="96" width="3" height="16" opacity="0.4" />
      <ellipse cx="208" cy="92" rx="10" ry="13" opacity="0.3" />
      {/* Wings */}
      <rect x="62" y="66" width="44" height="46" rx="2" opacity="0.4" />
      <rect x="154" y="66" width="44" height="46" rx="2" opacity="0.4" />
      <path d="M58 68 L84 54 L110 68 Z" opacity="0.5" />
      <path d="M150 68 L176 54 L202 68 Z" opacity="0.5" />
      {/* Main block and roof */}
      <rect x="100" y="52" width="60" height="60" rx="2" opacity="0.5" />
      <path d="M94 54 L130 32 L166 54 Z" opacity="0.65" />
      {/* Flag */}
      <rect x="129" y="8" width="2" height="26" opacity="0.7" />
      <path d="M131 9 H146 L142 14 L146 19 H131 Z" opacity="0.7" />
      {/* Clock */}
      <circle cx="130" cy="46" r="4.5" className="fill-background" />
      {/* Windows */}
      <g className="fill-background" opacity="0.9">
        <rect x="70" y="76" width="9" height="9" rx="1" />
        <rect x="89" y="76" width="9" height="9" rx="1" />
        <rect x="70" y="93" width="9" height="9" rx="1" />
        <rect x="89" y="93" width="9" height="9" rx="1" />
        <rect x="162" y="76" width="9" height="9" rx="1" />
        <rect x="181" y="76" width="9" height="9" rx="1" />
        <rect x="162" y="93" width="9" height="9" rx="1" />
        <rect x="181" y="93" width="9" height="9" rx="1" />
        <rect x="108" y="62" width="9" height="9" rx="1" />
        <rect x="143" y="62" width="9" height="9" rx="1" />
        <rect x="108" y="78" width="9" height="9" rx="1" />
        <rect x="143" y="78" width="9" height="9" rx="1" />
        {/* Door */}
        <path d="M122 112 V94 a8 8 0 0 1 16 0 V112 Z" />
      </g>
      {/* Ground */}
      <rect x="20" y="111" width="220" height="3" rx="1.5" opacity="0.3" />
    </svg>
  );
}
