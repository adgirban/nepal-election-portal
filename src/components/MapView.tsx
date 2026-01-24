import { useEffect, useState } from "react";
import { MapContainer, GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { normalizeDistrictName } from "../utils/normalizeDistrictName";

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
      fillColor: isSelected ? "#d9d9d9" : "#fff",
      fillOpacity: 1,
    };
  }

  if (!fc) return <div style={{ padding: 16 }}>Loading map…</div>;

  return (
    <MapContainer
      style={{ height: "100vh", width: "100vw" }}
      center={[28.2, 84.0]}
      zoom={7}
      minZoom={6}
      maxZoom={9}          // "lesser limit than now"
      zoomSnap={0.25}
      zoomDelta={0.25}
      wheelPxPerZoomLevel={120} // smoother wheel zoom
      doubleClickZoom={false}
      attributionControl={false}
    >
      <GeoJSON
        data={fc as any}
        style={(f) => styleFeature(f as any)}
        onEachFeature={(feature, layer) => {
          const raw = getDistrictName(feature as any);
          const name = normalizeDistrictName(raw);

          layer.on("mouseover", () => layer.setStyle({ weight: 2.2 }));
          layer.on("mouseout", () => layer.setStyle({ weight: 1.2 }));

          layer.on("click", () => props.onDistrictClick(name));
        }}
      />
    </MapContainer>
  );
}

function getDistrictName(f: Feature<Geometry>): string {
  const p: any = f.properties || {};
  // Your file uses DIST_EN
  return p.DIST_EN || p.DIST_ALT1E || p.DIST_ALT2E || "Unknown";
}
