"use client";

import { useId } from "react";
import { useT, wineTypeLabel, useLocale } from "@/lib/i18n";
import { wineAtmosphereKind, type WineAtmosphereKind } from "@/lib/wines";

type Props = {
  type: string;
  /** Optional secondary line (region / country). */
  place?: string | null;
  className?: string;
};

/**
 * Honest stand-in when there is no label photo.
 * Editorial atmosphere + type-true bottle silhouette — never a fake label.
 */
export function WineAtmospherePlaceholder({
  type,
  place,
  className = "",
}: Props) {
  const t = useT();
  const { dict } = useLocale();
  const kind = wineAtmosphereKind(type);
  const typeName = wineTypeLabel(dict, type);
  const placeLine = (place ?? "").trim();
  const uid = useId().replace(/:/g, "");

  return (
    <div
      className={[
        "wine-atmosphere",
        `wine-atmosphere--${kind}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={t("wine.atmosphereAlt", { type: typeName })}
    >
      <SceneBackdrop kind={kind} uid={uid} />
      <div className="wine-atmosphere__vignette" aria-hidden />
      {kind === "espumoso" ? (
        <div className="wine-atmosphere__bubbles" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <div className="wine-atmosphere__stage">
        <div className="wine-atmosphere__bottle-wrap">
          <BottleSilhouette kind={kind} uid={uid} />
        </div>
        <div className="wine-atmosphere__caption">
          <p className="wine-atmosphere__eyebrow">{t("wine.atmosphereHint")}</p>
          <p className="wine-atmosphere__type">{typeName}</p>
          {placeLine ? (
            <p className="wine-atmosphere__place">{placeLine}</p>
          ) : (
            <p className="wine-atmosphere__place">{t("wine.atmosphereAddPhoto")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SceneBackdrop({
  kind,
  uid,
}: {
  kind: WineAtmosphereKind;
  uid: string;
}) {
  const sunId = `atm-sun-${uid}`;
  const hazeId = `atm-haze-${uid}`;
  const rayId = `atm-ray-${uid}`;

  const sky =
    kind === "blanco"
      ? ["#f7f0e2", "#e8d7b0", "#b8975c"]
      : kind === "rosado"
        ? ["#f6e8ea", "#e4b8be", "#a85a64"]
        : kind === "espumoso"
          ? ["#eef3ea", "#c8d6bc", "#5a7058"]
          : ["#f0e4e2", "#c99296", "#5c1c28"];

  const hillFar =
    kind === "blanco"
      ? "#a89062"
      : kind === "rosado"
        ? "#946068"
        : kind === "espumoso"
          ? "#556852"
          : "#6a343c";
  const hillMid =
    kind === "blanco"
      ? "#7e6640"
      : kind === "rosado"
        ? "#734048"
        : kind === "espumoso"
          ? "#3d5240"
          : "#4a1c24";
  const hillNear =
    kind === "blanco"
      ? "#5c4a30"
      : kind === "rosado"
        ? "#582832"
        : kind === "espumoso"
          ? "#2a3a2e"
          : "#2e1016";

  return (
    <svg
      className="wine-atmosphere__scene"
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <radialGradient id={sunId} cx="76%" cy="18%" r="38%">
          <stop offset="0%" stopColor="rgba(255,250,235,0.95)" />
          <stop offset="40%" stopColor="rgba(255,220,160,0.28)" />
          <stop offset="100%" stopColor="rgba(255,220,160,0)" />
        </radialGradient>
        <linearGradient id={hazeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky[0]} />
          <stop offset="48%" stopColor={sky[1]} />
          <stop offset="100%" stopColor={sky[2]} />
        </linearGradient>
        <linearGradient id={rayId} x1="0.7" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="rgba(255,248,230,0.22)" />
          <stop offset="100%" stopColor="rgba(255,248,230,0)" />
        </linearGradient>
      </defs>

      <rect width="400" height="240" fill={`url(#${hazeId})`} />
      <circle cx="308" cy="42" r="78" fill={`url(#${sunId})`} />
      <path
        d="M260 0 L400 0 L400 140 Z"
        fill={`url(#${rayId})`}
        className="wine-atmosphere__ray"
      />

      <path
        d="M0 132 C56 116 98 124 142 112 C190 98 228 122 268 114 C312 104 348 96 400 108 L400 240 L0 240 Z"
        fill={hillFar}
        opacity="0.28"
      />
      <path
        d="M0 154 C48 142 84 158 126 148 C174 134 210 158 258 148 C308 138 348 156 400 146 L400 240 L0 240 Z"
        fill={hillMid}
        opacity="0.42"
      />
      <path
        d="M0 176 C52 166 90 180 136 172 C186 162 224 180 274 170 C322 160 358 176 400 168 L400 240 L0 240 Z"
        fill={hillNear}
        opacity="0.62"
      />
      <g
        opacity="0.22"
        stroke="rgba(255,252,247,0.65)"
        fill="none"
        strokeWidth="1.1"
      >
        <path d="M8 186 C70 178 120 192 178 184 C240 174 300 188 392 180" />
        <path d="M0 196 C80 188 140 202 210 194 C280 186 340 198 400 192" />
        <path d="M16 206 C90 200 150 212 230 204 C300 196 350 208 400 202" />
      </g>
    </svg>
  );
}

function bottlePath(kind: WineAtmosphereKind): string {
  // Centered on x=60. Distinct silhouettes by type.
  if (kind === "espumoso") {
    // Champagne / sparkling: taller neck, thicker glass, gentler shoulder.
    return "M54 30 L54 78 C54 86 52 94 48 102 C42 114 38 128 38 146 L38 200 C38 208 44 214 54 214 L66 214 C76 214 82 208 82 200 L82 146 C82 128 78 114 72 102 C68 94 66 86 66 78 L66 30 Z";
  }
  if (kind === "blanco" || kind === "rosado") {
    // Burgundy: sloping shoulders, slightly broader body.
    return "M54 28 L54 70 C54 78 50 88 44 98 C38 110 34 124 34 142 L34 200 C34 208 40 214 52 214 L68 214 C80 214 86 208 86 200 L86 142 C86 124 82 110 76 98 C70 88 66 78 66 70 L66 28 Z";
  }
  // Bordeaux: high shoulders, straight body (tinto / otro).
  return "M54 26 L54 76 C54 82 52 88 48 94 C42 104 38 116 38 134 L38 200 C38 208 44 214 54 214 L66 214 C76 214 82 208 82 200 L82 134 C82 116 78 104 72 94 C68 88 66 82 66 76 L66 26 Z";
}

function BottleSilhouette({
  kind,
  uid,
}: {
  kind: WineAtmosphereKind;
  uid: string;
}) {
  const fillId = `atm-bot-${uid}`;
  const shadeId = `atm-shade-${uid}`;
  const glassId = `atm-glass-${uid}`;
  const fill = `url(#${fillId})`;
  const body = bottlePath(kind);

  const stops =
    kind === "blanco" ? (
      <>
        <stop offset="0%" stopColor="#f3e6c4" />
        <stop offset="38%" stopColor="#d4b878" />
        <stop offset="100%" stopColor="#7a5c32" />
      </>
    ) : kind === "rosado" ? (
      <>
        <stop offset="0%" stopColor="#efb4bc" />
        <stop offset="42%" stopColor="#b85a64" />
        <stop offset="100%" stopColor="#4e2028" />
      </>
    ) : kind === "espumoso" ? (
      <>
        <stop offset="0%" stopColor="#edf4e8" />
        <stop offset="35%" stopColor="#a8c098" />
        <stop offset="100%" stopColor="#24342a" />
      </>
    ) : (
      <>
        <stop offset="0%" stopColor="#a03c48" />
        <stop offset="38%" stopColor="#6a1a28" />
        <stop offset="100%" stopColor="#16080c" />
      </>
    );

  const capsule =
    kind === "espumoso" ? "#c4a35a" : kind === "blanco" ? "#3a3024" : "#1a1214";

  return (
    <svg
      className="wine-atmosphere__bottle"
      viewBox="0 0 120 230"
      aria-hidden
    >
      <defs>
        <linearGradient id={fillId} x1="0.22" y1="0" x2="0.82" y2="1">
          {stops}
        </linearGradient>
        <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,252,247,0.2)" />
          <stop offset="42%" stopColor="rgba(255,252,247,0)" />
          <stop offset="100%" stopColor="rgba(10,8,8,0.28)" />
        </linearGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,252,247,0.18)" />
          <stop offset="100%" stopColor="rgba(255,252,247,0)" />
        </linearGradient>
      </defs>

      {/* Contact shadow */}
      <ellipse
        cx="60"
        cy="218"
        rx="28"
        ry="5.5"
        fill="rgba(20,18,16,0.28)"
      />

      {/* Capsule / foil */}
      <rect x="51" y="4" width="18" height="24" rx="2" fill={capsule} />
      {kind === "espumoso" ? (
        <>
          <path
            d="M54 4 L60 0 L66 4"
            fill="none"
            stroke="#a88440"
            strokeWidth="1.4"
          />
          {/* Muselet suggestion */}
          <path
            d="M53 22 L67 22 M55 22 L55 28 M65 22 L65 28"
            fill="none"
            stroke="rgba(255,252,247,0.45)"
            strokeWidth="1"
          />
        </>
      ) : (
        <rect
          x="51"
          y="14"
          width="18"
          height="1.5"
          fill="rgba(255,252,247,0.14)"
        />
      )}

      <path d={body} fill={fill} />
      <path d={body} fill={`url(#${shadeId})`} />
      <path d={body} fill={`url(#${glassId})`} opacity="0.35" />

      {/* Lip under capsule */}
      <rect
        x="52.5"
        y="26"
        width="15"
        height="2.5"
        rx="1"
        fill="rgba(20,18,16,0.4)"
      />

      {/* Highlights */}
      <path
        d="M43 108 C41 140 41 168 43 198"
        fill="none"
        stroke="rgba(255,252,247,0.34)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M57 32 L57 72"
        fill="none"
        stroke="rgba(255,252,247,0.26)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
