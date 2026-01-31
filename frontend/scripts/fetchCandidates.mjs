import fs from "fs";
import { load } from "cheerio";

const URL =
  "https://en.wikipedia.org/w/index.php?title=2026_Nepalese_general_election&action=render";

function clean(text = "") {
  return text.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

function isProvinceHeading(text) {
  const t = clean(text).toLowerCase();
  return (
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
  if (low.includes("province")) return s;
  for (const k of Object.keys(map)) if (low.includes(k)) return map[k];
  return s;
}

function hasConstituencyColumn(headers) {
  return headers.some((h) => h.toLowerCase().includes("constituen"));
}

// Rowspan/colspan-safe-ish parser
function parseTableWithSpans($, $table) {
  const rows = $table.find("tr").toArray();
  const grid = [];
  const spanMap = new Map(); // "r,c" -> { text, remaining }
  const key = (r, c) => `${r},${c}`;

  for (let r = 0; r < rows.length; r++) {
    grid[r] = [];
    let c = 0;
    const cells = $(rows[r]).find("th, td").toArray();

    const fillActive = () => {
      while (spanMap.has(key(r, c))) {
        const s = spanMap.get(key(r, c));
        grid[r][c] = s.text;
        if (s.remaining > 1) {
          spanMap.set(key(r + 1, c), { text: s.text, remaining: s.remaining - 1 });
        }
        spanMap.delete(key(r, c));
        c++;
      }
    };

    for (const cell of cells) {
      fillActive();
      const $cell = $(cell);
      const text = clean($cell.text());
      const rowspan = parseInt($cell.attr("rowspan") || "1", 10);
      const colspan = parseInt($cell.attr("colspan") || "1", 10);

      for (let k = 0; k < colspan; k++) {
        grid[r][c + k] = text;
        if (rowspan > 1) {
          spanMap.set(key(r + 1, c + k), { text, remaining: rowspan - 1 });
        }
      }
      c += colspan;
    }
    fillActive();
  }

  const headers = (grid[0] || []).map((x) => clean(x || "")).filter(Boolean);
  if (!headers.length) return { headers: [], data: [] };

  const data = [];
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i] || [];
    if (!row.some((v) => clean(v || ""))) continue;

    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = clean(row[j] || "");
    data.push(obj);
  }
  return { headers, data };
}

function findHeadingByExactText($, selector, exactLowerText) {
  const els = $(selector).toArray();
  for (const el of els) {
    const t = clean($(el).text()).toLowerCase();
    if (t === exactLowerText) return $(el);
  }
  return null;
}

async function main() {
  const res = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = load(html);

  console.log("Debug:", "tables=", $("table").length, "wikitables=", $("table.wikitable").length);

  const startHeading = findHeadingByExactText($, "h2, h3, h4, h5", "candidates by province");
  console.log("Debug:", "startHeadingFound=", Boolean(startHeading && startHeading.length));
  if (!startHeading || !startHeading.length) throw new Error("Candidates by Province heading not found.");

  // ✅ Robust walk: use the main content container and iterate through its direct children.
  // In action=render, everything important is usually inside .mw-parser-output.
  const $root = $(".mw-parser-output").first();
  console.log("Debug:", "mwParserOutputFound=", $root.length > 0, "rootChildren=", $root.children().length);

  if (!$root.length) throw new Error(".mw-parser-output not found. Page structure changed.");

  const rootChildren = $root.children().toArray();

  // Find the index of the child that CONTAINS the heading (heading might be nested)
  const headingEl = startHeading.get(0);
  const startIdx = rootChildren.findIndex((child) => child === headingEl || $(child).find(headingEl).length > 0);
  console.log("Debug:", "startIdxInRootChildren=", startIdx);

  if (startIdx < 0) {
    // fallback: just scan all children looking for the text
    throw new Error("Could not locate Candidates by Province heading inside .mw-parser-output children.");
  }

  const result = {
    source: "https://en.wikipedia.org/wiki/2026_Nepalese_general_election#Candidates_by_Province",
    fetchedAt: new Date().toISOString(),
    provinces: {},
  };

  let currentProvince = "";
  let parsedTables = 0;
  let tablesWithConstituency = 0;

  // Iterate AFTER the heading-containing block
  for (let i = startIdx + 1; i < rootChildren.length; i++) {
    const $node = $(rootChildren[i]);

    // Stop at next major section
    if ($node.is("h2")) break;

    // Province headings
    if ($node.is("h3, h4, h5")) {
      const title = clean($node.text());
      if (isProvinceHeading(title)) currentProvince = normalizeProvinceName(title);
      continue;
    }

    // Sometimes headings are inside wrappers (div, table caption blocks etc.)
    // So also check if this block contains a province heading as a descendant.
    const descendantHeadings = $node.find("h3, h4, h5").toArray();
    for (const h of descendantHeadings) {
      const title = clean($(h).text());
      if (isProvinceHeading(title)) currentProvince = normalizeProvinceName(title);
    }

    // Tables can also be nested. Parse any table(s) inside this block.
    const tables = $node.is("table") ? [$node] : $node.find("table").toArray().map((t) => $(t));
    for (const $table of tables) {
      if (!currentProvince) continue;

      const { headers, data } = parseTableWithSpans($, $table);
      if (!headers.length) continue;
      if (!hasConstituencyColumn(headers)) continue;

      tablesWithConstituency++;
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

  if (provinces.length === 0) {
    console.log("⚠️ Still empty. Quick peek after heading (next 25 root blocks):");
    for (let k = startIdx + 1; k < Math.min(rootChildren.length, startIdx + 26); k++) {
      const $n = $(rootChildren[k]);
      const tag = $n.get(0)?.tagName;
      const text = clean($n.text()).slice(0, 140);
      console.log(`${k - startIdx}. <${tag}> ${text}`);
    }
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
