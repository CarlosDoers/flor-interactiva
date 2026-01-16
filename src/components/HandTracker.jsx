import React, { useEffect, useRef } from 'react';
import { Holistic } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { useHandControl } from './HandContext';

export function HandTracker() {
  const videoRef = useRef(null);
  const { handStateRef, faceStateRef, setIsDetected } = useHandControl();
  const holisticRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    if (holisticRef.current) return;

    // --- SETUP HOLISTIC (MANOS + CARA UNIFICADO) ---
    const holistic = new Holistic({
      locateFile: (file) => {
        return `${window.location.origin}/mediapipe/holistic/${file}`;
      }
    });
    holisticRef.current = holistic;
    
    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      refineFaceLandmarks: true // Crítico para detección de iris/labios precisos
    });

    // --- PROCESADO ---
    holistic.onResults((results) => {
        // 1. PROCESAMIENTO MANOS (Priorizamos mano derecha o izquierda indistintamente)
        const rightHand = results.rightHandLandmarks;
        const leftHand = results.leftHandLandmarks;
        const mainHand = rightHand || leftHand; // Usamos la que detecte

        if (mainHand) {
            setIsDetected(true);
            
            const wrist = mainHand[0];
            const midMCP = mainHand[9];
            const midTip = mainHand[12];
            
            // Lógica de apertura invariante a escala
            const distToMCP = Math.sqrt(Math.pow(midMCP.x - wrist.x, 2) + Math.pow(midMCP.y - wrist.y, 2));
            const distToTip = Math.sqrt(Math.pow(midTip.x - wrist.x, 2) + Math.pow(midTip.y - wrist.y, 2));
            const ratio = distToTip / (distToMCP || 0.001);
            
            let openness = (ratio - 1.1) / 0.6;
            openness = Math.max(0, Math.min(1, openness));
            
            const current = handStateRef.current;
            handStateRef.current = current + (openness - current) * 0.15;
            
        } else {
            setIsDetected(false);
            handStateRef.current = handStateRef.current * 0.95;
        }

        // 2. PROCESAMIENTO CARA
        if (results.faceLandmarks) {
            const landmarks = results.faceLandmarks;
            const dist = (i1, i2) => Math.sqrt(
                Math.pow(landmarks[i1].x - landmarks[i2].x, 2) + 
                Math.pow(landmarks[i1].y - landmarks[i2].y, 2)
            );

            // Detección Sonrisa
            const mouthWidth = dist(61, 291);
            const faceWidth = dist(234, 454);
            const smileRatio = mouthWidth / (faceWidth || 0.1); 
            
            let smile = (smileRatio - 0.42) / 0.10;
            smile = Math.max(0, Math.min(1, smile));

            // Detección Cejas
            const faceHeight = dist(10, 152);
            const browLeftDist = dist(65, 159);
            const browRightDist = dist(295, 386);
            const avgBrowHeight = (browLeftDist + browRightDist) / 2;
            const browRatio = avgBrowHeight / (faceHeight || 0.1);
            
            // Ajuste de umbrales para Holistic (ligeramente diferentes a FaceMesh puro a veces)
            let eyebrows = (browRatio - 0.08) / 0.04;
            eyebrows = Math.max(0, Math.min(1, eyebrows));

            const currentSmile = faceStateRef.current.smile;
            const currentBrows = faceStateRef.current.eyebrows;
            
            faceStateRef.current = {
                smile: currentSmile + (smile - currentSmile) * 0.1,
                eyebrows: currentBrows + (eyebrows - currentBrows) * 0.1
            };
        } else {
             // Relajar cara si no se detecta
             faceStateRef.current = {
                smile: faceStateRef.current.smile * 0.95,
                eyebrows: faceStateRef.current.eyebrows * 0.95
             }
        }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && holisticRef.current) {
          try {
             await holisticRef.current.send({ image: videoRef.current });
          } catch (error) {
             console.error('Error en loop Holistic:', error);
          }
        }
      },
      width: 640,
      height: 480
    });

    cameraRef.current = camera;
    camera.start();

    return () => {
       if (cameraRef.current) cameraRef.current.stop();
       if (holisticRef.current) holisticRef.current.close();
       holisticRef.current = null;
    };
  }, [setIsDetected]);

  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 0, opacity: 0, pointerEvents: 'none' }}>
      <video ref={videoRef} style={{ width: '320px', height: '240px' }} playsInline></video>
    </div>
  );
}
