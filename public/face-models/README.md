# face-api models

Modelos de `@vladmandic/face-api` usados pelo cadastro biometrico (browser).

Fonte: https://github.com/vladmandic/face-api/tree/master/model

Necessarios:
- ssd_mobilenetv1_model-weights_manifest.json + ssd_mobilenetv1_model.bin
- face_landmark_68_model-weights_manifest.json + face_landmark_68_model.bin
- face_recognition_model-weights_manifest.json + face_recognition_model.bin

Total: ~12 MB. Servidos via /face-models pelo Next.js (public/).
