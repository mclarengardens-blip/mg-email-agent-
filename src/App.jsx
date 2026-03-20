import { useState, useEffect, useRef } from "react";

const GOOGLE_GREEN = "#2D6A4F";
const CREAM = "#F8F5F0";

const DEMO_EMAILS = [
  {
    id: "e1",
    from: "Helena Ashworth <helena.ashworth@ashworthestates.co.uk>",
    subject: "Garden redesign quote — urgent timeline",
    time: "08:42",
    date: "Today",
    body: `Hi,\n\nI hope you're well. I'm reaching out regarding our property at Kensington Square — we're looking to have the rear garden completely redesigned before our summer entertaining season begins.\n\nWe'd like to include a formal lawn area, raised planting beds with seasonal colour, and a small water feature. Budget is not the primary concern; quality and timing are.\n\nCould you arrange a site visit this week or early next? We'd need the project completed by end of May at the latest.\n\nKind regards,\nHelena Ashworth`,
  },
  {
    id: "e2",
    from: "David Okafor <orders@oakfieldnurseries.co.uk>",
    subject: "Stock availability issue — Chelsea project order",
    time: "09:15",
    date: "Today",
    body: `Good morning,\n\nWe're writing to advise that the Prunus serrula specimens you ordered for the Chelsea Embankment project are currently out of stock. Our next shipment from the Dutch grower arrives 28 March.\n\nWe can offer Prunus maackii as an alternative — similar ornamental bark, stock available immediately.\n\nPlease advise how you'd like to proceed.\n\nBest,\nDavid Okafor\nOakfield Nurseries`,
  },
  {
    id: "e3",
    from: "James Rutherford <j.rutherford@rutherfordgroup.com>",
    subject: "Spring maintenance schedule — Mayfair residence",
    time: "10:03",
    date: "Today",
    body: `Hello,\n\nJust a note to confirm whether our spring maintenance visits are still scheduled as discussed last autumn. I believe we agreed on fortnightly visits from April through June.\n\nAlso, could you arrange for the rose beds to be pruned before the first visit? They've become rather overgrown over winter.\n\nMany thanks,\nJames`,
  },
  {
    id: "e4",
    from: "Accounts <accounts@bartletttools.co.uk>",
    subject: "Invoice #BT-2094 — payment reminder",
    time: "11:30",
    date: "Today",
    body: `Dear Sir/Madam,\n\nThis is a reminder that invoice #BT-2094 for £1,840.00 (dated 14 February) is now 30 days overdue.\n\nPlease arrange payment at your earliest convenience to avoid a late payment charge.\n\nKind regards,\nAccounts Team\nBartlett Tools & Equipment`,
  },
  {
    id: "e5",
    from: "Mailchimp <noreply@mailchimp.com>",
    subject: "Your March campaign stats are ready",
    time: "07:00",
    date: "Today",
    body: `Hi there,\n\nYour March email campaign has finished sending.\nOpen rate: 24.3%\nClick rate: 3.1%\n\nView your full report in Mailchimp.\n\nThe Mailchimp Team`,
  },
  {
    id: "e6",
    from: "LinkedIn <notifications@linkedin.com>",
    subject: "You have 5 new connection requests",
    time: "06:15",
    date: "Today",
    body: `Hi,\n\nYou have 5 new connection requests waiting for you on LinkedIn.\n\nThe LinkedIn Team`,
  },
];

const SYSTEM_PROMPT = `You are an intelligent email assistant for a premium gardening company based in London called "Premium Gardens London". The owner manages multiple teams and high-value clients.

Prioritise: client enquiries & quotes, scheduling & bookings, supplier orders & invoices.

Return a JSON object (raw JSON only, no markdown, no backticks) with:
{
  "relevant": true/false,
  "category": "client-enquiry" | "client-scheduling" | "supplier-order" | "supplier-invoice" | "other",
  "priority": "high" | "medium" | "low",
  "tags": array of up to 3 short strings,
  "summary": one sentence max 20 words describing what action is needed,
  "draft": a professional warm reply in first person. Sign off as "[Your name], Premium Gardens London". No subject line.
}`;

const PRIORITY_COLOR = {
  high: { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444" },
  medium: { bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
  low: { bg: "#F0FDF4", text: "#166534", dot: "#22C55E" },
};

const CATEGORY_LABEL = {
  "client-enquiry": "Client enquiry",
  "client-scheduling": "Scheduling",
  "supplier-order": "Supplier order",
  "supplier-invoice": "Invoice",
  other: "Other",
};

const TAG_VARIANT = {
  client: "green", supplier: "blue", urgent: "red",
  quote: "amber", invoice: "amber", scheduling: "blue",
  order: "blue", enquiry: "green",
};

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 14, height: 14,
        border: "2px solid #D1FAE5",
        borderTopColor: GOOGLE_GREEN,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function TagPill({ label, variant = "default" }) {
  const styles = {
    default: { bg: "#F3F4F6", text: "#374151" },
    green: { bg: "#D1FAE5", text: "#065F46" },
    amber: { bg: "#FEF3C7", text: "#92400E" },
    blue: { bg: "#DBEAFE", text: "#1E40AF" },
    red: { bg: "#FEE2E2", text: "#991B1B" },
  };
  const s = styles[variant] || styles.default;
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: "2px 8px",
      borderRadius: 99, background: s.bg, color: s.text, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export default function App() {
  const [processed, setProcessed] = useState({});
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [selected, setSelected] = useState(null);
  const [sent, setSent] = useState(new Set());
  const [drafts, setDrafts] = useState({});
  const [regenerating, setRegenerating] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [keyEntered, setKeyEntered] = useState(false);
  const scanRef = useRef(false);

  const relevantEmails = DEMO_EMAILS.filter(e => processed[e.id]?.relevant !== false);
  const actionNeeded = relevantEmails.filter(e => !sent.has(e.id) && processed[e.id]);

  async function analyseEmail(email) {
    const prompt = `Analyse this email:\n\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const text = data.content.map(b => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  }

  async function runScan() {
    if (scanRef.current) return;
    scanRef.current = true;
    setScanning(true);
    setScanProgress(0);
    setProcessed({});
    setSent(new Set());
    setDrafts({});
    setSelected(null);

    for (let i = 0; i < DEMO_EMAILS.length; i++) {
      const email = DEMO_EMAILS[i];
      try {
        const result = await analyseEmail(email);
        setProcessed(prev => ({ ...prev, [email.id]: result }));
        setDrafts(prev => ({ ...prev, [email.id]: result.draft }));
      } catch {
        setProcessed(prev => ({
          ...prev,
          [email.id]: {
            relevant: true, category: "other", priority: "low",
            tags: ["error"], summary: "Could not analyse — check manually.", draft: "",
          },
        }));
      }
      setScanProgress(Math.round(((i + 1) / DEMO_EMAILS.length) * 100));
    }

    setScanning(false);
    scanRef.current = false;
  }

  useEffect(() => {
    const first = DEMO_EMAILS.find(e => processed[e.id]?.relevant !== false);
    if (first && !selected) setSelected(first.id);
  }, [processed]);

  const selectedEmail = DEMO_EMAILS.find(e => e.id === selected);
  const selectedResult = selected ? processed[selected] : null;

  async function regenerateDraft(emailId) {
    setRegenerating(emailId);
    const email = DEMO_EMAILS.find(e => e.id === emailId);
    try {
      const result = await analyseEmail(email);
      setDrafts(prev => ({ ...prev, [emailId]: result.draft }));
    } catch {}
    setRegenerating(null);
  }

  function sendReply(id) {
    setSent(prev => new Set([...prev, id]));
    const nextUnsent = relevantEmails.find(e => e.id !== id && !sent.has(e.id) && processed[e.id]);
    if (nextUnsent) setSelected(nextUnsent.id);
  }

  if (!keyEntered) {
    return (
      <div style={{
        minHeight: "100vh", background: CREAM,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{
          background: "white", borderRadius: 12, padding: "40px 36px",
          width: 400, border: "1px solid #E5E7EB", textAlign: "center",
        }}>
          <div style={{
            width: 48, height: 48, background: GOOGLE_GREEN, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C7 2 4 4 4 7c0 4 6 11 6 11s6-7 6-11c0-3-3-5-6-5z" fill="white"/>
              <circle cx="10" cy="7" r="2" fill={GOOGLE_GREEN}/>
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#111827", marginBottom: 8 }}>
            Greenleaf Mail Agent
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
            Enter your Anthropic API key to get started
          </div>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", fontSize: 13,
              border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 12,
              fontFamily: "monospace",
            }}
          />
          <button
            onClick={() => { if (apiKey.startsWith("sk-ant-")) setKeyEntered(true); }}
            style={{
              width: "100%", background: GOOGLE_GREEN, color: "white",
              border: "none", borderRadius: 8, padding: "10px",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}
          >
            Continue
          </button>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 12 }}>
            Your key is never stored or shared
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: CREAM, minHeight: "100vh" }}>
      <style>{`
        * { box-sizing: border-box; }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        textarea:focus { outline: none; border-color: ${GOOGLE_GREEN} !important; }
        .email-row:hover { background: rgba(45,106,79,0.04) !important; }
        .email-row.active { background: white !important; border-left: 3px solid ${GOOGLE_GREEN} !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 2px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .fade-in { animation: fadeIn 0.3s ease forwards; }
        @keyframes shimmer { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        .shimmer { animation: shimmer 1.4s ease-in-out infinite; }
      `}</style>

      <div style={{
        background: "white", borderBottom: "1px solid #E5E7EB",
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, background: GOOGLE_GREEN, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C7 2 4 4 4 7c0 4 6 11 6 11s6-7 6-11c0-3-3-5-6-5z" fill="white"/>
              <circle cx="10" cy="7" r="2" fill={GOOGLE_GREEN}/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Greenleaf Mail Agent</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>Premium Gardens London</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "Scanned", value: DEMO_EMAILS.length },
              { label: "Need attention", value: actionNeeded.length },
              { label: "Replied", value: sent.size },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#111827", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            style={{
              background: scanning ? "#D1FAE5" : GOOGLE_GREEN,
              color: scanning ? GOOGLE_GREEN : "white",
              border: "none", borderRadius: 8, padding: "8px 18px",
              fontSize: 13, fontWeight: 500, cursor: scanning ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {scanning ? <><Spinner /> Scanning…</> : "Scan inbox"}
          </button>
        </div>
      </div>

      {scanning && (
        <div style={{ height: 2, background: "#E5E7EB" }}>
          <div style={{ height: "100%", background: GOOGLE_GREEN, width: `${scanProgress}%`, transition: "width 0.3s ease" }} />
        </div>
      )}

      <div style={{ display: "flex", height: "calc(100vh - 61px)" }}>
        <div style={{ width: 300, minWidth: 300, borderRight: "1px solid #E5E7EB", background: "white", overflowY: "auto" }}>
          <div style={{
            padding: "10px 16px", fontSize: 10, fontWeight: 600, color: "#9CA3AF",
            letterSpacing: "0.08em", textTransform: "uppercase",
            borderBottom: "1px solid #F3F4F6", background: "#FAFAF9",
          }}>
            Needs attention ({actionNeeded.length})
          </div>

          {DEMO_EMAILS.map(email => {
            const result = processed[email.id];
            if (result && !result.relevant) return null;
            const isSent = sent.has(email.id);
            const isActive = selected === email.id;
            const pc = result?.priority ? PRIORITY_COLOR[result.priority] : null;

            return (
              <div
                key={email.id}
                className={`email-row ${isActive ? "active" : ""}`}
                onClick={() => setSelected(email.id)}
                style={{
                  padding: "12px 16px", borderBottom: "1px solid #F3F4F6",
                  cursor: "pointer", opacity: isSent ? 0.45 : 1,
                  borderLeft: isActive ? `3px solid ${GOOGLE_GREEN}` : "3px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>
                    {email.from.split(" <")[0]}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isSent && <span style={{ fontSize: 10, color: GOOGLE_GREEN, fontWeight: 600 }}>✓ sent</span>}
                    {pc && !isSent && <span style={{ width: 7, height: 7, borderRadius: "50%", background: pc.dot, display: "inline-block" }} />}
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{email.time}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {email.subject}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {result ? (
                    <>
                      {result.category && (
                        <TagPill label={CATEGORY_LABEL[result.category] || result.category}
                          variant={result.category.startsWith("client") ? "green" : result.category.startsWith("supplier") ? "blue" : "default"} />
                      )}
                      {result.tags?.slice(0, 2).map(t => (
                        <TagPill key={t} label={t} variant={TAG_VARIANT[t] || "default"} />
                      ))}
                    </>
                  ) : (
                    <div className="shimmer" style={{ height: 16, width: 80, background: "#E5E7EB", borderRadius: 99 }} />
                  )}
                </div>
              </div>
            );
          })}

          {Object.keys(processed).some(id => !processed[id].relevant) && (
            <>
              <div style={{
                padding: "8px 16px", fontSize: 10, fontWeight: 600, color: "#9CA3AF",
                letterSpacing: "0.08em", textTransform: "uppercase",
                borderBottom: "1px solid #F3F4F6", background: "#FAFAF9", marginTop: 4,
              }}>
                Filtered out
              </div>
              {DEMO_EMAILS.filter(e => processed[e.id] && !processed[e.id].relevant).map(email => (
                <div key={email.id} className="email-row"
                  onClick={() => setSelected(email.id)}
                  style={{
                    padding: "10px 16px", borderBottom: "1px solid #F3F4F6",
                    cursor: "pointer", opacity: 0.4,
                    borderLeft: selected === email.id ? "3px solid #9CA3AF" : "3px solid transparent",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#6B7280" }}>{email.from.split(" <")[0]}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email.subject}</div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: CREAM }}>
          {!selected || !selectedEmail ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9CA3AF", gap: 12 }}>
              <div style={{ fontSize: 40, opacity: 0.25 }}>✉</div>
              <div style={{ fontSize: 14 }}>
                {Object.keys(processed).length === 0 ? "Click \"Scan inbox\" to begin" : "Select an email to review"}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", background: "white", borderBottom: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{selectedEmail.subject}</div>
                <div style={{ fontSize: 12, color: "#6B7280", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>From: <strong style={{ color: "#374151" }}>{selectedEmail.from}</strong></span>
                  <span>{selectedEmail.date} at {selectedEmail.time}</span>
                  {selectedResult?.priority && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 99,
                      background: PRIORITY_COLOR[selectedResult.priority].bg,
                      color: PRIORITY_COLOR[selectedResult.priority].text,
                    }}>
                      {selectedResult.priority.charAt(0).toUpperCase() + selectedResult.priority.slice(1)} priority
                    </span>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto", borderRight: "1px solid #E5E7EB" }}>
                  <pre style={{ fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.75, color: "#374151", whiteSpace: "pre-wrap", margin: 0 }}>
                    {selectedEmail.body}
                  </pre>
                </div>

                <div style={{ width: 380, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid #E5E7EB", background: "white" }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600, color: "#9CA3AF",
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
                    }}>
                      AI analysis
                      <span style={{ background: "#D1FAE5", color: GOOGLE_GREEN, fontSize: 9, padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>Claude</span>
                    </div>
                    {selectedResult ? (
                      <div className="fade-in">
                        <div style={{
                          fontSize: 13, color: "#374151", lineHeight: 1.6,
                          borderLeft: `3px solid ${GOOGLE_GREEN}`, paddingLeft: 10, marginBottom: 8,
                        }}>
                          {selectedResult.summary}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {selectedResult.tags?.map(t => <TagPill key={t} label={t} variant={TAG_VARIANT[t] || "default"} />)}
                        </div>
                      </div>
                    ) : (
                      <div className="shimmer" style={{ fontSize: 13, color: "#9CA3AF" }}>Analysing with Claude…</div>
                    )}
                  </div>

                  <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Draft response
                    </div>
                    {selectedResult ? (
                      selectedResult.relevant ? (
                        <>
                          <textarea
                            value={drafts[selected] || ""}
                            onChange={e => setDrafts(prev => ({ ...prev, [selected]: e.target.value }))}
                            disabled={sent.has(selected) || regenerating === selected}
                            style={{
                              flex: 1, minHeight: 220,
                              border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px",
                              fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.7,
                              color: "#374151", resize: "none",
                              background: sent.has(selected) ? "#F9FAFB" : "white",
                            }}
                          />
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {sent.has(selected) ? (
                              <span style={{ fontSize: 12, color: GOOGLE_GREEN, fontWeight: 600 }}>✓ Reply sent</span>
                            ) : (
                              <>
                                <button onClick={() => sendReply(selected)} style={{
                                  background: GOOGLE_GREEN, color: "white", border: "none",
                                  borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
                                }}>
                                  Send reply
                                </button>
                                <button onClick={() => regenerateDraft(selected)} disabled={regenerating === selected} style={{
                                  background: "white", color: "#374151", border: "1px solid #E5E7EB",
                                  borderRadius: 7, padding: "7px 14px", fontSize: 13, cursor: "pointer",
                                  display: "flex", alignItems: "center", gap: 6,
                                }}>
                                  {regenerating === selected ? <><Spinner /> Redrafting…</> : "Redraft"}
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic", padding: "12px 0" }}>
                          Auto-filtered — not relevant to your business.
                        </div>
                      )
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[100, 80, 90, 60].map((w, i) => (
                          <div key={i} className="shimmer" style={{ height: 14, width: `${w}%`, background: "#E5E7EB", borderRadius: 4 }} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
