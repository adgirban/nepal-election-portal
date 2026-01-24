import { useMemo, useState } from "react";
import MapView from "./components/MapView";
import candidatesData from "./data/candidates.json";
import { normalizeDistrictName } from "./utils/normalizeDistrictName";

/* ---------------- Types ---------------- */

type ProvinceTableRow = Record<string, string>;

type CandidatesJSON = {
  source: string;
  fetchedAt: string;
  provinces: Record<string, ProvinceTableRow[]>;
};

type SelectedDistrict = {
  name: string; // normalized district label used for lookup + UI
};

/* ---------------- Helpers ---------------- */

/** Find a column key in a row by regex (case-insensitive), returns the actual key. */
function findColumnKey(row: ProvinceTableRow, pattern: RegExp): string | null {
  for (const k of Object.keys(row)) {
    if (pattern.test(k)) return k;
  }
  return null;
}

/**
 * Given a constituency string like:
 * "Jhapa 1", "Jhapa–1", "Jhapa-1", "Eastern Rukum 1"
 * returns the district portion: "Jhapa", "Eastern Rukum"
 */
function extractDistrictFromConstituency(constituencyRaw: string): string {
  const s = (constituencyRaw || "").trim();
  if (!s) return "";

  // Normalize dash variants (–, —) to "-"
  const dashNorm = s.replace(/[–—]/g, "-");

  // Common patterns:
  // 1) "Jhapa 1"
  // 2) "Jhapa-1"
  // 3) "Jhapa - 1"
  // 4) Sometimes weird spacing
  // Remove trailing separator + number
  const removed = dashNorm.replace(/\s*[-\s]\s*\d+\s*$/, "").trim();

  // If no change, try removing last token if it's a number
  if (removed === dashNorm) {
    const parts = dashNorm.split(/\s+/);
    const last = parts[parts.length - 1];
    if (!isNaN(Number(last))) return parts.slice(0, -1).join(" ").trim();
  }

  return removed;
}

/* ---------------- App ---------------- */

export default function App() {
  const data = candidatesData as unknown as CandidatesJSON;

  const [selected, setSelected] = useState<SelectedDistrict | null>(null);

  // Flatten count for debugging (tells you if candidates.json is actually populated)
  const totalCandidateRows = useMemo(() => {
    if (!data?.provinces) return 0;
    return Object.values(data.provinces).reduce((acc, rows) => acc + rows.length, 0);
  }, [data]);

  /* -----------------------------------------------------------
     Build an index:
     district (normalized) -> rows (constituencies + candidates)
     ----------------------------------------------------------- */
  const districtIndex = useMemo(() => {
    const index = new Map<string, ProvinceTableRow[]>();

    if (!data?.provinces) return index;

    for (const provinceName of Object.keys(data.provinces)) {
      const rows = data.provinces[provinceName] || [];

      for (const row of rows) {
        // Detect constituency column even if casing changes
        const constituencyKey =
          findColumnKey(row, /^constituency$/i) ||
          findColumnKey(row, /constituency/i);

        const constituency = constituencyKey ? (row[constituencyKey] || "").trim() : "";
        if (!constituency) continue;

        const districtRaw = extractDistrictFromConstituency(constituency);
        const districtNormalized = normalizeDistrictName(districtRaw);
        const key = districtNormalized.toLowerCase();

        if (!index.has(key)) index.set(key, []);
        index.get(key)!.push({ ...row, Province: provinceName });
      }
    }

    return index;
  }, [data]);

  /* -----------------------------------------------------------
     District click handler (toggle)
     IMPORTANT: normalize here so mismatches don’t happen.
     ----------------------------------------------------------- */
  function handleDistrictClick(districtNameFromMap: string) {
    const normalized = normalizeDistrictName(districtNameFromMap);

    setSelected((prev) => {
      if (prev?.name.toLowerCase() === normalized.toLowerCase()) return null;
      return { name: normalized };
    });
  }

  const constituencyRows = selected
    ? districtIndex.get(selected.name.toLowerCase()) ?? []
    : [];

  return (
    <div className="map-wrap">
      <MapView
        geoJsonUrl="/nepal-districts.geojson"
        selectedDistrictName={selected?.name ?? null}
        onDistrictClick={handleDistrictClick}
      />

      {selected && (
        <div className="popup">
          <h2>{selected.name}</h2>

          <div className="small">
            Source: Wikipedia • Updated {new Date(data.fetchedAt).toLocaleString()}
          </div>

          <div className="small" style={{ marginTop: 6 }}>
            Debug: totalRows={totalCandidateRows}, matchedRows={constituencyRows.length}
          </div>

          <div className="hr" />

          {totalCandidateRows === 0 ? (
            <p className="small">
              Your <b>candidates.json is empty</b> (no rows were loaded).
              <br />
              Run: <b>npm run fetch:candidates</b>
            </p>
          ) : constituencyRows.length === 0 ? (
            <p className="small">
              No constituencies found for this district.
              <br />
              This usually means a spelling mismatch between your district GeoJSON and Wikipedia names.
              <br />
              Tell me which district you clicked (exact name shown above) and I’ll add it to the mapping.
            </p>
          ) : (
            constituencyRows.map((row, i) => {
              const constituencyKey =
                findColumnKey(row, /^constituency$/i) ||
                findColumnKey(row, /constituency/i) ||
                "Constituency";

              const constituency = row[constituencyKey] || "(unknown constituency)";

              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <h3 style={{ marginBottom: 8 }}>
                    {constituency}
                    <span className="small"> — {row["Province"]}</span>
                  </h3>

                  <Candidate party="Congress" name={row["Congress"]} />
                  <Candidate party="UML" name={row["UML"]} />
                  <Candidate party="NCP" name={row["NCP"]} />
                  <Candidate party="RSP" name={row["RSP"]} />
                  <Candidate party="RPP" name={row["RPP"]} />

                  {/* Optional columns */}
                  <Candidate party="PSP-N" name={row["PSP-N"]} />
                  <Candidate party="Janamat" name={row["Janamat"]} />
                  <Candidate party="UNP" name={row["UNP"]} />
                  <Candidate party="Others" name={row["Others"]} />

                  <div className="hr" />
                </div>
              );
            })
          )}

          <button className="btn" onClick={() => setSelected(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Candidate Row ---------------- */

function Candidate(props: { party: string; name?: string }) {
  const name = (props.name || "").trim();
  if (!name) return null;

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 4, alignItems: "baseline" }}>
      <div style={{ width: 90, fontWeight: 700 }}>{props.party}</div>
      <div style={{ flex: 1 }}>{name}</div>
      <div className="small" style={{ width: 120, textAlign: "right" }}>
        [logo] [symbol]
      </div>
    </div>
  );
}
