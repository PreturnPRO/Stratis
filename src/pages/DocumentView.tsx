import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { RADIUS, FONT, LETTER_SPACING, SHADOW, GRADIENT, SPACE } from '../tokens/colors'
import { useTheme } from '../hooks/useTheme'
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

function priorityColor(colors: Record<string, string>): Record<string, string> {
  return {
    HIGH: colors.red,
    MEDIUM: colors.amber,
    LOW: colors.textMuted,
  }
}

function humanizeProjectId(id?: string | null): string {
  if (!id) return 'PM Document'
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function DocumentView({ sessionId, projectId, onNav }: Props) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
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

  const [viewingVersion, setViewingVersion] = useState<number | null>(null)
  const [viewState, setViewState] = useState<PmDocumentState | null>(null)
  const [showRestore, setShowRestore] = useState<number | null>(null)
  const [restoring, setRestoring] = useState(false)

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
        setVersions(data.data.versions ?? [])
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
      if (!res.ok || !data.ok) { setError(data.error ?? 'Could not save the document'); return }
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

  const scrollToSection = (key: string) => {
    document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const loadVersion = useCallback(
    async (v: number) => {
      if (!activeProjectId) return
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/document/${activeProjectId}/version/${v}`, { headers: authHeaders })
        const data = await res.json()
        if (!res.ok || !data.ok) { setError(data.error ?? 'Could not load that version'); return }
        setViewState(data.data.state)
        setViewingVersion(v)
      } catch {
        setError('Could not reach the server')
      }
    },
    [activeProjectId, authHeaders],
  )

  const exitVersionView = () => {
    setViewingVersion(null)
    setViewState(null)
  }

  const handleRestore = async (v: number) => {
    if (!activeProjectId) return
    setRestoring(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/document/${activeProjectId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ version: v }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setError(data.error ?? 'Could not restore that version'); return }
      setDocState(data.data.document.state)
      setVersion(data.data.document.version)
      setVersions(data.data.versions ?? [])
      setShowRestore(null)
      exitVersionView()
    } catch {
      setError('Could not reach the server')
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.dim}>Loading document…</p>
      </div>
    )
  }

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
  const isHistorical = viewingVersion != null
  const displayState = isHistorical ? viewState : docState

  return (
    <div className="document-shell" style={styles.shell}>
      <nav aria-label="Table of contents" style={styles.toc}>
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

        <div style={styles.tocLabel}>Contents</div>
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
          <div style={{ marginTop: SPACE[8] }}>
            <div style={styles.tocLabel}>Versions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {versions.slice(0, 8).map((v) => {
                const isLatest = v.version === version
                // Highlight follows what the article is SHOWING, not which row
                // happens to be newest. Keying the lit state off isLatest alone
                // left v5 lit while you were reading v3, so the sidebar
                // contradicted the page — in the one view whose job is telling
                // you which version you are looking at.
                const isViewing = viewingVersion == null ? isLatest : viewingVersion === v.version
                return (
                  <button
                    key={v.id}
                    style={{
                      ...styles.historyRow,
                      ...(isViewing && isLatest ? styles.historyRowActive : {}),
                      ...(isViewing && !isLatest ? styles.historyRowViewing : {}),
                    }}
                    onClick={() => (isLatest ? exitVersionView() : void loadVersion(v.version))}
                    title={isLatest ? 'Current version' : 'View this version'}
                  >
                    <span style={styles.historyVersion}>v{v.version}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.historySummary}>{v.changeSummary || (isLatest ? 'Current document' : '(no summary)')}</div>
                      <div style={styles.historyDate}>{formatDate(v.createdAt)}{isLatest ? ' · latest' : ''}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {isFacilitator && docState && !isHistorical && (
          <button style={styles.removeDocBtn} onClick={() => setShowRemoveDoc(true)}>
            Remove document…
          </button>
        )}
      </nav>

      <div style={styles.articleScroll}>
        <article style={styles.article}>
          <header style={styles.articleHeader}>
            <div style={{ minWidth: 0 }}>
              <div style={styles.kicker}>
                PM DOCUMENT · SOURCE OF TRUTH
                <span style={styles.kickerVersion}>
                  {isHistorical ? ` · v${viewingVersion} — SNAPSHOT` : ` · v${version} — CURRENT`}
                </span>
              </div>
              <h1 style={styles.bigTitle}>{title}</h1>
              <p style={styles.subtitle}>
                {isHistorical
                  ? `Viewing version ${viewingVersion} · read-only snapshot`
                  : `Version ${version}${proposed ? ` · reviewing ${proposedCount} change${proposedCount === 1 ? '' : 's'} for v${version + 1}` : ''}`}
              </p>
            </div>
          </header>

          {error && <div style={styles.errorBox}>{error}</div>}

          {isHistorical && (
            <div style={styles.historyBanner}>
              <div style={{ flex: 1, minWidth: 0, fontSize: FONT.size.body, fontWeight: 600, color: colors.cyan }}>
                You're viewing version {viewingVersion} — the current document is v{version}.
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {isFacilitator && viewingVersion !== version && (
                  <Button variant="primary" size="sm" onClick={() => setShowRestore(viewingVersion)}>
                    Restore this version
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={exitVersionView}>
                  Back to latest (v{version})
                </Button>
              </div>
            </div>
          )}

          {!isHistorical && proposed && proposedCount > 0 && (
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
                  {busy ? 'Saving…' : `Save ${approvedCount} to v${version + 1}`}
                </Button>
              </div>
            </div>
          )}

          {!isHistorical && proposed && proposedCount === 0 && (
            <div style={styles.noChanges}>This meeting didn't change the project's state.</div>
          )}

          {displayState && PM_SECTIONS.map((s, i) => {
            const sec = displayState.sections[s.key]
            const secReviews = isHistorical ? [] : (reviewsBySection[s.key] ?? [])
            return (
              <section key={s.key} id={`sec-${s.key}`} style={styles.section}>
                <div style={styles.sectionHead}>
                  <span style={styles.sectionNumber}>{String(i + 1).padStart(2, '0')}</span>
                  <h2 style={styles.sectionTitle}>{sec?.title ?? s.title}</h2>
                  {isFacilitator && !isHistorical && !secReviews.length && (
                    <button
                      style={styles.editLink}
                      aria-label={`Edit ${sec?.title ?? s.title}`}
                      onClick={() => openEditSection(s.key, sec?.content ?? '')}
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                    </button>
                  )}
                </div>

                {(sec?.content?.trim() || !secReviews.length) && (
                  <Markdown>{sec?.content ?? ''}</Markdown>
                )}

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
          <p style={{ ...styles.dim, fontSize: FONT.size.label, margin: '0 0 8px' }}>Markdown supported (#, **bold**, - lists).</p>
          <textarea
            style={styles.textarea}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={10}
            aria-label="Section content"
          />
        </Modal>
      )}

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
          <p style={{ color: colors.textMuted, fontSize: FONT.size.body, margin: 0, lineHeight: 1.6 }}>
            This permanently deletes the PM document and its entire version history. This can't be undone.
          </p>
        </Modal>
      )}

      {showRestore != null && (
        <Modal
          title={`Restore version ${showRestore}?`}
          width={400}
          onClose={() => !restoring && setShowRestore(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowRestore(null)} disabled={restoring}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleRestore(showRestore)} disabled={restoring}>
                {restoring ? 'Restoring…' : `Restore as v${version + 1}`}
              </Button>
            </>
          }
        >
          <p style={{ color: colors.textMuted, fontSize: FONT.size.body, margin: 0, lineHeight: 1.6 }}>
            This makes version {showRestore}'s content the current document, saved as a new
            version (v{version + 1}). Nothing is lost — the present version stays in history.
          </p>
        </Modal>
      )}
    </div>
  )
}

function ProposedChange({
  review, onApprove, onReject, onToggleEdit, onContent,
}: {
  review: PatchReview
  onApprove: () => void
  onReject: () => void
  onToggleEdit: () => void
  onContent: (c: string) => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { patch, decision, content, editing } = review
  const priority = priorityColor(colors)[patch.review_priority ?? 'LOW'] ?? colors.textMuted
  const stateAccent =
    decision === 'approved' ? colors.teal : decision === 'rejected' ? colors.red : colors.accent
  const isPending = decision === 'pending'
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.proposed,
        background: isPending ? colors.amberSubtle : styles.proposed.background,
        borderColor: isPending ? colors.accentDim : `${stateAccent}66`,
        opacity: decision === 'rejected' ? 0.6 : 1,
        backgroundImage: isPending ? 'none' : `linear-gradient(${stateAccent}0d, ${stateAccent}0d)`,
        boxShadow: isPending ? SHADOW.glow(colors.accent) : hovered ? SHADOW.xs : 'none',
        transition: 'box-shadow 0.18s ease',
      }}
    >
      <div style={styles.proposedHead}>
        <span style={{ ...styles.proposedTag, color: stateAccent, background: `${stateAccent}1f` }}>
          {decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Proposed change'}
          {' · '}
          {patch.operation.replace(/_/g, ' ')}
        </span>
        {patch.review_priority && (
          <span style={{ ...styles.proposedPriority, color: priority }}>{patch.review_priority}</span>
        )}
      </div>

      {editing ? (
        <textarea
          style={styles.proposedEditor}
          value={content}
          onChange={(e) => onContent(e.target.value)}
          aria-label="Proposed change content"
        />
      ) : (
        <Markdown>{content}</Markdown>
      )}

      {patch.reason && <p style={styles.proposedReason}>Why: {patch.reason}</p>}

      <div style={styles.proposedActions}>
        <button
          style={{
            ...styles.reviewBtn,
            color: decision === 'approved' ? colors.onAccent : colors.accent,
            background: decision === 'approved' ? colors.accent : 'transparent',
            borderColor: colors.accentDim,
            boxShadow: decision === 'approved' ? SHADOW.glow(colors.accent) : 'none',
          }}
          onClick={onApprove}
        >
          {decision === 'approved' ? '✓ Approved' : 'Approve'}
        </button>
        <button style={styles.reviewBtn} onClick={onToggleEdit}>{editing ? 'Done' : 'Edit'}</button>
        <button
          style={{ ...styles.reviewBtn, color: colors.red, borderColor: `${colors.red}66` }}
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

function makeStyles(colors: Record<string, string>): Record<string, React.CSSProperties> {
  return {
    page: { padding: '40px 60px', overflowY: 'auto', flex: 1, color: colors.textPrimary },
    shell: { display: 'flex', flex: 1, height: '100%', minHeight: 0, background: colors.bg },

    toc: {
      width: 220,
      flexShrink: 0,
      borderRight: `1px solid ${colors.border}`,
      padding: '40px 20px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    },
    tocLabel: {
      fontFamily: FONT.mono, fontSize: FONT.size.label, fontWeight: 700, letterSpacing: LETTER_SPACING.label, color: colors.textMuted,
      textTransform: 'uppercase', marginBottom: 12,
    },
    tocLink: {
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'transparent', border: 'none', borderRadius: RADIUS.sm,
      padding: '7px 10px', fontSize: FONT.size.body, color: colors.textMuted, cursor: 'pointer',
    },
    tocDot: {
      width: 6, height: 6, borderRadius: '50%', background: colors.amber, flexShrink: 0,
    },
    backBtn: {
      background: 'transparent', border: 'none', color: colors.accent,
      cursor: 'pointer', fontSize: FONT.size.label, padding: 0, marginBottom: SPACE[6], textAlign: 'left',
    },
    removeDocBtn: {
      marginTop: 'auto', background: 'transparent', border: `1px dashed ${colors.border}`,
      borderRadius: RADIUS.sm, color: colors.textMuted, fontSize: FONT.size.label,
      padding: '9px 10px', cursor: 'pointer', textAlign: 'left',
    },

    articleScroll: { flex: 1, overflowY: 'auto', minWidth: 0, minHeight: 0 },
    article: { maxWidth: 1060, margin: '0 auto', padding: '44px 56px' },
    articleHeader: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16, marginBottom: SPACE[8],
    },
    kicker: {
      fontFamily: FONT.mono, fontSize: FONT.size.micro, fontWeight: 700, letterSpacing: LETTER_SPACING.eyebrow,
      color: colors.accent, marginBottom: SPACE[2.5],
    },
    kickerVersion: { color: colors.textMuted },
    bigTitle: { fontSize: FONT.size.display, fontWeight: 700, margin: 0, color: colors.textPrimary, lineHeight: 1.15, letterSpacing: -0.5 },
    subtitle: { fontSize: FONT.size.body, color: colors.textMuted, margin: '10px 0 0' },
    dim: { color: colors.textMuted },

    errorBox: {
      background: colors.redBg, border: `1px solid ${colors.red}`, color: colors.textPrimary,
      borderRadius: RADIUS.md, padding: '10px 14px', fontSize: FONT.size.body, marginBottom: 20,
    },

    reviewBanner: {
      display: 'flex', alignItems: 'center', gap: 16,
      background: colors.amberSubtle,
      backgroundImage: GRADIENT.surfaceSheen,
      border: `1px solid ${colors.amber}55`,
      borderRadius: RADIUS.lg, padding: '14px 16px', marginBottom: 32,
      boxShadow: SHADOW.xs,
    },
    reviewBannerTitle: { fontSize: FONT.size.body, fontWeight: 600, color: colors.amber },
    reviewBannerSummary: { fontSize: FONT.size.label, color: colors.textMuted, marginTop: 4, lineHeight: 1.5 },
    noChanges: {
      background: colors.surfaceMuted, border: `1px solid ${colors.border}`,
      borderRadius: RADIUS.md, padding: '12px 16px', marginBottom: 32,
      fontSize: FONT.size.body, color: colors.textMuted,
    },

    section: { marginBottom: 40, scrollMarginTop: 24 },
    sectionHead: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, marginBottom: 12, paddingBottom: SPACE[2.5], borderBottom: `1px solid ${colors.border}`,
    },
    sectionNumber: {
      fontFamily: FONT.mono, fontSize: FONT.size.caption, fontWeight: 700, color: colors.textMuted,
      marginRight: -4,
    },
    sectionTitle: { flex: 1, fontSize: FONT.size.heading, fontWeight: 600, margin: 0, color: colors.textPrimary, letterSpacing: -0.2 },
    editLink: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', color: colors.textMuted,
      cursor: 'pointer', padding: '4px', borderRadius: RADIUS.sm,
    },

    proposed: {
      background: colors.surface, border: '1px solid', borderRadius: 10,
      padding: '14px 16px', marginTop: SPACE[4], display: 'flex', flexDirection: 'column', gap: 8,
    },
    proposedHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    proposedTag: {
      fontFamily: FONT.mono, fontSize: FONT.size.micro, fontWeight: 700, letterSpacing: LETTER_SPACING.wide, textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: RADIUS.pill,
    },
    proposedPriority: { fontFamily: FONT.mono, fontSize: FONT.size.micro, fontWeight: 700 },
    proposedReason: { fontSize: FONT.size.label, color: colors.textMuted, margin: 0, fontStyle: 'italic' },
    proposedEditor: {
      width: '100%', minHeight: 120, background: colors.bg,
      border: `1px solid ${colors.border}`, color: colors.textPrimary,
      borderRadius: RADIUS.sm, padding: SPACE[2.5], fontSize: FONT.size.body, fontFamily: 'inherit',
      resize: 'vertical', outline: 'none', lineHeight: 1.6,
    },
    proposedActions: { display: 'flex', gap: SPACE[1.5], justifyContent: 'flex-end', marginTop: 2 },
    reviewBtn: {
      padding: '4px 11px', fontSize: FONT.size.caption, fontWeight: 600, borderRadius: RADIUS.sm,
      border: `1px solid ${colors.border}`, background: 'transparent',
      color: colors.textMuted, cursor: 'pointer',
    },

    pickerList: { display: 'flex', flexDirection: 'column', gap: SPACE[2.5], maxWidth: 640 },
    pickerRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      background: colors.surface, border: `1px solid ${colors.border}`,
      borderRadius: RADIUS.lg, padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
    },
    pickerName: { fontSize: FONT.size.body, fontWeight: 600, color: colors.textPrimary },

    historyRow: {
      display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%',
      background: 'transparent', border: '1px solid transparent', borderRadius: RADIUS.sm,
      padding: '7px 8px', cursor: 'pointer', textAlign: 'left',
    },
    historyRowActive: {
      background: colors.amberSubtle, border: `1px solid ${colors.accentDim}`,
    },
    historyRowViewing: {
      background: colors.cyanBg, border: `1px solid ${colors.cyan}55`,
    },
    historyBanner: {
      display: 'flex', alignItems: 'center', gap: 16,
      background: colors.cyanBg, border: `1px solid ${colors.cyan}55`,
      borderRadius: RADIUS.lg, padding: '14px 16px', marginBottom: 32,
    },
    historyVersion: { fontFamily: FONT.mono, fontSize: FONT.size.caption, fontWeight: 700, color: colors.accent, minWidth: 24 },
    historySummary: { fontSize: FONT.size.label, color: colors.textMuted, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis' },
    historyDate: { fontFamily: FONT.mono, fontSize: FONT.size.micro, color: colors.textMuted, marginTop: 2 },

    textarea: {
      width: '100%', background: colors.bg, border: `1px solid ${colors.border}`,
      color: colors.textPrimary, borderRadius: RADIUS.sm, padding: '10px 12px',
      fontSize: FONT.size.body, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6,
    },
  }
}
