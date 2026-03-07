export type InspectionStatus = 'pass' | 'fail' | 'pending';
export type CheckItemStatus = 'done' | 'failed' | '';
export type Severity = 'low' | 'med' | 'high';

export interface Inspector {
  id: string;
  initials: string;
  name: string;
}

export interface Site {
  id: string;
  name: string;
}

export interface Inspection {
  id: string;
  site: string;
  type: string;
  score: number;
  status: InspectionStatus;
  inspectorId: string;
  inspectorInitials: string;
  inspectorName: string;
  time: string;
  createdAt: string;
}

export interface CheckItem {
  id: string;
  text: string;
  status: CheckItemStatus;
  failNote?: string;
}

export interface CheckGroup {
  name: string;
  items: CheckItem[];
}

export interface FailureDetail {
  checkItemId: string;
  title: string;
  severity: Severity;
  description: string;
  photos: string[];
  assigneeId: string;
  dueDate: string;
  referenceStandard: string;
}

export interface FeedEvent {
  id: string;
  time: string;
  color: string;
  html: string;
}

export interface ReportGroup {
  name: string;
  score: number;
  items: { text: string; status: 'pass' | 'fail' | 'pending'; note?: string }[];
}

export interface Template {
  id: string;
  icon: string;
  name: string;
  count: number;
}

export interface Stats {
  passed: number;
  failures: number;
  pending: number;
  rate: number;
  passedToday: number;
  failuresToday: number;
}
