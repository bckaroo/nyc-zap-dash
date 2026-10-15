export const ACTION_STYLES = {
  BD: { label: "Business Improvement District", color: "#9c4f96" },
  BF: { label: "Business Franchise", color: "#8359a3" },
  CM: { label: "Renewal", color: "#6c63a8" },
  CS: { label: "Substantial Compliance", color: "#4f6fab" },
  EC: { label: "Enclosed Cafe", color: "#347ea8" },
  HA: { label: "Urban Development Action Area", color: "#158b9b" },
  HI: { label: "Individual Landmark", color: "#008f82" },
  HK: { label: "Historic District or Landmark Designation", color: "#248d68" },
  HO: { label: "Housing Plan or Project", color: "#4d884d" },
  HU: { label: "Urban Renewal Plan", color: "#708139" },
  LD: { label: "Legal Document", color: "#8b772b" },
  MD: { label: "Amended Drainage Plan", color: "#a46a27" },
  ME: { label: "Easement Delineation", color: "#b75b2c" },
  ML: { label: "Landfill", color: "#c4473b" },
  MM: { label: "City Map Change", color: "#d13b52" },
  PC: { label: "City Acquisition and Site Selection", color: "#cc3d73" },
  PP: { label: "Disposition of City-Owned Property", color: "#ba498f" },
  PQ: { label: "City Acquisition", color: "#9e5a9e" },
  PS: { label: "City Facility Site Selection", color: "#7769a6" },
  PX: { label: "Office Space Lease", color: "#4e78a6" },
  RA: { label: "South Richmond Authorization", color: "#26889c" },
  RC: { label: "South Richmond Certification", color: "#008f79" },
  SG: { label: "POPS Signage", color: "#4a8a51" },
  ZA: { label: "Zoning Authorization", color: "#e77728" },
  ZC: { label: "Zoning Certification", color: "#b08b1d" },
  ZM: { label: "Zoning Map Amendment", color: "#0a6640" },
  ZR: { label: "Zoning Text Amendment", color: "#1682a3" },
  ZS: { label: "Zoning Special Permit", color: "#6f4c9b" },
} as const;

export type KnownActionCode = keyof typeof ACTION_STYLES;

export interface ActionStyle {
  code: string;
  label: string;
  color: string;
}

export interface ProjectSiteProperties {
  project_id: string;
  project_name: string;
  borough: string;
  community_district: string;
  action_types: string[];
  primary_action_type: string;
  location_method: "point_on_zap_bbl_polygon";
  location_source: "ZAP bbl-featurecollection";
  source_url: string;
  bbl: string;
}

export interface ProjectSiteFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: ProjectSiteProperties;
}

export interface MapPayload {
  borough_counts: { id: string; name: string; project_count: number }[];
  community_district_counts: { id: string; borough: string; project_count: number }[];
  project_sites: { type: "FeatureCollection"; features: ProjectSiteFeature[] };
  located_project_count: number;
  site_point_count: number;
  unmatched_project_count: number;
}

export function getActionStyle(value: string | null | undefined): ActionStyle {
  const code = (value ?? "").trim().toUpperCase();
  const style = ACTION_STYLES[code as KnownActionCode];
  if (style) return { code, ...style };
  return {
    code,
    label: code ? `Other ZAP action (${code})` : "Action not reported",
    color: "#5d6c65",
  };
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`Invalid map payload: ${label}`);
}

export function validateMapPayload(value: unknown): MapPayload {
  if (!value || typeof value !== "object") throw new Error("Invalid map payload: object missing");
  const payload = value as Partial<MapPayload>;
  if (!Array.isArray(payload.borough_counts) || !Array.isArray(payload.community_district_counts)) {
    throw new Error("Invalid map payload: choropleth counts missing");
  }
  if (payload.project_sites?.type !== "FeatureCollection" || !Array.isArray(payload.project_sites.features)) {
    throw new Error("Invalid map payload: project site FeatureCollection missing");
  }
  assertNonNegativeInteger(payload.located_project_count, "located project count");
  assertNonNegativeInteger(payload.site_point_count, "site point count");
  assertNonNegativeInteger(payload.unmatched_project_count, "unmatched project count");
  if (payload.site_point_count !== payload.project_sites.features.length) {
    throw new Error("Invalid map payload: site point count mismatch");
  }
  for (const feature of payload.project_sites.features) {
    if (
      feature.type !== "Feature"
      || feature.geometry?.type !== "Point"
      || !Array.isArray(feature.geometry.coordinates)
      || feature.geometry.coordinates.length !== 2
      || !feature.geometry.coordinates.every(Number.isFinite)
    ) {
      throw new Error("Invalid map payload: project site must be a Point");
    }
    if (
      feature.properties?.location_method !== "point_on_zap_bbl_polygon"
      || feature.properties?.location_source !== "ZAP bbl-featurecollection"
    ) {
      throw new Error("Invalid map payload: site must derive from an authoritative ZAP BBL polygon");
    }
    if (!Array.isArray(feature.properties.action_types)) {
      throw new Error("Invalid map payload: action types missing");
    }
  }
  return payload as MapPayload;
}
