import { useMemo, useState } from "react";
import MapView from "./components/MapView";
import candidatesData from "./data/candidates.json";
import { normalizeDistrictName } from "./utils/normalizeDistrictName";
import partySymbolsData from "./data/partySymbols.json";
import NavBar from "./components/NavBar";
import electionInfoData from "./data/electionInfo.json";

type Row = Record<string, any>;

type CandidatesJSON = {
  source: string;
  fetchedAt: string;
  provinces: Record<string, Row[]>;
};

const PARTY_ORDER = [
  "Congress",
  "UML",
  "NCP",
  "RSP",
  "RPP",
  "PSP-N",
  "Janamat",
  "UNP",
  "Others",
];

type PartySymbolsJSON = {
  source: string;
  fetchedAt: string;
  symbols: Record<string, string>;
};

// Map your candidates.json column keys -> partySymbols.json keys
const PARTY_KEY_TO_FULLNAME: Record<string, string> = {
  Congress: "Nepali Congress",
  UML: "CPN (UML)",
  NCP: "Nepali Communist Party",
  RSP: "Rastriya Swatantra Party",
  RPP: "Rastriya Prajatantra Party",
  "PSP-N": "People's Socialist Party, Nepal",
  Janamat: "Janamat Party",
  UNP: "Ujyaalo",
  Others: "", // no symbol
};

function getPartySymbolPath(partyKey: string): string | null {
  const symbols = (partySymbolsData as PartySymbolsJSON).symbols || {};
  const full = PARTY_KEY_TO_FULLNAME[partyKey] ?? partyKey;
  if (!full) return null;

  return symbols[full] ?? null;
}


/**
 * Map GeoJSON district names -> the district label we use in candidates.json lookup.
 * Add more entries as you discover mismatches (this is normal).
 */
const DISTRICT_ALIAS: Record<string, string> = {
  // Rukum naming mismatch
  "Rukum East": "Eastern Rukum",
  "Rukum (East)": "Eastern Rukum",
  "Rukum-East": "Eastern Rukum",
  "Rukum East District": "Eastern Rukum",
  "Eastern Rukum": "Eastern Rukum",

  "Rukum West": "Western Rukum",
  "Rukum (West)": "Western Rukum",
  "Rukum-West": "Western Rukum",
  "Rukum West District": "Western Rukum",
  "Western Rukum": "Western Rukum",

  // Nawalparasi / Parasi datasets vary
  Parasi: "Nawalparasi",
  "Nawalparasi West": "Nawalparasi",
  "Nawalparasi (West)": "Nawalparasi",

  // Keep as-is but included for clarity
  Nawalpur: "Nawalpur",
};

export default function App() {
  const data = candidatesData as CandidatesJSON;

  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  // Build district -> candidate rows index (from candidates.json)
  const districtIndex = useMemo(() => {
    const idx = new Map<string, Row[]>();

    for (const provinceName of Object.keys(data.provinces || {})) {
      const rows = data.provinces[provinceName] || [];

      for (const row of rows) {
        if (!isCandidateRow(row)) continue;

        const constituency = String(row.Constituency || "").trim();
        if (!constituency) continue;

        const districtRaw = extractDistrictFromConstituency(constituency);
        const districtKey = normalizeDistrictName(districtRaw).toLowerCase();

        const cleaned = cleanRowValues(row);

        if (!idx.has(districtKey)) idx.set(districtKey, []);
        idx.get(districtKey)!.push({ ...cleaned, Province: provinceName });
      }
    }

    // Sort within each district by constituency number
    for (const [k, arr] of idx.entries()) {
      arr.sort(
        (a, b) =>
          constituencyNumber(a.Constituency) - constituencyNumber(b.Constituency)
      );
      idx.set(k, arr);
    }

    return idx;
  }, [data]);

  function normalizeDistrictForLookup(nameFromMap: string): string {
    const base = normalizeDistrictName(nameFromMap);

    // Apply alias map (case-insensitive)
    const aliasKey = Object.keys(DISTRICT_ALIAS).find(
      (k) => k.toLowerCase() === base.toLowerCase()
    );
    const mapped = aliasKey ? DISTRICT_ALIAS[aliasKey] : base;

    return normalizeDistrictName(mapped);
  }

  function handleDistrictClick(nameFromMap: string) {
    const normalized = normalizeDistrictForLookup(nameFromMap);

    // Debug so you can see mismatches immediately
    // eslint-disable-next-line no-console
    console.log("Map click:", nameFromMap, "=> lookup:", normalized);

    setSelectedDistrict((prev) =>
      prev?.toLowerCase() === normalized.toLowerCase() ? null : normalized
    );
  }

  const matchedRows = selectedDistrict
    ? districtIndex.get(selectedDistrict.toLowerCase()) ?? []
    : [];

  const debugNearby = useMemo(() => {
    if (!selectedDistrict) return [];
    const key = selectedDistrict.toLowerCase();
    const all = Array.from(districtIndex.keys());

    const contains = all.filter((k) => k.includes(key) || key.includes(k));
    return contains.slice(0, 10);
  }, [selectedDistrict, districtIndex]);

  return (
    <div className="map-wrap">
      <NavBar info={electionInfoData as any} />

      <div className="main">
        <MapView
          geoJsonUrl="/nepal-districts.geojson"
          selectedDistrictName={selectedDistrict}
          onDistrictClick={handleDistrictClick}
        />

        {selectedDistrict && (
          <div className="popup">
            <h2 style={{ marginBottom: 6 }}>{selectedDistrict}</h2>

            <div className="small">
              Source: Wikipedia • Updated{" "}
              {new Date(data.fetchedAt).toLocaleString()}
            </div>

            <div className="hr" />

            {matchedRows.length === 0 ? (
              <p className="small">
                No constituencies found for this district in{" "}
                <b>src/data/candidates.json</b>.
                <br />
                <span className="small">
                  Debug: normalized = <b>{selectedDistrict}</b>
                  {debugNearby.length > 0 && (
                    <>
                      <br />
                      Similar keys: {debugNearby.join(", ")}
                    </>
                  )}
                </span>
              </p>
            ) : (
                matchedRows.map((row, i) => {
                  const parties = detectPartyColumns(row);

                    return (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <h3 style={{ marginBottom: 8 }}>
                      {row.Constituency}
                      <span className="small"> — {row.Province}</span>
                    </h3>

                    {parties.map((party) => (
                      <CandidateRow
                        key={party}
                        party={party}
                        name={String(row[party] ?? "")}
                      />
                    ))}

                        <div className="hr" />
                      </div>
                    );
                  })
            )}


            <button className="btn" onClick={() => setSelectedDistrict(null)}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateRow({ party, name }: { party: string; name: string; }) {
  const v = sanitizeValue(name);
  if (!v) return null;

  const symbolPath = getPartySymbolPath(party);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 4,
        alignItems: "center",
      }}
    >
      <div style={{ width: 90, fontWeight: 700 }}>{party}</div>

      <div style={{ flex: 1, alignItems: "baseline" }}>{v}</div>

      {/* Symbol column (shifted left, space reserved for votes) */}
      <div
        style={{
          width: 120,
          textAlign: "left",
          paddingLeft: 16,
          paddingRight: 40, // ← future vote count space
          boxSizing: "border-box",
        }}
      >
        {symbolPath ? (
          <img
            src={symbolPath}
            alt={`${party} symbol`}
            style={{ height: 26, width: "auto", objectFit: "contain" }}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="small">—</span>
        )}
      </div>
    </div>
  );
}



/* ---------------- Helpers ---------------- */

function isCandidateRow(row: Row): boolean {
  const c = String(row?.Constituency ?? "").trim();
  if (!c) return false;
  if (c.toLowerCase() === "constituency") return false;

  // must end in a number (filters out "Outgoing MP" rows)
  if (!/\d+\s*$/.test(c)) return false;

  return true;
}

function extractDistrictFromConstituency(constituency: string): string {
  return constituency
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\s*[-\s]\s*\d+\s*$/, "")
    .trim();
}

function constituencyNumber(constituency: string): number {
  const m = String(constituency).match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 999;
}

function detectPartyColumns(row: Row): string[] {
  const keys = Object.keys(row);
  const present = PARTY_ORDER.filter((p) => keys.includes(p));

  if (present.length === 0) {
    return keys.filter((k) => k !== "Constituency" && k !== "Province");
  }
  return present;
}

function sanitizeValue(raw: string): string {
  let s = String(raw || "").trim();
  if (!s) return "";

  // strip embedded wikipedia css blobs from "Others"
  if (s.includes(".mw-parser-output")) {
    const lastBrace = s.lastIndexOf("}");
    if (lastBrace !== -1) s = s.slice(lastBrace + 1).trim();
  }

  s = s.replace(/[{};]/g, " ").replace(/\s+/g, " ").trim();
  if (s === "-" || s === "—") return "";
  return s;
}

function cleanRowValues(row: Row): Row {
  const out: Row = {};
  for (const k of Object.keys(row)) {
    const v = row[k];
    out[k] = typeof v === "string" ? sanitizeValue(v) : v;
  }
  return out;
}
