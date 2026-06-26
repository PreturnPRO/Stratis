import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, RADIUS } from '../tokens/colors'
import { useAuth } from '../context/AuthContext'
import { Button, Modal } from '../components/ui'
import { Markdown } from '../components/Markdown'
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
  HIGH: COLORS.red,
  MEDIUM: COLORS.amber,
  LOW: COLORS.textMuted,
}

function humanizeProjectId(id?: string | null): string {
  if (!id) return 'PM Document'
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [docState, setDocState] = useState<PmDocumentState | null>(null)
  const [version, setVersion] = useState(0)
  const [versions, setVersions] = useState<PmDocumentVersion[]>([])
  const [proposed, setProposed] = useState<DocumentPatchOutput | null>(null)
  const [reviews, setReviews] = useState<PatchReview[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(projectId ?? null)

  const [picker, setPicker] = useState<{ id: string; name: string; meetingCount: number }[]>([])
  const browsable = !sessionId && !projectId

  const [editSectionKey, setEditSectionKey] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [savingDoc, setSavingDoc] = useState(false)
  const [showRemoveDoc, setShowRemoveDoc] = useState(false)
  const [removingDoc, setRemovingDoc] = useState(false)

  // ─── loaders ────────────────────────────────────────────────────────────────

  const loadProject = useCallback(
    async (pid: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/document/${pid}`, { headers: authHeaders })
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

  const generate = useCallback(
    async (sid: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/document/session/${sid}/generate`, {
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
        // FIX: anchor the project so Remove / Edit / per-section actions work.
        setActiveProjectId(data.data.projectId ?? null)
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

  const loadPicker = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/meeting/projects`, { headers: authHeaders })
      const data = await res.json()
      setPicker(res.ok && data.ok ? (data.data?.projects ?? []) : [])
    } catch {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    if (sessionId) void generate(sessionId)
    else if (projectId) void loadProject(projectId)
    else void loadPicker()
  }, [sessionId, projectId, generate, loadProject, loadPicker])

  // ─── review helpers ───────────────────────────────────────────────────────

  const setDecision = (id: string, decision: Decision) =>
    setReviews((rs) => rs.map((r) => (r.patch.client_patch_id === id ? { ...r, decision } : r)))

  const toggleEdit = (id: string) =>
    setReviews((rs) => rs.map((r) => (r.patch.client_patch_id === id ? { ...r, editing: !r.editing } : r)))

  const setContent = (id: string, content: string) =>
    setReviews((rs) => rs.map((r) => (r.patch.client_patch_id === id ? { ...r, content } : r)))

  const approveAll = () =>
    setReviews((rs) => rs.map((r) => ({ ...r, decision: 'approved' as const })))

  const approvedCount = reviews.filter((r) => r.decision === 'approved').length

  const reviewsBySection = useMemo(() => {
    const map: Record<string, PatchReview[]> = {}
    for (const r of reviews) {
      (map[r.patch.section_key] ??= []).push(r)
    }
    return map
  }, [reviews])

  const commit = async () => {
    if (!sessionId || approvedCount === 0) return
    setBusy(true)
    setError(null)
    try {
      const patches = reviews
        .filter((r) => r.decision === 'approved')
        .map((r) => ({ ...r.patch, new_content: r.content }))
      const res = await fetch(`${API_BASE}/api/document/session/${sessionId}/commit`, {
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

  // ─── manual section edit ────────────────────────────────────────────────────

  const openEditSection = (key: string, currentContent: string) => {
    setEditSectionKey(key)
    setEditContent(currentContent)
  }

  const handleSaveSection = async () => {
    if (!editSectionKey || !activeProjectId) return
    setSavingDoc(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/document/${activeProjectId}/section`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ sectionKey: editSectionKey, content: editContent }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.error ?? 'Could not save section'); return }
      if (data.data?.document?.state) setDocState(data.data.document.state)
      setEditSectionKey(null)
    } catch {
      setError('Could not reach the server')
    } finally {
      setSavingDoc(false)
    }
  }

  // ─── remove document ──────────────────────────────────────────────────────

  const handleRemoveDocument = async () => {
    if (!activeProjectId) return
    setRemovingDoc(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/document/${activeProjectId}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.error ?? 'Could not delete document'); return }
      setShowRemoveDoc(false)
      setDocState(null)
      setVersions([])
      setProposed(null)
      setReviews([])
      setActiveProjectId(null)
      if (sessionId) onNavRef.current?.('dashboard')
      else onNavRef.current?.('projects')
    } catch {
      setError('Could not reach the server')
    } finally {
      setRemovingDoc(false)
    }
  }

  const [restoring, setRestoring] = useState<number | null>(null)

  const handleRestore = async (targetVersion: number) => {
    if (!activeProjectId || restoring !== null) return
    setRestoring(targetVersion)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/document/${activeProjectId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ version: targetVersion }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.error ?? 'Could not restore version'); return }
      setDocState(data.data.document.state)
      setVersion(data.data.document.version)
      setVersions(data.data.versions ?? [])
    } catch {
      setError('Could not reach the server')
    } finally {
      setRestoring(null)
    }
  }

  const scrollToSection = (key: string) => {
    document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ─── render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.dim}>Loading document…</p>
      </div>
    )
  }

  // Project picker (no session, no project selected).
  if (browsable && !docState) {
    return (
      <div style={styles.page}>
        <h1 style={styles.bigTitle}>PM Documents</h1>
        <p style={{ ...styles.dim, margin: '6px 0 24px' }}>Select a project to view its living document.</p>
        {error && <div style={styles.errorBox}>{error}</div>}
        <div style={styles.pickerList}>
          {picker.length === 0 && !error && <p style={styles.dim}>No projects yet.</p>}
          {picker.map((p) => (
            <button key={p.id} style={styles.pickerRow} onClick={() => void loadProject(p.id)}>
              <span style={styles.pickerName}>{p.name}</span>
              <span style={styles.dim}>{p.meetingCount} meeting{p.meetingCount === 1 ? '' : 's'}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const title = humanizeProjectId(activeProjectId ?? proposed?.project_id)
  const proposedCount = reviews.length

  return (
    <div style={styles.shell}>
      {/* ── Left ToC sidebar ─────────────────────────────────────────────── */}
      <nav style={styles.toc}>
        {!sessionId && (docState || error) && (
          <button
            style={styles.backBtn}
            onClick={() => {
              if (browsable) {
                setDocState(null); setVersions([]); setError(null); setActiveProjectId(null); void loadPicker()
              } else {
                onNavRef.current?.('projects')
              }
            }}
          >
            ← All projects
          </button>
        )}

        <div style={styles.tocLabel}>On this page</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {PM_SECTIONS.map((s) => {
            const hasProposed = (reviewsBySection[s.key]?.length ?? 0) > 0
            return (
              <button key={s.key} style={styles.tocLink} onClick={() => scrollToSection(s.key)}>
                <span style={{ flex: 1, textAlign: 'left' }}>{s.title}</span>
                {hasProposed && <span style={styles.tocDot} title="Proposed change" />}
              </button>
            )
          })}
        </div>

        {versions.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={styles.tocLabel}>History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {versions.slice(0, 6).map((v) => (
                <div key={v.id} style={styles.historyRow}>
                  <span style={styles.historyVersion}>v{v.version}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.historySummary}>{v.changeSummary || '(no summary)'}</div>
                    <div style={styles.historyDate}>{formatDate(v.createdAt)}</div>
                    {isFacilitator && v.version !== version && (
                      <button
                        style={styles.restoreLink}
                        disabled={restoring !== null}
                        onClick={() => void handleRestore(v.version)}
                      >
                        {restoring === v.version ? 'Restoring…' : 'Restore this version'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── Article ──────────────────────────────────────────────────────── */}
      <div style={styles.articleScroll}>
        <article style={styles.article}>
          <header style={styles.articleHeader}>
            <div style={{ minWidth: 0 }}>
              <div style={styles.kicker}>PM DOCUMENT · SOURCE OF TRUTH</div>
              <h1 style={styles.bigTitle}>{title}</h1>
              <p style={styles.subtitle}>
                Version {version}
                {proposed ? ` · reviewing ${proposedCount} change${proposedCount === 1 ? '' : 's'} for v${version + 1}` : ''}
              </p>
            </div>
            {isFacilitator && docState && (
              <Button variant="danger" size="sm" onClick={() => setShowRemoveDoc(true)}>
                Remove document
              </Button>
            )}
          </header>

          {error && <div style={styles.errorBox}>{error}</div>}

          {/* Slim review banner */}
          {proposed && proposedCount > 0 && (
            <div style={styles.reviewBanner}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.reviewBannerTitle}>
                  Stratis proposed {proposedCount} change{proposedCount === 1 ? '' : 's'} from this meeting
                </div>
                {proposed.overall_change_summary && (
                  <div style={styles.reviewBannerSummary}>{proposed.overall_change_summary}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Button variant="ghost" size="sm" onClick={approveAll}>Approve all</Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!approvedCount || busy}
                  onClick={() => void commit()}
                >
                  {busy ? 'Committing…' : `Commit ${approvedCount} → v${version + 1}`}
                </Button>
              </div>
            </div>
          )}

          {proposed && proposedCount === 0 && (
            <div style={styles.noChanges}>This meeting didn't change the project's state.</div>
          )}

          {/* Sections */}
          {docState && PM_SECTIONS.map((s) => {
            const sec = docState.sections[s.key]
            const secReviews = reviewsBySection[s.key] ?? []
            return (
              <section key={s.key} id={`sec-${s.key}`} style={styles.section}>
                <div style={styles.sectionHead}>
                  <h2 style={styles.sectionTitle}>{sec?.title ?? s.title}</h2>
                  {isFacilitator && !secReviews.length && (
                    <button style={styles.editLink} onClick={() => openEditSection(s.key, sec?.content ?? '')}>
                      Edit
                    </button>
                  )}
                </div>

                {/* Current content */}
                {(sec?.content?.trim() || !secReviews.length) && (
                  <Markdown>{sec?.content ?? ''}</Markdown>
                )}

                {/* Proposed changes for this section */}
                {secReviews.map((r) => (
                  <ProposedChange
                    key={r.patch.client_patch_id}
                    review={r}
                    onApprove={() => setDecision(r.patch.client_patch_id, 'approved')}
                    onReject={() => setDecision(r.patch.client_patch_id, 'rejected')}
                    onToggleEdit={() => toggleEdit(r.patch.client_patch_id)}
                    onContent={(c) => setContent(r.patch.client_patch_id, c)}
                  />
                ))}
              </section>
            )
          })}
        </article>
      </div>

      {/* ── Edit section modal ───────────────────────────────────────────── */}
      {editSectionKey && (
        <Modal
          title="Edit section"
          width={560}
          onClose={() => !savingDoc && setEditSectionKey(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditSectionKey(null)} disabled={savingDoc}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleSaveSection()} disabled={savingDoc}>
                {savingDoc ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <p style={{ ...styles.dim, fontSize: 12, margin: '0 0 8px' }}>Markdown supported (#, **bold**, - lists).</p>
          <textarea
            style={styles.textarea}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={10}
          />
        </Modal>
      )}

      {/* ── Remove document confirm ──────────────────────────────────────── */}
      {showRemoveDoc && (
        <Modal
          title="Remove document?"
          width={380}
          onClose={() => !removingDoc && setShowRemoveDoc(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowRemoveDoc(false)} disabled={removingDoc}>Cancel</Button>
              <Button variant="danger" onClick={() => void handleRemoveDocument()} disabled={removingDoc}>
                {removingDoc ? 'Removing…' : 'Remove'}
              </Button>
            </>
          }
        >
          <p style={{ color: COLORS.textMuted, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            This permanently deletes the PM document and its entire version history. This can't be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}

// ─── ProposedChange (inline review) ──────────────────────────────────────────

function ProposedChange({
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
  const accent =
    decision === 'approved' ? COLORS.teal : decision === 'rejected' ? COLORS.red : COLORS.amber

  return (
    <div style={{ ...styles.proposed, borderColor: `${accent}66`, opacity: decision === 'rejected' ? 0.6 : 1 }}>
      <div style={styles.proposedHead}>
        <span style={{ ...styles.proposedTag, color: accent, background: `${accent}1f` }}>
          {decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Proposed change'}
          {' · '}
          {patch.operation.replace(/_/g, ' ')}
        </span>
        {patch.review_priority && (
          <span style={{ ...styles.proposedPriority, color: priorityColor }}>{patch.review_priority}</span>
        )}
      </div>

      {editing ? (
        <textarea style={styles.proposedEditor} value={content} onChange={(e) => onContent(e.target.value)} />
      ) : (
        <Markdown>{content}</Markdown>
      )}

      {patch.reason && <p style={styles.proposedReason}>Why: {patch.reason}</p>}

      <div style={styles.proposedActions}>
        <button
          style={{ ...styles.reviewBtn, color: COLORS.teal, borderColor: `${COLORS.teal}66` }}
          onClick={onApprove}
        >
          {decision === 'approved' ? '✓ Approved' : 'Approve'}
        </button>
        <button style={styles.reviewBtn} onClick={onToggleEdit}>{editing ? 'Done' : 'Edit'}</button>
        <button
          style={{ ...styles.reviewBtn, color: COLORS.red, borderColor: `${COLORS.red}66` }}
          onClick={onReject}
        >
          {decision === 'rejected' ? '✕ Rejected' : 'Reject'}
        </button>
      </div>
    </div>
  )
}

function formatDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '40px 60px', overflowY: 'auto', flex: 1, color: COLORS.textPrimary },
  // height:100% is load-bearing — the parent in App.tsx is a plain block, so
  // flex:1 alone leaves the shell unbounded and articleScroll never scrolls.
  shell: { display: 'flex', flex: 1, height: '100%', minHeight: 0, background: COLORS.bg },

  // ToC
  toc: {
    width: 248,
    flexShrink: 0,
    borderRight: `1px solid ${COLORS.border}`,
    padding: '40px 20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  tocLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORS.textDim,
    textTransform: 'uppercase', marginBottom: 12,
  },
  tocLink: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'transparent', border: 'none', borderRadius: RADIUS.sm,
    padding: '7px 10px', fontSize: 13, color: COLORS.textMuted, cursor: 'pointer',
  },
  tocDot: { width: 6, height: 6, borderRadius: '50%', background: COLORS.amber, flexShrink: 0 },
  backBtn: {
    background: 'transparent', border: 'none', color: COLORS.accent,
    cursor: 'pointer', fontSize: 12, padding: 0, marginBottom: 22, textAlign: 'left',
  },

  // Article
  articleScroll: { flex: 1, overflowY: 'auto', minWidth: 0 },
  article: { maxWidth: 760, margin: '0 auto', padding: '48px 40px 80px' },
  articleHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 16, marginBottom: 28,
  },
  kicker: { fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: COLORS.accent, marginBottom: 10 },
  bigTitle: { fontSize: 32, fontWeight: 700, margin: 0, color: COLORS.textPrimary, lineHeight: 1.15, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textMuted, margin: '10px 0 0' },
  dim: { color: COLORS.textMuted },

  errorBox: {
    background: COLORS.redBg, border: `1px solid ${COLORS.red}`, color: COLORS.textPrimary,
    borderRadius: RADIUS.md, padding: '10px 14px', fontSize: 13, marginBottom: 20,
  },

  reviewBanner: {
    display: 'flex', alignItems: 'center', gap: 16,
    background: COLORS.amberSubtle, border: `1px solid ${COLORS.amber}55`,
    borderRadius: RADIUS.lg, padding: '14px 16px', marginBottom: 32,
  },
  reviewBannerTitle: { fontSize: 13, fontWeight: 600, color: COLORS.amber },
  reviewBannerSummary: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.5 },
  noChanges: {
    background: COLORS.surfaceMuted, border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md, padding: '12px 16px', marginBottom: 32,
    fontSize: 13, color: COLORS.textMuted,
  },

  section: { marginBottom: 40, scrollMarginTop: 24 },
  sectionHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}`,
  },
  sectionTitle: { fontSize: 20, fontWeight: 700, margin: 0, color: COLORS.textPrimary, letterSpacing: -0.2 },
  editLink: {
    background: 'transparent', border: 'none', color: COLORS.textMuted,
    fontSize: 12, cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
  },

  // Proposed change card
  proposed: {
    background: COLORS.surface, border: '1px solid', borderRadius: RADIUS.md,
    padding: '14px 16px', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8,
  },
  proposedHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  proposedTag: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
    padding: '3px 9px', borderRadius: RADIUS.pill,
  },
  proposedPriority: { fontSize: 10, fontWeight: 700 },
  proposedReason: { fontSize: 12, color: COLORS.textMuted, margin: 0, fontStyle: 'italic' },
  proposedEditor: {
    width: '100%', minHeight: 120, background: COLORS.bg,
    border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary,
    borderRadius: RADIUS.sm, padding: 10, fontSize: 13, fontFamily: 'inherit',
    resize: 'vertical', outline: 'none', lineHeight: 1.6,
  },
  proposedActions: { display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 },
  reviewBtn: {
    padding: '4px 11px', fontSize: 11, fontWeight: 600, borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.border}`, background: 'transparent',
    color: COLORS.textMuted, cursor: 'pointer',
  },

  // Picker
  pickerList: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 },
  pickerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg, padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
  },
  pickerName: { fontSize: 15, fontWeight: 600, color: COLORS.textPrimary },

  // History (ToC)
  historyRow: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  historyVersion: { fontSize: 11, fontWeight: 700, color: COLORS.accent, minWidth: 24 },
  historySummary: { fontSize: 12, color: COLORS.textMuted, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis' },
  historyDate: { fontSize: 10, color: COLORS.textDim, marginTop: 2 },
  restoreLink: {
    background: 'transparent', border: 'none', color: COLORS.accent,
    fontSize: 11, cursor: 'pointer', padding: '2px 0', marginTop: 2, textAlign: 'left',
  },

  textarea: {
    width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.border}`,
    color: COLORS.textPrimary, borderRadius: RADIUS.sm, padding: '10px 12px',
    fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6,
  },
}
