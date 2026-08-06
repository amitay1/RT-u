import type { RtPtValidationIssue, RtPtValidationSummary } from '@/lib/rtPtValidation';
import type { RtPtMethod } from '@/types/rtPtDocument';

export interface RtPtWorkflowTabDefinition {
  value: string;
  label: string;
  shortLabel: string;
}

export type RtPtWorkflowTabStatus = 'ready' | 'correction' | 'review';

export interface RtPtWorkflowTabState extends RtPtWorkflowTabDefinition {
  errors: number;
  warnings: number;
  status: RtPtWorkflowTabStatus;
}

export type RtPtWorkflowValidation = Pick<
  RtPtValidationSummary,
  'issues' | 'completionPercent' | 'completedFieldsCount' | 'totalRequiredFields'
>;

export interface RtPtWorkflowSnapshot {
  completionPercent: number;
  completedFieldsCount: number;
  totalRequiredFields: number;
  errors: number;
  warnings: number;
  readySections: number;
  totalSections: number;
  tabs: RtPtWorkflowTabState[];
  nextTab: RtPtWorkflowTabState | null;
}

export function resolveRtPtWorkflowTab(method: RtPtMethod, issueTab: string): string {
  if (issueTab === 'source') return method === 'RT-Film' ? 'equipment' : 'exposure';
  if (issueTab === 'storage') return 'processing';
  if (issueTab === 'removal') return 'application';
  return issueTab;
}

const tabStatus = (errors: number, warnings: number): RtPtWorkflowTabStatus => {
  if (errors > 0) return 'correction';
  if (warnings > 0) return 'review';
  return 'ready';
};

const issuePriority = (tab: RtPtWorkflowTabState): number => {
  if (tab.errors > 0) return 0;
  if (tab.warnings > 0) return 1;
  return 2;
};

export function buildRtPtWorkflowSnapshot(
  method: RtPtMethod,
  tabs: ReadonlyArray<RtPtWorkflowTabDefinition>,
  activeTab: string,
  validation: RtPtWorkflowValidation,
): RtPtWorkflowSnapshot {
  const counts = new Map<string, { errors: number; warnings: number }>();

  validation.issues.forEach((issue: RtPtValidationIssue) => {
    const tab = resolveRtPtWorkflowTab(method, issue.tab);
    const current = counts.get(tab) ?? { errors: 0, warnings: 0 };
    if (issue.severity === 'error') current.errors += 1;
    else current.warnings += 1;
    counts.set(tab, current);
  });

  const tabStates = tabs.map<RtPtWorkflowTabState>((tab) => {
    const count = counts.get(tab.value) ?? { errors: 0, warnings: 0 };
    return {
      ...tab,
      ...count,
      status: tabStatus(count.errors, count.warnings),
    };
  });

  const activeIndex = Math.max(0, tabStates.findIndex((tab) => tab.value === activeTab));
  const forwardOrder = [
    ...tabStates.slice(activeIndex + 1),
    ...tabStates.slice(0, activeIndex + 1),
  ];
  const nextTab = [...forwardOrder]
    .sort((left, right) => issuePriority(left) - issuePriority(right))
    .find((tab) => tab.status !== 'ready') ?? null;

  return {
    completionPercent: validation.completionPercent,
    completedFieldsCount: validation.completedFieldsCount,
    totalRequiredFields: validation.totalRequiredFields,
    errors: validation.issues.filter((issue) => issue.severity === 'error').length,
    warnings: validation.issues.filter((issue) => issue.severity === 'warning').length,
    readySections: tabStates.filter((tab) => tab.status === 'ready').length,
    totalSections: tabStates.length,
    tabs: tabStates,
    nextTab,
  };
}
