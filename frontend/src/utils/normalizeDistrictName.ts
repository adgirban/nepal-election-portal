// src/utils/normalizeDistrictName.ts
const DISTRICT_NAME_MAP: Record<string, string> = {
  // GeoJSON -> Wikipedia district labels
  "nawalparasi east": "Nawalpur",
  "nawalparasi west": "Nawalparasi",

  "rukum east": "Eastern Rukum",
  "rukum west": "Western Rukum",

  "chitawan": "Chitwan",
  "tanahu": "Tanahun",
  "kabhrepalanchok": "Kavrepalanchok",
};

export function normalizeDistrictName(raw: string): string {
  const s = (raw || "").trim();

  // Normalize whitespace and case
  const key = s.toLowerCase().replace(/\s+/g, " ");

  // Apply mapping if needed
  return DISTRICT_NAME_MAP[key] ?? s;
}
