'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Download, Linkedin, ArrowUpDown, Mail, Phone, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Candidate, CandidateStatus, FilterStatus, STATUS_OPTIONS } from '@/lib/types';

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

const statusLabels: Record<CandidateStatus, string> = {
  pending: 'Pending',
  shortlisted: 'Shortlisted',
  hold: 'Hold',
  rejected: 'Rejected',
};

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-success font-bold';
  if (score >= 60) return 'text-electric-blue font-semibold';
  if (score >= 45) return 'text-warning font-medium';
  return 'text-destructive font-medium';
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
  const [editingComments, setEditingComments] = useState<string | null>(null);
  const [tempComments, setTempComments] = useState('');

  const filteredCandidates = useMemo(() => {
    let result = [...candidates];
    
    // Apply filter
    if (filter !== 'all') {
      result = result.filter(c => c.status === filter);
    }
    
    // Apply sort
    result.sort((a, b) => {
      return sortOrder === 'desc' 
        ? b.totalScore - a.totalScore 
        : a.totalScore - b.totalScore;
    });
    
    return result;
  }, [candidates, filter, sortOrder]);

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const startEditingComments = (candidate: Candidate) => {
    setEditingComments(candidate.id);
    setTempComments(candidate.comments);
  };

  const saveComments = (candidateId: string) => {
    onCommentsChange(candidateId, tempComments);
    setEditingComments(null);
    setTempComments('');
  };

  const exportToCsv = () => {
    const headers = ['Rank', 'Name', 'Email', 'Phone', 'LinkedIn', 'Score', 'Status', 'Comments'];
    const rows = filteredCandidates.map(c => [
      c.rank,
      c.name,
      c.email,
      c.phone,
      c.linkedIn,
      c.totalScore,
      c.status,
      c.comments,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
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
    <div className="space-y-6">
      {/* Stats Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-xl">{projectName}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {roleName} &middot; Showing top {percentileThreshold}% ({candidates.length} candidates)
              </p>
            </div>
            <Button variant="outline" onClick={exportToCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="font-medium">{statCounts.total}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2">
              <span className="text-sm text-success">Shortlisted:</span>
              <span className="font-medium text-success">{statCounts.shortlisted}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2">
              <span className="text-sm text-warning">Hold:</span>
              <span className="font-medium text-warning">{statCounts.hold}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
              <span className="text-sm text-destructive">Rejected:</span>
              <span className="font-medium text-destructive">{statCounts.rejected}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'shortlisted' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('shortlisted')}
          className={filter === 'shortlisted' ? 'bg-success hover:bg-success/90' : ''}
        >
          Shortlisted
        </Button>
        <Button
          variant={filter === 'hold' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('hold')}
          className={filter === 'hold' ? 'bg-warning hover:bg-warning/90 text-foreground' : ''}
        >
          Hold
        </Button>
        <Button
          variant={filter === 'rejected' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('rejected')}
          className={filter === 'rejected' ? 'bg-destructive hover:bg-destructive/90' : ''}
        >
          Rejected
        </Button>
      </div>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="w-[100px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 font-medium"
                      onClick={toggleSort}
                    >
                      Score
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[280px]">Reasoning</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[200px]">Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((candidate) => (
                  <TableRow key={candidate.id}>
                    <TableCell className="font-medium text-muted-foreground">
                      {candidate.rank}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{candidate.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`mailto:${candidate.email}`}
                                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                              >
                                <Mail className="h-4 w-4 text-muted-foreground" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>{candidate.email}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`tel:${candidate.phone}`}
                                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                              >
                                <Phone className="h-4 w-4 text-muted-foreground" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>{candidate.phone}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={candidate.linkedIn}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                              >
                                <Linkedin className="h-4 w-4 text-electric-blue" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>View LinkedIn</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('text-lg', getScoreColor(candidate.totalScore))}>
                        {candidate.totalScore}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="line-clamp-2 text-sm text-muted-foreground cursor-help">
                              {candidate.reasoning}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            {candidate.reasoning}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={candidate.status}
                        onValueChange={(v) => onStatusChange(candidate.id, v as CandidateStatus)}
                      >
                        <SelectTrigger className={cn('h-8', statusColors[candidate.status])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="shortlisted">Shortlisted</SelectItem>
                          <SelectItem value="hold">Hold</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {editingComments === candidate.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={tempComments}
                            onChange={(e) => setTempComments(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveComments(candidate.id);
                              if (e.key === 'Escape') setEditingComments(null);
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => saveComments(candidate.id)}
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted"
                          onClick={() => startEditingComments(candidate)}
                        >
                          {candidate.comments || (
                            <>
                              <MessageSquare className="h-3 w-3" />
                              Add note...
                            </>
                          )}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
