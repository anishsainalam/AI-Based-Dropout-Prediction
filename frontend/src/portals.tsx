import { useState, type FormEvent } from "react";
import {
  GraduationCap,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  HeartHandshake,
  LogOut,
  Settings,
  ArrowLeft,
  KeyRound,
  UserPlus,
  Search,
  LockKeyhole,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { api, setCsrf, useApi, errorMessage } from "./api";
import {
  Avatar,
  Brand,
  Busy,
  Empty,
  Modal,
  Notice,
  PageTitle,
  StatusView,
  prettyDate,
} from "./components";
import { useAuth, useToast } from "./main";
import { SettingsPage } from "./pages";
import type { Features, User, StudentList } from "./types";

export function PortalLogin({
  onLogin,
  demo,
}: {
  onLogin: (user: User) => void;
  demo: boolean;
}) {
  const [portal, setPortal] = useState<"professor" | "student">("professor");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(
    e?: FormEvent,
    example?: "professor" | "student" | "admin",
  ) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const p =
      example === "student" ? "student" : example ? "professor" : portal;
    try {
      const result = await api<{ user: User; csrf: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          portal: p,
          email:
            p === "professor"
              ? example === "admin"
                ? "admin@continuum.demo"
                : example
                  ? "faculty@continuum.demo"
                  : identity
              : "",
          enrollment_number:
            p === "student" ? (example ? "STU2024001" : identity) : "",
          password:
            example === "student"
              ? "StudentDemo@2026"
              : example === "admin"
                ? "ContinuumAdmin@2026"
                : example
                  ? "Continuum@2026"
                  : password,
        }),
      });
      setCsrf(result.csrf);
      onLogin(result.user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand inverse />
        <div className="login-story-content">
          <span className="story-kicker">
            <span /> THE STUDENT SUCCESS WORKSPACE
          </span>
          <h1>
            See the signals.
            <br />
            Support the
            <br />
            <em>possibilities.</em>
          </h1>
          <p>
            A connected space for students and the professors
            <br />
            who help them move forward.
          </p>
          <div className="story-visual">
            <div className="story-orbit">
              <GraduationCap size={36} />
            </div>
            <div className="story-signal">
              <span className="story-signal-icon">
                <HeartHandshake size={20} />
              </span>
              <div>
                <strong>One institution. Connected support.</strong>
                <span>Private access to the right information</span>
              </div>
            </div>
          </div>
        </div>
        <p className="login-story-footer">
          Built around students. Designed for the people who guide them.
        </p>
      </section>
      <main className="login-panel">
        <div className="login-top">
          <ShieldCheck size={17} />
          Institution-managed access
        </div>
        <div className="login-form portal-login">
          <span className="eyebrow">WELCOME TO CONTINUUM</span>
          <h2>
            Your next step
            <br />
            starts here.
          </h2>
          <p className="muted">Choose your workspace to sign in.</p>
          <div className="portal-choice" aria-label="Choose sign-in section">
            <button
              type="button"
              className={portal === "professor" ? "selected" : ""}
              aria-pressed={portal === "professor"}
              onClick={() => {
                setPortal("professor");
                setIdentity("");
                setPassword("");
                setError("");
              }}
            >
              <ShieldCheck size={20} />
              <span>
                Professor<small>Faculty & administrators</small>
              </span>
            </button>
            <button
              type="button"
              className={portal === "student" ? "selected" : ""}
              aria-pressed={portal === "student"}
              onClick={() => {
                setPortal("student");
                setIdentity("");
                setPassword("");
                setError("");
              }}
            >
              <GraduationCap size={22} />
              <span>
                Student<small>Your personal workspace</small>
              </span>
            </button>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <form onSubmit={login}>
            <label>
              {portal === "student" ? "Enrollment number" : "Institution email"}
              <input
                type={portal === "student" ? "text" : "email"}
                autoComplete="username"
                required
                maxLength={160}
                placeholder={
                  portal === "student"
                    ? "Enter your enrollment number"
                    : "you@institution.edu"
                }
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  placeholder={
                    portal === "student"
                      ? "Password issued by your institution"
                      : "Enter your password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <Busy busy={busy} className="button primary login-submit">
              Sign in as {portal}
              <ArrowRight size={17} />
            </Busy>
          </form>
          <p className="institution-note">
            <LockKeyhole size={15} />
            {portal === "student"
              ? "Student accounts are issued by your institution. To get access or reset a forgotten password, contact your administrator."
              : "Faculty accounts are provisioned by your institution. There is no public registration."}
          </p>
          {demo && (
            <>
              <div className="or-divider">
                <span />
                FICTIONAL DATA ONLY
                <span />
              </div>
              <Busy
                busy={busy}
                className="button secondary login-submit"
                onClick={() => login(undefined, portal)}
              >
                Explore {portal} demo
                <ArrowRight size={16} />
              </Busy>
              {portal === "professor" && (
                <button
                  className="text-button centered admin-demo"
                  disabled={busy}
                  onClick={() => login(undefined, "admin")}
                >
                  Organization administrator demo
                  <ArrowRight size={14} />
                </button>
              )}
            </>
          )}
        </div>
        <p className="login-footer">
          Continuum · Personal access. Shared purpose.
        </p>
      </main>
    </div>
  );
}

type StudentHome = Features & {
  student_id: string;
  name: string;
  email: string;
  department: string;
  semester: number;
  updated_at: string;
  support_plans: {
    id: number;
    category: string;
    note: string;
    due_date: string;
    status: string;
    professor: string;
  }[];
};
function StudentHomePage() {
  const query = useApi<StudentHome>("/student/me");
  const data = query.data;
  if (query.loading || query.error || !data)
    return <StatusView {...query} retry={query.reload} />;
  return (
    <>
      <PageTitle
        eyebrow="YOUR JOURNEY, CONNECTED"
        title={`Good to see you, ${data.name.split(" ")[0]}.`}
        description="A clear view of your academic progress and the next steps you’ve agreed with your professors."
      />
      <section className="student-welcome">
        <Avatar name={data.name} large />
        <div>
          <h2>{data.name}</h2>
          <p>
            {data.student_id} · {data.department} · Semester {data.semester}
          </p>
          <small>
            Only you and authorized staff can access your academic record.
          </small>
        </div>
        <span>
          <ShieldCheck size={20} />
          Your private workspace
        </span>
      </section>
      <div className="student-metric-grid">
        {[
          {
            label: "Attendance",
            value: `${data.attendance.toFixed(1)}%`,
            detail: "Of scheduled classes",
          },
          {
            label: "CGPA",
            value: data.cgpa.toFixed(2),
            detail: "On a 10-point scale",
          },
          {
            label: "Assignments completed",
            value: `${data.assignment_completion.toFixed(1)}%`,
            detail: "Of assignments due",
          },
          {
            label: "Credits completed",
            value: `${data.credits_ratio.toFixed(1)}%`,
            detail: "Of credits expected",
          },
          {
            label: "Active backlogs",
            value: data.backlogs,
            detail: "Courses to focus on",
          },
          {
            label: "Weekly learning activity",
            value: data.lms_activity.toFixed(1),
            detail: "Average learning sessions",
          },
        ].map((m) => (
          <div className="stat-card" key={m.label}>
            <span className="muted">{m.label}</span>
            <strong className="stat-value">{m.value}</strong>
            <small className="muted">{m.detail}</small>
          </div>
        ))}
      </div>
      <section className="panel student-next">
        <div className="panel-heading">
          <div className="heading-with-icon">
            <span className="blue-icon">
              <HeartHandshake size={21} />
            </span>
            <div>
              <h2>Your next steps</h2>
              <p>Support plans your professors have shared with you</p>
            </div>
          </div>
        </div>
        {data.support_plans.length ? (
          <div className="student-shared-plans">
            {data.support_plans.map((p) => (
              <article key={p.id}>
                <div>
                  <h3>{p.category}</h3>
                  <span className={`status-pill ${p.status}`}>
                    {p.status === "resolved" ? "Completed" : "Open"}
                  </span>
                </div>
                <p>{p.note}</p>
                <small>
                  <CalendarDays size={15} />
                  Follow-up {prettyDate(p.due_date)} · {p.professor}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="Your next chapter is open"
            description="When your professor shares a support plan, you’ll find it here. Reach out to your department whenever you need help."
          />
        )}
      </section>
      <p className="page-note">
        <ShieldCheck size={15} />
        Academic data is maintained by your institution. If something looks
        incorrect, contact your professor. Last updated{" "}
        {prettyDate(data.updated_at)}.
      </p>
    </>
  );
}

export function StudentPortal() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(user.must_change_password);
  const toast = useToast();
  return (
    <div className="student-portal">
      <header className="student-portal-header">
        <Brand />
        <span className="student-portal-label">
          <GraduationCap size={18} />
          Student workspace
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Student account settings"
            onClick={() => setSettings(!settings)}
          >
            <Settings size={19} />
          </button>
          <Avatar name={user.name} />
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={() =>
              logout().catch((e) => toast(errorMessage(e), "error"))
            }
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="student-portal-main">
        {user.must_change_password && (
          <Notice>
            <strong>Make this account yours.</strong> Change the temporary
            password issued by your institution before opening your academic
            record.
          </Notice>
        )}
        {settings || user.must_change_password ? (
          <>
            {!user.must_change_password && (
              <button
                className="back-link text-button"
                onClick={() => setSettings(false)}
              >
                <ArrowLeft size={16} />
                Back to my progress
              </button>
            )}
            <SettingsPage />
          </>
        ) : (
          <StudentHomePage />
        )}
      </main>
      <footer className="student-portal-footer">
        Continuum · Your progress, supported.
      </footer>
    </div>
  );
}

type Account = {
  id: number;
  student_id: number;
  enrollment_number: string;
  name: string;
  department: string;
  active: boolean;
  must_change_password: boolean;
};
type Issued = Account & { temporary_password: string; message: string };
export function AccountsPage() {
  const { user } = useAuth();
  if (user.role !== "admin")
    return (
      <Notice tone="error">
        Only your organization administrator can issue student accounts.
      </Notice>
    );
  return <AccountManagement />;
}
function AccountManagement() {
  const accounts = useApi<Account[]>("/admin/student-accounts");
  const [search, setSearch] = useState("");
  const students = useApi<StudentList>(
    `/students?search=${encodeURIComponent(search)}&sort=name&page_size=30`,
  );
  const [issued, setIssued] = useState<Issued | null>(null);
  const [reset, setReset] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  async function issue(id: number, resetting = false) {
    setBusy(true);
    try {
      const result = await api<Issued>(
        resetting
          ? `/admin/student-accounts/${id}/reset-password`
          : "/admin/student-accounts",
        {
          method: "POST",
          body: resetting ? undefined : JSON.stringify({ student_id: id }),
        },
      );
      setReset(null);
      setShowCreate(false);
      setIssued(result);
      accounts.reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(a: Account) {
    setBusy(true);
    try {
      await api(`/admin/student-accounts/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !a.active }),
      });
      toast(
        a.active
          ? "Student access suspended; existing sessions revoked."
          : "Student access restored.",
      );
      accounts.reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="ORGANIZATION ACCESS CONTROL"
        title="The right access. Issued by you."
        description="Create enrollment-based student accounts, reset credentials, and control access."
      >
        <button className="button primary" onClick={() => setShowCreate(true)}>
          <UserPlus size={18} />
          Issue student account
        </button>
      </PageTitle>
      <Notice>
        <ShieldCheck size={16} />
        Students cannot register themselves. Temporary passwords are shown once,
        stored only as hashes, and must be changed at first sign-in.
      </Notice>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Student accounts</h2>
            <p>{accounts.data?.length ?? 0} organization-issued accounts</p>
          </div>
        </div>
        {accounts.loading || accounts.error ? (
          <StatusView {...accounts} retry={accounts.reload} />
        ) : accounts.data?.length ? (
          <div className="table-scroll">
            <table className="account-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Enrollment number</th>
                  <th>Access</th>
                  <th>Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.data.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.name}</strong>
                      <small>{a.department}</small>
                    </td>
                    <td>{a.enrollment_number}</td>
                    <td>
                      <span
                        className={`status-pill ${a.active ? "resolved" : "rejected"}`}
                      >
                        {a.active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td>
                      {a.must_change_password
                        ? "Change required"
                        : "Personal password set"}
                    </td>
                    <td>
                      <div className="account-actions">
                        <button
                          className="button secondary small"
                          disabled={busy}
                          onClick={() => setReset(a)}
                        >
                          <KeyRound size={14} />
                          Reset
                        </button>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => toggle(a)}
                        >
                          {a.active ? "Suspend" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Issue your first student account"
            description="Import a student record, then issue access using their enrollment number."
          />
        )}
      </section>
      {showCreate && (
        <Modal
          title="Issue a student account"
          onClose={() => setShowCreate(false)}
        >
          <div className="modal-form">
            <p className="muted">
              Choose an imported student. Their enrollment number becomes their
              sign-in ID.
            </p>
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Find student to issue account"
                placeholder="Name or enrollment number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="provision-list">
              {students.data?.items.map((s) => {
                const exists = accounts.data?.some(
                  (a) => a.student_id === s.id,
                );
                return (
                  <div key={s.id}>
                    <Avatar name={s.name} />
                    <div>
                      <strong>{s.name}</strong>
                      <small>{s.student_id}</small>
                    </div>
                    <Busy
                      busy={busy}
                      className="button secondary small"
                      disabled={exists}
                      onClick={() => issue(s.id)}
                    >
                      {exists ? "Already issued" : "Issue access"}
                    </Busy>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal
          title={`Reset access · ${reset.name}`}
          onClose={() => setReset(null)}
        >
          <div className="modal-form">
            <p className="muted">
              This replaces the current password with a temporary password and
              signs the student out on all devices. You will need to share the
              new password privately.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setReset(null)}
              >
                Cancel
              </button>
              <Busy
                busy={busy}
                className="button primary"
                onClick={() => issue(reset.id, true)}
              >
                Reset password
              </Busy>
            </div>
          </div>
        </Modal>
      )}
      {issued && (
        <Modal title="Student access is ready" onClose={() => setIssued(null)}>
          <div className="modal-form">
            <Notice tone="success">
              <CheckCircle2 size={16} />
              Account issued for {issued.name}.
            </Notice>
            <div className="issued-credentials">
              <label>
                Enrollment number
                <input readOnly value={issued.enrollment_number} />
              </label>
              <label>
                Temporary password
                <input
                  readOnly
                  value={issued.temporary_password}
                  autoComplete="off"
                />
              </label>
            </div>
            <p className="credentials-warning">
              Share these credentials privately with this student. The temporary
              password will not be shown again after this window closes. The
              student must change it on first sign-in.
            </p>
            <div className="modal-actions">
              <button
                className="button primary"
                onClick={() => setIssued(null)}
              >
                I’ve saved the credentials
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
