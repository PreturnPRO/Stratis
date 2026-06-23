import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COLORS } from '../tokens/colors'
import { useAuth } from '../context/AuthContext'
import {
  PM_SECTIONS,
  type DocumentPatchDTO,
  type DocumentPatchOutput,
  type PmDocumentState,
  type PmDocumentVersion,
} from '../../shared/types'
import { API_BASE } from '../lib/api'

type Decision = 'pending' | 'approved' | 'rejected'

interface PatchReview {
  patch: DocumentPatchDTO
  decision: Decision
  content: string
  editing: boolean
}

interface Props {
  sessionId?: string
  projectId?: string
  onNav?: (id: string, params?: Record<string, string>) => void
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH:   COLORS.red,
  MEDIUM: COLORS.amber,
  LOW:    COLORS.textMuted,
}

export default function DocumentView({ sessionId, projectId, onNav }: Props) {
  const { token, user } = useAuth()
  const isFacilitator = user?.role === 'facilitator' || user?.role === 'admin'

  const onNavRef = useRef(onNav)
  useEffect(() => { onNavRef.current = onNav }, [onNav])

  const authHeaders = useMemo(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  )

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [busy, setBusy]       = useState(false)

  const [docState, setDocState]   = useState<PmDocumentState | null>(null)
  const [version, setVersion]     = useState(0)
  const [versions, setVersions]   = useState<PmDocumentVersion[]>([])
  const [proposed, setProposed]   = useState<DocumentPatchOutput | null>(null)
  const [reviews, setReviews]     = useState<PatchReview[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(projectId ?? null)

  const [picker, setPicker] = useState<{ id: string; name: string; meetingCount: number }[]>([])
  const browsable = !sessionId && !projectId

  const [showEditDoc, setShowEditDoc]         = useState(false)
  const [editSectionKey, setEditSectionKey]   = useState<string | null>(null)
  const [editContent, setEditContent]         = useState('')
  const [savingDoc, setSavingDoc]             = useState(false)
  const [showRemoveDoc, setShowRemoveDoc]     = useState(false)
  const [removingDoc, setRemovingDoc]         = useState(false)

  // ─── loadProject ───────────────────────────────────────────────────────────

  const loadProject = useCallback(
    async (pid: string) => {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch(`${API_BASE}/api/document/${pid}`, { headers: authHeaders })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setError(data.error ?? 'No document yet for this project')
          setDocState(null)
          setActiveProjectId(pid)
          onNavRef.current?.('document', { projectId: pid })
          return
        }
        setDocState(data.data.document.state)
        setVersion(data.data.document.version)
        setVersions(data.data.versions ?? [])
        setActiveProjectId(pid)
        onNavRef.current?.('document', { projectId: pid })
      } catch {
        setError('Could not reach the server')
      } finally {
        setLoading(false)
      }
    },
    [authHeaders],
  )

  // ─── generate (post-meeting patches) ───────────────────────────────────────

  const generate = useCallback(
    async (sid: string) => {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch(`${API_BASE}/api/document/session/${sid}/generate`, {
          method: 'POST',
          headers: authHeaders,
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setError(data.error ?? 'Could not generate document update')
          return
        }
        setDocState({ sections: data.data.document.sections })
        setVersion(data.data.document.version ?? 0)
        const out: DocumentPatchOutput = data.data.proposed
        setProposed(out)
        setReviews(
          out.patches.map((p) => ({
            patch: p, decision: 'pending', content: p.new_content, editing: false,
          })),
        )
      } catch {
        setError('Could not reach the server')
      } finally {
        setLoading(false)
      }
    },
    [authHeaders],
  )

  // ─── loadPicker ────────────────────────────────────────────────────────────

  const loadPicker = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`${API_BASE}/api/meeting/projects`, { headers: authHeaders })
      const data = await res.json()
      setPicker(res.ok && data.ok ? (data.data?.projects ?? []) : [])
    } catch {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    if (sessionId)      void generate(sessionId)
    else if (projectId) void loadProject(projectId)
    else                void loadPicker()
  }, [sessionId, projectId, generate, loadProject, loadPicker])

  // ─── patch review helpers ──────────────────────────────────────────────────

  const setDecision = (id: string, decision: Decision) =>
    setReviews((rs) => rs.map((r) => (r.patch.client_patch_id === id ? { ...r, decision } : r)))

  const toggleEdit = (id: string) =>
    setReviews((rs) =>
      rs.map((r) => (r.patch.client_patch_id === id ? { ...r, editing: !r.editing } : r)),
    )

  const setContent = (id: string, content: string) =>
    setReviews((rs) => rs.map((r) => (r.patch.client_patch_id === id ? { ...r, content } : r)))

  const approvedCount = reviews.filter((r) => r.decision === 'approved').length

  const commit = async () => {
    if (!sessionId || approvedCount === 0) return
    setBusy(true)
    setError(null)
    try {
      const patches = reviews
        .filter((r) => r.decision === 'approved')
        .map((r) => ({ ...r.patch, new_content: r.content }))
      const res  = await fetch(`${API_BASE}/api/document/session/${sessionId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          patches,
          overall_change_summary: proposed?.overall_change_summary ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.error ?? 'Could not commit the document'); return }
      setDocState(data.data.document.state)
      setVersion(data.data.document.version)
      setVersions(data.data.versions ?? [])
      const remaining = reviews.filter((r) => r.decision !== 'approved')
      setReviews(remaining)
      if (remaining.length === 0) setProposed(null)
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  // ─── edit section ──────────────────────────────────────────────────────────

  const openEditSection = (key: string, currentContent: string) => {
    setEditSectionKey(key)
    setEditContent(currentContent)
    setShowEditDoc(true)
  }

  const handleSaveSection = async () => {
    if (!editSectionKey || !activeProjectId) return
    setSavingDoc(true)
    setError(null)
    try {
      const res  = await fetch(`${API_BASE}/api/document/${activeProjectId}/section`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ sectionKey: editSectionKey, content: editContent }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.error ?? 'Could not save section'); return }
      if (data.data?.document?.state) setDocState(data.data.document.state)
      setShowEditDoc(false)
      setEditSectionKey(null)
    } catch {
      setError('Could not reach the server')
    } finally {
      setSavingDoc(false)
    }
  }

  // ─── remove document ───────────────────────────────────────────────────────

  const handleRemoveDocument = async () => {
    if (!activeProjectId) return
    setRemovingDoc(true)
    setError(null)
    try {
      const res  = await fetch(`${API_BASE}/api/document/${activeProjectId}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.error ?? 'Could not delete document'); return }
      setShowRemoveDoc(false)
      setDocState(null)
      setVersions([])
      setActiveProjectId(null)
      void loadPicker()
    } catch {
      setError('Could not reach the server')
    } finally {
      setRemovingDoc(false)
    }
  }

  if (loading) return <div style={styles.page}><p style={styles.dim}>Loading document…</p></div>

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          {!sessionId && (docState || error) && (
            <button
              style={styles.backBtn}
              onClick={() => {
                if (browsable) {
                  setDocState(null)
                  setVersions([])
                  setError(null)
                  setActiveProjectId(null)
                  void loadPicker()
                } else {
                  onNavRef.current?.('projects')
                }
              }}
            >
              ← All projects
            </button>
          )}
          <h1 style={styles.title}>PM Document</h1>
          <p style={styles.subtitle}>
            Source of truth · version {version}
            {proposed ? ` · reviewing changes for v${version + 1}` : ''}
          </p>
        </div>

        {isFacilitator && docState && (
          <button style={styles.ghostBtn} onClick={() => setShowRemoveDoc(true)}>
            Remove document
          </button>
        )}
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.columns}>
        {/* ─── Document sections / picker ─────────────────────────────────── */}
        <div style={styles.docCol}>
          {docState
            ? PM_SECTIONS.map((s) => {
                const sec = docState.sections[s.key]
                return (
                  <section key={s.key} style={styles.section}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <h2 style={styles.sectionTitle}>{sec?.title ?? s.title}</h2>
                      {isFacilitator && (
                        <button
                          style={styles.editSectionBtn}
                          onClick={() => openEditSection(s.key, sec?.content ?? '')}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <p style={styles.sectionBody}>
                      {sec?.content?.trim() || <span style={styles.dim}>(empty)</span>}
                    </p>
                  </section>
                )
              })
            : browsable
              ? (
                  <div style={styles.pickerList}>
                    <p style={styles.dim}>Select a project to view its PM document.</p>
                    {picker.length === 0 && !error && (
                      <p style={styles.dim}>No projects yet.</p>
                    )}
                    {picker.map((p) => (
                      <button key={p.id} style={styles.pickerRow} onClick={() => void loadProject(p.id)}>
                        <span style={styles.pickerName}>{p.name}</span>
                        <span style={styles.dim}>
                          {p.meetingCount} meeting{p.meetingCount === 1 ? '' : 's'}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              : !error && (
                  <p style={styles.dim}>
                    Open a meeting summary or a project to view its PM document.
                  </p>
                )}
        </div>

        {/* ─── Review panel / version history ─────────────────────────────── */}
        <div style={styles.sideCol}>
          {proposed && reviews.length > 0 && (
            <div style={styles.reviewPanel}>
              <div style={styles.panelHead}>Proposed changes ({reviews.length})</div>
              {proposed.overall_change_summary && (
                <p style={styles.changeSummary}>{proposed.overall_change_summary}</p>
              )}
              {reviews.map((r) => (
                <PatchCard
                  key={r.patch.client_patch_id}
                  review={r}
                  onApprove={() => setDecision(r.patch.client_patch_id, 'approved')}
                  onReject={() => setDecision(r.patch.client_patch_id, 'rejected')}
                  onToggleEdit={() => toggleEdit(r.patch.client_patch_id)}
                  onContent={(c) => setContent(r.patch.client_patch_id, c)}
                />
              ))}
              <button
                style={{ ...styles.commitBtn, opacity: approvedCount && !busy ? 1 : 0.5 }}
                disabled={!approvedCount || busy}
                onClick={() => void commit()}
              >
                {busy ? 'Committing…' : `Commit ${approvedCount} approved → v${version + 1}`}
              </button>
            </div>
          )}

          {proposed && reviews.length === 0 && (
            <div style={styles.reviewPanel}>
              <div style={styles.panelHead}>No changes proposed</div>
              <p style={styles.dim}>This meeting didn't change the project's state.</p>
            </div>
          )}

          {versions.length > 0 && (
            <div style={styles.historyPanel}>
              <div style={styles.panelHead}>Version history</div>
              {versions.map((v) => (
                <div key={v.id} style={styles.historyRow}>
                  <span style={styles.historyVersion}>v{v.version}</span>
                  <div style={{ flex: 1 }}>
                    <p style={styles.historySummary}>{v.changeSummary || '(no summary)'}</p>
                    <p style={styles.historyDate}>{formatDate(v.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Edit section modal ─────────────────────────────────────────────── */}
      {showEditDoc && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: COLORS.textPrimary, fontSize: 17, fontWeight: 500, margin: '0 0 14px' }}>
              Edit section
            </h2>
            <textarea
              style={textareaStyle}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button style={styles.ghostBtn} onClick={() => setShowEditDoc(false)} disabled={savingDoc}>
                Cancel
              </button>
              <button style={styles.commitBtn} onClick={() => void handleSaveSection()} disabled={savingDoc}>
                {savingDoc ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Remove document confirm ─────────────────────────────────────────── */}
      {showRemoveDoc && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, width: 360 }}>
            <h2 style={{ color: COLORS.textPrimary, fontSize: 17, fontWeight: 500, margin: '0 0 12px' }}>
              Remove document?
            </h2>
            <p style={{ color: COLORS.textMuted, fontSize: 13, margin: '0 0 22px', lineHeight: 1.6 }}>
              This will permanently delete the PM document and all its version history.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={styles.ghostBtn} onClick={() => setShowRemoveDoc(false)} disabled={removingDoc}>
                Cancel
              </button>
              <button
                style={{ ...styles.commitBtn, background: COLORS.red }}
                onClick={() => void handleRemoveDocument()}
                disabled={removingDoc}
              >
                {removingDoc ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PatchCard ─────────────────────────────────────────────────────────────────

function PatchCard({
  review, onApprove, onReject, onToggleEdit, onContent,
}: {
  review: PatchReview
  onApprove: () => void
  onReject: () => void
  onToggleEdit: () => void
  onContent: (c: string) => void
}) {
  const { patch, decision, content, editing } = review
  const priorityColor = PRIORITY_COLOR[patch.review_priority ?? 'LOW'] ?? COLORS.textMuted
  const border =
    decision === 'approved' ? COLORS.teal : decision === 'rejected' ? COLORS.red : COLORS.border

  return (
    <div style={{ ...styles.patchCard, borderColor: border }}>
      <div style={styles.patchHead}>
        <span style={styles.patchOp}>
          {patch.operation.replace(/_/g, ' ')} · {patch.section_title}
        </span>
        {patch.review_priority && (
          <span style={{ ...styles.patchPriority, color: priorityColor }}>
            {patch.review_priority}
          </span>
        )}
      </div>

      {editing ? (
        <textarea
          style={styles.patchEditor}
          value={content}
          onChange={(e) => onContent(e.target.value)}
        />
      ) : (
        <p style={styles.patchContent}>{content}</p>
      )}

      {patch.reason && <p style={styles.patchReason}>why: {patch.reason}</p>}

      <div style={styles.patchActions}>
        <button style={{ ...styles.smallBtn, color: COLORS.teal, borderColor: COLORS.teal }} onClick={onApprove}>
          {decision === 'approved' ? '✓ approved' : 'approve'}
        </button>
        <button style={styles.smallBtn} onClick={onToggleEdit}>
          {editing ? 'done' : 'edit'}
        </button>
        <button style={{ ...styles.smallBtn, color: COLORS.red, borderColor: COLORS.red }} onClick={onReject}>
          {decision === 'rejected' ? '✕ rejected' : 'reject'}
        </button>
      </div>
    </div>
  )
}

function formatDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
}

const modalStyle: React.CSSProperties = {
  width: 480, background: COLORS.surface,
  border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24,
}

const textareaStyle: React.CSSProperties = {
  width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.border}`,
  color: COLORS.textPrimary, borderRadius: 6, padding: '10px 12px',
  fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
}

const styles: Record<string, React.CSSProperties> = {
  page:      { padding: '40px 60px', overflowY: 'auto', flex: 1, color: COLORS.textPrimary },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title:     { fontSize: 22, fontWeight: 600, margin: 0, color: COLORS.textPrimary },
  subtitle:  { fontSize: 13, color: COLORS.textMuted, margin: '6px 0 0' },
  dim:       { color: COLORS.textMuted },
  backBtn: {
    background: 'transparent', border: 'none', color: COLORS.accent,
    cursor: 'pointer', fontSize: 12, padding: 0, marginBottom: 8,
  },
  ghostBtn: {
    padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6,
    border: `1px solid ${COLORS.border}`, background: 'transparent',
    color: COLORS.textMuted, cursor: 'pointer',
  },
  editSectionBtn: {
    padding: '3px 9px', fontSize: 11, fontWeight: 500, borderRadius: 5,
    border: `1px solid ${COLORS.border}`, background: 'transparent',
    color: COLORS.textMuted, cursor: 'pointer',
  },
  pickerList:  { display: 'flex', flexDirection: 'column', gap: 10 },
  pickerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
    borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
  },
  pickerName:  { fontSize: 14, fontWeight: 600, color: COLORS.textPrimary },
  errorBox: {
    background: COLORS.redBg, border: `1px solid ${COLORS.red}`, color: COLORS.textPrimary,
    borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 20,
  },
  columns:     { display: 'flex', gap: 28, alignItems: 'flex-start' },
  docCol:      { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 },
  sideCol:     { width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 },
  section: {
    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
    borderRadius: 10, padding: '16px 18px',
  },
  sectionTitle: { fontSize: 14, fontWeight: 600, margin: 0, color: COLORS.accent },
  sectionBody:  { fontSize: 13, lineHeight: 1.6, color: COLORS.textPrimary, margin: 0, whiteSpace: 'pre-wrap' },
  reviewPanel: {
    background: COLORS.surfaceMuted, border: `1px solid ${COLORS.border}`,
    borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
  },
  panelHead:     { fontSize: 13, fontWeight: 600, color: COLORS.textPrimary },
  changeSummary: { fontSize: 12, color: COLORS.textMuted, margin: 0, lineHeight: 1.5 },
  patchCard: {
    background: COLORS.surface, border: '1px solid', borderRadius: 8,
    padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  patchHead:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  patchOp:       { fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'capitalize' },
  patchPriority: { fontSize: 10, fontWeight: 700 },
  patchContent:  { fontSize: 12, lineHeight: 1.5, color: COLORS.textPrimary, margin: 0, whiteSpace: 'pre-wrap' },
  patchEditor: {
    width: '100%', minHeight: 80, background: COLORS.bg,
    border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary,
    borderRadius: 6, padding: 8, fontSize: 12, fontFamily: 'inherit',
    resize: 'vertical', outline: 'none',
  },
  patchReason:   { fontSize: 11, color: COLORS.textMuted, margin: 0, fontStyle: 'italic' },
  patchActions:  { display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 },
  smallBtn: {
    padding: '3px 9px', fontSize: 11, fontWeight: 500, borderRadius: 5,
    border: `1px solid ${COLORS.border}`, background: 'transparent',
    color: COLORS.textMuted, cursor: 'pointer',
  },
  commitBtn: {
    marginTop: 4, padding: '9px 12px', fontSize: 13, fontWeight: 600,
    borderRadius: 7, border: 'none', background: COLORS.accent,
    color: '#0a0a0a', cursor: 'pointer',
  },
  historyPanel: {
    background: COLORS.surfaceMuted, border: `1px solid ${COLORS.border}`,
    borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
  },
  historyRow:     { display: 'flex', gap: 10, alignItems: 'flex-start' },
  historyVersion: { fontSize: 12, fontWeight: 700, color: COLORS.accent, minWidth: 28 },
  historySummary: { fontSize: 12, color: COLORS.textPrimary, margin: 0, lineHeight: 1.4 },
  historyDate:    { fontSize: 10, color: COLORS.textDim, margin: '2px 0 0' },
}