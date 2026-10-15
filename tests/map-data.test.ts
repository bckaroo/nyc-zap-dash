import { describe, expect, it } from "vitest";

import {
  ACTION_STYLES,
  getActionStyle,
  validateMapPayload,
} from "../src/lib/map-data";
import { buildBoroughActionRows } from "../src/components/BoroughActionChart";

const validMapPayload = {
  borough_counts: [{ id: "3", name: "Brooklyn", project_count: 1 }],
  community_district_counts: [{ id: "308", borough: "Brooklyn", project_count: 1 }],
  project_sites: {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [-73.95, 40.67] as [number, number] },
        properties: {
          project_id: "2026K0001",
          project_name: "Test project",
          borough: "Brooklyn",
          community_district: "K08",
          action_types: ["ZM"],
          primary_action_type: "ZM",
          location_method: "point_on_zap_bbl_polygon",
          location_source: "ZAP bbl-featurecollection",
          source_url: "https://zap.planning.nyc.gov/projects/2026K0001",
          bbl: "3012340056",
        },
      },
    ],
  },
  located_project_count: 1,
  site_point_count: 1,
  unmatched_project_count: 0,
};

describe("map action styles", () => {
  it("maps known ZAP action codes to stable labels and colors", () => {
    expect(getActionStyle("MM")).toEqual({
      code: "MM",
      label: "City Map Change",
      color: ACTION_STYLES.MM.color,
    });
    expect(getActionStyle("ZM").label).toBe("Zoning Map Amendment");
    expect(getActionStyle("ZA").color).not.toBe(getActionStyle("ZM").color);
  });

  it("uses a deterministic fallback for unknown and missing action codes", () => {
    expect(getActionStyle("XX")).toEqual({ code: "XX", label: "Other ZAP action (XX)", color: "#5d6c65" });
    expect(getActionStyle("")).toEqual({ code: "", label: "Action not reported", color: "#5d6c65" });
  });
});

describe("public map payload validation", () => {
  it("accepts authoritative project-site points and count metadata", () => {
    expect(validateMapPayload(validMapPayload)).toEqual(validMapPayload);
  });

  it("rejects non-point or guessed locations and inconsistent coverage totals", () => {
    expect(() => validateMapPayload({
      ...validMapPayload,
      project_sites: {
        type: "FeatureCollection",
        features: [{
          ...validMapPayload.project_sites.features[0],
          properties: {
            ...validMapPayload.project_sites.features[0].properties,
            location_method: "community_district_centroid",
          },
        }],
      },
    })).toThrow(/authoritative ZAP BBL polygon/i);

    expect(() => validateMapPayload({ ...validMapPayload, site_point_count: 2 })).toThrow(/site point count/i);
  });

  it("accepts an empty map payload for an unlocated snapshot", () => {
    expect(validateMapPayload({
      borough_counts: [],
      community_district_counts: [],
      project_sites: { type: "FeatureCollection", features: [] },
      located_project_count: 0,
      site_point_count: 0,
      unmatched_project_count: 3,
    }).unmatched_project_count).toBe(3);
  });
});

describe("buildBoroughActionRows", () => {
  it("counts distinct projects per borough per action and never doubles multisite projects", () => {
    const site = (pid: string, borough: string, action: string, coords: [number, number]) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: coords },
      properties: { project_id: pid, borough, primary_action_type: action },
    });
    const payload = {
      project_sites: {
        type: "FeatureCollection" as const,
        features: [
          site("P1", "Brooklyn", "ZM", [0, 0]),
          site("P1", "Brooklyn", "ZM", [1, 1]), // second site of the same project
          site("P2", "Brooklyn", "ZS", [2, 2]),
          site("P3", "Queens", "ZA", [3, 3]),
        ],
      },
    };
    const rows = buildBoroughActionRows(payload.project_sites as never);
    expect(rows).toEqual([
      { borough: "Brooklyn", ZM: 1, ZS: 1 },
      { borough: "Queens", ZA: 1 },
    ]);
  });
});
