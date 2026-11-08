import numpy as np
import pandas as pd
import pytest
import joblib
import catboost
from app.ml import train, demo_dataset, Predictor
from app.schemas import FEATURES
from sklearn.model_selection import train_test_split

@pytest.mark.parametrize('case',['duplicate_features','duplicate_ids','missing_ids','nonfinite','outcome','missing_feature','duplicate_columns','whitespace_ids'])
def test_training_rejects_invalid_data_before_artifacts(tmp_path,case):
    data=demo_dataset(240)
    if case=='duplicate_features': data=pd.concat([data,data.iloc[[0]]],ignore_index=True)
    elif case=='duplicate_ids': data['student_id']='same'
    elif case=='missing_ids': data['student_id']=[str(i) if i else None for i in range(len(data))]
    elif case=='nonfinite': data.loc[0,'attendance']=np.inf
    elif case=='outcome': data['dropout']=0
    elif case=='duplicate_columns': data=pd.concat([data,data[['dropout']]],axis=1)
    elif case=='whitespace_ids': data['student_id']=['one' if i else ' one ' for i in range(len(data))]
    else: data=data.drop(columns=['cgpa'])
    with pytest.raises(ValueError): train(data,artifact_dir=tmp_path)
    assert not (tmp_path/'model.joblib').exists()

def test_real_training_selection_split_and_serialization(tmp_path,monkeypatch):
    # Small deterministic dataset; every real estimator is trained, no mocked model scores.
    data=demo_dataset(400)
    from sklearn.pipeline import Pipeline
    original_fit=Pipeline.fit
    fits=[]
    catboost_pipelines=[]
    def capture(self,X,y,*args,**kwargs):
        fits.append(set(X.index))
        if isinstance(self.steps[-1][1],catboost.CatBoostClassifier):
            catboost_pipelines.append(self)
        return original_fit(self,X,y,*args,**kwargs)
    monkeypatch.setattr(Pipeline,'fit',capture)
    result=train(data,artifact_dir=tmp_path)
    card=result['report']
    dev,test=train_test_split(data.index,test_size=.2,stratify=data.dropout,random_state=42)
    training,validation=train_test_split(dev,test_size=.25,stratify=data.loc[dev,'dropout'],random_state=42)
    assert card['split']=={'train':240,'validation':80,'test':80,'seed':42}
    assert len(fits)==6 # Five candidates plus the selected final estimator.
    assert all(fit==set(training) for fit in fits[:-1])
    assert fits[-1]==set(dev)
    assert all(not fit.intersection(test) for fit in fits)
    assert {'Logistic regression','Decision tree','Random forest','Histogram gradient boosting','CatBoost'}==set(c['name'] for c in card['comparison'])
    assert card['catboost_version']==catboost.__version__
    assert card['comparison'][0]['name']==card['selected_model']
    assert card['comparison'][0]['selection_score']==max(c['selection_score'] for c in card['comparison'])
    assert sum(sum(row) for row in card['test_metrics']['confusion_matrix'])==80
    np.testing.assert_allclose(result['pipeline'].steps[0][1].statistics_,data.loc[dev,FEATURES].median().values)
    restored=joblib.load(tmp_path/'model.joblib')
    np.testing.assert_allclose(restored['pipeline'].predict_proba(data[FEATURES]),result['pipeline'].predict_proba(data[FEATURES]))
    predictor=Predictor(restored)
    explanation=predictor.explain_details(data.iloc[0].to_dict())
    assert explanation['additivity_error']<1e-12
    reference=predictor.explain_details(predictor.medians)
    assert all(abs(v['effect'])<1e-12 for v in reference['values'])
    assert len(card['diagnostics']['calibration'])<=8
    assert (tmp_path/'model-card.json').exists()

    # Exercise the replacement model's serving path even when another candidate wins.
    catboost_bundle=dict(pipeline=catboost_pipelines[0],medians=result['medians'],report=card)
    joblib.dump(catboost_bundle,tmp_path/'catboost.joblib')
    catboost_restored=joblib.load(tmp_path/'catboost.joblib')
    np.testing.assert_allclose(catboost_restored['pipeline'].predict_proba(data[FEATURES]),catboost_pipelines[0].predict_proba(data[FEATURES]))
    catboost_predictor=Predictor(catboost_restored)
    prediction=catboost_predictor.predict([data.iloc[0].to_dict()])[0]
    assert 0<=prediction['probability']<=1
    assert catboost_predictor.explain_details(data.iloc[0].to_dict())['additivity_error']<1e-12


def test_training_requires_catboost(tmp_path,monkeypatch):
    import builtins
    original_import=builtins.__import__
    def without_catboost(name,*args,**kwargs):
        if name=='catboost':
            raise ImportError('CatBoost is not installed')
        return original_import(name,*args,**kwargs)
    monkeypatch.setattr(builtins,'__import__',without_catboost)
    with pytest.raises(RuntimeError,match='CatBoost is required'):
        train(demo_dataset(240),artifact_dir=tmp_path)
    assert not (tmp_path/'model.joblib').exists()
