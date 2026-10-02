export type PrintableTheme = {
  id: string;
  name: string;
  bg: string;
  primary: string;
  secondary: string;
  text: string;
  accent: string;
  illustration: "leaf" | "coffee" | "wine" | "spa" | "shop" | "wave";
};

export const PRINTABLE_THEMES: PrintableTheme[] = [
  {
    id: "classic",
    name: "Classic",
    bg: "#fbf6ee",
    primary: "#3b2412",
    secondary: "#7c2d12",
    text: "#1c1917",
    accent: "#d6a86c",
    illustration: "leaf",
  },
  {
    id: "minimal",
    name: "Minimal",
    bg: "#ffffff",
    primary: "#111111",
    secondary: "#444444",
    text: "#111111",
    accent: "#888888",
    illustration: "wave",
  },
  {
    id: "premium",
    name: "Premium",
    bg: "#1a0f0a",
    primary: "#f5d28a",
    secondary: "#d6a86c",
    text: "#f8e9c8",
    accent: "#f5d28a",
    illustration: "coffee",
  },
  {
    id: "table-tent",
    name: "Table Tent",
    bg: "#fff5e6",
    primary: "#5b3013",
    secondary: "#b87333",
    text: "#2b1a0d",
    accent: "#d6a86c",
    illustration: "coffee",
  },
];

export function getPrintableTheme(id: string) {
  return PRINTABLE_THEMES.find((t) => t.id === id) || PRINTABLE_THEMES[0];
}
