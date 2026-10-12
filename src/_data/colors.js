const content = require("./content.js");

const PALETTES = {
  navy: { dark: "#1c3553", accent: "#4a7fa5", light: "#f5f7fa", cream: "#e8eef5" },
  forest: { dark: "#2f4a2f", accent: "#6b8e5a", light: "#f3f6f1", cream: "#e7efe2" },
  terracotta: { dark: "#8c4a2f", accent: "#c17a52", light: "#faf5f1", cream: "#f1e5dc" },
  plum: { dark: "#4a2d4f", accent: "#8a6b9e", light: "#f7f4f8", cream: "#ece4ef" },
  charcoal: { dark: "#2b2b30", accent: "#b08d4f", light: "#f6f6f4", cream: "#e9e7e0" },
};

// ── Readable text ────────────────────────────────
// The accent is a mid-tone, which is fine for bars, borders and tints but too pale to
// read as small text on the light backgrounds, and too dark on the dark ones. Rather
// than trust every scheme (or a custom hex from the editor) to get that right, the
// text versions are worked out here: the accent is nudged darker, or lighter, just far
// enough to reach WCAG AA contrast (4.5:1) against the backgrounds it sits on.
const hexToRgb = (hex) => {
  const h = String(hex).replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (hex, towards, amount) => {
  const a = hexToRgb(hex), b = hexToRgb(towards);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * amount));
};
// The first step from `hex` towards `towards` that reads on every one of `backgrounds`.
// 4.6 rather than 4.5 leaves a little room for rounding.
const readable = (hex, towards, backgrounds, target = 4.6) => {
  for (let step = 0; step <= 50; step++) {
    const candidate = mix(hex, towards, step / 50);
    if (backgrounds.every((bg) => contrast(candidate, bg) >= target)) return candidate;
  }
  return towards;
};

module.exports = () => {
  const theme = content().theme || {};
  const pal = PALETTES[theme.palette] || PALETTES.navy;

  const dark = theme.customDark || pal.dark;
  const accent = theme.customAccent || pal.accent;
  const light = theme.customLight || pal.light;
  const cream = theme.customCream || pal.cream;

  return {
    dark,
    accent,
    light,
    cream,
    // Accent for text and buttons on the light backgrounds (and white text on it).
    accentText: readable(accent, "#000000", ["#ffffff", light, cream]),
    // Accent for text on the dark background (footer, quote bands, Approach section).
    accentOnDark: readable(accent, "#ffffff", [dark, mix(dark, "#ffffff", 0.05)]),
    // Secondary text on the dark background: a soft white, made just light enough to
    // read. (Fading white with opacity fails on the lighter dark colours, e.g. Terracotta.)
    mutedOnDark: readable(mix("#ffffff", dark, 0.45), "#ffffff", [dark, mix(dark, "#ffffff", 0.05)]),
  };
};

module.exports.contrast = contrast;
