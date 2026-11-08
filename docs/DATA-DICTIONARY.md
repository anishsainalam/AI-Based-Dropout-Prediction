# Data contract

CSV must be UTF-8 (BOM accepted); comma, semicolon, tab, and pipe delimiters are detected. XLSX imports read only the first worksheet. **Your file can use different column names**: the interface suggests common aliases and lets you map any unfamiliar header. Matching is a reviewed rules-based process, not a guarantee of understanding arbitrary data. Duplicate headers are rejected; extra unmapped columns are ignored. Limits: 5 MB, 5,000 non-empty rows, 100 columns, and 30 MB expanded XLSX contents.

The table below describes the normalized meanings the current model needs, not mandatory upload header names. Attendance can be calculated from attended/total classes, assignment completion from completed/total assignments, and credit completion from earned/expected credits. Fraction-to-percentage and institution-approved GPA conversions are explicit options. Department and semester may use a reviewed common value. Missing academic measurements cannot be invented.

| Column | Type / range | Meaning |
|---|---|---|
| student_id | 2–40 characters; letters, numbers, `_`, `-` | Stable unique student key. Matching keys update existing students. |
| name | 2–100 characters | Display name; not a model input. |
| email | Optional valid email, up to 160 characters | Faculty reference; not a model input. No emails are sent. |
| department | 2–80 characters | Cohort filter and chart grouping; not a model input. |
| semester | Integer 1–12 | Student context; not a model input. |
| attendance | Decimal 0–100 | Percentage of scheduled classes attended in the agreed observation period. |
| cgpa | Decimal 0–10 | Cumulative grade point average on a 10-point scale. Convert consistently before import. |
| backlogs | Integer 0–20 | Number of unresolved course backlogs at observation time. |
| assignment_completion | Decimal 0–100 | Percentage of due assignments completed in the observation period. |
| lms_activity | Decimal 0–100 | Average weekly learning-platform sessions in the observation period. Fractional averages are valid. |
| credits_ratio | Decimal 0–100 | Earned credits divided by expected credits at the observation date, times 100. |

The six numeric academic fields are the only features used by the model. Missing numeric inputs are rejected at the product boundary; the pipeline includes median imputation for modularity, but the supplied training command also requires complete, valid inputs. There is no silent guessing of missing academic data.

For **training only**, include `dropout`: `1` for an observed dropout outcome, `0` for an observed non-dropout outcome. A current student without a mature outcome must not be labeled `0` simply because they are still enrolled. Define the observation date, prediction horizon, withdrawal criteria and censoring rules consistently. Training needs at least 100 rows and 20 examples in each outcome class; these are software minimums, not evidence of sufficient statistical power.

One row per student is expected during training. If `student_id` is supplied, duplicate IDs are rejected. Repeated observations require a grouped and temporal split implemented before evaluation. Avoid features recorded after withdrawal or other outcome leakage.

## Import behavior

1. Upload: inspect the file, review suggested mappings and units, then validate every mapped row. Sources and previews belong to the signed-in staff user.
2. Any validation error rejects the entire batch. No student changes occur.
3. A valid preview displays new/update counts and the first five rows.
4. Commit creates or updates all records in one transaction and scores each row.
5. A repeated commit returns its original result without duplicating students.

Existing support plans are retained on student updates. Importing does not retrain the model. Exported reports can be mapped again; leave prediction columns unmapped because they are outputs, not training inputs. The original strict preview API remains available for canonical integrations.

## Risk bands

- **Low:** probability below 0.30.
- **Moderate:** probability from 0.30 up to, but excluding, 0.60.
- **High:** probability at least 0.60.

Band assignment uses the unrounded probability. Display rounding may show 30% or 60% at a boundary. The model evaluation screen uses a separate 0.50 decision threshold for precision, recall, F1, accuracy and the confusion matrix.
