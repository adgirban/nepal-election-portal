import { useEffect, useState } from "react";
import { MapContainer, GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { normalizeDistrictName } from "../utils/normalizeDistrictName";
import L from "leaflet";



type Props = {
  geoJsonUrl: string;
  selectedDistrictName: string | null;
  onDistrictClick: (districtName: string) => void;
};

export default function MapView(props: Props) {
  const [fc, setFc] = useState<FeatureCollection<Geometry> | null>(null);

  useEffect(() => {
    fetch(props.geoJsonUrl)
      .then((r) => r.json())
      .then((j) => setFc(j))
      .catch((e) => console.error("Failed to load GeoJSON", e));
  }, [props.geoJsonUrl]);

  const selectedKey = (props.selectedDistrictName || "").toLowerCase();

  function styleFeature(f: Feature<Geometry>) {
    const raw = getDistrictName(f);
    const name = normalizeDistrictName(raw);
    const isSelected = name.toLowerCase() === selectedKey;

    return {
      weight: 1.2,
      color: "#000",
      fillColor: isSelected ? "#e5dbdb" : "#fff",
      fillOpacity: 1,
    };
  }

  if (!fc) return <div style={{ padding: 16 }}>Loading map…</div>;

  return (
    <MapContainer
      keyboard={false}
      style={{ height: "100vh", width: "100vw", background: "#f4eeee" }}
      center={[28.4, 84.0]}
      zoom={7.5}
      minZoom={6}
      maxZoom={9}
      zoomSnap={0.25}
      zoomDelta={0.25}
      wheelPxPerZoomLevel={120}
      doubleClickZoom={false}
      attributionControl={false}
    >
      <GeoJSON
        data={fc as any}
        interactive={true}
        style={(f) => styleFeature(f as any)}
        onEachFeature={(feature, layer) => {
          const raw = getDistrictName(feature as any);
          const name = normalizeDistrictName(raw);

          // Bind tooltip (not permanent)
          (layer as any).bindTooltip(name, {
            sticky: true,
            direction: "top",
            opacity: 0.95,
            className: "district-tooltip",
          });

          layer.on("mouseover", () => {
            (layer as L.Path).setStyle({ weight: 2.2 });
            (layer as any).openTooltip();
          });

          layer.on("mouseout", () => {
            (layer as L.Path).setStyle({ weight: 1.2 });
            (layer as any).closeTooltip();
          });

          layer.on("click", () => {
            // prevent tooltip staying / flashing on click
            (layer as any).closeTooltip();
            props.onDistrictClick(name);
          });
        }}

      />

    </MapContainer>
  );
}

/**
 * Robust district-name extraction:
 * 1) try known keys
 * 2) try keys that look like district/name
 * 3) fallback: first string property
 */
function getDistrictName(f: Feature<Geometry>): string {
  const p: Record<string, unknown> = (f.properties as any) || {};

  const knownKeys = [
    "DIST_EN",
    "DIST_ALT1E",
    "DIST_ALT2E",
    "DISTRICT",
    "DISTRICT_EN",
    "DISTNAME",
    "DIST_NAME",
    "NAME_3",
    "NAME",
    "NAME_EN",
    "name",
  ];

  // 1) known keys
  for (const k of knownKeys) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  // 2) any key containing dist/district/name
  for (const [k, v] of Object.entries(p)) {
    if (
      /dist|district|name/i.test(k) &&
      typeof v === "string" &&
      v.trim()
    ) {
      return v.trim();
    }
  }

  // 3) fallback: first reasonable string value
  for (const v of Object.values(p)) {
    if (typeof v === "string" && v.trim().length >= 2) return v.trim();
  }

  return "Unknown";
}
