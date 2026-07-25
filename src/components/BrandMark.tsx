import Image from "next/image";
import Link from "next/link";
import { BrandWordmark } from "@/components/BrandWordmark";

type Props = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showWordmark?: boolean;
};

const sizes = {
  sm: { px: 28 },
  md: { px: 36 },
  lg: { px: 44 },
};

/** Canonical Cavatale mark: wine bottle + conversation bubble. Do not replace. */
export function BrandMark({
  href = "/",
  size = "md",
  className = "",
  showWordmark = true,
}: Props) {
  const s = sizes[size];
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/brand/cavatale-mark.png"
        alt=""
        width={s.px}
        height={s.px}
        className="shrink-0 rounded-[8px]"
        priority
      />
      {showWordmark ? <BrandWordmark size={size} /> : null}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Cavatale">
      {inner}
    </Link>
  );
}
