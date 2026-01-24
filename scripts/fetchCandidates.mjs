import fs from "fs";
import { load } from "cheerio";

const URL =
  "https://en.wikipedia.org/w/index.php?title=2026_Nepalese_general_election&action=render";

function clean(text = "") {
  return text.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

function isProvinceHeading(text) {
  const t = text.toLowerCase();
  return (
    t.includes("province") ||
    t.includes("koshi") ||
    t.includes("madhesh") ||
    t.includes("bagmati") ||
    t.includes("gandaki") ||
    t.includes("lumbini") ||
    t.includes("karnali") ||
    t.includes("sudurpashchim") ||
    t.includes("sudurpaschim")
  );
}

function normalizeProvinceName(raw) {
  const s = clean(raw);
  const low = s.toLowerCase();

  const map = {
    koshi: "Koshi Province",
    madhesh: "Madhesh Province",
    bagmati: "Bagmati Province",
    gandaki: "Gandaki Province",
    lumbini: "Lumbini Province",
    karnali: "Karnali Province",
    sudurpashchim: "Sudurpashchim Province",
    sudurpaschim: "Sudurpashchim Province",
  };

  // If already contains "Province", keep as is
  if (low.includes("province")) return s;

  for (const k of Object.keys(map)) {
    if (low.includes(k)) return map[k];
  }

  return s;
}

function hasConstituencyColumn(headers) {
  return headers.some((h) => h.toLowerCase().includes("constituen"));
}

async function main() {
  const res = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = load(html);

  const anchor = $("#Candidates_by_Province");
  console.log(
    "Debug:",
    "anchorFound=", anchor.length > 0,
    "tables=", $("table").length,
    "wikitables=", $("table.wikitable").length
  );

  if (!anchor.length) throw new Error("Candidates_by_Province anchor not found.");

  // Start from the closest heading OR parent
  let start = anchor.closest("h2, h3, h4, h5");
  if (!start.length) start = anchor.parent();

  const result = {
    source: "https://en.wikipedia.org/wiki/2026_Nepalese_general_election#Candidates_by_Province",
    fetchedAt: new Date().toISOString(),
    provinces: {},
  };

  let currentProvince = "";
  let parsedTables = 0;
  let tablesWithConstituency = 0;

  // Walk forward in DOM order
  const nodes = start.nextAll().toArray();

  for (const node of nodes) {
    const $node = $(node);

    // Stop when we hit a new major section that isn't province-related
    // (Wikipedia render pages sometimes use h2/h3 for new sections)
    if ($node.is("h2, h3")) {
      const title = clean($node.find(".mw-headline").text() || $node.text());
      if (title && !isProvinceHeading(title) && title.toLowerCase().includes("candidates") === false) {
        // We've reached a new section after Candidates-by-Province
        // (safe stop to avoid parsing unrelated tables)
        break;
      }
    }

    // Province headings can be h3/h4/h5
    if ($node.is("h3, h4, h5")) {
      const title = clean($node.find(".mw-headline").text() || $node.text());
      if (title && isProvinceHeading(title)) {
        currentProvince = normalizeProvinceName(title);
      }
      continue;
    }

    // Parse tables under the last province heading
    if ($node.is("table")) {
      const rows = $node.find("tr").toArray();
      if (rows.length < 2) continue;

      const headers = $(rows[0])
        .find("th, td")
        .toArray()
        .map((c) => clean($(c).text()))
        .filter(Boolean);

      if (!headers.length) continue;
      if (!hasConstituencyColumn(headers)) continue;

      tablesWithConstituency++;

      if (!currentProvince) {
        // If table appears before we detect province heading, skip
        continue;
      }

      const data = [];
      for (let i = 1; i < rows.length; i++) {
        const cells = $(rows[i])
          .find("th, td")
          .toArray()
          .map((c) => clean($(c).text()));

        if (!cells.length) continue;

        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = cells[idx] || "";
        });

        data.push(obj);
      }

      if (!result.provinces[currentProvince]) result.provinces[currentProvince] = [];
      result.provinces[currentProvince].push(...data);
      parsedTables++;
    }
  }

  fs.mkdirSync("src/data", { recursive: true });
  fs.writeFileSync("src/data/candidates.json", JSON.stringify(result, null, 2), "utf-8");

  const provinces = Object.keys(result.provinces);
  const totalRows = Object.values(result.provinces).reduce((a, b) => a + b.length, 0);

  console.log("✅ Candidates fetched successfully");
  console.log("Provinces:", provinces);
  console.log("Total rows:", totalRows);
  console.log("Debug: tablesWithConstituency=", tablesWithConstituency, "parsedTables=", parsedTables);

  // If still empty, print the first few headings after the anchor for diagnosis
  if (provinces.length === 0) {
    console.log("⚠️ Provinces still empty. Printing next headings for diagnosis:");
    let printed = 0;
    for (const node of nodes) {
      const $node = $(node);
      if ($node.is("h2, h3, h4, h5")) {
        const title = clean($node.find(".mw-headline").text() || $node.text());
        if (title) {
          console.log("Heading:", title);
          printed++;
          if (printed >= 12) break;
        }
      }
    }
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
