import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const ECN_API_URL = process.env.ECN_API_URL || "";

console.log("ECN_API_URL =", ECN_API_URL || "(not set)");

let cache = {
  fetchedAt: new Date().toISOString(),
  votes: {}
};

const clients = new Set();

// ECN Nepali district name -> English (matches Wikipedia / common datasets)
const DISTRICT_NP_TO_EN = {
  // Koshi Province (14)
  "ताप्लेजुंग": "Taplejung",
  "पाँचथर": "Panchthar",
  "इलाम": "Ilam",
  "झापा": "Jhapa",
  "मोरङ": "Morang",
  "सुनसरी": "Sunsari",
  "धनकुटा": "Dhankuta",
  "तेह्रथुम": "Tehrathum",
  "संखुवासभा": "Sankhuwasabha",
  "भोजपुर": "Bhojpur",
  "खोटाङ": "Khotang",
  "सोलुखुम्बु": "Solukhumbu",
  "ओखलढुंगा": "Okhaldhunga",
  "उदयपुर": "Udayapur",

  // Madhesh Province (8)
  "सप्तरी": "Saptari",
  "सिराहा": "Siraha",
  "धनुषा": "Dhanusha",
  "महोत्तरी": "Mahottari",
  "सर्लाही": "Sarlahi",
  "रौतहट": "Rautahat",
  "बारा": "Bara",
  "पर्सा": "Parsa",

  // Bagmati Province (13)
  "दोलखा": "Dolakha",
  "रामेछाप": "Ramechhap",
  "सिन्धुली": "Sindhuli",
  "सिन्धुपाल्चोक": "Sindhupalchok",
  "काभ्रेपलाञ्चोक": "Kavrepalanchok",
  "ललितपुर": "Lalitpur",
  "भक्तपुर": "Bhaktapur",
  "काठमाडौँ": "Kathmandu",
  "नुवाकोट": "Nuwakot",
  "रसुवा": "Rasuwa",
  "धादिङ": "Dhading",
  "चितवन": "Chitwan",
  "मकवानपुर": "Makwanpur",

  // Gandaki Province (11)
  "गोरखा": "Gorkha",
  "लमजुङ": "Lamjung",
  "तनहुँ": "Tanahun",
  "कास्की": "Kaski",
  "मनाङ": "Manang",
  "मुस्ताङ": "Mustang",
  "म्याग्दी": "Myagdi",
  "नवलपुर": "Nawalpur",
  "पर्वत": "Parbat",
  "बागलुङ": "Baglung",
  "स्याङ्जा": "Syangja",

  // Lumbini Province (12)
  "रुकुम पूर्व": "Eastern Rukum",
  "रुकुम पश्चिम": "Western Rukum",
  "रोल्पा": "Rolpa",
  "प्युठान": "Pyuthan",
  "गुल्मी": "Gulmi",
  "अर्घाखाँची": "Arghakhanchi",
  "पाल्पा": "Palpa",
  "नवलपरासी पश्चिम": "Nawalparasi",
  "रुपन्देही": "Rupandehi",
  "कपिलवस्तु": "Kapilvastu",
  "दाङ": "Dang",
  "बाँके": "Banke",

  // Karnali Province (10)
  "डोल्पा": "Dolpa",
  "मुगु": "Mugu",
  "हुम्ला": "Humla",
  "जुम्ला": "Jumla",
  "कालिकोट": "Kalikot",
  "दैलेख": "Dailekh",
  "जाजरकोट": "Jajarkot",
  "सुर्खेत": "Surkhet",
  "सल्यान": "Salyan",
  "रुकुम": "Rukum", // legacy combined name (rare, but safe)

  // Sudurpashchim Province (9)
  "बझाङ": "Bajhang",
  "बझुरा": "Bajura",
  "अछाम": "Achham",
  "डोटी": "Doti",
  "कैलाली": "Kailali",
  "कञ्चनपुर": "Kanchanpur",
  "डडेल्धुरा": "Dadeldhura",
  "डोटी": "Doti",
  "दार्चुला": "Darchula",
};


function fixNepali(s) {
  if (typeof s !== "string") return s;
  if (!s.includes("à")) return s;
  try {
    return Buffer.from(s, "latin1").toString("utf8");
  } catch {
    return s;
  }
}

function cleanText(s) {
  return fixNepali(String(s ?? "")).replace(/\s+/g, " ").trim();
}

// ECN PoliticalPartyName -> your party column keys
function partyKeyFromECN(politicalPartyName) {
  const raw = cleanText(politicalPartyName || "");
  const p = raw.toLowerCase();

  // Nepali Congress
  if (p.includes("nepali congress") || raw.includes("नेपाली कांग्रेस")) return "Congress";

  // UML
  if (p.includes("uml") || raw.includes("एमाले")) return "UML";

  // Maoist / NCP bucket
  if (
    p.includes("mao") ||
    p.includes("maoist") ||
    p.includes("communist") ||
    raw.includes("माओवादी") ||
    raw.includes("कम्युनिष्ट")
  ) {
    return "NCP";
  }

  // RSP
  if (p.includes("rastriya swatantra") || raw.includes("राष्ट्रिय स्वतन्त्र")) return "RSP";

  // RPP  ✅ (this is your failing case)
  if (p.includes("rastriya prajatantra") || raw.includes("राष्ट्रिय प्रजातन्त्र")) return "RPP";

  // PSP-N
  if (p.includes("people's socialist") || raw.includes("जनता समाजवादी")) return "PSP-N";

  // Janamat
  if (p.includes("janamat") || raw.includes("जनमत")) return "Janamat";

  // UNP / Ujyaalo
  if (p.includes("ujyaalo") || raw.includes("उज्यालो")) return "UNP";

  return "Others";
}


function normalizeDistrictNameServer(districtName) {
  const raw = cleanText(districtName)
    .replace(/[–—]/g, "-")
    .trim();

  // If Nepali → map to English
  if (DISTRICT_NP_TO_EN[raw]) {
    return DISTRICT_NP_TO_EN[raw];
  }

  return raw;
}


function normalizeVotes(rows) {
  const votes = {};

  for (const row of rows) {
    const district = normalizeDistrictNameServer(row?.DistrictName);
    const scConstId = cleanText(row?.SCConstID); // "1", "2", ...
    const partyKey = partyKeyFromECN(row?.PoliticalPartyName);
    const total = Number(row?.TotalVoteReceived ?? 0) || 0;

    if (!district || !scConstId || !partyKey) continue;

    const key = `${district}-${scConstId}|${partyKey}`;
    votes[key] = total;
  }

  return votes;
}


function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

let lastHash = "";
function hashVotes(votes) {
  const keys = Object.keys(votes).sort();
  let s = "";
  for (const k of keys) s += k + ":" + votes[k] + ";";
  return s;
}


async function pollOnce() {
  if (!ECN_API_URL) return;

  const r = await fetch(ECN_API_URL, {
  headers: {
    // Match what your browser XHR sends (important for 406)
    "accept": "application/json, text/javascript, */*; q=0.01",
    "accept-language": "en-US,en;q=0.9,ne;q=0.8",
    "x-requested-with": "XMLHttpRequest",
    "referer": process.env.ECN_REFERER || "https://result.election.gov.np/",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ...(process.env.ECN_COOKIE ? { "cookie": process.env.ECN_COOKIE } : {}),
  },
});


  if (!r.ok) {
    console.error("ECN fetch failed:", r.status);
    return;
  }

  const rows = await r.json();

  const normalizedVotes = normalizeVotes(rows);

  console.log(
    "Sample keys:",
    Object.keys(normalizedVotes).slice(0, 5)
  );

  const h = hashVotes(normalizedVotes);
    if (h !== lastHash) {
    lastHash = h;
    cache = { fetchedAt: new Date().toISOString(), votes: normalizedVotes };
    broadcast(cache);
    } else {
    cache.fetchedAt = new Date().toISOString();
    }


}

setInterval(() => {
  pollOnce().catch(console.error);
}, 10_000);

// snapshot
app.get("/api/votes/snapshot", (req, res) => {
  res.json(cache);
});

// SSE
app.get("/api/votes/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  res.write(`data: ${JSON.stringify(cache)}\n\n`);
  clients.add(res);

  req.on("close", () => clients.delete(res));
});

app.listen(5175, () => {
  console.log("Votes server running at http://localhost:5175");
});
