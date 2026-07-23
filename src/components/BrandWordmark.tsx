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
 * Dual-type wordmark: Cava (Cormorant) + Tale (Italianno).
 * Reads as one name with cellar structure + human story.
 */
export function BrandWordmark({ className = "", size = "md" }: Props) {
  return (
    <span
      className={`brand-wordmark ${sizeClass[size]} ${className}`.trim()}
      aria-label="Cavatale"
    >
      <span className="brand-cava">Cava</span>
      <span className="brand-tale">Tale</span>
    </span>
  );
}
