import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Users,
  ArrowUpRight,
  Upload,
  Download,
  ArrowRight,
  ArrowLeft,
  HeartHandshake,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  BrainCircuit,
  Info,
  FileCheck2,
  X,
  Check,
  LockKeyhole,
  CircleHelp,
} from "lucide-react";
import { api, useApi, download, errorMessage } from "./api";
import {
  Avatar,
  Busy,
  Empty,
  Explanations,
  Modal,
  Notice,
  PageTitle,
  RiskBadge,
  StatusView,
  StudentTable,
  TextLink,
  pct,
  prettyDate,
} from "./components";
import { StudentForm, PredictionHistory, ModelDiagnostics } from "./experience";
import { useAuth, useToast } from "./main";
import { ColumnMapper, type Inspection } from "./mapping";
import type {
  Batch,
  Explanation,
  Features,
  Intervention,
  ModelCard,
  Overview,
  Preview,
  StudentDetail,
  StudentList,
} from "./types";

export function OverviewPage() {
  const query = useApi<Overview>("/overview");
  const toast = useToast();
  const data = query.data;
  if (query.loading || query.error || !data)
    return <StatusView {...query} retry={query.reload} />;
  const counts = data.risk_counts;
  const total = Math.max(data.total, 1);
  const highAngle = (counts.high / total) * 360;
  const moderateAngle = highAngle + (counts.moderate / total) * 360;
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE INSIGHT. A LASTING DIFFERENCE."
        title="Every student. A way forward."
        description="Your campus at a glance. See who’s thriving and where a check-in can help."
      >
        <button
          className="button secondary"
          onClick={() =>
            download("/students/export", "continuum-risk-report.csv").catch(
              (e) => toast(errorMessage(e), "error"),
            )
          }
        >
          <Download size={17} />
          Export report
        </button>
        <Link to="/imports" className="button primary">
          <Plus size={18} />
          Import students
        </Link>
      </PageTitle>
      <div className="overview-meta">
        <span>
          <CalendarDays size={15} />
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        <span className="meta-right">
          <span className="live-dot" />
          Latest saved predictions
          {data.updated_at && ` · ${prettyDate(data.updated_at)}`}
        </span>
      </div>
      <section className="stats-grid" aria-label="Campus summary">
        {[
          {
            label: "Total students",
            value: data.total.toLocaleString(),
            icon: Users,
            foot: `Across ${data.departments.length} departments`,
            color: "blue",
          },
          {
            label: "Students at high risk",
            value: counts.high.toLocaleString(),
            icon: AlertTriangle,
            foot: `${pct(counts.high / total, 1)} of your student cohort`,
            color: "red",
          },
          {
            label: "Average attendance",
            value: `${data.average_attendance}%`,
            icon: Activity,
            foot: "Current imported attendance",
            color: "teal",
          },
          {
            label: "Active support plans",
            value: data.active_interventions.toLocaleString(),
            icon: HeartHandshake,
            foot: "Open faculty follow-ups",
            color: "violet",
          },
        ].map((s, i) => (
          <div className={`stat-card stat-${s.color}`} key={s.label}>
            <div className="stat-heading">
              <span>{s.label}</span>
              <span className="stat-icon">
                <s.icon size={19} />
              </span>
            </div>
            <strong className="stat-value">{s.value}</strong>
            <div className="stat-footer">
              <span className={`stat-foot-indicator ${s.color}`} />
              {s.foot}
              {i === 1 && (
                <Link
                  to="/students?risk=high"
                  aria-label="View high-risk students"
                >
                  <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </section>
      <div className="analytics-grid">
        <section className="panel cohort-panel">
          <div className="panel-heading">
            <div>
              <h2>How your campus is doing</h2>
              <p>Current risk distribution by department</p>
            </div>
            <span className="small-tag">All semesters</span>
          </div>
          <div className="chart-legend">
            <span>
              <i className="low-color" />
              Low risk
            </span>
            <span>
              <i className="moderate-color" />
              Medium
            </span>
            <span>
              <i className="high-color" />
              High risk
            </span>
          </div>
          {data.total ? (
            <div
              className="department-chart"
              role="img"
              aria-label={data.departments
                .map(
                  (d) =>
                    `${d.name}: ${d.low} low, ${d.moderate} moderate, ${d.high} high`,
                )
                .join("; ")}
            >
              <div className="chart-grid-lines">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>
              <div className="chart-columns">
                {data.departments.map((d) => (
                  <div className="chart-column" key={d.name}>
                    <div className="stack-container">
                      <span className="bar-total">{d.total} students</span>
                      <div
                        className="stack"
                        title={`${d.name}: ${d.high} high, ${d.moderate} moderate, ${d.low} low`}
                      >
                        <div
                          className="high-color"
                          style={{ height: `${(d.high / d.total) * 100}%` }}
                        />
                        <div
                          className="moderate-color"
                          style={{ height: `${(d.moderate / d.total) * 100}%` }}
                        />
                        <div
                          className="low-color"
                          style={{ height: `${(d.low / d.total) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="chart-column-label">
                      {d.name
                        .replace("Administration", "Admin.")
                        .replace("Engineering", "Eng.")
                        .replace("Computer Science", "Computer Sc.")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty
              title="Your campus view starts here"
              description="Import students to see the distribution."
            />
          )}
          <div className="chart-caption">
            <Info size={14} />A snapshot of the current cohort. Risk estimates
            guide a closer look.
          </div>
        </section>
        <section className="panel risk-summary">
          <div className="panel-heading">
            <div>
              <h2>The bigger picture</h2>
              <p>Every number represents a student</p>
            </div>
          </div>
          <div className="donut-wrap">
            <div
              className="risk-donut"
              style={{
                background: data.total
                  ? `conic-gradient(#f07869 0deg ${highAngle}deg, #efbe57 ${highAngle}deg ${moderateAngle}deg, #5576ec ${moderateAngle}deg 360deg)`
                  : "#e9edf5",
              }}
              role="img"
              aria-label={`${counts.low} low, ${counts.moderate} moderate, ${counts.high} high-risk students`}
            >
              <div>
                <span className="donut-inner-icon">
                  <Users size={19} />
                </span>
                <strong>{data.total}</strong>
                <span>Total students</span>
              </div>
            </div>
          </div>
          <div className="risk-summary-list">
            {(["low", "moderate", "high"] as const).map((r) => (
              <Link to={`/students?risk=${r}`} key={r}>
                <span>
                  <i className={`${r}-color`} />
                  {r === "low"
                    ? "Low risk"
                    : r === "moderate"
                      ? "Medium risk"
                      : "High risk"}
                </span>
                <strong>
                  {counts[r]} <small>{pct(counts[r] / total, 1)}</small>
                  <ChevronRight size={15} />
                </strong>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="lower-grid">
        <section className="panel attention-panel">
          <div className="panel-heading">
            <div className="heading-with-icon">
              <span className="attention-icon">
                <HeartHandshake size={20} />
              </span>
              <div>
                <h2>A check-in could make a difference</h2>
                <p>Students with the highest estimated risk</p>
              </div>
            </div>
            <TextLink to="/students">View all students</TextLink>
          </div>
          {data.attention.length ? (
            <StudentTable students={data.attention} compact />
          ) : (
            <Empty
              title="No students yet"
              description="Import your first student cohort to begin."
            />
          )}
        </section>
        <section className="panel followups-panel">
          <div className="panel-heading">
            <div>
              <h2>Next conversations</h2>
              <p>Your campus support agenda</p>
            </div>
            <span className="round-icon">
              <CalendarDays size={19} />
            </span>
          </div>
          {data.upcoming.length ? (
            <div className="followup-list">
              {data.upcoming.map((item) => (
                <Link
                  className="followup-item"
                  to={`/students/${item.student_id}`}
                  key={item.id}
                >
                  <div className="followup-date">
                    <strong>
                      {new Date(item.due_date + "T12:00:00").getDate()}
                    </strong>
                    <span>
                      {new Date(item.due_date + "T12:00:00").toLocaleString(
                        "en",
                        { month: "short" },
                      )}
                    </span>
                  </div>
                  <div>
                    <strong>{item.student_name}</strong>
                    <span>{item.category}</span>
                    <small>{item.owner_name}</small>
                  </div>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="A clear agenda"
              description="Add a support plan from a student profile."
            />
          )}
          <div className="panel-bottom">
            <TextLink to="/interventions">All support plans</TextLink>
          </div>
        </section>
      </div>
      {data.demo_mode && (
        <div className="demo-footnote">
          <ShieldCheck size={17} />
          <span>
            <strong>A safe space to explore.</strong> These students are
            fictional. Predictions use a synthetic training dataset.
          </span>
          <Link to="/model">
            About the model <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
    </>
  );
}

export function StudentsPage() {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const risk = params.get("risk") || "";
  const department = params.get("department") || "";
  const sort = params.get("sort") || "risk";
  const page = Number(params.get("page") || 1);
  const [input, setInput] = useState(search);
  const toast = useToast();
  useEffect(() => setInput(search), [search]);
  const request = new URLSearchParams({
    search,
    risk,
    department,
    sort,
    page: String(page),
  });
  const query = useApi<StudentList>(`/students?${request}`);
  function filter(key: string, value: string) {
    setParams((p) => {
      p.set(key, value);
      p.set("page", "1");
      return p;
    });
  }
  useEffect(() => {
    if (input === search) return;
    const timer = setTimeout(() => filter("search", input), 300);
    return () => clearTimeout(timer);
  }, [input, search]);
  const data = query.data;
  return (
    <>
      <PageTitle
        eyebrow="YOUR STUDENT COMMUNITY"
        title="See the person behind the prediction."
        description="Explore student progress and turn early signals into meaningful support."
      >
        <button className="button secondary" onClick={() => setCreating(true)}>
          <Plus size={17} />
          Add student
        </button>
        <button
          className="button secondary"
          onClick={() =>
            download(
              `/students/export?${new URLSearchParams({ search, risk, department })}`,
              "continuum-students.csv",
            ).catch((e) => toast(errorMessage(e), "error"))
          }
        >
          <Download size={17} />
          Export view
        </button>
        <Link to="/imports" className="button primary">
          <Plus size={18} />
          Import students
        </Link>
      </PageTitle>
      {creating && (
        <Modal title="Add a student" onClose={() => setCreating(false)}>
          <StudentForm
            onSaved={(s) => navigate(`/students/${s.id}`)}
            onClose={() => setCreating(false)}
          />
        </Modal>
      )}
      <section className="panel directory-panel">
        <div className="directory-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Search students"
              placeholder="Search by name or student ID…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {input && (
              <button
                className="icon-button"
                onClick={() => setInput("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="filter-controls">
            <select
              aria-label="Filter by department"
              value={department}
              onChange={(e) => filter("department", e.target.value)}
            >
              <option value="">All departments</option>
              {data?.departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              aria-label="Sort students"
              value={sort}
              onChange={(e) => filter("sort", e.target.value)}
            >
              <option value="risk">Highest risk first</option>
              <option value="name">Name A–Z</option>
              <option value="attendance">Lowest attendance</option>
            </select>
          </div>
        </div>
        <div className="directory-tabs">
          <div className="segment-tabs" aria-label="Risk filters">
            {[
              ["", "All students"],
              ["high", "High risk"],
              ["moderate", "Medium"],
              ["low", "Low risk"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={risk === value ? "selected" : ""}
                onClick={() => filter("risk", value)}
              >
                {label}
                {risk === value && data && <span>{data.total}</span>}
              </button>
            ))}
          </div>
          <span className="muted result-count">
            {data?.total ?? "…"} students
          </span>
        </div>
        {query.error ? (
          <StatusView {...query} retry={query.reload} />
        ) : query.loading ? (
          <StatusView {...query} retry={query.reload} />
        ) : data?.items.length ? (
          <StudentTable students={data.items} />
        ) : (
          <Empty
            title="No students match this view"
            description="Try another search or clear your filters."
          >
            <button
              className="button secondary"
              onClick={() => {
                setParams({});
                setInput("");
              }}
            >
              Clear filters
            </button>
          </Empty>
        )}
        <div className="pagination">
          <span>
            {data?.total
              ? `${(page - 1) * 12 + 1}–${Math.min(page * 12, data.total)} of ${data.total} students`
              : "No results"}
          </span>
          <div>
            <button
              className="button secondary small"
              disabled={page <= 1 || query.loading}
              onClick={() =>
                setParams((p) => {
                  p.set("page", String(page - 1));
                  return p;
                })
              }
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="button secondary small"
              disabled={!data || page * 12 >= data.total || query.loading}
              onClick={() =>
                setParams((p) => {
                  p.set("page", String(page + 1));
                  return p;
                })
              }
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      <p className="page-note">
        <Info size={15} />
        Risk levels: Low &lt;30% · Medium 30–&lt;60% · High ≥60%. These
        thresholds are illustrative and support human review.
      </p>
    </>
  );
}

const featureDefinitions: {
  key: keyof Features;
  label: string;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: "attendance", label: "Attendance", max: 100, step: 0.01, unit: "%" },
  { key: "cgpa", label: "CGPA", max: 10, step: 0.01, unit: "/ 10" },
  {
    key: "backlogs",
    label: "Active backlogs",
    max: 20,
    step: 1,
    unit: "courses",
  },
  {
    key: "assignment_completion",
    label: "Assignment completion",
    max: 100,
    step: 0.01,
    unit: "%",
  },
  {
    key: "lms_activity",
    label: "Weekly learning activity",
    max: 100,
    step: 0.01,
    unit: "sessions",
  },
  {
    key: "credits_ratio",
    label: "Credits completed",
    max: 100,
    step: 0.01,
    unit: "%",
  },
];
function extractFeatures(s: Features): Features {
  return Object.fromEntries(
    featureDefinitions.map((f) => [f.key, s[f.key]]),
  ) as Features;
}

function SupportForm({
  studentId,
  onSaved,
  onClose,
}: {
  studentId: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState("Academic support");
  const [due, setDue] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/students/${studentId}/interventions`, {
        method: "POST",
        body: JSON.stringify({
          category,
          due_date: due,
          note,
          shared_with_student: shared,
        }),
      });
      toast("Support plan created.");
      onSaved();
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
        Agree on a small, practical next step and record the follow-up here.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <label>
        Support type
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {[
            "Academic support",
            "Attendance check-in",
            "Mentoring",
            "Learning plan",
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Follow-up date
        <input
          type="date"
          required
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </label>
      <label>
        Support note
        <textarea
          minLength={5}
          maxLength={2000}
          required
          rows={4}
          placeholder="What would help this student, and what will happen next?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={shared}
          onChange={(e) => setShared(e.target.checked)}
        />
        <span>Share this plan and note with the student</span>
      </label>
      <small className="muted">
        Private to faculty by default. Only shared plans appear in the student
        portal.
      </small>
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <Busy className="button primary" busy={busy}>
          <Plus size={16} />
          Create support plan
        </Busy>
      </div>
    </form>
  );
}

function EditFeatures({
  student,
  onSaved,
  onClose,
}: {
  student: StudentDetail;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState(extractFeatures(student));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/students/${student.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      toast("Student data updated and risk recalculated.");
      onSaved();
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
        Save verified academic data. The risk estimate is recalculated
        automatically.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="form-grid">
        {featureDefinitions.map((f) => (
          <label key={f.key}>
            {f.label} <small>({f.unit})</small>
            <input
              type="number"
              required
              min={0}
              max={f.max}
              step={f.step}
              value={values[f.key]}
              onChange={(e) =>
                setValues({
                  ...values,
                  [f.key]: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <Busy className="button primary" busy={busy}>
          Save & recalculate
        </Busy>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const { id } = useParams();
  const query = useApi<StudentDetail>(`/students/${id}`);
  const [support, setSupport] = useState(false);
  const [profileEdit, setProfileEdit] = useState(false);
  const [edit, setEdit] = useState(false);
  const [scenario, setScenario] = useState<Features | null>(null);
  const [result, setResult] = useState<{
    probability: number;
    risk: StudentDetail["risk"];
    explanations: Explanation[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const student = query.data;
  useEffect(() => {
    if (student) {
      setScenario(extractFeatures(student));
      setResult(null);
    }
  }, [student]);
  async function simulate() {
    if (!scenario) return;
    setBusy(true);
    try {
      setResult(
        await api("/predict", {
          method: "POST",
          body: JSON.stringify(scenario),
        }),
      );
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  async function resolve(item: Intervention) {
    try {
      await api(`/interventions/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: item.status === "open" ? "resolved" : "open",
        }),
      });
      toast(
        item.status === "open"
          ? "Support plan marked complete."
          : "Support plan reopened.",
      );
      query.reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  if (query.loading || query.error || !student)
    return <StatusView {...query} retry={query.reload} />;
  return (
    <>
      <Link className="back-link" to="/students">
        <ArrowLeft size={16} />
        All students
      </Link>
      <div className="profile-heading">
        <div className="profile-identity">
          <Avatar name={student.name} large />
          <div>
            <div className="profile-title">
              <h1>{student.name}</h1>
              <RiskBadge risk={student.risk} />
            </div>
            <p>
              {student.student_id}
              <span>·</span>
              {student.department}
              <span>·</span>Semester {student.semester}
            </p>
            <small className="muted">
              {student.email || "No email recorded"}
            </small>
          </div>
        </div>
        <div className="page-actions">
          <button
            className="button secondary"
            onClick={() => setProfileEdit(true)}
          >
            Edit profile
          </button>
          <button className="button secondary" onClick={() => setEdit(true)}>
            <SlidersHorizontal size={17} />
            Update data
          </button>
          <button className="button primary" onClick={() => setSupport(true)}>
            <Plus size={18} />
            Create support plan
          </button>
        </div>
      </div>
      <div className="profile-grid">
        <div>
          <section className="panel academic-panel">
            <div className="panel-heading">
              <div>
                <h2>Academic snapshot</h2>
                <p>The latest recorded indicators for this student</p>
              </div>
              <span className="small-tag">
                {student.source === "demo"
                  ? "Demo student"
                  : student.source === "manual"
                    ? "Faculty record"
                    : "Imported record"}
              </span>
            </div>
            <div className="academic-stats">
              {featureDefinitions.map((f) => (
                <div key={f.key}>
                  <span>{f.label}</span>
                  <strong>
                    {Number(student[f.key]).toFixed(f.key === "cgpa" ? 1 : 0)}
                    <small>{f.unit}</small>
                  </strong>
                  {f.max === 100 && f.key !== "lms_activity" && (
                    <div className="metric-track">
                      <i style={{ width: `${student[f.key]}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="panel-bottom muted">
              Updated {prettyDate(student.updated_at)} · {student.student_id}
            </div>
          </section>
          <section className="panel explanations-panel">
            <div className="panel-heading">
              <div className="heading-with-icon">
                <span className="blue-icon">
                  <Sparkles size={20} />
                </span>
                <div>
                  <h2>Behind this estimate</h2>
                  <p>
                    How individual inputs influence the model’s current estimate
                  </p>
                </div>
              </div>
              <span className="small-tag">Exact Shapley</span>
            </div>
            <div className="explanation-baseline">
              <span>
                Reference estimate{" "}
                <strong>{pct(student.explanation.baseline, 1)}</strong>
              </span>
              <ArrowRight size={16} />
              <span>
                Student estimate <strong>{pct(student.probability, 1)}</strong>
              </span>
            </div>
            <Explanations items={student.explanations} />
            <div className="explanation-key">
              <span>
                <i className="risk-effect" />
                Raises estimate
              </span>
              <span>
                <i className="protective-effect" />
                Lowers estimate
              </span>
            </div>
            <div className="method-note">
              <Info size={16} />
              <p>
                Exact single-reference Shapley values consider all 64 feature
                combinations. Contributions in percentage points add to the
                reference estimate to recover this prediction. The reference
                uses development-set medians, not a population average.
                Correlated inputs can form unrealistic combinations; these
                values do not prove cause.
              </p>
            </div>
          </section>
          <PredictionHistory
            key={`${student.id}-${student.predicted_at}`}
            studentId={student.id}
          />
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Support, one step at a time</h2>
                <p>A shared history of faculty follow-ups</p>
              </div>
              <button className="text-button" onClick={() => setSupport(true)}>
                <Plus size={16} />
                Add plan
              </button>
            </div>
            {student.interventions.length ? (
              <div className="profile-plans">
                {student.interventions.map((item) => (
                  <article className="profile-plan" key={item.id}>
                    <span className={`timeline-icon ${item.status}`}>
                      {item.status === "resolved" ? (
                        <Check size={18} />
                      ) : (
                        <HeartHandshake size={18} />
                      )}
                    </span>
                    <div>
                      <div className="plan-title">
                        <strong>{item.category}</strong>
                        <span className={`status-pill ${item.status}`}>
                          {item.status === "resolved" ? "Completed" : "Open"}
                        </span>
                      </div>
                      <p>{item.note}</p>
                      <small>
                        {item.owner_name} · Follow-up{" "}
                        {prettyDate(item.due_date)}
                      </small>
                      <button
                        className="text-button"
                        onClick={() => resolve(item)}
                      >
                        {item.status === "open"
                          ? "Mark complete"
                          : "Reopen plan"}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Start a supportive conversation"
                description="Create the first plan to record a next step and follow-up date."
              />
            )}
          </section>
        </div>
        <aside className="profile-side">
          <section className={`prediction-card ${student.risk}`}>
            <div className="prediction-label">
              <BrainCircuit size={20} />
              DROPOUT RISK ESTIMATE
            </div>
            <div className="prediction-number">
              {(student.probability * 100).toFixed(1)}
              <span>%</span>
            </div>
            <RiskBadge risk={student.risk} />
            <div className="risk-scale">
              <i
                style={{ left: `${Math.min(98, student.probability * 100)}%` }}
              />
            </div>
            <div className="scale-labels">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
            <p>
              {student.risk === "high"
                ? "A closer look may help. Review the academic context and arrange a supportive check-in."
                : student.risk === "moderate"
                  ? "Some signals deserve attention. A timely conversation can help clarify what support is needed."
                  : "Keep the conversation going. A lower estimate does not rule out the need for support."}
            </p>
            <div className="prediction-version">
              <ShieldCheck size={15} />
              <span>
                Estimated {prettyDate(student.predicted_at)}
                <small>{student.model_version}</small>
              </span>
            </div>
          </section>
          <section className="panel scenario-panel">
            <div className="panel-heading">
              <div className="heading-with-icon">
                <SlidersHorizontal size={18} />
                <div>
                  <h2>Explore a scenario</h2>
                  <p>Adjust inputs to see model sensitivity</p>
                </div>
              </div>
            </div>
            <div className="scenario-fields">
              {scenario &&
                featureDefinitions.map((f) => (
                  <label key={f.key}>
                    <span>
                      {f.label}
                      <strong>
                        {scenario[f.key]} <small>{f.unit}</small>
                      </strong>
                    </span>
                    <input
                      aria-label={`Scenario ${f.label}`}
                      type="range"
                      min={0}
                      max={f.max}
                      step={f.step}
                      value={scenario[f.key]}
                      onChange={(e) => {
                        setScenario({
                          ...scenario,
                          [f.key]: Number(e.target.value),
                        });
                        setResult(null);
                      }}
                    />
                  </label>
                ))}
              <Busy
                busy={busy}
                className="button primary full-width"
                onClick={simulate}
              >
                <Sparkles size={16} />
                Calculate scenario
              </Busy>
              {result && (
                <div className="scenario-result" role="status">
                  <span>Scenario estimate</span>
                  <strong>{pct(result.probability, 1)}</strong>
                  <RiskBadge risk={result.risk} />
                  <small>
                    {((result.probability - student.probability) * 100).toFixed(
                      1,
                    )}{" "}
                    percentage points from saved estimate
                  </small>
                </div>
              )}
              <button
                className="text-button centered"
                onClick={() => {
                  setScenario(extractFeatures(student));
                  setResult(null);
                }}
              >
                <RefreshCw size={14} />
                Reset inputs
              </button>
              <p className="scenario-disclaimer">
                Scenarios do not change the student record or predict the effect
                of an intervention.
              </p>
            </div>
          </section>
          <Link to="/model" className="model-help">
            <CircleHelp size={20} />
            <span>
              <strong>Understand the model</strong>
              <small>Validation, limitations & methodology</small>
            </span>
            <ArrowUpRight size={18} />
          </Link>
        </aside>
      </div>
      {profileEdit && (
        <Modal
          title="Edit student profile"
          onClose={() => setProfileEdit(false)}
        >
          <StudentForm
            student={student}
            onSaved={query.reload}
            onClose={() => setProfileEdit(false)}
          />
        </Modal>
      )}
      {support && (
        <Modal
          title={`Support plan · ${student.name}`}
          onClose={() => setSupport(false)}
        >
          <SupportForm
            studentId={student.id}
            onSaved={query.reload}
            onClose={() => setSupport(false)}
          />
        </Modal>
      )}
      {edit && (
        <Modal title="Update academic data" onClose={() => setEdit(false)}>
          <EditFeatures
            student={student}
            onSaved={query.reload}
            onClose={() => setEdit(false)}
          />
        </Modal>
      )}
    </>
  );
}

export function ImportsPage() {
  const history = useApi<Batch[]>("/imports");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState<Batch | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setInspection(null);
    setDone(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setInspection(
        await api<Inspection>("/imports/inspect", {
          method: "POST",
          body: form,
        }),
      );
      history.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function commit() {
    if (!preview) return;
    setCommitting(true);
    setError("");
    try {
      const result = await api<Batch>(`/imports/${preview.id}/commit`, {
        method: "POST",
      });
      setDone(result);
      setPreview(null);
      history.reload();
      toast(
        `${result.created + result.updated} student records imported and scored.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCommitting(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="GOOD DATA. EARLIER INSIGHT."
        title="Bring your student data together."
        description="Upload a cohort, review the details, and get risk estimates in one workflow."
      />
      <div className="import-steps">
        <span
          className={!preview && !inspection && !done ? "current" : "complete"}
        >
          <i>{preview || done ? <Check size={15} /> : 1}</i>Upload your file
        </span>
        <div />
        <span
          className={preview || inspection ? "current" : done ? "complete" : ""}
        >
          <i>{done ? <Check size={15} /> : 2}</i>Review & validate
        </span>
        <div />
        <span className={done ? "complete" : ""}>
          <i>{done ? <Check size={15} /> : 3}</i>Import & predict
        </span>
      </div>
      <div className="import-grid">
        <div>
          {error && <Notice tone="error">{error}</Notice>}
          {done && (
            <div className="import-success">
              <CheckCircle2 size={36} />
              <h2>Your student data is ready.</h2>
              <p>
                {done.created} new students · {done.updated} updated records.
                Every imported student has a fresh risk estimate.
              </p>
              <div className="page-actions">
                <Link className="button primary" to="/students">
                  Explore students
                  <ArrowRight size={17} />
                </Link>
                <button
                  className="button secondary"
                  onClick={() => setDone(null)}
                >
                  Import another file
                </button>
              </div>
            </div>
          )}
          {inspection && (
            <ColumnMapper
              inspection={inspection}
              onCancel={() => setInspection(null)}
              onMapped={(p) => {
                setPreview(p);
                setInspection(null);
                history.reload();
              }}
            />
          )}
          {!done && !inspection && (
            <section className="panel upload-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {preview
                      ? "Review your file"
                      : "Start with your student file"}
                  </h2>
                  <p>
                    {preview
                      ? preview.filename
                      : "Any headers · CSV and Excel workbooks supported"}
                  </p>
                </div>
                <span className="round-icon">
                  <FileSpreadsheet size={19} />
                </span>
              </div>
              {!preview ? (
                <div
                  className={`dropzone ${drag ? "dragging" : ""} ${busy ? "is-busy" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!busy) setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    if (!busy) upload(e.dataTransfer.files[0]);
                  }}
                >
                  <span className="upload-icon">
                    <Upload size={29} />
                  </span>
                  <h3>
                    {busy
                      ? "Checking your student data…"
                      : "A fresh perspective starts here"}
                  </h3>
                  <p>Drag and drop your file, or choose it below.</p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".csv,.xlsx"
                    className="sr-only"
                    aria-label="Upload student file"
                    onChange={(e) => upload(e.target.files?.[0])}
                    disabled={busy}
                  />
                  <Busy
                    className="button primary"
                    busy={busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    Choose a file
                    <ArrowUpRight size={16} />
                  </Busy>
                  <small>
                    CSV or XLSX · Up to 5 MB · 5,000 students per import
                  </small>
                </div>
              ) : (
                <div className="import-review">
                  <div className="review-summary">
                    <span
                      className={
                        preview.error_count
                          ? "validation-icon error"
                          : "validation-icon"
                      }
                    >
                      {preview.error_count ? (
                        <AlertTriangle size={24} />
                      ) : (
                        <FileCheck2 size={24} />
                      )}
                    </span>
                    <div>
                      <h3>
                        {preview.error_count
                          ? "A few details need attention"
                          : "All rows passed validation"}
                      </h3>
                      <p>
                        {preview.row_count} rows checked
                        {!preview.error_count &&
                          ` · ${preview.to_create} new · ${preview.to_update} existing students`}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      disabled={committing}
                      onClick={() => setPreview(null)}
                    >
                      Change file
                    </button>
                  </div>
                  {preview.error_count ? (
                    <>
                      <Notice tone="error">
                        {preview.error_count} validation issue
                        {preview.error_count === 1 ? "" : "s"}. No student
                        records have changed. Correct the file and upload it
                        again.
                      </Notice>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Row</th>
                              <th>Field</th>
                              <th>What to fix</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.errors.map((e, i) => (
                              <tr key={i}>
                                <td>{e.row}</td>
                                <td>
                                  <code>{e.field}</code>
                                </td>
                                <td>{e.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {preview.error_count > 100 && (
                        <p className="muted">Showing the first 100 issues.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Student ID</th>
                              <th>Name</th>
                              <th>Department</th>
                              <th>Attendance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.preview.map((s) => (
                              <tr key={s.student_id}>
                                <td>{s.student_id}</td>
                                <td>{s.name}</td>
                                <td>{s.department}</td>
                                <td>{s.attendance}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="muted preview-caption">
                        Showing the first {preview.preview.length} rows.
                        Existing student IDs will update their academic data;
                        support plans are retained.
                      </p>
                      <div className="import-confirm">
                        <span>
                          <ShieldCheck size={17} />
                          The full file is saved in one transaction.
                        </span>
                        <Busy
                          busy={committing}
                          className="button primary"
                          onClick={commit}
                        >
                          Import {preview.row_count} students
                          <ArrowRight size={17} />
                        </Busy>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="upload-panel-footer">
                <ShieldCheck size={17} />
                Student files stay in this application’s configured database.
              </div>
            </section>
          )}
          <section className="panel import-history">
            <div className="panel-heading">
              <div>
                <h2>Your import history</h2>
                <p>The latest files you brought into your workspace</p>
              </div>
              <button
                className="icon-button"
                aria-label="Refresh import history"
                onClick={history.reload}
              >
                <RefreshCw size={17} />
              </button>
            </div>
            {history.error ? (
              <StatusView {...history} retry={history.reload} />
            ) : history.loading ? (
              <p className="panel-padding muted">Loading imports…</p>
            ) : history.data?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Rows</th>
                      <th>Status</th>
                      <th>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <span className="file-name">
                            <FileSpreadsheet size={18} />
                            {b.filename}
                          </span>
                          {b.status === "imported" && (
                            <small className="muted">
                              {b.created} created · {b.updated} updated
                            </small>
                          )}
                        </td>
                        <td>{b.row_count}</td>
                        <td>
                          <span className={`status-pill ${b.status}`}>
                            {b.status === "ready"
                              ? "Validated"
                              : b.status === "rejected"
                                ? "Needs correction"
                                : "Imported"}
                          </span>
                        </td>
                        <td>{prettyDate(b.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="A clean slate"
                description="Your uploads and their validation results will appear here."
              />
            )}
          </section>
        </div>
        <aside>
          <section className="panel import-guide">
            <span className="guide-icon">
              <FileSpreadsheet size={24} />
            </span>
            <h2>A good place to start.</h2>
            <p>
              Use your existing spreadsheet. We’ll suggest column matches and
              let you review them before import. The template is optional.
            </p>
            <button
              className="button secondary full-width"
              onClick={() =>
                download(
                  "/imports/template?format=csv",
                  "student-template.csv",
                ).catch((e) => toast(errorMessage(e), "error"))
              }
            >
              <Download size={16} />
              Download CSV template
            </button>
            <button
              className="text-button centered"
              onClick={() =>
                download(
                  "/imports/template?format=xlsx",
                  "student-template.xlsx",
                ).catch((e) => toast(errorMessage(e), "error"))
              }
            >
              Or get the Excel template
              <ArrowUpRight size={15} />
            </button>
            <hr />
            <h3>What you’ll need</h3>
            <ul className="check-list">
              <li>
                <Check size={16} />
                <span>Student ID, name, department and semester</span>
              </li>
              <li>
                <Check size={16} />
                <span>Attendance and CGPA</span>
              </li>
              <li>
                <Check size={16} />
                <span>Backlogs and assignment completion</span>
              </li>
              <li>
                <Check size={16} />
                <span>Weekly learning sessions and credits completed</span>
              </li>
              <li>
                <Check size={16} />
                <span>Email address (optional)</span>
              </li>
            </ul>
            <div className="guide-note">
              <Info size={17} />
              <p>
                Different column names and extra columns are supported. Review
                suggested meanings and units; academic inputs still need to be
                present or calculable. XLSX reads the first worksheet.
              </p>
            </div>
          </section>
          <div className="import-principle">
            <BrainCircuit size={22} />
            <h3>Importing isn’t training.</h3>
            <p>
              Uploads receive predictions from the active model. Model training
              is a separate, documented step using observed dropout outcomes.
            </p>
            <TextLink to="/model">See model details</TextLink>
          </div>
        </aside>
      </div>
    </>
  );
}

export function ModelPage() {
  const query = useApi<ModelCard>("/model");
  const data = query.data;
  if (query.loading || query.error || !data)
    return <StatusView {...query} retry={query.reload} />;
  const metric = data.test_metrics;
  const maxImportance = Math.max(
    0.01,
    ...data.importance.map((i) => Math.abs(i.value)),
  );
  return (
    <>
      <PageTitle
        eyebrow="TRANSPARENCY BUILDS TRUST"
        title="Understand the intelligence behind the insight."
        description="A clear view of how the model was selected, evaluated, and used."
      >
        <span className="model-status">
          <span className="live-dot" />
          Active model
        </span>
      </PageTitle>
      {data.is_demo && (
        <Notice>
          <strong>Demonstration model.</strong> Trained on synthetic student
          data. These results show pipeline behavior and do not establish
          accuracy for real students.
        </Notice>
      )}
      <section className="model-hero">
        <div>
          <span className="model-hero-icon">
            <BrainCircuit size={29} />
          </span>
          <div>
            <p className="eyebrow">SELECTED MODEL</p>
            <h2>{data.selected_model}</h2>
            <p>Selected by the highest validation average precision.</p>
          </div>
        </div>
        <div className="model-hero-meta">
          <span>
            Training observations
            <strong>{data.dataset_rows.toLocaleString()}</strong>
          </span>
          <span>
            Academic features<strong>6</strong>
          </span>
          <span>
            Outcome prevalence<strong>{pct(data.positive_rate, 1)}</strong>
          </span>
          <span>
            Trained on<strong>{prettyDate(data.trained_at)}</strong>
          </span>
        </div>
      </section>
      <div className="model-metrics">
        <div className="section-inline-title">
          <h2>Held-out test performance</h2>
          <span>
            {data.split.test} students · Unseen during model selection
          </span>
        </div>
        <div className="stats-grid">
          {[
            {
              label: "ROC AUC",
              value: metric.roc_auc.toFixed(3),
              description: "Ranking across both classes",
            },
            {
              label: "Average precision",
              value: metric.average_precision.toFixed(3),
              description: "Focus on observed dropout outcomes",
            },
            {
              label: "Recall",
              value: pct(metric.recall, 1),
              description: "Dropouts found at a 50% threshold",
            },
            {
              label: "Brier score",
              value: metric.brier.toFixed(3),
              description: "Probability error · Lower is better",
            },
          ].map((m) => (
            <div className="stat-card" key={m.label}>
              <span className="muted">{m.label}</span>
              <strong className="stat-value">{m.value}</strong>
              <small className="muted">{m.description}</small>
            </div>
          ))}
        </div>
      </div>
      <section className="panel model-comparison">
        <div className="panel-heading">
          <div>
            <h2>The right model is earned, not assumed.</h2>
            <p>
              Validation-set comparison · {data.split.validation} observations ·
              Best average precision wins
            </p>
          </div>
          <span className="small-tag">
            {data.comparison.length} models evaluated
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Average precision</th>
                <th>ROC AUC</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1 score</th>
              </tr>
            </thead>
            <tbody>
              {data.comparison.map((m, i) => (
                <tr className={i === 0 ? "selected-model" : ""} key={m.name}>
                  <td>
                    <span className="model-name">
                      {i === 0 && <ShieldCheck size={18} />}
                      <strong>{m.name}</strong>
                      {i === 0 && (
                        <span className="selected-tag">SELECTED</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <strong>{m.average_precision.toFixed(3)}</strong>
                  </td>
                  <td>{m.roc_auc.toFixed(3)}</td>
                  <td>{pct(m.precision, 1)}</td>
                  <td>{pct(m.recall, 1)}</td>
                  <td>{m.f1.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-bottom muted">
          Classification metrics use a 50% threshold. Faculty risk bands use 30%
          and 60%; the two serve different purposes.
        </div>
      </section>
      <ModelDiagnostics diagnostics={data.diagnostics} />
      <div className="model-detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>What the model pays attention to</h2>
              <p>
                Test-set permutation importance · Average precision decrease
              </p>
            </div>
          </div>
          <div className="importance-chart">
            {[...data.importance]
              .sort((a, b) => b.value - a.value)
              .map((i) => (
                <div key={i.feature}>
                  <span>{i.label}</span>
                  <div className="importance-track">
                    <i
                      style={{
                        width: `${(Math.abs(i.value) / maxImportance) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{i.value.toFixed(3)}</strong>
                </div>
              ))}
          </div>
          <div className="method-note">
            <Info size={16} />
            <p>
              Each feature is shuffled five times. A larger score decrease means
              the model relied more on that feature on this test set. Correlated
              inputs can share importance.
            </p>
          </div>
        </section>
        <section className="panel evaluation-panel">
          <div className="panel-heading">
            <div>
              <h2>A closer look at test results</h2>
              <p>Observed outcome vs. predicted class at 50%</p>
            </div>
          </div>
          <div className="confusion-matrix">
            <span />
            <span>Predicted continuing</span>
            <span>Predicted dropout</span>
            <span>Observed continuing</span>
            <strong className="correct">
              {metric.confusion_matrix[0][0]}
              <small>True negatives</small>
            </strong>
            <strong>
              {metric.confusion_matrix[0][1]}
              <small>False positives</small>
            </strong>
            <span>Observed dropout</span>
            <strong>
              {metric.confusion_matrix[1][0]}
              <small>False negatives</small>
            </strong>
            <strong className="correct">
              {metric.confusion_matrix[1][1]}
              <small>True positives</small>
            </strong>
          </div>
          <p className="panel-padding muted">
            Accuracy {pct(metric.accuracy, 1)} · Precision{" "}
            {pct(metric.precision, 1)} · F1 {metric.f1.toFixed(3)}
          </p>
        </section>
      </div>
      <section className="panel methodology-panel">
        <div>
          <span className="blue-icon">
            <ShieldCheck size={23} />
          </span>
          <h2>
            Built to inform.
            <br />
            Guided by people.
          </h2>
          <p>
            The model identifies patterns in academic indicators. Faculty bring
            the context, judgment, and care.
          </p>
          <div className="split-visual">
            <span style={{ flex: 3 }}>60% train</span>
            <span>20% validate</span>
            <span>20% test</span>
          </div>
          <small>
            Stratified split · Seed {data.split.seed} · Selected model refit on
            training + validation data.
          </small>
        </div>
        <div>
          <h3>What to keep in mind</h3>
          <ul className="limitations">
            {data.limitations.map((l) => (
              <li key={l}>
                <Info size={16} />
                {l}
              </li>
            ))}
          </ul>
          <div className="model-provenance">
            <span>
              Source <strong>{data.source}</strong>
            </span>
            <span>
              Model version <code>{data.version}</code>
            </span>
            <span>
              Dataset fingerprint{" "}
              <code title={data.fingerprint}>
                {data.fingerprint.slice(0, 20)}…
              </code>
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

export function InterventionsPage() {
  const [filter, setFilter] = useState("open");
  const query = useApi<Intervention[]>(`/interventions?status=${filter}`);
  const toast = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  async function update(item: Intervention) {
    setBusyId(item.id);
    try {
      await api(`/interventions/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: item.status === "open" ? "resolved" : "open",
        }),
      });
      toast(
        item.status === "open"
          ? "Support plan completed."
          : "Support plan reopened.",
      );
      query.reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusyId(null);
    }
  }
  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return (
    <>
      <PageTitle
        eyebrow="FROM INSIGHT TO A CONVERSATION"
        title="Small steps. Meaningful support."
        description="Keep student follow-ups in view and give every next step a place to live."
      >
        <Link className="button primary" to="/students">
          <Plus size={18} />
          Choose a student
        </Link>
      </PageTitle>
      <div className="support-page-top">
        <div className="segment-tabs">
          {[
            ["open", "Open plans"],
            ["resolved", "Completed"],
            ["all", "All plans"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={filter === v ? "selected" : ""}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="muted">{query.data?.length ?? "…"} support plans</span>
      </div>
      {query.loading || query.error ? (
        <StatusView {...query} retry={query.reload} />
      ) : query.data?.length ? (
        <div className="support-cards">
          {query.data.map((item) => (
            <article className="panel support-card" key={item.id}>
              <div className="support-card-top">
                <Link
                  className="student-name"
                  to={`/students/${item.student_id}`}
                >
                  <Avatar name={item.student_name} />
                  <span>
                    <strong>{item.student_name}</strong>
                    <small>{item.student_code}</small>
                  </span>
                </Link>
                <span className={`status-pill ${item.status}`}>
                  {item.status === "open" ? "Open" : "Completed"}
                </span>
              </div>
              <h3>{item.category}</h3>
              <p>{item.note}</p>
              <div
                className={`support-due ${item.status === "open" && item.due_date < todayString ? "overdue" : ""}`}
              >
                <CalendarDays size={15} />
                {prettyDate(item.due_date)}
                {item.status === "open" && item.due_date < todayString && (
                  <span>Follow-up due</span>
                )}
              </div>
              <div className="support-owner">
                <span>
                  Assigned to <strong>{item.owner_name}</strong>
                </span>
              </div>
              <div className="support-card-actions">
                <Link className="text-link" to={`/students/${item.student_id}`}>
                  Student profile
                  <ArrowUpRight size={16} />
                </Link>
                <Busy
                  className="button secondary small"
                  busy={busyId === item.id}
                  onClick={() => update(item)}
                >
                  {item.status === "open" ? (
                    <Check size={16} />
                  ) : (
                    <RefreshCw size={15} />
                  )}{" "}
                  {item.status === "open" ? "Mark complete" : "Reopen"}
                </Busy>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            filter === "resolved"
              ? "No completed plans yet"
              : "No support plans in this view"
          }
          description="Open a student profile to create a support plan and choose a follow-up date."
        >
          <Link className="button primary" to="/students">
            Explore students
            <ArrowRight size={16} />
          </Link>
        </Empty>
      )}
    </>
  );
}

function AuditPanel() {
  const query =
    useApi<
      { id: number; action: string; detail: string; created_at: string }[]
    >("/audit");
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Workspace activity</h2>
          <p>Recent audited actions · Administrator view</p>
        </div>
      </div>
      {query.loading || query.error ? (
        <StatusView {...query} retry={query.reload} />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Detail</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((a) => (
                <tr key={a.id}>
                  <td>{a.action}</td>
                  <td>{a.detail}</td>
                  <td>{prettyDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SettingsPage() {
  const { user, expire } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function change(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/auth/password", {
        method: "POST",
        body: JSON.stringify({
          current_password: current,
          new_password: password,
        }),
      });
      toast("Password changed. Sign in with your new password.");
      navigate("/");
      expire();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR WORKSPACE"
        title="A few things, just for you."
        description="Your institution account, access details, and sign-in security."
      />
      <div className="settings-grid">
        <section className="panel account-panel">
          <div className="panel-heading">
            <h2>Your account</h2>
            <ShieldCheck size={20} />
          </div>
          <div className="account-identity">
            <Avatar name={user.name} large />
            <h2>{user.name}</h2>
            <span className="small-tag">
              {user.role === "admin"
                ? "Administrator"
                : user.role === "student"
                  ? "Student"
                  : "Professor"}
            </span>
          </div>
          <dl className="account-details">
            <div>
              <dt>Email address</dt>
              <dd>{user.email || "Enrollment-based sign-in"}</dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd>Campus · Student success</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>
                {user.role === "student"
                  ? "Your own academic record and shared support plans"
                  : "Campus student records, imports, predictions and support plans"}
                {user.role === "admin"
                  ? ", plus activity audit and account issuance"
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>8-hour secure server session</dd>
            </div>
          </dl>
          <div className="method-note">
            <Info size={16} />
            <p>Account provisioning is managed by your campus administrator.</p>
          </div>
        </section>
        <section className="panel password-panel">
          <div className="panel-heading">
            <div>
              <h2>Keep your account secure</h2>
              <p>Choose a unique password with at least 12 characters.</p>
            </div>
            <LockKeyhole size={21} />
          </div>
          <form className="settings-form" onSubmit={change}>
            {error && <Notice tone="error">{error}</Notice>}
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <p className="muted">
              Changing your password signs you out on every device.
            </p>
            <Busy className="button primary" busy={busy}>
              Update password
              <ArrowRight size={17} />
            </Busy>
          </form>
        </section>
      </div>
      {user.role === "admin" && <AuditPanel />}
    </>
  );
}
