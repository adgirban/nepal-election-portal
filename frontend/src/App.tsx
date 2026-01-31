import { useMemo, useState } from "react";
import MapView from "./components/MapView";
import candidatesData from "./data/candidates.json";
import { normalizeDistrictName } from "./utils/normalizeDistrictName";
import partySymbolsData from "./data/partySymbols.json";
import NavBar from "./components/NavBar";
import electionInfoData from "./data/electionInfo.json";
import { useLiveVotes } from "./hooks/useLiveVotes";


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
  Terhathum: "Tehrathum",
  Kapilbastu: "Kapilvastu",
};

export default function App() {
  const data = candidatesData as CandidatesJSON;
  const liveVotes = useLiveVotes();
  const votesReady = !!liveVotes && Object.keys(liveVotes.votes || {}).length > 0;


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
          <div
            className="popup-overlay"
            onClick={() => setSelectedDistrict(null)}
          >
            <div className="popup" onClick={(e) => e.stopPropagation()}>
              <button className="btn" onClick={() => setSelectedDistrict(null)}>
                X
              </button>
              <h2 style={{ marginBottom: 6 }}>{selectedDistrict}<span className="small"> — {matchedRows[0]?.Province}</span></h2>

            <div className="small">
              Source: Wikipedia • Updated{" "}
              {new Date(data.fetchedAt).toLocaleString()}
            </div>

            <div className="small">
              Live votes:{" "}
              <b>
                {votesReady
                  ? `connected • last update ${new Date(liveVotes!.fetchedAt).toLocaleString()}`
                  : "not started / no ECN data yet"}
              </b>
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
                    </h3>

                    {parties.map((party) => (
                      <CandidateRow
                        key={party}
                        party={party}
                        name={String(row[party] ?? "")}
                        constituency={String(row.Constituency ?? "")}
                        votesMap={liveVotes?.votes ?? {}}
                        votesReady={votesReady}
                      />

                    ))}

                        <div className="hr" />
                      </div>
                    );
                  })
            )}


            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateRow({
  party,
  name,
  constituency,
  votesMap,
  votesReady,
}: {
  party: string;
  name: string;
  constituency: string;
  votesMap: Record<string, number>;
  votesReady: boolean;
}) {
  const v = sanitizeValue(name);
  if (!v) return null;

  const symbolPath = getPartySymbolPath(party);
  const candidates = splitCandidateNames(v);

  const districtRaw = extractDistrictFromConstituency(constituency);
  const district = normalizeDistrictName(districtRaw);
  const no = constituencyNumber(constituency);

  const voteKey = `${district}-${no}|${party}`;
  const hasKey = Object.prototype.hasOwnProperty.call(votesMap, voteKey);
  const votes = hasKey ? votesMap[voteKey] : 0;

  const display = votesReady ? (hasKey ? votes.toLocaleString() : "—") : "—";

  return (
    <div style={{ marginBottom: 6 }}>
      {candidates.map((cand, idx) => (
        <div
          key={`${party}-${idx}`}
          style={{
            display: "flex",
            gap: 5,
            alignItems: "center",
            borderBottom: "1px solid #979595",
            padding: "3px 0",
            boxSizing: "border-box",
          }}
        >
          <div style={{ width: 80, fontWeight: 700 }}>
            {idx === 0 ? party : ""}
          </div>

          <div style={{ flex: 1, lineHeight: "20px" }}>{cand}</div>

          <div
            style={{
              width: 50,
              textAlign: "left",
              paddingLeft: 0,
              paddingRight: 10,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              minHeight: 26,
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

          <div
            style={{
              width: 70,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {display}
          </div>
        </div>
      ))}
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

function splitCandidateNames(value: string): string[] {
  const s0 = String(value || "").trim();
  if (!s0) return [];

  const s = s0.replace(/\s+/g, " ").trim();

  if (s.includes("\n")) {
    return s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  if (s.includes("<br")) {
    return s
      .replace(/<br\s*\/?>/gi, "\n")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  const parenSegments = s.match(/[^()]+?\([^)]*\)/g);
  if (parenSegments && parenSegments.length >= 2) {
    return parenSegments.map((x) => x.trim()).filter(Boolean);
  }

  const separators = [" • ", " ; ", " | "];
  for (const sep of separators) {
    if (s.includes(sep)) {
      return s
        .split(sep)
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }

  if (s.includes(",") && /,\s*[A-Z]/.test(s)) {
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [s];
}


