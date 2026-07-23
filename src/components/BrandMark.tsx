import Image from "next/image";
import Link from "next/link";

type Props = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showWordmark?: boolean;
};

const sizes = {
  sm: { px: 28, text: "text-xl" },
  md: { px: 36, text: "text-2xl md:text-3xl" },
  lg: { px: 44, text: "text-3xl md:text-4xl" },
};

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
      {showWordmark ? (
        <span className={`display tracking-tight text-ink ${s.text}`}>
          Cavatale
        </span>
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
