type Props = {
  className?: string;
  /** Visual scale; hero is the landing masthead. */
  size?: "sm" | "md" | "lg" | "hero";
};

const sizeClass = {
  sm: "brand-wordmark--sm",
  md: "brand-wordmark--md",
  lg: "brand-wordmark--lg",
  hero: "brand-wordmark--hero",
} as const;

/**
 * Dual-style wordmark: Cava (Cormorant roman) + tale (Cormorant italic).
 * Lowercase tale keeps one flowing name; wine + italic mark the story half.
 */
export function BrandWordmark({ className = "", size = "md" }: Props) {
  return (
    <span
      className={`brand-wordmark ${sizeClass[size]} ${className}`.trim()}
      aria-label="Cavatale"
    >
      <span className="brand-cava">Cava</span>
      <span className="brand-tale">tale</span>
    </span>
  );
}
