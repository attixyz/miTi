declare module "@/components/ProTip" {
  const ProTip: React.ComponentType;
  export default ProTip;
}

// tz-lookup ships no types: synchronous lat/lon -> IANA timezone string.
declare module "tz-lookup" {
  export default function tzLookup(lat: number, lon: number): string;
}

// Next.js declares "*.module.css" (CSS Modules) but not plain global stylesheets.
// Classic tsc ignores side-effect imports, but stricter checkers (the TS Native
// Preview / tsgo, or noUncheckedSideEffectImports) flag `import "./globals.css"`.
declare module "*.css";
