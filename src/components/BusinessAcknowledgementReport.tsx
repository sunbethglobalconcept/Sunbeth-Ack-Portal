import React, { useCallback, useEffect, useMemo, useState } from "react";

interface AckRow {
  businessId?: string;
  businessName?: string;
  batchId?: string;
  batchName?: string;
  email?: string;
  displayName?: string;
  department?: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
}

interface BusinessGroup {
  businessId: string;
  businessName: string;
  total: number;
  acknowledged: number;
  pending: number;
  uniqueUsers: number;
  batches: number;
}

const getApiBases = () => {
  const envBase = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");
  const hinted = (typeof window !== "undefined" && ((window as any).__API_BASE__ || (window as any).API_BASE))
    ? String((window as any).__API_BASE__ || (window as any).API_BASE).replace(/\/$/, "")
    : "";
  const local = "http://127.0.0.1:4000";
  return Array.from(new Set([envBase, hinted, local].filter(Boolean)));
};

const tryFetchJson = async (path: string) => {
  const bases = getApiBases();
  let lastErr: any = null;
  for (const b of bases) {
    try {
      const r = await fetch(`${b}${path}`);
      if (r.ok) return await r.json();
    } catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  throw new Error("All API bases failed");
};

const normalizeRows = (res: any): AckRow[] => {
  const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
  return items.map((r: any) => ({
    businessId: r.businessId || r.business_id || r.toba_businessid || "",
    businessName: r.businessName || r.business || "",
    batchId: r.batchId || "",
    batchName: r.batchName || "",
    email: r.email || "",
    displayName: r.displayName || "",
    department: r.department || "",
    acknowledged: Boolean(r.acknowledged ?? (r.acknowledgedAt ? true : false)),
    acknowledgedAt: r.acknowledgedAt || "",
  }));
};

const aggregateByBusiness = (rows: AckRow[]): BusinessGroup[] => {
  const map = new Map<string, BusinessGroup>();
  for (const r of rows) {
    const id = r.businessId || "unknown";
    const name = (r.businessName || "").trim() || "Unknown Business";
    const existing = map.get(id) || { businessId: id, businessName: name, total: 0, acknowledged: 0, pending: 0, uniqueUsers: 0, batches: 0 };
    map.set(id, {
      ...existing,
      total: existing.total + 1,
      acknowledged: existing.acknowledged + (r.acknowledged ? 1 : 0),
      pending: existing.pending + (r.acknowledged ? 0 : 1),
    });
  }
  for (const [id, group] of map.entries()) {
    const users = new Set(rows.filter(r => (r.businessId || "unknown") === id).map(r => r.email || r.displayName || ""));
    const batches = new Set(rows.filter(r => (r.businessId || "unknown") === id).map(r => r.batchId || ""));
    map.set(id, { ...group, uniqueUsers: users.size, batches: batches.size });
  }
  return Array.from(map.values()).sort((a, b) => b.acknowledged - a.acknowledged);
};

const BusinessOptions: React.FC<{ options: Array<{ id: string; name: string }>; value: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
  <select id="business-filter" value={value} onChange={e => onChange(e.target.value)} className="form-control">
    <option value="all">All</option>
    {options.map(opt => (
      <option key={opt.id} value={opt.id}>{opt.name}</option>
    ))}
  </select>
);

const BusinessAckTable: React.FC<{ grouped: BusinessGroup[] }> = ({ grouped }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ backgroundColor: "#f8f9fa" }}>
          <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Business</th>
          <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Batches</th>
          <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Users</th>
          <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Acknowledged</th>
          <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Pending</th>
          <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Completion %</th>
        </tr>
      </thead>
      <tbody>
        {grouped.map(g => {
          const completionPct = g.total ? Math.round((g.acknowledged / g.total) * 100) : 0;
          return (
            <tr key={g.businessId} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: 10, fontWeight: 600 }}>{g.businessName}</td>
              <td style={{ padding: 10 }}>{g.batches}</td>
              <td style={{ padding: 10 }}>{g.uniqueUsers}</td>
              <td style={{ padding: 10 }}>{g.acknowledged}</td>
              <td style={{ padding: 10 }}>{g.pending}</td>
              <td style={{ padding: 10 }}>
                <span style={{ color: completionPct >= 90 ? "#28a745" : completionPct >= 75 ? "#ffc107" : "#dc3545", fontWeight: 600 }}>
                  {completionPct}%
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const useAckData = (businessFilter: string) => {
  const [rows, setRows] = useState<AckRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const q = businessFilter && businessFilter !== "all" ? `?businessId=${encodeURIComponent(businessFilter)}` : "";
      const res = await tryFetchJson(`/api/ack-report${q ? `${q}&` : "?"}limit=5000`);
      setRows(normalizeRows(res));
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessFilter]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, error, reload: load };
};

export default function BusinessAcknowledgementReport() {
  const [businessFilter, setBusinessFilter] = useState("all");
  const { rows, loading, error, reload } = useAckData(businessFilter);
  const grouped = useMemo(() => aggregateByBusiness(rows), [rows]);
  const businessOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const id = r.businessId || "unknown";
      const name = (r.businessName || "").trim() || "Unknown Business";
      if (!seen.has(id)) seen.set(id, name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Business Acknowledgement Report</h3>
          <div className="small muted">Grouped by business with completion and pending counts</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="business-filter" className="small">Business filter:</label>
          <BusinessOptions options={businessOptions} value={businessFilter} onChange={setBusinessFilter} />
          <button className="btn ghost sm" onClick={reload}>Refresh</button>
        </div>
      </div>

      {loading && <div className="small muted">Loading business acknowledgements...</div>}
      {error && <div style={{ color: "#dc3545" }}>{error}</div>}
      {!loading && !error && grouped.length === 0 && (
        <div className="small muted">No acknowledgement data found for this selection.</div>
      )}
      {!loading && !error && grouped.length > 0 && (
        <BusinessAckTable grouped={grouped} />
      )}
    </div>
  );
}
