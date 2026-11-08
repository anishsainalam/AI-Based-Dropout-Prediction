import { useState } from "react";
import { ArrowRight, Check, Info } from "lucide-react";
import { api, errorMessage } from "./api";
import { Busy, Notice } from "./components";
import type { Preview } from "./types";
export type Inspection = {
  id: string;
  filename: string;
  row_count: number;
  columns: string[];
  sample: Record<string, string>[];
  mapping: Record<string, string>;
  confidence: Record<string, string>;
  fields: { key: string; label: string; required: boolean; derived: boolean }[];
};
export function ColumnMapper({
  inspection,
  onMapped,
  onCancel,
}: {
  inspection: Inspection;
  onMapped: (p: Preview) => void;
  onCancel: () => void;
}) {
  const [mapping, setMapping] = useState(inspection.mapping);
  const [transforms, setTransforms] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const count = Object.values(mapping).filter(Boolean).length;
  async function validate() {
    setBusy(true);
    setError("");
    try {
      onMapped(
        await api<Preview>(`/imports/${inspection.id}/map`, {
          method: "POST",
          body: JSON.stringify({ mapping, transforms, defaults }),
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function field(f: Inspection["fields"][number]) {
    return (
      <div className="mapping-row" key={f.key}>
        <div>
          <strong>
            {f.label}
            {f.required && <span className="required-star">*</span>}
          </strong>
          <small>
            {inspection.confidence[f.key] || "Choose the matching column"}
          </small>
        </div>
        <div>
          <select
            aria-label={`Column for ${f.label}`}
            value={mapping[f.key] || ""}
            onChange={(e) => {
              setMapping({ ...mapping, [f.key]: e.target.value });
              setConfirmed(false);
            }}
          >
            <option value="">
              {f.required
                ? "Select column or use a calculation below"
                : "Not used"}
            </option>
            {inspection.columns.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {mapping[f.key] && (
            <small className="mapping-sample">
              Example: {inspection.sample[0]?.[mapping[f.key]] || "(empty)"}
            </small>
          )}
          {["department", "semester"].includes(f.key) && !mapping[f.key] && (
            <input
              type={f.key === "semester" ? "number" : "text"}
              aria-label={`Common ${f.label}`}
              placeholder={`Or set ${f.label.toLowerCase()} for every row`}
              min={1}
              max={12}
              value={defaults[f.key] || ""}
              onChange={(e) =>
                setDefaults({ ...defaults, [f.key]: e.target.value })
              }
            />
          )}
        </div>
        {[
          "attendance",
          "assignment_completion",
          "credits_ratio",
          "cgpa",
        ].includes(f.key) ? (
          <select
            aria-label={`Unit conversion for ${f.label}`}
            value={transforms[f.key] || "identity"}
            onChange={(e) => {
              setTransforms({ ...transforms, [f.key]: e.target.value });
              setConfirmed(false);
            }}
          >
            <option value="identity">
              {f.key === "cgpa" ? "Already on 0–10 scale" : "Already 0–100%"}
            </option>
            {f.key === "cgpa" ? (
              <>
                <option value="gpa4_to10">Convert 0–4 GPA → 0–10</option>
                <option value="marks100_to10">Approved score % → 0–10</option>
              </>
            ) : (
              <option value="fraction_to_percent">
                Convert 0–1 fraction → %
              </option>
            )}
          </select>
        ) : (
          <span />
        )}
      </div>
    );
  }
  return (
    <section className="panel column-mapper">
      <div className="panel-heading">
        <div>
          <h2>Different headers. One clear meaning.</h2>
          <p>
            {inspection.filename} · {inspection.row_count} rows · {count} fields
            suggested
          </p>
        </div>
        <button className="text-button" onClick={onCancel} disabled={busy}>
          Change file
        </button>
      </div>
      <div className="mapper-intro">
        <Info size={18} />
        <p>
          We recognized common column names. Check each match and its unit
          before continuing. Unmapped extra columns are ignored; missing
          academic values are never invented.
        </p>
      </div>
      {error && (
        <div className="mapper-error">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mapping-header">
        <span>Information we need</span>
        <span>Your file’s column</span>
        <span>Units / conversion</span>
      </div>
      {inspection.fields.filter((f) => !f.derived).map(field)}
      <details className="mapping-derived">
        <summary>
          Have counts instead of percentages? Calculate them here.
        </summary>
        <p>
          Use attended / total classes for attendance, completed / total
          assignments for assignment completion, or earned / expected credits
          for credit completion. Leave the corresponding percentage field above
          unmapped.
        </p>
        {inspection.fields.filter((f) => f.derived).map(field)}
      </details>
      <div className="mapper-footer">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            I’ve checked the column meanings and scales, including any
            conversions.
          </span>
        </label>
        <p>
          GPA/score conversions require your institution’s approval. Different
          grading systems are not automatically equivalent.
        </p>
        <Busy
          className="button primary"
          disabled={!confirmed}
          busy={busy}
          onClick={validate}
        >
          <Check size={16} />
          Validate mapped data
          <ArrowRight size={17} />
        </Busy>
      </div>
    </section>
  );
}
