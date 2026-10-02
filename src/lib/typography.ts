const fontFamilies: Record<string, string> = {
  Inter: "Inter Variable",
  Manrope: "Manrope Variable",
  "Plus Jakarta Sans": "Plus Jakarta Sans Variable",
  Lora: "Lora Variable",
  "DM Serif Display": "DM Serif Display",
};

// Match the actual self-hosted @fontsource family names, not only the UI labels.
export function businessFontStack(font: string | null | undefined) {
  const family = font && Object.hasOwn(fontFamilies, font) ? fontFamilies[font] : undefined;
  return `"${family || fontFamilies.Inter}", system-ui, sans-serif`;
}
