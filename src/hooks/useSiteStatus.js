/* ─────────────────────────────────────────────────────────────
   src/hooks/useSiteStatus.js
   Hook che espone lo stato del sito (config/site) in tempo reale.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { subscribeSiteStatus } from "../utils/siteStatus";

export default function useSiteStatus() {
  const [state, setState] = useState({
    status: "operational",
    message: "",
    loading: true,
  });

  useEffect(() => {
    const unsub = subscribeSiteStatus((s) =>
      setState({ status: s.status, message: s.message, loading: false })
    );
    return () => unsub();
  }, []);

  return state;
}
