import type { FilterId, LayoutType, Tier } from "./types";

export interface FrameSpec {
  id: string;
  slug: string;
  name: string;
  layout: LayoutType;
  isPremium: boolean;
  tier: Tier;
  /** paper / base colour */
  paper: string;
  ink: string;
  accent: string;
  secondary: string;
  style: "classic" | "film" | "neon" | "retro" | "studio" | "bloom" | "mono" | "pop" | "noir";
  description: string;
}

export const FRAMES: FrameSpec[] = [
  {
    id: "frame-classic-cream",
    slug: "classic-cream",
    name: "Classic Cream",
    layout: "1x4_strip",
    isPremium: false,
    tier: "free",
    paper: "#f4ecdd",
    ink: "#231f1c",
    accent: "#c8452f",
    secondary: "#d9cdb8",
    style: "classic",
    description: "Strip krem hangat dengan aksen stempel merah.",
  },
  {
    id: "frame-mono-strip",
    slug: "mono-strip",
    name: "Mono Strip",
    layout: "1x4_strip",
    isPremium: false,
    tier: "free",
    paper: "#f7f7f5",
    ink: "#111111",
    accent: "#111111",
    secondary: "#dededb",
    style: "mono",
    description: "Bersih, tipografis, tanpa distraksi.",
  },
  {
    id: "frame-retro-sun",
    slug: "retro-sun",
    name: "Retro Sun",
    layout: "1x4_strip",
    isPremium: false,
    tier: "free",
    paper: "#f6c65b",
    ink: "#2a1608",
    accent: "#d2492a",
    secondary: "#e9a53a",
    style: "retro",
    description: "Kuning surya dengan garis jadul.",
  },
  {
    id: "frame-grid-paper",
    slug: "grid-paper",
    name: "Grid Paper",
    layout: "2x2_grid",
    isPremium: false,
    tier: "free",
    paper: "#efe9df",
    ink: "#2b2721",
    accent: "#3a6b5b",
    secondary: "#d6cdbe",
    style: "studio",
    description: "Grid netral untuk potret berdua.",
  },
  {
    id: "frame-wide-linen",
    slug: "wide-linen",
    name: "Wide Linen",
    layout: "1x2_wide",
    isPremium: false,
    tier: "free",
    paper: "#ecebe6",
    ink: "#1e1e1e",
    accent: "#8a6a4b",
    secondary: "#d8d4c9",
    style: "studio",
    description: "Dua potret lebar bertekstur linen.",
  },
  {
    id: "frame-film-noir",
    slug: "film-noir",
    name: "Film Noir",
    layout: "1x4_strip",
    isPremium: true,
    tier: "paid",
    paper: "#111111",
    ink: "#f5f0e6",
    accent: "#e2483b",
    secondary: "#2a2a2a",
    style: "film",
    description: "Strip film 35mm dengan perforasi dan date stamp.",
  },
  {
    id: "frame-neon-night",
    slug: "neon-night",
    name: "Neon Night",
    layout: "1x4_strip",
    isPremium: true,
    tier: "paid",
    paper: "#0b0e17",
    ink: "#e8f6ff",
    accent: "#4ef0d0",
    secondary: "#ff5fa2",
    style: "neon",
    description: "Gradien neon untuk sesi malam.",
  },
  {
    id: "frame-bloom-grid",
    slug: "bloom-grid",
    name: "Bloom Grid",
    layout: "2x2_grid",
    isPremium: true,
    tier: "paid",
    paper: "#f7e9ec",
    ink: "#3a1f27",
    accent: "#d95d7a",
    secondary: "#f0c9d3",
    style: "bloom",
    description: "Grid bunga lembut dengan sudut membulat.",
  },
  {
    id: "frame-pop-wide",
    slug: "pop-wide",
    name: "Pop Wide",
    layout: "1x2_wide",
    isPremium: true,
    tier: "paid",
    paper: "#f2f4f8",
    ink: "#111318",
    accent: "#2f5bff",
    secondary: "#ff4d6d",
    style: "pop",
    description: "Wide layout dengan blok warna pop art.",
  },
  {
    id: "frame-fairy-night",
    slug: "fairy-night",
    name: "Fairy Night",
    layout: "1x4_strip",
    isPremium: true,
    tier: "paid",
    paper: "#1b1030",
    ink: "#fff2fb",
    accent: "#ff8fc7",
    secondary: "#b79cf0",
    style: "neon",
    description: "Langit galaxy ungu-pink dengan taburan bintang peri.",
  },
];

export function getFrame(id: string | null | undefined): FrameSpec {
  return FRAMES.find((frame) => frame.id === id) ?? FRAMES[0];
}

export function framesForTier(tier: Tier): FrameSpec[] {
  return FRAMES.filter((frame) => !frame.isPremium || tier === "paid");
}

export function defaultFrameForLayout(layout: LayoutType, tier: Tier): FrameSpec {
  const candidates = FRAMES.filter((frame) => frame.layout === layout && (!frame.isPremium || tier === "paid"));
  return candidates[0] ?? FRAMES[0];
}

export const FILTERS: Array<{ id: FilterId; name: string; isPremium: boolean }> = [
  { id: "none", name: "Clean", isPremium: false },
  { id: "mono", name: "Mono", isPremium: false },
  { id: "vintage", name: "Vintage", isPremium: false },
  { id: "cinematic", name: "Cinematic", isPremium: true },
  { id: "dreamy", name: "Dreamy", isPremium: true },
  { id: "grain", name: "Film Grain", isPremium: true },
];

export function filterAvailable(id: FilterId, tier: Tier): boolean {
  const filter = FILTERS.find((item) => item.id === id);
  if (!filter) return false;
  return !filter.isPremium || tier === "paid";
}
