export interface Language {
  code: string;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
}

export const languages: Language[] = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "fr", name: "French", nativeName: "Fran\u00e7ais", dir: "ltr" },
  { code: "es", name: "Spanish", nativeName: "Espa\u00f1ol", dir: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "it", name: "Italian", nativeName: "Italiano", dir: "ltr" },
  { code: "pt", name: "Portuguese", nativeName: "Portugu\u00eas", dir: "ltr" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", dir: "ltr" },
  { code: "pl", name: "Polish", nativeName: "Polski", dir: "ltr" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", dir: "ltr" },
  { code: "da", name: "Danish", nativeName: "Dansk", dir: "ltr" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", dir: "ltr" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", dir: "ltr" },
  { code: "ru", name: "Russian", nativeName: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439", dir: "ltr" },
  { code: "uk", name: "Ukrainian", nativeName: "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430", dir: "ltr" },
  { code: "tr", name: "Turkish", nativeName: "T\u00fcrk\u00e7e", dir: "ltr" },
  { code: "ar", name: "Arabic", nativeName: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", dir: "rtl" },
  { code: "he", name: "Hebrew", nativeName: "\u05e2\u05d1\u05e8\u05d9\u05ea", dir: "rtl" },
  { code: "hi", name: "Hindi", nativeName: "\u0939\u093f\u0928\u094d\u0926\u0940", dir: "ltr" },
  { code: "zh", name: "Chinese", nativeName: "\u4e2d\u6587", dir: "ltr" },
  { code: "ja", name: "Japanese", nativeName: "\u65e5\u672c\u8a9e", dir: "ltr" },
  { code: "ko", name: "Korean", nativeName: "\ud55c\uad6d\uc5b4", dir: "ltr" },
  { code: "th", name: "Thai", nativeName: "\u0e44\u0e17\u0e22", dir: "ltr" },
  { code: "vi", name: "Vietnamese", nativeName: "Ti\u1ebfng Vi\u1ec7t", dir: "ltr" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", dir: "ltr" },
];

export const defaultLanguage = "en";

export function getSupportedLanguageCode(browserLang: string): string {
  const code = browserLang.split("-")[0].toLowerCase();
  const match = languages.find((l) => l.code === code);
  return match ? match.code : defaultLanguage;
}
