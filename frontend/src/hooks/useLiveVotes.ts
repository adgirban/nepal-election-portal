import { useEffect, useState } from "react";

type VotesPayload = {
  fetchedAt: string;
  votes: Record<string, number>;
};

export function useLiveVotes() {
  const [data, setData] = useState<VotesPayload | null>(null);

  useEffect(() => {
    fetch("/api/votes/snapshot")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});

    const es = new EventSource("/api/votes/stream");
    es.onmessage = (ev) => {
      try {
        setData(JSON.parse(ev.data));
      } catch {}
    };

    return () => es.close();
  }, []);

  return data;
}
