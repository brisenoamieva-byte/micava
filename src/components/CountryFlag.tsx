import { countryCode, countryFlagEmoji, countryIso } from "@/lib/wines";

type Props = {
  country: string;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
};

/** Rectangular flag frames (≈3:2), not square — avoids cropping stars/cantons */
const sizes = {
  xs: { box: "h-3 w-[1.125rem]", width: 24, emoji: "text-[9px]" },
  sm: { box: "h-5 w-[1.875rem]", width: 40, emoji: "text-sm" },
  md: { box: "h-6 w-9", width: 48, emoji: "text-base" },
  lg: { box: "h-8 w-12", width: 64, emoji: "text-xl" },
};

export function CountryFlag({
  country,
  size = "md",
  showLabel = false,
  className = "",
}: Props) {
  const iso = countryIso[country];
  const code = countryCode[country] ?? country.slice(0, 2).toUpperCase();
  const emoji = countryFlagEmoji[country];
  const s = sizes[size];

  return (
    <span
      className={["inline-flex items-center gap-2", className].join(" ")}
      title={country}
    >
      <span
        className={[
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-[var(--line)] bg-[rgba(26,23,20,0.04)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]",
          s.box,
        ].join(" ")}
      >
        {iso ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://flagcdn.com/w80/${iso}.png`}
            srcSet={`https://flagcdn.com/w40/${iso}.png 1x, https://flagcdn.com/w80/${iso}.png 2x`}
            alt=""
            width={s.width}
            height={Math.round((s.width * 2) / 3)}
            className="h-full w-full object-contain object-center"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className={["leading-none", s.emoji].join(" ")} aria-hidden>
            {emoji ?? code}
          </span>
        )}
      </span>
      {showLabel ? (
        <span className="text-sm text-ink">
          <span className="font-medium">{code}</span>
          <span className="text-ink-soft"> · {country}</span>
        </span>
      ) : null}
    </span>
  );
}
