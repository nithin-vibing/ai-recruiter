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
import { Plus, Trash2, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react';
import type { RubricCriterion } from '@/lib/types';
import { cn } from '@/lib/utils';

interface RubricTableProps {
  rubric: RubricCriterion[];
  originalRubric?: RubricCriterion[];
  onRubricChange: (rubric: RubricCriterion[]) => void;
  onApprove: () => void;
}

export function RubricTable({ rubric, originalRubric, onRubricChange, onApprove }: RubricTableProps) {
  const [localRubric, setLocalRubric] = useState<RubricCriterion[]>(rubric);

  useEffect(() => {
    setLocalRubric(rubric);
  }, [rubric]);

  // Weight is stored internally as decimal (0.2) but displayed as percentage (20)
  const weightSumDecimal = localRubric.reduce((sum, c) => sum + c.weight, 0);
  const weightSumPercent = Math.round(weightSumDecimal * 100);
  const isWeightValid = Math.abs(weightSumPercent - 100) <= 1;

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
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Criterion</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px] text-center">Max Score</TableHead>
                <TableHead className="w-[120px] text-center">Weight %</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localRubric.map((criterion) => (
                <TableRow key={criterion.id}>
                  <TableCell>
                    <Input
                      value={criterion.name}
                      onChange={(e) => updateCriterion(criterion.id, 'name', e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={criterion.description}
                      onChange={(e) => updateCriterion(criterion.id, 'description', e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={criterion.maxScore}
                      onChange={(e) => updateCriterion(criterion.id, 'maxScore', parseInt(e.target.value) || 0)}
                      className="h-8 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(criterion.weight * 100)}
                      onChange={(e) => updateWeight(criterion.id, parseFloat(e.target.value) || 0)}
                      className="h-8 text-center"
                    />
                  </TableCell>
                  <TableCell>
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
            disabled={!isWeightValid}
            onClick={onApprove}
          >
            Approve Rubric & Continue
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
