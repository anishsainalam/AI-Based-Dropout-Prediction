"""Append-only prediction snapshots; historical inputs are never reconstructed."""
import json
from .database import PredictionHistory
from .schemas import FEATURES

def snapshot(db, student, reason, actor=None, timestamp=None):
    db.flush()
    item = PredictionHistory(student_id=student.id, actor_id=actor.id if actor else None,
        probability=student.probability, risk=student.risk, model_version=student.model_version,
        features=json.dumps({f:getattr(student,f) for f in FEATURES}), reason=reason)
    if timestamp:
        item.created_at=timestamp
    db.add(item)
    return item

def history_view(item):
    return {**{c.name:getattr(item,c.name) for c in PredictionHistory.__table__.columns},
            'features':json.loads(item.features)}
