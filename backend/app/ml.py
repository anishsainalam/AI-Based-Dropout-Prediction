"""Replaceable tabular pipeline. No identity or department fields enter the model."""
import argparse
import math
from sklearn.calibration import calibration_curve
from sklearn.metrics import roc_curve, precision_recall_curve
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import average_precision_score, roc_auc_score, accuracy_score, precision_score, recall_score, f1_score, brier_score_loss, confusion_matrix
from sklearn.inspection import permutation_importance
from .config import ARTIFACTS, DATA
from .schemas import FEATURES, LABELS, Features

def demo_dataset(n=2400, seed=42):
    rng = np.random.default_rng(seed)
    support = rng.beta(4, 1.7, n)
    attendance = np.clip(support * 75 + rng.normal(22, 13, n), 10, 100)
    cgpa = np.clip(support * 5 + rng.normal(3.2, 1.3, n), 1, 10)
    assignments = np.clip(support * 82 + rng.normal(12, 16, n), 0, 100)
    backlogs = np.minimum(rng.poisson(np.maximum(0.15, (8-cgpa)*0.65)), 9)
    lms = np.clip(support * 18 + rng.normal(2, 5, n), 0, 40)
    credits = np.clip(100-backlogs*9+rng.normal(-8,12,n),10,100)
    x = pd.DataFrame(dict(attendance=attendance,cgpa=cgpa,backlogs=backlogs,assignment_completion=assignments,lms_activity=lms,credits_ratio=credits)).round(2)
    logit = -1.6 + (65-attendance)*0.045 + (6-cgpa)*0.45 + backlogs*0.27 + (65-assignments)*0.022 + (10-lms)*0.04 + (65-credits)*0.018
    x['dropout'] = rng.binomial(1,1/(1+np.exp(-logit)))
    return x

def metrics(y, p):
    binary = p >= 0.5
    return dict(average_precision=round(float(average_precision_score(y,p)),4),roc_auc=round(float(roc_auc_score(y,p)),4),accuracy=round(float(accuracy_score(y,binary)),4),precision=round(float(precision_score(y,binary,zero_division=0)),4),recall=round(float(recall_score(y,binary,zero_division=0)),4),f1=round(float(f1_score(y,binary,zero_division=0)),4),brier=round(float(brier_score_loss(y,p)),4),confusion_matrix=confusion_matrix(y,binary,labels=[0,1]).tolist())

def train(frame, source='synthetic demonstration', artifact_dir=ARTIFACTS):
    if frame.columns.duplicated().any():
        raise ValueError('Training column names must be unique.')
    missing = set(FEATURES+['dropout'])-set(frame.columns)
    if missing:
        raise ValueError('Missing training columns: '+', '.join(sorted(missing)))
    if len(frame)<100 or frame['dropout'].isna().any() or set(frame['dropout'].unique()) != {0,1} or frame['dropout'].value_counts().min()<20:
        raise ValueError('Training needs at least 100 rows and at least 20 observed outcomes in each binary class (0/1).')
    # Normalize values before all checks; only these six pre-outcome inputs enter the pipeline.
    normalized = [Features.model_validate(row).model_dump() for row in frame[FEATURES].to_dict('records')]
    frame = frame.reset_index(drop=True).copy()
    frame[FEATURES] = pd.DataFrame(normalized)[FEATURES]
    if frame[FEATURES].duplicated().any():
        raise ValueError('Duplicate feature observations found. Review duplicates before training to prevent identical records crossing splits.')
    if 'student_id' in frame and (frame['student_id'].isna().any() or frame['student_id'].astype(str).str.strip().eq('').any()):
        raise ValueError('Training student IDs must not be missing.')
    if 'student_id' in frame and frame['student_id'].astype(str).str.strip().duplicated().any():
        raise ValueError('One pre-outcome observation per student is required; split repeated observations by student before training.')
    X, y = frame[FEATURES], frame['dropout'].astype(int)
    x_dev,x_test,y_dev,y_test = train_test_split(X,y,test_size=.2,stratify=y,random_state=42)
    x_train,x_val,y_train,y_val = train_test_split(x_dev,y_dev,test_size=.25,stratify=y_dev,random_state=42)
    candidates = {
        'Logistic regression': make_pipeline(SimpleImputer(strategy='median'),StandardScaler(),LogisticRegression(max_iter=1500,random_state=42)),
        'Decision tree': make_pipeline(SimpleImputer(strategy='median'),DecisionTreeClassifier(max_depth=5,min_samples_leaf=25,random_state=42)),
        'Random forest': make_pipeline(SimpleImputer(strategy='median'),RandomForestClassifier(n_estimators=180,max_depth=7,min_samples_leaf=12,n_jobs=2,random_state=42)),
        'Histogram gradient boosting': make_pipeline(SimpleImputer(strategy='median'),HistGradientBoostingClassifier(max_iter=100,max_leaf_nodes=12,l2_regularization=5,random_state=42))
    }
    try:
        import catboost
        candidates['CatBoost'] = make_pipeline(
            SimpleImputer(strategy='median'),
            catboost.CatBoostClassifier(iterations=150,depth=3,learning_rate=.04,
                bootstrap_type='Bernoulli',subsample=.85,rsm=.9,thread_count=2,
                random_seed=42,loss_function='Logloss',verbose=False,allow_writing_files=False))
    except ImportError as exc:
        raise RuntimeError('CatBoost is required for the promised model comparison. Install backend/requirements-lock.txt.') from exc
    comparisons = []
    for name, pipe in candidates.items():
        pipe.fit(x_train,y_train)
        probabilities=pipe.predict_proba(x_val)[:,1]
        comparisons.append({'name':name, **metrics(y_val,probabilities),'selection_score':float(average_precision_score(y_val,probabilities))})
    comparisons.sort(key=lambda v:v['selection_score'],reverse=True)
    selected = comparisons[0]['name']
    final = clone(candidates[selected]).fit(x_dev,y_dev)
    test_probabilities=final.predict_proba(x_test)[:,1]
    test_metrics = metrics(y_test,test_probabilities)
    importance = permutation_importance(final,x_test,y_test,scoring='average_precision',n_repeats=5,random_state=42,n_jobs=1)
    fingerprint = hashlib.sha256(pd.util.hash_pandas_object(frame[FEATURES+['dropout']],index=False).values.tobytes()).hexdigest()
    stamp = datetime.now(timezone.utc)
    version = stamp.strftime('v%Y%m%d-%H%M%S')+'-'+fingerprint[:6]
    report = dict(version=version,selected_model=selected,trained_at=stamp.isoformat(),source=source,is_demo=source=='synthetic demonstration',dataset_rows=len(frame),features=FEATURES,positive_rate=round(float(y.mean()),4),selection_metric='Validation average precision',split={'train':len(x_train),'validation':len(x_val),'test':len(x_test),'seed':42},comparison=comparisons,test_metrics=test_metrics,importance=[{'feature':f,'label':LABELS[f],'value':round(float(v),4),'std':round(float(s),4)} for f,v,s in zip(FEATURES,importance.importances_mean,importance.importances_std)],thresholds={'moderate':.3,'high':.6},fingerprint=fingerprint,sklearn_version=sklearn.__version__,explanation_method='Exact single-reference Shapley values in probability space, enumerating all 64 feature subsets against development-set medians. Additive; not causal or population-conditional.',limitations=['Synthetic outcomes do not establish accuracy on real students.' if source=='synthetic demonstration' else 'Requires institution-specific external and temporal validation.','Risk thresholds are illustrative support triage rules, not validated decision cutoffs.','Probabilities are model estimates, not guarantees. Review calibration on real cohorts.','Use for supportive human review; never automatic academic or disciplinary decisions.','This random holdout evaluates one row per student. Use a future cohort and pre-outcome features for institutional validation.'])
    observed, estimated=calibration_curve(y_test,test_probabilities,n_bins=8,strategy='quantile')
    fpr,tpr,_=roc_curve(y_test,test_probabilities)
    precision,recall,_=precision_recall_curve(y_test,test_probabilities)
    def points(xs,ys):
        indices=np.unique(np.linspace(0,len(xs)-1,min(80,len(xs))).astype(int))
        return [{'x':round(float(xs[i]),6),'y':round(float(ys[i]),6)} for i in indices]
    report['diagnostics']={'calibration':points(estimated,observed),'roc':points(fpr,tpr),'precision_recall':points(recall,precision)}
    report['class_counts']={name:{'continuing':int((labels==0).sum()),'dropout':int((labels==1).sum())} for name,labels in [('train',y_train),('validation',y_val),('test',y_test)]}
    report['methodology']={'evaluation_threshold':0.5,'selection_uses':'validation only; full precision average precision',
        'final_fit':'train + validation; test remains held out','preprocessing':'imputation and scaling fit inside each candidate pipeline on train only; final pipeline refit on development',
        'duplicate_policy':'Reject repeated student IDs and identical feature vectors before splitting',
        'split_fingerprints':{name:hashlib.sha256(pd.util.hash_pandas_object(part,index=False).values.tobytes()).hexdigest() for name,part in [('train',x_train),('validation',x_val),('test',x_test)]}}
    report['catboost_version']=catboost.__version__
    artifact_dir = Path(artifact_dir)
    artifact_dir.mkdir(parents=True,exist_ok=True)
    # Trusted, locally created artifacts only; joblib files can execute code when loaded.
    bundle = dict(pipeline=final,medians=x_dev.median().to_dict(),report=report)
    joblib.dump(bundle,artifact_dir/'model.joblib.tmp')
    (artifact_dir/'model.joblib.tmp').replace(artifact_dir/'model.joblib')
    (artifact_dir/'model-card.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return bundle

class Predictor:
    def __init__(self, bundle):
        self.pipeline = bundle['pipeline']
        self.medians = bundle['medians']
        self.report = bundle['report']

    def predict(self, records):
        probabilities = self.pipeline.predict_proba(pd.DataFrame(records)[FEATURES])[:,1]
        return [{'probability':round(float(p),6),'risk':'high' if p>=.6 else 'moderate' if p>=.3 else 'low','model_version':self.report['version']} for p in probabilities]

    def explain_details(self, record):
        # Exact Shapley formula: weighted marginal contributions over every subset.
        # Six inputs => 64 predictions, batched once; no approximation or SHAP dependency.
        n=len(FEATURES)
        coalitions=[{f:record[f] if mask & (1<<i) else self.medians[f] for i,f in enumerate(FEATURES)} for mask in range(1<<n)]
        probabilities=self.pipeline.predict_proba(pd.DataFrame(coalitions)[FEATURES])[:,1]
        values=[]
        for i,f in enumerate(FEATURES):
            contribution=0.0
            for mask in range(1<<n):
                if mask & (1<<i): continue
                size=mask.bit_count()
                weight=math.factorial(size)*math.factorial(n-size-1)/math.factorial(n)
                contribution+=weight*(probabilities[mask | (1<<i)]-probabilities[mask])
            values.append({'feature':f,'label':LABELS[f],'value':record[f],'reference':round(self.medians[f],2),'effect':float(contribution)})
        return {'method':'Exact single-reference Shapley','baseline':float(probabilities[0]),'probability':float(probabilities[-1]),
            'values':sorted(values,key=lambda x:abs(x['effect']),reverse=True),
            'additivity_error':float(abs(probabilities[0]+sum(v['effect'] for v in values)-probabilities[-1])),
            'reference':'Development-set feature medians; not a population average. Correlated features and artificial combinations limit interpretation.'}

    def explain(self, record):
        return self.explain_details(record)['values']

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description='Train Continuum with observed binary dropout outcomes.')
    parser.add_argument('--csv',type=Path)
    parser.add_argument('--source',default='institutional dataset')
    parser.add_argument('--output',type=Path,default=ARTIFACTS)
    args=parser.parse_args()
    data = pd.read_csv(args.csv) if args.csv else demo_dataset()
    if args.csv is None:
        data.to_csv(DATA/'demo-training.csv',index=False)
    result=train(data,args.source if args.csv else 'synthetic demonstration',args.output)
    print(json.dumps({'selected_model':result['report']['selected_model'],'test_metrics':result['report']['test_metrics'],'version':result['report']['version']},indent=2))
