import React, { useEffect, useRef } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { useHandControl } from './HandContext';

export function SmileTracker() {
  const videoRef = useRef(null);
  const { smileStateRef } = useHandControl();
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Prevenir doble inicialización
    if (faceMeshRef.current) return;

    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMeshRef.current = faceMesh;

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        
        // Puntos clave para detectar sonrisa:
        // 61 y 291: Comisuras de los labios (izquierda y derecha)
        // 13: Centro superior del labio
        // 14: Centro inferior del labio
        
        const leftMouth = landmarks[61];
        const rightMouth = landmarks[291];
        const topLip = landmarks[13];
        const bottomLip = landmarks[14];
        
        // Calcular ancho de la boca
        const mouthWidth = Math.sqrt(
          Math.pow(rightMouth.x - leftMouth.x, 2) + 
          Math.pow(rightMouth.y - leftMouth.y, 2)
        );
        
        // Calcular altura de la boca
        const mouthHeight = Math.sqrt(
          Math.pow(topLip.x - bottomLip.x, 2) + 
          Math.pow(topLip.y - bottomLip.y, 2)
        );
        
        // Ratio ancho/alto - sonrisa hace que la boca sea más ancha que alta
        const ratio = mouthWidth / (mouthHeight || 0.01);
        
        // Normalizar: Serio ~2.5-3.5, Sonrisa ~4.5-6.0
        let smile = (ratio - 3.0) / 2.5;
        smile = Math.max(0, Math.min(1, smile));
        
        // Suavizado
        const current = smileStateRef.current;
        smileStateRef.current = current + (smile - current) * 0.2;
        
      } else {
        // Volver a neutral si no hay cara detectada
        smileStateRef.current = smileStateRef.current * 0.9;
      }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && faceMeshRef.current) {
          await faceMeshRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480
    });

    cameraRef.current = camera;
    camera.start();

    return () => {
       if (cameraRef.current) {
         cameraRef.current.stop();
       }
       if (faceMeshRef.current) {
         faceMeshRef.current.close();
       }
    };
  }, [smileStateRef]);

  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 0, opacity: 0, pointerEvents: 'none' }}>
      <video ref={videoRef} style={{ width: '320px', height: '240px' }} playsInline></video>
    </div>
  );
}
