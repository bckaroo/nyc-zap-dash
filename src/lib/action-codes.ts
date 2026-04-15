// NYC ZAP Action Code Lookup — human-readable names
// Source: NYC DCP "Applications Reviewed by City Planning"

export const ACTION_NAMES: Record<string, string> = {
  // ULURP actions
  ZM: "Zoning Map Amendment",
  ZS: "Special Permit (CPC)",
  MM: "City Map Change",
  HA: "Housing/Urban Renewal Plan",
  HI: "Housing/Urban Renewal Implementation",
  PF: "Capital Project Site Selection",
  PD: "Disposition of City Property",
  // Non-ULURP actions
  BD: "Business Improvement District",
  BS: "Bus Franchise",
  CM: "Follow-up/Renewal Application",
  EC: "Enclosed Sidewalk Café",
  HC: "Minor Change",
  HG: "Urban Renewal Designation",
  HK: "Landmark/Historic District",
  MD: "Amended Drainage Plan",
  ME: "Easement Delineation",
  MY: "Administrative Demapping",
  NP: "197-a Plan",
  PX: "Office Space",
  RA: "South Richmond District Authorization",
  RC: "South Richmond District Certification",
  ZA: "Zoning Authorization",
  ZC: "Zoning Certification",
  ZR: "Zoning Text Amendment",
  // Additional codes found in data
  PC: "Preliminary Certificate",
  PQ: "Quality Housing",
  LD: "Landmark Designation",
  PP: "Parks/Public Place",
  HX: "Housing Plan (Mixed)",
};

export function formatActionCode(code: string): string {
  const name = ACTION_NAMES[code];
  if (name) return `${name} (${code})`;
  return code;
}

export function formatActionString(actions: string): string {
  return actions
    .split(";")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => formatActionCode(a))
    .join(", ");
}