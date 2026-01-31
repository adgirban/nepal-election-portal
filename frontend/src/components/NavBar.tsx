import { useEffect, useMemo, useState } from "react";

type ElectionInfo = {
  source: string;
  fetchedAt: string;
  electionDateAD: string; // YYYY-MM-DD
  registeredVoters: number;
  seatsTotal: number;
  seatsFPTP: number;
  seatsPR: number;
  notes?: Record<string, any>;
};

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function daysRemaining(targetISO: string) {
  const now = new Date();
  const target = new Date(targetISO + "T00:00:00");
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// Optional: convert AD -> BS if you install a converter library.
// This will NOT break your app if you don't install anything.
async function adToBsSafe(adISO: string): Promise<string | null> {
  try {
    // If you want BS conversion:
    // npm i nepali-date-converter
    // then this dynamic import will work.
    const mod: any = await import("nepali-date-converter");
    const NepaliDate = mod?.default || mod?.NepaliDate;
    if (!NepaliDate) return null;

    const d = new Date(adISO + "T00:00:00");
    const nd = new NepaliDate(d);
    // Common output: YYYY-MM-DD in BS
    // Different libs format differently; adjust if needed.
    return nd?.format?.("YYYY-MM-DD") ?? String(nd);
  } catch {
    return null;
  }
}

export default function NavBar({ info }: { info: ElectionInfo }) {
  const [bsDate, setBsDate] = useState<string | null>(null);

  useEffect(() => {
    // try convert; if library not installed, stays null (no crash)
    adToBsSafe(info.electionDateAD).then(setBsDate);
  }, [info.electionDateAD]);

  const remaining = useMemo(
    () => daysRemaining(info.electionDateAD),
    [info.electionDateAD]
  );

  const electionDateLabel = useMemo(() => {
    const d = new Date(info.electionDateAD + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [info.electionDateAD]);

  return (
    <div className="navbar">
      <div className="navbar__left">
        <div className="navbar__title">Nepal Election Portal 2026</div>
        <div className="navbar__meta">
          <span className="pill">
            Election Day: <b>{electionDateLabel}</b>
          </span>

          <span className="pill">
            Days remaining:{" "}
            <b>{Number.isFinite(remaining) ? remaining : "—"}</b>
          </span>

          <span className="pill">
            Registered voters: <b>{formatNumber(info.registeredVoters)}</b>
          </span>

          <span className="pill">
            Seats:{" "}
            <b>
              {info.seatsTotal} ({info.seatsFPTP} FPTP + {info.seatsPR} PR)
            </b>
          </span>

          <span className="pill pill--muted">
            BS: <b>{bsDate ?? "Install converter to show"}</b>
          </span>
        </div>
      </div>

      <div className="navbar__right">
        <a className="navbar__link" href={info.source} target="_blank" rel="noreferrer">
          Source
        </a>
        <span className="navbar__small">
          Updated {new Date(info.fetchedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
