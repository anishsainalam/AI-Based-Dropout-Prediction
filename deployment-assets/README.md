# Trusted model for container hosting

For a production Render deployment without a persistent disk, copy the **trusted model you trained on observed institutional outcomes** to `deployment-assets/model.joblib` before building the image. The Dockerfile copies this directory into `/app/data/artifacts`. No training CSV, database, student uploads, or passwords belong in this directory.

Use an institution-controlled private repository and artifact access policy. Joblib artifacts are executable Python serialization; never download or load an untrusted model.

For a public demonstration using synthetic data only, the normal Docker demo configuration trains its synthetic model on first startup. To avoid training on a small free runtime, you can copy the locally generated synthetic model into this directory and explicitly select demo mode. A synthetic artifact cannot start a production-mode app.
