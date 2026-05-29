declare module "@/components/ProTip" {
  const ProTip: React.ComponentType;
  export default ProTip;
}

// tz-lookup ships no types: synchronous lat/lon -> IANA timezone string.
declare module "tz-lookup" {
  export default function tzLookup(lat: number, lon: number): string;
}
