"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

import { ACTION_STYLES, getActionStyle, type MapPayload } from "../lib/map-data";
import BoroughActionChart from "./BoroughActionChart";

type BoundaryFeatureCollection = FeatureCollection<Polygon | MultiPolygon, Record<string, string | number>>;

const EMPTY_MAP: MapPayload = {
  borough_counts: [],
  community_district_counts: [],
  project_sites: { type: "FeatureCollection", features: [] },
  located_project_count: 0,
  site_point_count: 0,
  unmatched_project_count: 0,
};

function addCounts(
  boundaries: BoundaryFeatureCollection,
  counts: Map<string, number>,
  idField: "borocode" | "boro_cd",
): BoundaryFeatureCollection {
  return {
    ...boundaries,
    features: boundaries.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        project_count: counts.get(String(feature.properties[idField])) ?? 0,
      },
    })),
  };
}

export default function GeographyMap({
  mapData = EMPTY_MAP,
  borough = "",
  communityDistrict = "",
  collectedThrough,
}: {
  mapData?: MapPayload;
  borough?: string;
  communityDistrict?: string;
  collectedThrough: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const filterRef = useRef({ borough, communityDistrict });
  filterRef.current = { borough, communityDistrict };
  const [zoomLabel, setZoomLabel] = useState("Citywide view: borough activity");
  const [mapError, setMapError] = useState("");

  const visibleActionStyles = useMemo(() => {
    const codes = new Set(mapData.project_sites.features.map((feature) => feature.properties.primary_action_type));
    return [...codes].sort().map(getActionStyle);
  }, [mapData.project_sites.features]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    async function initializeMap() {
      try {
        const maplibregl = await import("maplibre-gl");
        const [boroughResponse, districtResponse] = await Promise.all([
          fetch("/data/nyc-boroughs.geojson"),
          fetch("/data/nyc-community-districts.geojson"),
        ]);
        if (!boroughResponse.ok || !districtResponse.ok) throw new Error("Boundary files could not be loaded");
        const [boroughBoundaries, districtBoundaries] = await Promise.all([
          boroughResponse.json() as Promise<BoundaryFeatureCollection>,
          districtResponse.json() as Promise<BoundaryFeatureCollection>,
        ]);
        if (cancelled || !containerRef.current) return;

        const boroughCounts = new Map(mapData.borough_counts.map((item) => [item.id, item.project_count]));
        const districtCounts = new Map(mapData.community_district_counts.map((item) => [item.id, item.project_count]));
        const actionExpression = [
          "match",
          ["get", "primary_action_type"],
          ...Object.entries(ACTION_STYLES).flatMap(([code, style]) => [code, style.color]),
          "#5d6c65",
        ] as unknown as ExpressionSpecification;

        map = new maplibregl.Map({
          container: containerRef.current,
          center: [-73.94, 40.70],
          zoom: 8.7,
          minZoom: 8,
          maxZoom: 17,
          attributionControl: false,
          style: "/data/basemap-grayscale.json",
        });
        mapRef.current = map;
        map.on("error", (event) => { console.error("maplibre error:", (event as { error?: Error }).error?.message || String(event)); });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "NYC Planning / NYC Open Data" }));

        map.on("load", () => {
          if (!map) return;
          map.addSource("boroughs", { type: "geojson", data: addCounts(boroughBoundaries, boroughCounts, "borocode") });
          map.addSource("community-districts", { type: "geojson", data: addCounts(districtBoundaries, districtCounts, "boro_cd") });
          map.addSource("project-sites", { type: "geojson", data: mapData.project_sites });
          map.addLayer({
            id: "borough-fills",
            type: "fill",
            source: "boroughs",
            maxzoom: 9.5,
            paint: {
              "fill-color": ["interpolate", ["linear"], ["get", "project_count"], 0, "#eef3ec", 10, "#a8cf91", 30, "#4f9368", 60, "#0a6640"],
              "fill-opacity": 0.82,
              "fill-outline-color": "#315343",
            },
          });
          map.addLayer({
            id: "district-fills",
            type: "fill",
            source: "community-districts",
            minzoom: 9.5,
            maxzoom: 11.5,
            paint: {
              "fill-color": ["interpolate", ["linear"], ["get", "project_count"], 0, "#f4f1e8", 3, "#c8dc9a", 8, "#6da36b", 15, "#0a6640"],
              "fill-opacity": 0.76,
              "fill-outline-color": "#355849",
            },
          });
          map.addLayer({
            id: "project-sites",
            type: "circle",
            source: "project-sites",
            minzoom: 11,
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 5, 15, 9],
              "circle-color": actionExpression,
              "circle-stroke-color": "#fffdf7",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.9,
            },
          });

          const applyProjectFilters = () => {
            if (!map) return;
            const filters: Array<["==", ["get", string], string]> = [];
            if (filterRef.current.borough) filters.push(["==", ["get", "borough"], filterRef.current.borough]);
            if (filterRef.current.communityDistrict) filters.push(["==", ["get", "community_district"], filterRef.current.communityDistrict]);
            map.setFilter("project-sites", filters.length ? ["all", ...filters] : null);
          };
          const updateZoomLabel = () => {
            if (!map) return;
            const zoom = map.getZoom();
            setZoomLabel(zoom < 9.5
              ? "Citywide view: borough activity"
              : zoom < 11
                ? "Borough view: Community District activity"
                : "Neighborhood view: authoritative ZAP project sites");
          };
          applyProjectFilters();
          updateZoomLabel();
          map.on("zoomend", updateZoomLabel);

        });
      } catch (error) {
        setMapError(error instanceof Error ? error.message : "Map could not be loaded");
      }
    }

    void initializeMap();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [mapData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("project-sites")) return;
    const filters: Array<["==", ["get", string], string]> = [];
    if (borough) filters.push(["==", ["get", "borough"], borough]);
    if (communityDistrict) filters.push(["==", ["get", "community_district"], communityDistrict]);
    map.setFilter("project-sites", filters.length ? ["all", ...filters] : null);
  }, [borough, communityDistrict]);

  return (
    <div className="map-layout">
      <div className="map-stage">
        <div
          ref={containerRef}
          className="geography-map"
          role="application"
          tabIndex={0}
          aria-label="Interactive ZAP application activity map. Use the plus and minus buttons to change geography level, and arrow keys to pan."
        />
        {mapError && <p className="map-error" role="status">{mapError}. Use the geography table below.</p>}
        <p className="map-zoom-status" aria-live="polite">{zoomLabel}</p>
      </div>
      <aside className="map-legend" aria-label="Map legend and zoom behavior">
        <h3>Map layers</h3>
        <ol className="zoom-key">
          <li><strong>Zoom 8–9:</strong> Borough project counts</li>
          <li><strong>Zoom 9–10: Community Districts</strong> appear at borough scale</li>
          <li><strong>Zoom 11+:</strong> ZAP project-site dots</li>
        </ol>
        <p className="legend-note">Basemap: light grayscale streets and place labels (Esri World Light Gray), for orientation only. Darker areas contain more distinct projects. Counts never multiply a project because it has several BBL sites.</p>
        <div className="choropleth-ramp" aria-label="Fewer to more projects"><span>Fewer</span><i /><i /><i /><i /><span>More</span></div>
        <h3>Action type</h3>
        <ul className="action-legend">
          {visibleActionStyles.map((style) => (
            <li key={style.code || "unreported"}><i style={{ background: style.color }} />{style.label}</li>
          ))}
          {!visibleActionStyles.length && <li><i style={{ background: "#5d6c65" }} />No located action types in this snapshot</li>}
        </ul>
        <p className="legend-note">
          {mapData.located_project_count.toLocaleString()} projects have authoritative ZAP geometry;
          {" "}{mapData.site_point_count.toLocaleString()} site points are shown;
          {" "}{mapData.unmatched_project_count.toLocaleString()} projects are unlocated.
        </p>
        <p className="legend-note">Snapshot collected through {collectedThrough || "not reported"}. Activity comes only from the existing ZAP dataset. Boundaries are cartographic reference; points come only from ZAP BBL polygons, never district centroids.</p>
      </aside>
      <BoroughActionChart mapData={mapData} />
    </div>
  );
}
