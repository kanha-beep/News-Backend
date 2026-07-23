export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English", googleTarget: "en", scheduled: false, googleSupported: true },
  { code: "as", label: "Assamese", googleTarget: "as", scheduled: true, googleSupported: true },
  { code: "bn", label: "Bengali", googleTarget: "bn", scheduled: true, googleSupported: true },
  { code: "brx", label: "Bodo", googleTarget: "", scheduled: true, googleSupported: false },
  { code: "doi", label: "Dogri", googleTarget: "doi", scheduled: true, googleSupported: true },
  { code: "gu", label: "Gujarati", googleTarget: "gu", scheduled: true, googleSupported: true },
  { code: "hi", label: "Hindi", googleTarget: "hi", scheduled: true, googleSupported: true },
  { code: "kn", label: "Kannada", googleTarget: "kn", scheduled: true, googleSupported: true },
  { code: "ks", label: "Kashmiri", googleTarget: "", scheduled: true, googleSupported: false },
  { code: "gom", label: "Konkani", googleTarget: "gom", scheduled: true, googleSupported: true },
  { code: "mai", label: "Maithili", googleTarget: "mai", scheduled: true, googleSupported: true },
  { code: "ml", label: "Malayalam", googleTarget: "ml", scheduled: true, googleSupported: true },
  { code: "mni-Mtei", label: "Manipuri", googleTarget: "mni-Mtei", scheduled: true, googleSupported: true },
  { code: "mr", label: "Marathi", googleTarget: "mr", scheduled: true, googleSupported: true },
  { code: "ne", label: "Nepali", googleTarget: "ne", scheduled: true, googleSupported: true },
  { code: "or", label: "Odia", googleTarget: "or", scheduled: true, googleSupported: true },
  { code: "pa", label: "Punjabi", googleTarget: "pa", scheduled: true, googleSupported: true },
  { code: "sa", label: "Sanskrit", googleTarget: "sa", scheduled: true, googleSupported: true },
  { code: "sat", label: "Santali", googleTarget: "", scheduled: true, googleSupported: false },
  { code: "sd", label: "Sindhi", googleTarget: "sd", scheduled: true, googleSupported: true },
  { code: "ta", label: "Tamil", googleTarget: "ta", scheduled: true, googleSupported: true },
  { code: "te", label: "Telugu", googleTarget: "te", scheduled: true, googleSupported: true },
  { code: "ur", label: "Urdu", googleTarget: "ur", scheduled: true, googleSupported: true },
];

export const DEFAULT_LANGUAGE_CODE = "en";
export const SUPPORTED_LANGUAGE_CODES = new Set(
  LANGUAGE_OPTIONS.map((language) => language.code),
);
export const LANGUAGE_TARGET_BY_CODE = new Map(
  LANGUAGE_OPTIONS.filter((language) => language.googleSupported)
    .map((language) => [language.code, language.googleTarget]),
);
export const GOOGLE_SUPPORTED_LANGUAGE_CODES = new Set(
  LANGUAGE_OPTIONS.filter((language) => language.googleSupported)
    .map((language) => language.code),
);
