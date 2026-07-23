import Link from "next/link";
import { BrandMarkIcon } from "@/components/BrandMarkIcon";
import { BrandWordmark } from "@/components/BrandWordmark";

type Props = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showWordmark?: boolean;
};

const sizes = {
  sm: { px: 28 },
  md: { px: 34 },
  lg: { px: 40 },
};

export function BrandMark({
  href = "/",
  size = "md",
  className = "",
  showWordmark = true,
}: Props) {
  const s = sizes[size];
  const inner = (
    <span className={`inline-flex items-center gap-2.5 text-[var(--wine)] ${className}`}>
      <BrandMarkIcon size={s.px} className="shrink-0" />
      {showWordmark ? (
        <BrandWordmark size={size} className="text-ink" />
      ) : null}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Cavatale">
      {inner}
    </Link>
  );
}
