#!/usr/bin/env node
/**
 * Generate the light grayscale basemap style for ZapDash.
 *
 * Uses the keyless Esri World Light Gray raster tiles — a light greyscale
 * basemap that (unlike vector PMTiles on build.protomaps.com, which sends no
 * CORS headers) renders directly in the browser without a proxy.
 */
const fs = require("fs");
const path = require("path");

const style = {
  version: 8,
  sources: {
    esri_light_gray: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 16,
      attribution:
        "Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS community",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#f2f2f0" },
    },
    {
      id: "basemap-raster",
      type: "raster",
      source: "esri_light_gray",
      paint: { "raster-opacity": 1 },
    },
  ],
};

const out = path.join(__dirname, "..", "public", "data", "basemap-grayscale.json");
fs.writeFileSync(out, JSON.stringify(style));