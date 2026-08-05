import { es } from "./dictionaries/es";
import { en } from "./dictionaries/en";
import type { Dict, Locale } from "./types";
import { DEFAULT_LOCALE } from "./types";

const dictionaries: Record<Locale, Dict> = {
  es,
  en: en as unknown as Dict,
};

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

type Params = Record<string, string | number>;

/** Resolve nested key like "cava.scanBottle" and interpolate {name}. */
export function translate(
  dict: Dict,
  key: string,
  params?: Params
): string {
  const parts = key.split(".");
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in cur) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  if (typeof cur !== "string") return key;
  if (!params) return cur;
  return cur.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`
  );
}

export function wineTypeLabel(dict: Dict, type: string): string {
  const map = dict.wineTypes as Record<string, string>;
  return map[type] ?? type;
}
