export type Locale = "es" | "en";

export const LOCALES: Locale[] = ["es", "en"];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "cavatale_locale";
export const LOCALE_STORAGE_KEY = "cavatale.locale";

export type Dict = typeof import("./dictionaries/es").es;
