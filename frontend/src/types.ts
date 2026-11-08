export type Risk = "low" | "moderate" | "high";
export type Features = {
  attendance: number;
  cgpa: number;
  backlogs: number;
  assignment_completion: number;
  lms_activity: number;
  credits_ratio: number;
};
export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "faculty" | "student";
  student_id: number | null;
  must_change_password: boolean;
};
export type Student = Features & {
  id: number;
  student_id: string;
  name: string;
  email: string;
  department: string;
  semester: number;
  probability: number;
  risk: Risk;
  model_version: string;
  source: string;
  predicted_at: string;
  updated_at: string;
};
export type Explanation = {
  feature: keyof Features;
  label: string;
  value: number;
  reference: number;
  effect: number;
};
export type Intervention = {
  id: number;
  student_id: number;
  student_name: string;
  student_code: string;
  category: string;
  note: string;
  due_date: string;
  status: "open" | "resolved";
  owner_name: string;
  created_at: string;
  shared_with_student: boolean;
};
export type StudentDetail = Student & {
  explanation: {
    baseline: number;
    probability: number;
    method: string;
    reference: string;
  };
  explanations: Explanation[];
  interventions: Intervention[];
};
export type Overview = {
  total: number;
  risk_counts: Record<Risk, number>;
  average_attendance: number;
  active_interventions: number;
  departments: ({ name: string; total: number } & Record<Risk, number>)[];
  attention: Student[];
  upcoming: Intervention[];
  updated_at: string | null;
  demo_mode: boolean;
  model: string;
};
export type StudentList = {
  items: Student[];
  total: number;
  page: number;
  page_size: number;
  departments: string[];
};
export type Batch = {
  id: string;
  filename: string;
  row_count: number;
  status: string;
  created: number;
  updated: number;
  created_at: string;
};
export type Preview = Batch & {
  errors: { row: number; field: string; message: string }[];
  error_count: number;
  preview: (Features & {
    name: string;
    student_id: string;
    department: string;
  })[];
  to_create: number;
  to_update: number;
};
export type Metrics = {
  average_precision: number;
  roc_auc: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  brier: number;
  confusion_matrix: number[][];
};
export type ModelCard = {
  diagnostics?: {
    roc: { x: number; y: number }[];
    precision_recall: { x: number; y: number }[];
    calibration: { x: number; y: number }[];
  };
  version: string;
  selected_model: string;
  trained_at: string;
  source: string;
  is_demo: boolean;
  dataset_rows: number;
  positive_rate: number;
  selection_metric: string;
  split: { train: number; validation: number; test: number; seed: number };
  comparison: (Metrics & { name: string })[];
  test_metrics: Metrics;
  importance: { feature: string; label: string; value: number; std: number }[];
  thresholds: { moderate: number; high: number };
  fingerprint: string;
  sklearn_version: string;
  explanation_method: string;
  limitations: string[];
};
