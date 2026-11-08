import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Download,
  Users,
  HeartHandshake,
  Activity,
  History,
} from "lucide-react";
import { api, useApi, errorMessage, download } from "./api";
import {
  Busy,
  Notice,
  PageTitle,
  RiskBadge,
  StatusView,
  Empty,
  pct,
} from "./components";
import { useToast } from "./main";
import type { Student, Features, Risk } from "./types";

const inputs: {
  key: keyof Features;
  label: string;
  max: number;
  step: number;
}[] = [
  { key: "attendance", label: "Attendance (%)", max: 100, step: 0.01 },
  { key: "cgpa", label: "CGPA (out of 10)", max: 10, step: 0.01 },
  { key: "backlogs", label: "Active backlogs", max: 20, step: 1 },
  {
    key: "assignment_completion",
    label: "Assignment completion (%)",
    max: 100,
    step: 0.01,
  },
  {
    key: "lms_activity",
    label: "Weekly learning activity (sessions)",
    max: 100,
    step: 0.01,
  },
  {
    key: "credits_ratio",
    label: "Credits completed (%)",
    max: 100,
    step: 0.01,
  },
];

export function StudentForm({
  student,
  onSaved,
  onClose,
}: {
  student?: Student;
  onSaved: (student: Student) => void;
  onClose: () => void;
}) {
  const fields = [
    "student_id",
    "name",
    "email",
    "department",
    "semester",
    ...inputs.map((f) => f.key),
  ];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((key) => [
        key,
        student ? String(student[key as keyof Student]) : "",
      ]),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toast = useToast();
  function field(key: string) {
    return {
      value: values[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setValues((v) => ({ ...v, [key]: e.target.value })),
    };
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<Student>(
        student ? `/students/${student.id}/profile` : "/students",
        {
          method: student ? "PATCH" : "POST",
          body: JSON.stringify({
            ...values,
            semester: Number(values.semester),
            ...Object.fromEntries(
              inputs.map((f) => [f.key, Number(values[f.key])]),
            ),
          }),
        },
      );
      toast(
        student
          ? "Profile updated. A new prediction is saved in history."
          : "Student created with a saved risk prediction.",
      );
      onSaved(result);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="modal-form" onSubmit={save}>
      <p className="muted">
        Enter verified information. All six academic measurements are required
        for this model.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="form-grid">
        <label>
          Enrollment number
          <input
            {...field("student_id")}
            required
            minLength={2}
            maxLength={40}
            pattern="[A-Za-z0-9_-]+"
          />
        </label>
        <label>
          Full name
          <input {...field("name")} required minLength={2} maxLength={100} />
        </label>
        <label>
          Email (optional)
          <input {...field("email")} type="email" maxLength={160} />
        </label>
        <label>
          Department
          <input
            {...field("department")}
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <label>
          Semester
          <input
            {...field("semester")}
            type="number"
            required
            min={1}
            max={12}
            step={1}
          />
        </label>
      </div>
      <h3 className="form-section-title">Academic measurements</h3>
      <div className="form-grid">
        {inputs.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              {...field(f.key)}
              type="number"
              required
              min={0}
              max={f.max}
              step={f.step}
            />
          </label>
        ))}
      </div>
      {student && (
        <p className="muted">
          Changing the enrollment number also changes the student's sign-in ID.
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <Busy busy={busy} className="button primary">
          {student ? "Save profile & predict" : "Create student & predict"}
        </Busy>
      </div>
    </form>
  );
}

type Snapshot = {
  id: number;
  probability: number;
  risk: Risk;
  model_version: string;
  features: Features;
  created_at: string;
  reason: string;
};
export function PredictionHistory({ studentId }: { studentId: number }) {
  const [page, setPage] = useState(1);
  const query = useApi<{ items: Snapshot[]; total: number; page_size: number }>(
    `/students/${studentId}/history?page=${page}`,
  );
  const [expanded, setExpanded] = useState<number | null>(null);
  if (query.loading || query.error || !query.data)
    return <StatusView {...query} retry={query.reload} />;
  const data = query.data;
  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <div className="heading-with-icon">
          <span className="blue-icon">
            <History size={20} />
          </span>
          <div>
            <h2>Prediction history</h2>
            <p>Saved estimates and the academic data used at the time</p>
          </div>
        </div>
        <span className="small-tag">{data.total} snapshots</span>
      </div>
      {!data.items.length ? (
        <Empty
          title="No saved predictions yet"
          description="Save academic data to start the history."
        />
      ) : (
        <>
          <div className="history-list">
            {data.items.map((item) => (
              <article key={item.id} className="history-item">
                <div className="history-summary">
                  <div>
                    <strong>{item.reason}</strong>
                    <small>
                      {new Date(item.created_at).toLocaleString("en-IN")}
                    </small>
                  </div>
                  <strong className="history-probability">
                    {pct(item.probability, 1)}
                  </strong>
                  <RiskBadge risk={item.risk} />
                  <button
                    className="text-button"
                    onClick={() =>
                      setExpanded(expanded === item.id ? null : item.id)
                    }
                    aria-expanded={expanded === item.id}
                  >
                    {expanded === item.id ? "Hide inputs" : "View inputs"}
                  </button>
                </div>
                <small className="history-model">{item.model_version}</small>
                {expanded === item.id && (
                  <div className="history-inputs">
                    {inputs.map((f) => (
                      <div key={f.key}>
                        <span>{f.label}</span>
                        <strong>{item.features[f.key]}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="history-pagination">
            <span>
              {(page - 1) * data.page_size + 1}–
              {Math.min(page * data.page_size, data.total)} of {data.total}
            </span>
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Newer
            </button>
            <button
              className="button secondary"
              disabled={page * data.page_size >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Older
            </button>
          </div>
        </>
      )}
      <div className="method-note">
        <p>
          The baseline preserves the last known prediction from the previous
          build. Earlier changes were not recorded. Different model versions may
          produce different estimates from the same inputs.
        </p>
      </div>
    </section>
  );
}

type Analytics = {
  total: number;
  risk_counts: Record<Risk, number>;
  department_options: string[];
  departments: ({
    name: string;
    total: number;
    mean_probability: number;
  } & Record<Risk, number>)[];
  features: {
    key: string;
    label: string;
    mean: number | null;
    reference: number;
  }[];
  support: {
    open: number;
    resolved: number;
    overdue: number;
    high_total: number;
    high_supported: number;
    unassigned: Student[];
  };
  changes: Record<string, number>;
  model_version: string;
  demo_mode: boolean;
};
export function AnalyticsPage() {
  const [department, setDepartment] = useState(""),
    [semester, setSemester] = useState("");
  const params = new URLSearchParams({
    ...(department ? { department } : {}),
    ...(semester ? { semester } : {}),
  });
  const query = useApi<Analytics>(`/analytics?${params}`);
  const toast = useToast();
  const data = query.data;
  return (
    <>
      <PageTitle
        eyebrow="FROM SIGNALS TO SUPPORT"
        title="A clearer view of your campus."
        description="Understand academic patterns, focus follow-ups, and track saved changes."
      >
        <button
          className="button secondary"
          onClick={() =>
            download(
              "/students/export" +
                (department
                  ? `?department=${encodeURIComponent(department)}`
                  : ""),
              "continuum-department-report.csv",
            ).catch((e) => toast(errorMessage(e), "error"))
          }
        >
          <Download size={17} />
          Export department
        </button>
      </PageTitle>
      <section className="panel analytics-filters">
        <label>
          Department
          <select
            aria-label="Analytics department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All departments</option>
            {data?.department_options.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Semester
          <select
            aria-label="Analytics semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          >
            <option value="">All semesters</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1}>{i + 1}</option>
            ))}
          </select>
        </label>
        <span className="muted">
          Current saved records · no inferred outcomes
        </span>
      </section>
      {query.loading || query.error || !data ? (
        <StatusView {...query} retry={query.reload} />
      ) : (
        <>
          {data.demo_mode && (
            <Notice>
              <strong>Demo analytics.</strong> Records are fictional and
              predictions use synthetic training data.
            </Notice>
          )}
          <div className="stats-grid analytics-stats">
            {[
              {
                label: "Students in view",
                value: data.total,
                detail: "Across selected departments and semesters",
                icon: Users,
              },
              {
                label: "High risk without an open plan",
                value: data.support.high_total - data.support.high_supported,
                detail: `${data.support.high_supported} of ${data.support.high_total} have an open plan`,
                icon: HeartHandshake,
              },
              {
                label: "Overdue follow-ups",
                value: data.support.overdue,
                detail: `${data.support.open} open support plans`,
                icon: Activity,
              },
              {
                label: "Completed support plans",
                value: data.support.resolved,
                detail: "Completion does not establish student outcomes",
                icon: HeartHandshake,
              },
            ].map((m) => (
              <div className="stat-card" key={m.label}>
                <span className="muted">
                  <m.icon size={16} /> {m.label}
                </span>
                <strong className="stat-value">{m.value}</strong>
                <small className="muted">{m.detail}</small>
              </div>
            ))}
          </div>
          {!data.total ? (
            <Empty
              title="No students in this view"
              description="Change the filters or add student records."
            />
          ) : (
            <>
              <div className="analytics-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Risk across departments</h2>
                      <p>
                        Current support triage bands, based on saved
                        probabilities
                      </p>
                    </div>
                  </div>
                  <div className="cohort-bars">
                    {data.departments.map((d) => (
                      <div key={d.name}>
                        <div className="cohort-bar-title">
                          <strong>{d.name}</strong>
                          <span>{d.total} students</span>
                        </div>
                        <div
                          className="cohort-bar"
                          role="img"
                          aria-label={`${d.name}: ${d.low} low, ${d.moderate} medium, ${d.high} high`}
                        >
                          {(["low", "moderate", "high"] as Risk[]).map((r) => (
                            <i
                              key={r}
                              className={`${r}-color`}
                              style={{ width: `${(d[r] / d.total) * 100}%` }}
                              title={`${r}: ${d[r]}`}
                            />
                          ))}
                        </div>
                        <div className="cohort-bar-foot">
                          <span>
                            Low {d.low} · Medium {d.moderate} · High {d.high}
                          </span>
                          <span>
                            Mean estimate {pct(d.mean_probability, 1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>What changed?</h2>
                      <p>Latest two saved predictions for each student</p>
                    </div>
                  </div>
                  <div className="change-list">
                    {[
                      {
                        key: "decreased",
                        label: "Lower estimate",
                        tone: "positive",
                      },
                      {
                        key: "increased",
                        label: "Higher estimate",
                        tone: "negative",
                      },
                      {
                        key: "stable",
                        label: "Within 0.5 percentage points",
                        tone: "",
                      },
                      {
                        key: "model_changed",
                        label: "Model version changed",
                        tone: "",
                      },
                      {
                        key: "not_enough_history",
                        label: "Awaiting a second snapshot",
                        tone: "",
                      },
                    ].map((i) => (
                      <div key={i.key}>
                        <span>{i.label}</span>
                        <strong className={i.tone}>
                          {data.changes[i.key]}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="method-note">
                    <p>
                      Only estimates from the same model are compared. Changes
                      reflect recorded inputs; they do not measure the effect of
                      support plans.
                    </p>
                  </div>
                </section>
              </div>
              <div className="analytics-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Academic indicators</h2>
                      <p>
                        Cohort averages alongside the model's reference values
                      </p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Measurement</th>
                          <th>Cohort mean</th>
                          <th>Training median</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.features.map((f) => (
                          <tr key={f.key}>
                            <td>{f.label}</td>
                            <td>{f.mean?.toFixed(2) ?? "—"}</td>
                            <td>{f.reference.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="method-note">
                    <p>
                      References describe the development dataset, not
                      recommended targets or validated intervention thresholds.
                    </p>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>A place to start</h2>
                      <p>Highest estimates without an open support plan</p>
                    </div>
                  </div>
                  {data.support.unassigned.length ? (
                    <div className="followup-list">
                      {data.support.unassigned.map((s) => (
                        <Link to={`/students/${s.id}`} key={s.id}>
                          <div>
                            <strong>{s.name}</strong>
                            <small>
                              {s.department} · {s.student_id}
                            </small>
                          </div>
                          <span>{pct(s.probability, 1)}</span>
                          <ArrowRight size={17} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Follow-ups are covered"
                      description="All high-risk students in this view have an open support plan."
                    />
                  )}
                </section>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

type Point = { x: number; y: number };
export function ModelDiagnostics({
  diagnostics,
}: {
  diagnostics?: {
    roc: Point[];
    precision_recall: Point[];
    calibration: Point[];
  };
}) {
  if (!diagnostics) return null;
  return (
    <div className="diagnostic-grid">
      {[
        {
          title: "ROC curve",
          points: diagnostics.roc,
          x: "False positive rate",
          y: "True positive rate",
          diagonal: true,
        },
        {
          title: "Precision–recall curve",
          points: diagnostics.precision_recall,
          x: "Recall",
          y: "Precision",
          diagonal: false,
        },
        {
          title: "Probability calibration",
          points: diagnostics.calibration,
          x: "Mean predicted probability",
          y: "Observed dropout fraction",
          diagonal: true,
        },
      ].map((c) => (
        <section className="panel diagnostic-card" key={c.title}>
          <div className="panel-heading">
            <div>
              <h2>{c.title}</h2>
              <p>Held-out test observations</p>
            </div>
          </div>
          <svg
            viewBox="0 0 320 265"
            role="img"
            aria-label={`${c.title}. Horizontal: ${c.x}; vertical: ${c.y}.`}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={v}>
                <line
                  x1="42"
                  y1={220 - v * 180}
                  x2="295"
                  y2={220 - v * 180}
                  stroke="#e7ebf3"
                />
                <text x="31" y={224 - v * 180} textAnchor="end">
                  {v}
                </text>
                <text x={42 + v * 253} y="239" textAnchor="middle">
                  {v}
                </text>
              </g>
            ))}
            {c.diagonal && (
              <line
                x1="42"
                y1="220"
                x2="295"
                y2="40"
                stroke="#aeb8cd"
                strokeDasharray="5 5"
              />
            )}
            <polyline
              points={c.points
                .map((p) => `${42 + p.x * 253},${220 - p.y * 180}`)
                .join(" ")}
              fill="none"
              stroke="#5576ec"
              strokeWidth="3"
            />
            {c.title.includes("calibration") &&
              c.points.map((p, i) => (
                <circle
                  key={i}
                  cx={42 + p.x * 253}
                  cy={220 - p.y * 180}
                  r="4"
                  fill="#5576ec"
                />
              ))}
            <text x="168" y="261" textAnchor="middle">
              {c.x}
            </text>
            <text x="42" y="22">
              {c.y}
            </text>
          </svg>
          <p className="diagnostic-note">
            {c.title.includes("calibration")
              ? "Eight quantile bins. Dashed line = ideal calibration. Diagnostic only; no test-set calibration was fitted."
              : c.diagonal
                ? "Dashed line = random ranking. Display sampled to at most 80 curve points."
                : "Precision and recall as the classification threshold varies; display sampled to at most 80 points."}
          </p>
        </section>
      ))}
    </div>
  );
}
