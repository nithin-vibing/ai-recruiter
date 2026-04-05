'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertCircle, CheckCircle, RotateCcw, Loader2 } from 'lucide-react';
import type { RubricCriterion } from '@/lib/types';
import { cn } from '@/lib/utils';

interface RubricTableProps {
  rubric: RubricCriterion[];
  originalRubric?: RubricCriterion[];
  onRubricChange: (rubric: RubricCriterion[]) => void;
  onApprove: () => void;
  approveLabel?: string;
  isLoading?: boolean;
}

// Largest remainder method: guarantees displayed integer percentages always sum to exactly 100
function getDisplayWeights(rubric: RubricCriterion[]): number[] {
  const rawPercentages = rubric.map(c => c.weight * 100);
  const floors = rawPercentages.map(p => Math.floor(p));
  const remainders = rawPercentages.map((p, i) => p - floors[i]);
  const totalFloor = floors.reduce((a, b) => a + b, 0);
  const diff = 100 - totalFloor;
  const sortedIndices = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r)
    .map(x => x.i);
  const result = [...floors];
  for (let i = 0; i < diff && i < sortedIndices.length; i++) {
    result[sortedIndices[i]]++;
  }
  return result;
}

export function RubricTable({ rubric, originalRubric, onRubricChange, onApprove, approveLabel = 'Approve Rubric & Continue', isLoading = false }: RubricTableProps) {
  const [localRubric, setLocalRubric] = useState<RubricCriterion[]>(rubric);
  // Raw string values while user is mid-edit — avoids LRM recompute fighting the keyboard
  const [weightInputValues, setWeightInputValues] = useState<{ [id: string]: string }>({});

  useEffect(() => {
    setLocalRubric(rubric);
    setWeightInputValues({}); // clear any in-progress edits on external rubric change (e.g. reset)
  }, [rubric]);

  // Weight is stored as decimal (0.2), displayed as integer percentage (20)
  // Use largest remainder method to ensure displayed values always sum to exactly 100
  const displayWeights = getDisplayWeights(localRubric);
  const weightSumPercent = displayWeights.reduce((a, b) => a + b, 0);
  const isWeightValid = weightSumPercent === 100;

  const updateCriterion = (id: string, field: keyof RubricCriterion, value: string | number) => {
    const updated = localRubric.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    );
    setLocalRubric(updated);
    onRubricChange(updated);
  };

  // Handle weight change: user enters percentage (e.g. 20), we store as decimal (0.2)
  const updateWeight = (id: string, percentValue: number) => {
    const decimalValue = Math.round(percentValue) / 100;
    updateCriterion(id, 'weight', decimalValue);
  };

  const addCriterion = () => {
    const newCriterion: RubricCriterion = {
      id: crypto.randomUUID(),
      name: 'New Criterion',
      description: 'Enter description...',
      maxScore: 10,
      weight: 0.1,
    };
    const updated = [...localRubric, newCriterion];
    setLocalRubric(updated);
    onRubricChange(updated);
  };

  const deleteCriterion = (id: string) => {
    if (localRubric.length <= 1) return;
    const updated = localRubric.filter(c => c.id !== id);
    setLocalRubric(updated);
    onRubricChange(updated);
  };

  const resetRubric = () => {
    if (originalRubric && originalRubric.length > 0) {
      setLocalRubric(originalRubric);
      onRubricChange(originalRubric);
    }
  };

  const hasChanges = originalRubric && JSON.stringify(localRubric) !== JSON.stringify(originalRubric);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-display text-xl">Screening Rubric</CardTitle>
            <CardDescription>
              Review and customize the scoring criteria. Weights must sum to 100%.
            </CardDescription>
          </div>
          <Badge
            variant={isWeightValid ? 'default' : 'destructive'}
            className={cn(
              'flex items-center gap-1',
              isWeightValid && 'bg-success hover:bg-success/90'
            )}
          >
            {isWeightValid ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            Weight: {weightSumPercent}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px] min-w-[180px]">Criterion</TableHead>
                <TableHead className="min-w-[260px]">Description</TableHead>
                <TableHead className="w-[90px] min-w-[90px] text-center">Max Score</TableHead>
                <TableHead className="w-[100px] min-w-[100px] text-center">Weight %</TableHead>
                <TableHead className="w-[48px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localRubric.map((criterion, index) => (
                <TableRow key={criterion.id} className="h-14">
                  <TableCell className="py-2">
                    <Input
                      value={criterion.name}
                      maxLength={25}
                      title={criterion.name}
                      onChange={(e) => updateCriterion(criterion.id, 'name', e.target.value)}
                      className="h-9 text-sm truncate"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      value={criterion.description}
                      maxLength={100}
                      title={criterion.description}
                      onChange={(e) => updateCriterion(criterion.id, 'description', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={criterion.maxScore}
                      onChange={(e) => updateCriterion(criterion.id, 'maxScore', parseInt(e.target.value) || 0)}
                      className="h-9 text-center text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={weightInputValues[criterion.id] ?? String(displayWeights[index])}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setWeightInputValues(prev => ({ ...prev, [criterion.id]: raw }));
                        const parsed = parseFloat(raw);
                        if (!isNaN(parsed)) {
                          updateWeight(criterion.id, parsed);
                        }
                      }}
                      onBlur={() => {
                        // Snap back to LRM-computed value on blur so display is always consistent
                        setWeightInputValues(prev => {
                          const next = { ...prev };
                          delete next[criterion.id];
                          return next;
                        });
                      }}
                      className="h-9 text-center text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteCriterion(criterion.id)}
                      disabled={localRubric.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={addCriterion}>
              <Plus className="h-4 w-4" />
              Add Criterion
            </Button>
            {hasChanges && (
              <Button variant="outline" onClick={resetRubric} className="text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>

          <Button
            className="bg-electric-blue hover:bg-deep-blue"
            disabled={!isWeightValid || isLoading}
            onClick={onApprove}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {approveLabel}
          </Button>
        </div>

        {!isWeightValid && (
          <p className="mt-3 text-sm text-destructive">
            Adjust weights to sum to 100% (currently {weightSumPercent}%)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
