export type InspectionStatus = 'pass' | 'fail' | 'pending';
export type CheckItemStatus = 'done' | 'failed' | 'na' | '';
export type Severity = 'low' | 'med' | 'high';

export interface Inspector {
  id: string;
  initials: string;
  name: string;
  email: string;
  phone: string;
  companyId: string;
  companyName?: string;
}

export interface Site {
  id: string;
  name: string;
  contactName: string;
  contactPhone: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface Company {
  id: string;
  name: string;
  contact: string;
  phone: string;
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
  companyId: string;
  companyName: string;
  time: string;
  createdAt: string;
}

export interface CheckItemPhoto {
  id: string;
  dataUrl: string;
  isReference: boolean;
}

export interface CheckItem {
  id: string;
  text: string;
  status: CheckItemStatus;
  failNote?: string;
  photos: CheckItemPhoto[];
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

export type RemediationStatus = 'open' | 'in-progress' | 'verified' | 'closed';

export interface FailureView {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  assigneeName: string | null;
  assigneeInitials: string | null;
  dueDate: string | null;
  referenceStandard: string;
  remediationStatus: RemediationStatus;
  createdAt: string;
  photos: string[];
}

export interface FeedEvent {
  id: string;
  time: string;
  color: string;
  inspectionId: string;
  message: string;
  tag: string;
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

export interface TemplateItemPhoto {
  id: string;
  dataUrl: string;
}

export interface TemplateItemDetail {
  id: number;
  text: string;
  photos: TemplateItemPhoto[];
}

export interface Document {
  id: string;
  name: string;
  fileType: string;
  dataUrl: string;
  companyId: string;
  companyName: string;
  siteId: string;
  siteName: string;
  createdAt: string;
}

export interface TemplateGroupDetail {
  id: number;
  name: string;
  items: TemplateItemDetail[];
}

export interface TemplateDetail extends Template {
  groups: TemplateGroupDetail[];
}

export interface Stats {
  passed: number;
  failures: number;
  pending: number;
  rate: number;
  passedToday: number;
  failuresToday: number;
}
