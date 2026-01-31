// scripts/fetchPartySymbols.mjs
// Node 18+ (works on Node 22)
// Run: node scripts/fetchPartySymbols.mjs

import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const PAGE_URL = "https://en.wikipedia.org/wiki/2026_Nepalese_general_election";

// output locations
const OUT_DIR = path.resolve(process.cwd(), "public", "election-symbols");
const OUT_JSON = path.resolve(process.cwd(), "src", "data", "partySymbols.json");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });

function slug(s) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function absUrl(src) {
  if (!src) return null;
  if (src.startsWith("//")) return "https:" + src;
  if (src.startsWith("http")) return src;
  if (src.startsWith("/")) return "https://en.wikipedia.org" + src;
  return null;
}

async function download(url, out) {
  const res = await fetch(url, {
    headers: { "User-Agent": "nepal-election-portal/1.0" },
  });
  if (!res.ok) throw new Error(`Failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(out, buf);
}

function findPartySymbolTable($) {
  const tables = $("table.wikitable").toArray();

  for (const el of tables) {
    const headers = $(el)
      .find("tr")
      .first()
      .find("th")
      .map((_, th) => $(th).text().trim().toLowerCase())
      .get();

    if (headers.includes("party") && headers.includes("symbol")) {
      return $(el);
    }
  }
  return null;
}

async function main() {
  console.log("Fetching:", PAGE_URL);
  const html = await fetch(PAGE_URL).then((r) => r.text());
  const $ = cheerio.load(html);

  const table = findPartySymbolTable($);
  if (!table) {
    throw new Error("Could not find a wikitable with Party + Symbol headers.");
  }

  const mapping = {
    source: PAGE_URL,
    fetchedAt: new Date().toISOString(),
    symbols: {},
  };

  const rows = table.find("tr").slice(1).toArray();

  console.log(`Found ${rows.length} rows. Extracting symbols…`);

  for (const row of rows) {
    const $row = $(row);
    const cells = $row.find("td");
    if (cells.length < 2) continue;

    const party =
      $row.find("a").first().text().trim() ||
      $(cells[0]).text().trim();

    const img = $row.find("img").first();
    const src = absUrl(img.attr("src"));
    if (!party || !src) continue;

    const file = slug(party) + ".png";
    const outPath = path.join(OUT_DIR, file);

    if (!fs.existsSync(outPath)) {
      await download(src, outPath);
      console.log(`✓ ${party}`);
    }

    mapping.symbols[party] = `/election-symbols/${file}`;
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(mapping, null, 2), "utf8");

  console.log("\n✅ DONE");
  console.log("Images →", OUT_DIR);
  console.log("Mapping →", OUT_JSON);
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
