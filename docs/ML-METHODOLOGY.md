# Model development and responsible interpretation

## Data and prediction horizon

The included dataset contains 2,400 reproducible synthetic observations (seed 42). Binary outcomes are sampled from a defined academic-risk generator. They are not institutional observations, and performance measures only this generator. The separately generated dashboard cohort uses seed 817 and is not used to train the model. Existing imported records and newly created students receive predictions only; imports never retrain the model.

Six inputs enter the pipeline: attendance, CGPA, backlogs, assignment completion, weekly LMS sessions and credit completion. Identity, department, semester, email and any additional columns are excluded. For replacement data, these features must represent information available at a specified prediction date before the dropout outcome window. This cannot be proved automatically from a CSV: the dataset owner must establish provenance and timing.

## Reproducible methodology

1. Require at least 100 rows and at least 20 observations per binary class (0 continuing/completed, 1 observed dropout). Validate finite values, ranges and integer backlog counts. Normalize numeric types before fitting.
2. Reject duplicate column names, repeated/blank student IDs when supplied and identical feature vectors, including duplicate vectors with conflicting labels. This conservative policy requires source review; it does not silently delete records. Multiple observations per student need a separately designed grouped/time-based study.
3. Split by stratified random sampling, seed 42: 60% training (1,440), 20% validation (480), 20% holdout test (480). No resampling occurs before splitting.
4. Fit each candidate preprocessing/model pipeline on training rows only. Median imputation is inside each pipeline; Logistic Regression additionally fits standard scaling. Complete measurements are required by the serving schema.
5. Train Logistic Regression, Decision Tree, Random Forest, Histogram Gradient Boosting and CatBoost using fixed hyperparameters. CatBoost is required; failure to install it stops comparison rather than silently omitting it. CatBoost uses 150 iterations, depth 3, learning rate 0.04, Bernoulli bootstrap with subsample 0.85, feature sampling (`rsm`) 0.9, two CPU threads, seed 42 and binary Logloss. Training is quiet and does not write auxiliary CatBoost files.
6. Select by full-precision validation average precision, not rounded display values or test results. Refit the selected complete pipeline on train + validation. This is a fixed holdout comparison, not nested cross-validation or an exhaustive hyperparameter search.
7. Evaluate the final model on the held-out test set. Classification metrics use 0.5; operational Low/Medium/High bands use illustrative thresholds 0.3 and 0.6. No thresholds or calibration model are fitted using test data.
8. Save the fitted preprocessing/model pipeline together, development medians, dataset and split fingerprints, metrics, package versions, class counts, diagnostics and limitations. The saved pipeline is loaded for API predictions.

ROC, precision–recall and calibration charts are computed from actual holdout predictions. Calibration uses up to eight quantile bins; displayed ROC/PR curves are sampled to at most 80 points. Metrics are computed from all observations, not sampled curve points. Permutation importance uses the fixed final model and test set for descriptive analysis only; it is not fed back into selection.

## Current measured results — synthetic demonstration only

Model version: `v20261104-072305-67731a`. Selected: **Random forest**. Recomputed on 4 November 2026 with CatBoost 1.2.10 in the five-model comparison.

| Holdout metric | Value |
|---|---:|
| average precision | 0.6150 |
| roc auc | 0.8957 |
| accuracy | 0.8688 |
| precision | 0.6615 |
| recall | 0.5119 |
| f1 | 0.5772 |
| brier | 0.0947 |

Validation comparison:

| Model | Average precision | ROC AUC | F1 |
|---|---:|---:|---:|
| Random forest | 0.7474 | 0.9142 | 0.5915 |
| CatBoost | 0.7324 | 0.9142 | 0.6014 |
| Logistic regression | 0.7224 | 0.9133 | 0.6122 |
| Histogram gradient boosting | 0.6898 | 0.8949 | 0.6207 |
| Decision tree | 0.6666 | 0.8880 | 0.5931 |

## Exact single-reference Shapley explanations

For a student, the model evaluates all 2^6 = 64 subsets of features in one batch. Features absent from a subset are replaced with the development-set median vector. Each contribution is the Shapley-weighted average marginal change across subsets. The reference probability plus all six contributions equals the student's predicted probability, to floating-point precision. The UI expresses contributions in percentage points.

This is an exact single-reference Shapley implementation in probability space, without installing the SHAP package. It is not a population-averaged SHAP analysis, conditional explanation or causal estimate. Correlated features may produce artificial combinations, and results depend on the reference. API tests verify additivity; a student identical to the reference has zero contributions. The unsaved scenario explorer cannot forecast the effect of an intervention.

## External validation still required

No real institutional dataset was available in this project. Before real use, validate a documented prediction horizon on future cohorts, assess calibration and uncertainty, inspect subgroup performance, and set thresholds according to support capacity. Removing protected demographics does not establish fairness. Use estimates to support faculty review, not automatic academic decisions.

Train replacement data into a separate artifact directory and then activate the trusted complete bundle with a server restart. Joblib loading can execute code; only trusted, locally produced artifacts should be installed. There is no public model-upload endpoint.

## Primary references

- [CatBoost classifier and scikit-learn interface](https://catboost.ai/docs/en/concepts/python-reference_catboostclassifier)
- [scikit-learn: common pitfalls and leakage](https://scikit-learn.org/1.8/common_pitfalls.html)
- [scikit-learn pipelines](https://scikit-learn.org/stable/modules/generated/sklearn.pipeline.Pipeline.html)
- [SHAP exact explanations and independent masking](https://shap.readthedocs.io/en/latest/example_notebooks/api_examples/explainers/Exact.html)
