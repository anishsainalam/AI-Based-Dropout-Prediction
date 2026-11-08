import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  AlertCircle,
  X,
  LoaderCircle,
  Inbox,
  CheckCircle2,
} from "lucide-react";
import type { Risk, Student, Explanation } from "./types";

export const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;
export const prettyDate = (s: string) =>
  new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand ${inverse ? "inverse" : ""}`}>
      <span className="brand-mark">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d="M27 12a11 11 0 1 0 0 16M14 20h14m-5-5 5 5-5 5" />
        </svg>
      </span>
      <span>
        continuum<span className="brand-period">.</span>
      </span>
    </span>
  );
}
export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span className={`risk-badge ${risk}`}>
      <span />
      {risk === "high"
        ? "High risk"
        : risk === "moderate"
          ? "Medium"
          : "Low risk"}
    </span>
  );
}
export function Avatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const sum = [...name].reduce((a, b) => a + b.charCodeAt(0), 0);
  return (
    <span className={`avatar avatar-${sum % 5} ${large ? "large" : ""}`}>
      {name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function StatusView({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (error)
    return (
      <div className="state-card" role="alert">
        <AlertCircle size={32} />
        <h3>We couldn’t load this view</h3>
        <p>{error}</p>
        <button className="button secondary" onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (loading)
    return (
      <div className="loading-view" role="status" aria-label="Loading">
        <div className="skeleton wide" />
        <div className="loading-grid">
          {[1, 2, 3, 4].map((i) => (
            <div className="skeleton tile" key={i} />
          ))}
        </div>
        <div className="skeleton block" />
      </div>
    );
  return null;
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="state-card">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Busy({
  children,
  busy,
  ...props
}: {
  children: ReactNode;
  busy: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} disabled={busy || props.disabled}>
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {tone === "success" ? (
        <CheckCircle2 size={18} />
      ) : (
        <AlertCircle size={18} />
      )}
      <div>{children}</div>
    </div>
  );
}
export function StudentTable({
  students,
  compact = false,
}: {
  students: Student[];
  compact?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="student-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Department</th>
            <th>Attendance</th>
            {!compact && <th>CGPA</th>}
            <th>Dropout risk</th>
            <th>
              <span className="sr-only">Open profile</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>
                <Link className="student-name" to={`/students/${s.id}`}>
                  <Avatar name={s.name} />
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {s.student_id} <span className="subtle-divider">/</span>{" "}
                      Sem {s.semester}
                    </small>
                  </span>
                </Link>
              </td>
              <td>
                <span className="department-text">{s.department}</span>
              </td>
              <td>
                <div className="attendance-cell">
                  <span className={s.attendance < 65 ? "danger-text" : ""}>
                    {s.attendance.toFixed(0)}%
                  </span>
                  <span className="mini-track">
                    <i
                      style={{ width: `${s.attendance}%` }}
                      className={s.attendance < 65 ? "orange" : ""}
                    />
                  </span>
                </div>
              </td>
              {!compact && (
                <td>
                  {s.cgpa.toFixed(1)}
                  <span className="muted"> / 10</span>
                </td>
              )}
              <td>
                <div className="risk-cell">
                  <RiskBadge risk={s.risk} />
                  <span className="probability">{pct(s.probability)}</span>
                </div>
              </td>
              <td>
                <Link
                  className="icon-button"
                  to={`/students/${s.id}`}
                  aria-label={`View ${s.name}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Explanations({ items }: { items: Explanation[] }) {
  const max = Math.max(0.08, ...items.map((i) => Math.abs(i.effect)));
  return (
    <div className="explanations">
      {items.map((item) => (
        <div className="explanation" key={item.feature}>
          <div className="explanation-label">
            <span>{item.label}</span>
            <strong className={item.effect > 0 ? "danger-text" : "blue-text"}>
              {item.effect > 0 ? "+" : ""}
              {(item.effect * 100).toFixed(1)} <small>pp</small>
            </strong>
          </div>
          <div className="effect-track">
            <i
              className={item.effect > 0 ? "risk-effect" : "protective-effect"}
              style={{ width: `${(Math.abs(item.effect) / max) * 100}%` }}
            />
          </div>
          <small>
            Student: {item.value} · Reference: {item.reference}
          </small>
        </div>
      ))}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function TextLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}
