// Mock content Sprint 1. Wire to /api/document in Sprint 2.
import { useEffect, useState } from 'react'
import { COLORS } from '../constants'
import { btnGhost } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const MOCK_DOC = {
  project: 'Pricing v2',
  updatedAt: 'Jun 10, 2026',
  sections: [
    {
      title: 'Decisions',
      items: [
        { label: 'Pricing model restructure', status: 'OPEN', color: COLORS.orange },
        { label: 'Seat-based vs usage-based', status: 'VALIDATED', color: COLORS.teal },
      ],
    },
    {
      title: 'Assumptions',
      items: [
        { label: 'SMB accepts metered billing', status: 'UNVALIDATED', color: COLORS.red },
        { label: 'Engineering ships in 6 weeks', status: 'BLOCKED', color: COLORS.red },
      ],
    },
    {
      title: 'Open questions',
      items: [
        { label: 'Who owns the pricing decision?', status: 'OPEN', color: COLORS.orange },
        { label: 'What is the fallback if SMB rejects?', status: 'OPEN', color: COLORS.orange },
      ],
    },
  ],
}

export default function Documents() {
  const { token } = useAuth()
  const [apiStatus, setApiStatus] = useState<string | null>(null)

  useEffect(() => {
    // Probe document endpoint — wire real data here in Sprint 2
    fetch('http://localhost:3001/api/summary', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => setApiStatus(d.data?.note ?? null))
      .catch(() => setApiStatus(null))
  }, [token])

  return (
    <div style={{ padding: '40px 60px', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 500, margin: 0 }}>
          {MOCK_DOC.project}
        </h1>
        <button style={{ ...btnGhost(), fontSize: 12 }}>Export</button>
      </div>
      <div style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 32 }}>
        Last updated {MOCK_DOC.updatedAt}
        {apiStatus && (
          <span style={{ marginLeft: 16, color: COLORS.textDim, fontStyle: 'italic' }}>
            · API: {apiStatus}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {MOCK_DOC.sections.map(section => (
          <div key={section.title}>
            <div style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1, marginBottom: 12 }}>
              {section.title.toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {section.items.map(item => (
                <div key={item.label} style={{
                  background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                  borderRadius: 8, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ color: COLORS.text, fontSize: 14 }}>{item.label}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: `${item.color}22`, color: item.color,
                  }}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}