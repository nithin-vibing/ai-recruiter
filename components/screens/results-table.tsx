'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Candidate, CandidateStatus, FilterStatus } from '@/lib/types';

interface ResultsTableProps {
  candidates: Candidate[];
  projectName: string;
  roleName: string;
  percentileThreshold: number;
  onStatusChange: (candidateId: string, status: CandidateStatus) => void;
  onCommentsChange: (candidateId: string, comments: string) => void;
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

export function ResultsTable({
  candidates,
  projectName,
  roleName,
  percentileThreshold,
  onStatusChange,
  onCommentsChange,
}: ResultsTableProps) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'reasoning' | 'resume'>('reasoning');
  const [tempComments, setTempComments] = useState('');
  const [editingComments, setEditingComments] = useState(false);

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

  // Auto-select first candidate if none selected
  const selectedCandidate = useMemo(() => {
    if (selectedId) {
      return filteredCandidates.find(c => c.id === selectedId) || filteredCandidates[0] || null;
    }
    return filteredCandidates[0] || null;
  }, [filteredCandidates, selectedId]);

  const selectedIndex = selectedCandidate
    ? filteredCandidates.findIndex(c => c.id === selectedCandidate.id)
    : -1;

  const navigatePrev = () => {
    if (selectedIndex > 0) {
      setSelectedId(filteredCandidates[selectedIndex - 1].id);
      setEditingComments(false);
      setDetailTab('reasoning');
    }
  };

  const navigateNext = () => {
    if (selectedIndex < filteredCandidates.length - 1) {
      setSelectedId(filteredCandidates[selectedIndex + 1].id);
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

  const exportToCsv = () => {
    const headers = ['Rank', 'Name', 'Email', 'Phone', 'LinkedIn', 'Score', 'Reasoning', 'Status', 'Comments'];
    const rows = filteredCandidates.map(c => [
      c.rank, c.name, c.email, c.phone, c.linkedIn, c.totalScore, c.reasoning, c.status, c.comments,
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName.replace(/\s+/g, '_')}_results.csv`;
    link.click();
  };

  const statCounts = useMemo(() => ({
    total: candidates.length,
    shortlisted: candidates.filter(c => c.status === 'shortlisted').length,
    hold: candidates.filter(c => c.status === 'hold').length,
    rejected: candidates.filter(c => c.status === 'rejected').length,
  }), [candidates]);

  return (
    <div className="space-y-4">
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
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2">
        {(['all', 'shortlisted', 'hold', 'rejected'] as FilterStatus[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className={cn(
              filter === f && f === 'shortlisted' && 'bg-success hover:bg-success/90',
              filter === f && f === 'hold' && 'bg-warning hover:bg-warning/90 text-foreground',
              filter === f && f === 'rejected' && 'bg-destructive hover:bg-destructive/90',
            )}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* ── Master-Detail Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4" style={{ height: 'calc(100vh - 260px)' }}>

        {/* ── Left: Candidate list ── */}
        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="p-3 pb-2 border-b shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {filteredCandidates.length} candidates
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleSort}>
                Score <ArrowUpDown className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <div className="overflow-y-auto flex-1">
            {filteredCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50',
                  selectedCandidate?.id === candidate.id && 'bg-electric-blue/5 border-l-2 border-l-electric-blue'
                )}
                onClick={() => {
                  setSelectedId(candidate.id);
                  setEditingComments(false);
                  setDetailTab('reasoning');
                }}
              >
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                  {candidate.rank}
                </span>
                <div className={cn('h-2 w-2 rounded-full shrink-0', statusDot[candidate.status])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{candidate.name}</p>
                </div>
                <span className={cn(
                  'text-sm tabular-nums px-2 py-0.5 rounded',
                  getScoreColor(candidate.totalScore),
                  getScoreBg(candidate.totalScore)
                )}>
                  {candidate.totalScore}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Right: Detail panel ── */}
        {selectedCandidate ? (
          <Card className="overflow-hidden flex flex-col">
            {/* Header */}
            <CardHeader className="p-4 pb-3 border-b shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold">{selectedCandidate.name}</h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className={cn('text-2xl tabular-nums', getScoreColor(selectedCandidate.totalScore))}>
                      {selectedCandidate.totalScore}
                    </span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                    <Badge variant="outline" className={cn('ml-2', statusColors[selectedCandidate.status])}>
                      {selectedCandidate.status.charAt(0).toUpperCase() + selectedCandidate.status.slice(1)}
                    </Badge>
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
                  'px-3 py-2 text-sm font-medium border-b-2 transition-colors',
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
                  'px-3 py-2 text-sm font-medium border-b-2 transition-colors',
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
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {detailTab === 'reasoning' && (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedCandidate.reasoning || 'No reasoning available.'}
                </p>
              )}
              {detailTab === 'resume' && (
                <div className="h-full flex flex-col">
                  {selectedCandidate.resumeUrl ? (
                    <div className="flex flex-col flex-1 gap-2">
                      <a
                        href={selectedCandidate.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-electric-blue hover:underline shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open Resume (PDF)
                      </a>
                      <iframe
                        src={selectedCandidate.resumeUrl}
                        className="w-full flex-1 rounded-lg border"
                        style={{ minHeight: '500px' }}
                        title={`Resume - ${selectedCandidate.name}`}
                      />
                    </div>
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
            <div className="border-t px-4 py-3 space-y-2 shrink-0">
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
                  <span className="text-xs text-muted-foreground tabular-nums">{selectedIndex + 1} of {filteredCandidates.length}</span>
                  <Button variant="ghost" size="sm" className="h-7" disabled={selectedIndex >= filteredCandidates.length - 1} onClick={navigateNext}>
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
        ) : (
          <Card className="flex items-center justify-center">
            <p className="text-muted-foreground">Select a candidate to view details</p>
          </Card>
        )}
      </div>
    </div>
  );
}
