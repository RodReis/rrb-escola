"use client";
import * as faceapi from "@vladmandic/face-api";

let loaded = false;
let loadingPromise: Promise<void> | null = null;

export async function ensureFaceModels() {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const url = "/face-models";
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(url),
      faceapi.nets.faceLandmark68Net.loadFromUri(url),
      faceapi.nets.faceRecognitionNet.loadFromUri(url)
    ]);
    loaded = true;
  })();
  return loadingPromise;
}
