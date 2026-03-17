import i18next from "i18next";

import { en } from "./catalog/en.js";

type Primitive = string | number | boolean | null;
type TranslationLeaf = string | readonly [string, string];
type JoinPath<Prefix extends string, Suffix extends string> = Suffix extends ""
  ? Prefix
  : `${Prefix}.${Suffix}`;
type PreviousDepth = [never, 0, 1, 2, 3, 4, 5, 6];

type LeafPaths<T, Depth extends number = 6> = [Depth] extends [never]
  ? never
  : T extends TranslationLeaf
    ? never
    : {
        [K in keyof T & string]: T[K] extends TranslationLeaf
          ? K
          : JoinPath<K, LeafPaths<T[K], PreviousDepth[Depth]>>;
      }[keyof T & string];

type PathValue<T, P extends string> = P extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? PathValue<T[Head], Tail>
    : never
  : P extends keyof T
    ? T[P]
    : never;

type ExtractPlaceholders<T extends string> = T extends `${string}{{${infer Param}}}${infer Rest}`
  ? Param | ExtractPlaceholders<Rest>
  : never;

type TranslationParams<T extends string> = [ExtractPlaceholders<T>] extends [never]
  ? undefined
  : Record<ExtractPlaceholders<T>, Primitive>;

export type StringsCatalog = typeof en;
export type StringKey = LeafPaths<StringsCatalog>;
export type SupportedLocale = "en";

export type StringParams<K extends StringKey> =
  PathValue<StringsCatalog, K> extends string
    ? TranslationParams<PathValue<StringsCatalog, K>>
    : never;

const resources = {
  en: {
    translation: en,
  },
} as const;

const instance = i18next.createInstance();

void instance.init({
  lng: "en",
  fallbackLng: "en",
  showSupportNotice: false,
  interpolation: {
    escapeValue: false,
  },
  resources,
});

export const defaultLocale: SupportedLocale = "en";

export const createTranslator = (locale: SupportedLocale = defaultLocale) => {
  return <K extends StringKey>(key: K, params?: StringParams<K>) =>
    instance.t(key, {
      lng: locale,
      ...params,
    });
};

export const translate = createTranslator();
