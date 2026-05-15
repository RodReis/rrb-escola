"use client";
import * as faceapi from "@vladmandic/face-api";
import { ensureFaceModels } from "./face-api-loader";

export type ExtractionResult =
  | { ok: true; embedding: number[]; score: number; box: { x: number; y: number; width: number; height: number } }
  | { ok: false; error: "no_face" | "multiple_faces" | "low_score" | "off_center" | "too_small"; detail?: string };

const MIN_SCORE = 0.7;
const MIN_FACE_PX = 100;

export async function extractEmbedding(image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<ExtractionResult> {
  await ensureFaceModels();
  const detections = await faceapi
    .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) return { ok: false, error: "no_face" };
  if (detections.length > 1) return { ok: false, error: "multiple_faces" };
  const det = detections[0];
  if (det.detection.score < MIN_SCORE) return { ok: false, error: "low_score", detail: `score=${det.detection.score.toFixed(2)}` };
  const box = det.detection.box;
  if (box.width < MIN_FACE_PX || box.height < MIN_FACE_PX) return { ok: false, error: "too_small", detail: `${Math.round(box.width)}x${Math.round(box.height)}` };

  const imgW = "videoWidth" in image ? image.videoWidth : "width" in image ? image.width : 0;
  const imgH = "videoHeight" in image ? image.videoHeight : "height" in image ? image.height : 0;
  if (imgW && imgH) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const offX = Math.abs(cx - imgW / 2) / imgW;
    const offY = Math.abs(cy - imgH / 2) / imgH;
    if (offX > 0.25 || offY > 0.25) return { ok: false, error: "off_center" };
  }

  return {
    ok: true,
    embedding: Array.from(det.descriptor),
    score: det.detection.score,
    box: { x: box.x, y: box.y, width: box.width, height: box.height }
  };
}
