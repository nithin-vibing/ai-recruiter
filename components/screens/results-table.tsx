'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Linkedin,
  ArrowUpDown,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  FileText,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Keyboard,
  GitCompare,
  X as XIcon,
  Info,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
} from 'lucide-react';
import { submitCriterionFeedback, fetchCriterionFeedback } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Candidate, CandidateStatus, FilterStatus } from '@/lib/types';

type PreviewCandidate = Candidate & { previewScore: number; previewRank: number };

interface ResultsTableProps {
  candidates: Candidate[];
  projectName: string;
  roleName: string;
  percentileThreshold: number;
  onStatusChange: (candidateId: string, status: CandidateStatus) => void;
  onCommentsChange: (candidateId: string, comments: string) => void;
  previewCandidates?: PreviewCandidate[] | null;
  blindMode?: boolean;
}

const statusColors: Record<CandidateStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  shortlisted: 'bg-success/10 text-success border-success/20',
  hold: 'bg-warning/10 text-warning border-warning/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusDot: Record<CandidateStatus, string> = {
  pending: 'bg-muted-foreground',
  shortlisted: 'bg-success',
  hold: 'bg-warning',
  rejected: 'bg-destructive',
};

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-success font-bold';
  if (score >= 60) return 'text-electric-blue font-semibold';
  if (score >= 45) return 'text-warning font-medium';
  return 'text-destructive font-medium';
}

function getScoreBg(score: number): string {
  if (score >= 75) return 'bg-success/10';
  if (score >= 60) return 'bg-electric-blue/10';
  if (score >= 45) return 'bg-warning/10';
  return 'bg-destructive/10';
}

function getCriterionBarColor(ratio: number): string {
  if (ratio >= 0.75) return 'bg-success';
  if (ratio >= 0.55) return 'bg-electric-blue';
  if (ratio >= 0.35) return 'bg-warning';
  return 'bg-destructive';
}

const confidenceConfig: Record<string, { label: string; icon: typeof Shield; className: string }> = {
  high:   { label: 'High Confidence', icon: ShieldCheck, className: 'text-success border-success/30 bg-success/10' },
  medium: { label: 'Review Carefully', icon: Shield,      className: 'text-warning border-warning/30 bg-warning/10' },
  low:    { label: 'Low Evidence',     icon: ShieldAlert, className: 'text-destructive border-destructive/30 bg-destructive/10' },
};

/** Split text into segments, wrapping matched evidence quotes with a highlight marker. */
function buildSegments(text: string, quotes: string[]): { text: string; highlight: boolean; criterion?: string }[] {
  const validQuotes = quotes.filter((q) => q && q.length > 15);
  if (validQuotes.length === 0) return [{ text, highlight: false }];

  // Build a sorted list of [start, end, quote] matches
  type Match = { start: number; end: number; criterion: string };
  const matches: Match[] = [];
  for (const q of validQuotes) {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx !== -1) matches.push({ start: idx, end: idx + q.length, criterion: q });
  }
  if (matches.length === 0) return [{ text, highlight: false }];

  // Sort by position, remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const merged: Match[] = [matches[0]];
  for (const m of matches.slice(1)) {
    if (m.start < merged[merged.length - 1].end) continue; // skip overlap
    merged.push(m);
  }

  const segments: { text: string; highlight: boolean; criterion?: string }[] = [];
  let cursor = 0;
  for (const { start, end, criterion } of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), highlight: false });
    segments.push({ text: text.slice(start, end), highlight: true, criterion });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlight: false });
  return segments;
}

function ResumeWithHighlights({ resumeUrl, evidenceQuotes }: { resumeUrl: string; evidenceQuotes: string[] }) {
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetchedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (fetchedUrl.current === resumeUrl) return;
    fetchedUrl.current = resumeUrl;
    setLoading(true);
    setError(false);
    setResumeText(null);

    (async () => {
      try {
        const { extractTextFromPdf } = await import('@/lib/pdf-extractor');
        const resp = await fetch(resumeUrl);
        const buf = await resp.arrayBuffer();
        const text = await extractTextFromPdf(buf);
        setResumeText(text.trim());
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [resumeUrl]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
        <p className="text-sm text-muted-foreground">Extracting text to show highlights...</p>
      </div>
    );
  }

  if (error || !resumeText) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
        <FileText className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Couldn&apos;t extract text from this PDF.</p>
        <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-electric-blue hover:underline">
          Open resume →
        </a>
      </div>
    );
  }

  const segments = buildSegments(resumeText, evidenceQuotes);
  const highlightCount = segments.filter((s) => s.highlight).length;

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      {highlightCount > 0 && (
        <p className="text-xs text-muted-foreground shrink-0">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-warning/60 mr-1.5 align-middle" />
          {highlightCount} AI-cited passage{highlightCount !== 1 ? 's' : ''} highlighted
        </p>
      )}
      <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {segments.map((seg, i) =>
          seg.highlight ? (
            <mark
              key={i}
              className="bg-warning/30 text-foreground rounded-sm px-0.5 not-italic"
              title={seg.criterion}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>
      <a
        href={resumeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-electric-blue hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Open original PDF
      </a>
    </div>
  );
}

export function ResultsTable({
  candidates,
  projectName,
  roleName,
  percentileThreshold,
  onStatusChange,
  onCommentsChange,
  previewCandidates,
  blindMode = false,
}: ResultsTableProps) {
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('ai-disclaimer-dismissed') === 'true'
  );
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down'>>({});
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'reasoning' | 'resume'>('reasoning');
  const [tempComments, setTempComments] = useState('');
  const [editingComments, setEditingComments] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  const filteredCandidates = useMemo(() => {
    let result = [...candidates];
    if (filter !== 'all') {
      result = result.filter(c => c.status === filter);
    }
    result.sort((a, b) =>
      sortOrder === 'desc' ? b.totalScore - a.totalScore : a.totalScore - b.totalScore
    );
    return result;
  }, [candidates, filter, sortOrder]);

  // displayList: what actually renders in the left panel.
  // In preview mode: previewCandidates (sorted by estimated score, filter applied here).
  // In blind mode: filteredCandidates sorted alphabetically by name.
  // Otherwise: filteredCandidates as-is.
  const displayList: Candidate[] = useMemo(() => {
    if (previewCandidates) {
      if (filter === 'all') return previewCandidates;
      return previewCandidates.filter(c => c.status === filter);
    }
    if (blindMode) {
      return [...filteredCandidates].sort((a, b) => a.name.localeCompare(b.name));
    }
    return filteredCandidates;
  }, [previewCandidates, filteredCandidates, filter, blindMode]);

  // Auto-select first candidate if none selected
  const selectedCandidate = useMemo(() => {
    if (selectedId) {
      return displayList.find(c => c.id === selectedId) || displayList[0] || null;
    }
    return displayList[0] || null;
  }, [displayList, selectedId]);

  const selectedIndex = selectedCandidate
    ? displayList.findIndex(c => c.id === selectedCandidate.id)
    : -1;

  const navigatePrev = () => {
    if (selectedIndex > 0) {
      setSelectedId(displayList[selectedIndex - 1].id);
      setEditingComments(false);
      setDetailTab('reasoning');
    }
  };

  const navigateNext = () => {
    if (selectedIndex < displayList.length - 1) {
      setSelectedId(displayList[selectedIndex + 1].id);
      setEditingComments(false);
      setDetailTab('reasoning');
    }
  };

  const toggleSort = () => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));

  const startEditComments = () => {
    setTempComments(selectedCandidate?.comments || '');
    setEditingComments(true);
  };

  const saveComments = () => {
    if (selectedCandidate) {
      onCommentsChange(selectedCandidate.id, tempComments);
    }
    setEditingComments(false);
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  // J / ↓  → next candidate    K / ↑  → previous candidate
  // S      → shortlist         H      → hold         R → reject    P → pending
  // ?      → toggle cheat sheet
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't fire when user is typing in an input/textarea
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        navigateNext();
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        navigatePrev();
        break;
      case 's':
        if (selectedCandidate) onStatusChange(selectedCandidate.id, 'shortlisted');
        break;
      case 'h':
        if (selectedCandidate) onStatusChange(selectedCandidate.id, 'hold');
        break;
      case 'r':
        if (selectedCandidate) onStatusChange(selectedCandidate.id, 'rejected');
        break;
      case 'p':
        if (selectedCandidate) onStatusChange(selectedCandidate.id, 'pending');
        break;
      case '?':
        setShowShortcuts((v) => !v);
        break;
    }
  }, [navigateNext, navigatePrev, selectedCandidate, onStatusChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Fetch criterion feedback once for the whole project on mount.
  // Keyed by `${candidateId}_${criterionName}` for O(1) lookup per row.
  useEffect(() => {
    const projectId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
    if (!projectId) return;
    fetchCriterionFeedback(projectId).then(setFeedbackMap).catch(() => {});
  }, []);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // swap oldest out
      return [...prev, id];
    });
    setCompareMode(false);
  };

  const exportToCsv = () => {
    // Collect all unique criterion names across candidates for dynamic columns
    const criterionNames = Array.from(
      new Set(candidates.flatMap(c => c.scores.map(s => s.criterionName)))
    );

    const baseHeaders = ['Rank', 'Name', 'Email', 'Phone', 'LinkedIn', 'Total Score', 'Status', 'Confidence', 'Notes', 'Reasoning'];
    const criterionHeaders = criterionNames.flatMap(n => [`${n} (score)`, `${n} (max)`, `${n} (evidence)`]);
    const headers = [...baseHeaders, ...criterionHeaders];

    const rows = filteredCandidates.map(c => {
      const scoreMap = Object.fromEntries(c.scores.map(s => [s.criterionName, s]));
      const base = [
        c.rank, c.name, c.email, c.phone, c.linkedIn,
        c.totalScore, c.status, c.confidence ?? '', c.comments, c.reasoning,
      ];
      const criterionCells = criterionNames.flatMap(n => {
        const s = scoreMap[n];
        return s ? [s.score, s.maxScore, s.evidence] : ['', '', ''];
      });
      return [...base, ...criterionCells];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName.replace(/\s+/g, '_')}_${roleName.replace(/\s+/g, '_')}_results.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const statCounts = useMemo(() => ({
    total: candidates.length,
    shortlisted: candidates.filter(c => c.status === 'shortlisted').length,
    hold: candidates.filter(c => c.status === 'hold').length,
    rejected: candidates.filter(c => c.status === 'rejected').length,
  }), [candidates]);

  return (
    <div className="space-y-4">
      {/* ── AI disclaimer ── */}
      {!disclaimerDismissed && (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>AI scores are a starting point. Screening models can reflect biases in job descriptions — apply your own judgment before making hiring decisions.</span>
          <button
            onClick={() => {
              setDisclaimerDismissed(true);
              localStorage.setItem('ai-disclaimer-dismissed', 'true');
            }}
            className="ml-auto shrink-0 rounded p-0.5 hover:bg-muted transition-colors"
            aria-label="Dismiss"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {/* ── Top bar: Project info + stats + export ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{projectName}</h2>
          <p className="text-sm text-muted-foreground">
            {roleName} · {candidates.length} candidates
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{statCounts.total} total</span>
            <span className="text-success">{statCounts.shortlisted} shortlisted</span>
            <span className="text-warning">{statCounts.hold} hold</span>
            <span className="text-destructive">{statCounts.rejected} rejected</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShortcuts((v) => !v)}
            title="Keyboard shortcuts (?)"
            className="text-muted-foreground"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Compare bar (shown when 1–2 candidates selected) ── */}
      {compareIds.length > 0 && !compareMode && (
        <div className="flex items-center gap-3 rounded-lg border border-electric-blue/30 bg-electric-blue/5 px-4 py-2">
          <GitCompare className="h-4 w-4 text-electric-blue shrink-0" />
          <span className="text-sm text-muted-foreground flex-1">
            {compareIds.length === 1
              ? 'Select one more candidate to compare'
              : `${filteredCandidates.find(c => c.id === compareIds[0])?.name ?? '—'} vs ${filteredCandidates.find(c => c.id === compareIds[1])?.name ?? '—'}`}
          </span>
          {compareIds.length === 2 && (
            <Button size="sm" className="bg-electric-blue hover:bg-deep-blue h-7 text-xs" onClick={() => setCompareMode(true)}>
              Compare
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => { setCompareIds([]); setCompareMode(false); }}>
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ── Keyboard shortcut cheat sheet ── */}
      {showShortcuts && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Keyboard shortcuts</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5">
            {[
              { key: 'J / ↓', label: 'Next candidate' },
              { key: 'K / ↑', label: 'Prev candidate' },
              { key: 'S', label: 'Shortlist' },
              { key: 'H', label: 'Hold' },
              { key: 'R', label: 'Reject' },
              { key: 'P', label: 'Reset to pending' },
              { key: '?', label: 'Toggle this panel' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border bg-background text-xs font-mono font-medium">{key}</kbd>
                <span className="text-muted-foreground text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'shortlisted', 'hold', 'rejected'] as FilterStatus[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className={cn(
              filter === f && f === 'pending' && 'bg-muted-foreground hover:bg-muted-foreground/90',
              filter === f && f === 'shortlisted' && 'bg-success hover:bg-success/90',
              filter === f && f === 'hold' && 'bg-warning hover:bg-warning/90 text-foreground',
              filter === f && f === 'rejected' && 'bg-destructive hover:bg-destructive/90',
            )}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && statCounts.total > 0 && (
              <span className="ml-1.5 text-xs opacity-70">
                {candidates.filter(c => c.status === 'pending').length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* ── Master-Detail Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4" style={{ height: 'calc(100vh - 195px)' }}>

        {/* ── Left: Candidate list ── */}
        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="p-3 pb-2 border-b shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {displayList.length} candidates
              </span>
              {!blindMode && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleSort}>
                  Score <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>

          {/* Mode banners */}
          {blindMode && (
            <div className="px-3 py-1.5 border-b bg-muted/40 text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
              <EyeOff className="h-3 w-3 shrink-0" />
              Blind review mode — sorted by name, scores hidden
            </div>
          )}
          {previewCandidates && !blindMode && (
            <div className="px-3 py-1.5 border-b bg-electric-blue/5 text-xs flex items-center gap-1 shrink-0">
              <span className="font-medium text-electric-blue">Preview</span>
              <span className="text-muted-foreground">· estimated from new weights · click Re-rank to confirm</span>
            </div>
          )}

          <div className="overflow-y-auto flex-1">
            {displayList.map((candidate) => {
              const isPreview = !!previewCandidates;
              const displayScore = isPreview
                ? Math.round((candidate as PreviewCandidate).previewScore)
                : candidate.totalScore;
              const displayRank = isPreview
                ? (candidate as PreviewCandidate).previewRank
                : candidate.rank;
              const showConfidenceIcon = !blindMode && candidate.confidence && candidate.confidence !== 'high';

              return (
                <div
                  key={candidate.id}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50',
                    selectedCandidate?.id === candidate.id && !compareMode && 'bg-electric-blue/5 border-l-2 border-l-electric-blue',
                    compareIds.includes(candidate.id) && 'bg-electric-blue/5',
                    candidate.confidence === 'low' && !blindMode && 'opacity-75',
                  )}
                  onClick={() => {
                    if (compareIds.length > 0) { toggleCompare(candidate.id); return; }
                    setSelectedId(candidate.id);
                    setEditingComments(false);
                    setDetailTab('reasoning');
                  }}
                >
                  {/* Checkbox: visible on hover or when compare mode active */}
                  <div className={cn(
                    'shrink-0 transition-all',
                    compareIds.length > 0 ? 'opacity-100 w-4' : 'opacity-0 group-hover:opacity-100 w-0 group-hover:w-4 overflow-hidden'
                  )}>
                    <input
                      type="checkbox"
                      checked={compareIds.includes(candidate.id)}
                      onChange={() => toggleCompare(candidate.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5 rounded accent-electric-blue cursor-pointer"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                    {displayRank}
                  </span>
                  <div className={cn('h-2 w-2 rounded-full shrink-0', statusDot[candidate.status])} />
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{candidate.name}</p>
                    {showConfidenceIcon && (() => {
                      const cfg = confidenceConfig[candidate.confidence!];
                      const Icon = cfg.icon;
                      return (
                        <span title={cfg.label} className="inline-flex shrink-0">
                          <Icon
                            className={cn(
                              'h-3 w-3 opacity-60',
                              candidate.confidence === 'low' ? 'text-destructive' : 'text-warning'
                            )}
                          />
                        </span>
                      );
                    })()}
                  </div>
                  {!blindMode && (
                    <span className={cn(
                      'text-sm tabular-nums px-2 py-0.5 rounded',
                      getScoreColor(displayScore),
                      getScoreBg(displayScore)
                    )}>
                      {isPreview ? `~${displayScore}` : displayScore}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Right: Compare panel ── */}
        {compareMode && compareIds.length === 2 ? (() => {
          const cA = candidates.find(c => c.id === compareIds[0]);
          const cB = candidates.find(c => c.id === compareIds[1]);
          if (!cA || !cB) return null;
          // Union of all criteria
          const allCriteria = Array.from(new Set([...cA.scores.map(s => s.criterionName), ...cB.scores.map(s => s.criterionName)]));
          return (
            <Card className="overflow-hidden flex flex-col">
              <CardHeader className="p-3 pb-2 border-b shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Side-by-side comparison</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setCompareMode(false); setCompareIds([]); }}>
                    <XIcon className="h-3 w-3" /> Exit
                  </Button>
                </div>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Header row */}
                <div className="grid grid-cols-2 gap-4">
                  {[cA, cB].map((c) => (
                    <div key={c.id} className="rounded-lg border p-3 space-y-1">
                      <p className="font-display font-bold text-sm leading-tight">{c.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-2xl font-bold tabular-nums', getScoreColor(c.totalScore))}>{c.totalScore}</span>
                        <span className="text-xs text-muted-foreground">/ 100</span>
                        <Badge variant="outline" className={cn('text-xs', statusColors[c.status])}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Criteria comparison */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Criteria breakdown</p>
                  {allCriteria.map((criterion) => {
                    const sA = cA.scores.find(s => s.criterionName === criterion);
                    const sB = cB.scores.find(s => s.criterionName === criterion);
                    const ratioA = sA ? sA.score / sA.maxScore : 0;
                    const ratioB = sB ? sB.score / sB.maxScore : 0;
                    return (
                      <div key={criterion} className="space-y-1">
                        <p className="text-xs font-medium truncate">{criterion}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[{ s: sA, ratio: ratioA, name: cA.name }, { s: sB, ratio: ratioB, name: cB.name }].map(({ s, ratio, name }) => (
                            <div key={name} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 bg-muted rounded-full flex-1 overflow-hidden">
                                  <div className={cn('h-full rounded-full', getCriterionBarColor(ratio))} style={{ width: `${ratio * 100}%` }} />
                                </div>
                                <span className={cn('text-xs tabular-nums font-semibold shrink-0 w-9 text-right', getScoreColor(ratio * 100))}>
                                  {s ? `${s.score}/${s.maxScore}` : '—'}
                                </span>
                              </div>
                              {s?.evidence && (
                                <p className="text-xs text-muted-foreground/70 italic line-clamp-1">&ldquo;{s.evidence}&rdquo;</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })() : null}

        {/* ── Right: Detail panel ── */}
        {!compareMode && selectedCandidate ? (
          <Card className="overflow-hidden flex flex-col">
            {/* Header */}
            <CardHeader className="p-3 pb-2 border-b shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold leading-tight">{selectedCandidate.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {!blindMode ? (
                      <>
                        <span className={cn('text-xl tabular-nums font-bold', getScoreColor(selectedCandidate.totalScore))}>
                          {selectedCandidate.totalScore}
                        </span>
                            <span className="text-xs text-muted-foreground">/ 100</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Score hidden</span>
                    )}
                    <Badge variant="outline" className={cn(statusColors[selectedCandidate.status])}>
                      {selectedCandidate.status.charAt(0).toUpperCase() + selectedCandidate.status.slice(1)}
                    </Badge>
                    {selectedCandidate.confidence && confidenceConfig[selectedCandidate.confidence] && (() => {
                      const cfg = confidenceConfig[selectedCandidate.confidence!];
                      const Icon = cfg.icon;
                      return (
                        <Badge variant="outline" className={cn('flex items-center gap-1 text-xs', cfg.className)}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {selectedCandidate.email && (
                    <a href={`mailto:${selectedCandidate.email}`} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" title={selectedCandidate.email}>
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )}
                  {selectedCandidate.phone && (
                    <a href={`tel:${selectedCandidate.phone}`} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" title={selectedCandidate.phone}>
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )}
                  {selectedCandidate.linkedIn && (
                    <a href={selectedCandidate.linkedIn} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" title="LinkedIn">
                      <Linkedin className="h-4 w-4 text-electric-blue" />
                    </a>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Tabs */}
            <div className="flex border-b px-4 shrink-0">
              <button
                className={cn(
                  'px-3 py-1.5 text-sm font-medium border-b-2 transition-colors',
                  detailTab === 'reasoning'
                    ? 'border-electric-blue text-electric-blue'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setDetailTab('reasoning')}
              >
                <FileText className="h-3.5 w-3.5 inline mr-1.5" />
                AI Reasoning
              </button>
              <button
                className={cn(
                  'px-3 py-1.5 text-sm font-medium border-b-2 transition-colors',
                  detailTab === 'resume'
                    ? 'border-electric-blue text-electric-blue'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setDetailTab('resume')}
              >
                <ExternalLink className="h-3.5 w-3.5 inline mr-1.5" />
                Resume
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden p-3 min-h-0">
              {detailTab === 'reasoning' && blindMode && (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
                  <EyeOff className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">AI reasoning is hidden in blind review mode.</p>
                  <p className="text-xs text-muted-foreground/60">Toggle off blind review in the header to see scores and reasoning.</p>
                </div>
              )}
              {detailTab === 'reasoning' && !blindMode && (
                <div className={cn(
                  'h-full',
                  selectedCandidate.scores.length > 0
                    ? 'grid grid-cols-[1fr_1px_1fr] gap-0'
                    : ''
                )}>
                  {/* Left: Summary — independently scrollable */}
                  <div className="pr-4 h-full overflow-y-auto">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Summary</p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {selectedCandidate.reasoning || 'No summary available.'}
                    </p>
                  </div>

                  {/* Divider */}
                  {selectedCandidate.scores.length > 0 && (
                    <div className="bg-border mx-1" />
                  )}

                  {/* Right: Criteria breakdown — independently scrollable */}
                  {selectedCandidate.scores.length > 0 && (
                    <div className="pl-4 h-full overflow-y-auto space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Criteria Breakdown</p>
                      {selectedCandidate.scores.map((s) => {
                        const ratio = s.maxScore > 0 ? s.score / s.maxScore : 0;
                        const feedbackKey = `${selectedCandidate.id}_${s.criterionName}`;
                        const currentFeedback = feedbackMap[feedbackKey];

                        const handleFeedback = (direction: 'up' | 'down') => {
                          const projectId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
                          if (!projectId) return;
                          // Toggle off if clicking the same direction
                          const next = currentFeedback === direction ? undefined : direction;
                          setFeedbackMap(prev => {
                            const updated = { ...prev };
                            if (next) updated[feedbackKey] = next;
                            else delete updated[feedbackKey];
                            return updated;
                          });
                          if (next) {
                            submitCriterionFeedback(selectedCandidate.id, s.criterionName, projectId, next);
                          }
                        };

                        return (
                          <div
                            key={s.criterionId}
                            className="group rounded-md px-1.5 py-1.5 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium w-[130px] shrink-0 truncate">{s.criterionName}</span>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1">
                                <div
                                  className={cn('h-full rounded-full', getCriterionBarColor(ratio))}
                                  style={{ width: `${ratio * 100}%` }}
                                />
                              </div>
                              <span className={cn('text-xs tabular-nums font-semibold w-9 text-right shrink-0', getScoreColor(ratio * 100))}>
                                {s.score}/{s.maxScore}
                              </span>
                              {/* Thumbs feedback — visible on hover or when active */}
                              <div className={cn(
                                'flex items-center gap-0.5 transition-opacity',
                                currentFeedback ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              )}>
                                <button
                                  onClick={() => handleFeedback('up')}
                                  title="Score looks right"
                                  className={cn(
                                    'h-5 w-5 rounded flex items-center justify-center transition-colors',
                                    currentFeedback === 'up'
                                      ? 'text-success bg-success/10'
                                      : 'text-muted-foreground hover:text-success hover:bg-success/10'
                                  )}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleFeedback('down')}
                                  title="Score seems off"
                                  className={cn(
                                    'h-5 w-5 rounded flex items-center justify-center transition-colors',
                                    currentFeedback === 'down'
                                      ? 'text-destructive bg-destructive/10'
                                      : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                  )}
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            {s.evidence && (
                              <p className="mt-0.5 ml-[138px] text-xs text-muted-foreground/70 italic leading-snug line-clamp-2">
                                &ldquo;{s.evidence}&rdquo;
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {detailTab === 'resume' && (
                <div className="h-full flex flex-col">
                  {selectedCandidate.resumeUrl ? (
                    <ResumeWithHighlights
                      resumeUrl={selectedCandidate.resumeUrl}
                      evidenceQuotes={selectedCandidate.scores.map((s) => s.evidence).filter(Boolean)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">Resume not available for this candidate.</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Resumes are stored when screening new projects.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom: Status + Comments + Navigation */}
            <div className="border-t px-4 py-2 space-y-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">Status</span>
                  <Select
                    value={selectedCandidate.status}
                    onValueChange={(v) => onStatusChange(selectedCandidate.id, v as CandidateStatus)}
                  >
                    <SelectTrigger className={cn('h-8 w-36', statusColors[selectedCandidate.status])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="shortlisted">Shortlisted</SelectItem>
                      <SelectItem value="hold">Hold</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7" disabled={selectedIndex <= 0} onClick={navigatePrev}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">{selectedIndex + 1} of {displayList.length}</span>
                  <Button variant="ghost" size="sm" className="h-7" disabled={selectedIndex >= displayList.length - 1} onClick={navigateNext}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground pt-1.5">Notes</span>
                {editingComments ? (
                  <div className="flex-1 flex gap-2">
                    <Textarea
                      value={tempComments}
                      onChange={(e) => setTempComments(e.target.value)}
                      className="text-sm min-h-[60px]"
                      autoFocus
                      placeholder="Add a note about this candidate..."
                    />
                    <div className="flex flex-col gap-1">
                      <Button size="sm" className="h-7" onClick={saveComments}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingComments(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="flex-1 text-left text-sm px-3 py-1.5 rounded-md border border-dashed hover:bg-muted/50 transition-colors text-muted-foreground"
                    onClick={startEditComments}
                  >
                    {selectedCandidate.comments || (
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Add a note...
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </Card>
        ) : (!compareMode && !selectedCandidate ? (
          <Card className="flex items-center justify-center">
            <p className="text-muted-foreground">Select a candidate to view details</p>
          </Card>
        ) : null)}
      </div>
    </div>
  );
}
