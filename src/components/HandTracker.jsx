import React, { useEffect, useRef } from 'react';
import { Hands } from '@mediapipe/hands';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { useHandControl } from './HandContext';

export function HandTracker() {
  const videoRef = useRef(null);
  const { handStateRef, smileStateRef, setIsDetected } = useHandControl();
  const handsRef = useRef(null);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    if (!videoRef.current) return;

    // Prevenir doble inicialización
    if (handsRef.current) return;

    // === HANDS DETECTION ===
    const hands = new Hands({
      locateFile: (file) => {
        return `https://unpkg.com/@mediapipe/hands@0.4.1646424915/${file}`;
      }
    });

    handsRef.current = hands;

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // === FACE MESH DETECTION ===
    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://unpkg.com/@mediapipe/face_mesh@0.4.1633559619/${file}`;
      }
    });

    faceMeshRef.current = faceMesh;

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false, // Desactivado para mejor rendimiento
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // === CALLBACK HANDS ===
    hands.onResults((results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setIsDetected(true);
        const landmarks = results.multiHandLandmarks[0];
        
        // --- MEJORA: Lógica Invariante a la Escala (Z-depth) ---
        // Usamos la relación entre "Longitud de la palma" y "Distancia a la punta"
        // Wrapper: 0 (Muñeca)
        // Middle MCP: 9 (Nudillo medio) -> Base de referencia
        // Middle Tip: 12 (Punta medio)
        
        const wrist = landmarks[0];
        const midMCP = landmarks[9];
        const midTip = landmarks[12];
        
        const distToMCP = Math.sqrt(Math.pow(midMCP.x - wrist.x, 2) + Math.pow(midMCP.y - wrist.y, 2));
        const distToTip = Math.sqrt(Math.pow(midTip.x - wrist.x, 2) + Math.pow(midTip.y - wrist.y, 2));
        
        // Ratio: En puño cerrado es ~1.0 o menor. Mano abierta ~1.8 o más.
        const ratio = distToTip / (distToMCP || 0.001);
        
        // Mapear ratio a 0..1
        // Puño (1.1) -> 0.0
        // Abierto (1.7) -> 1.0
        let openness = (ratio - 1.1) / 0.6;
        openness = Math.max(0, Math.min(1, openness));
        
        // Optimización: Actualizar ref directamente sin triggers de React
        // Suavizado manual (Lerp)
        const current = handStateRef.current;
        handStateRef.current = current + (openness - current) * 0.15;
        
      } else {
        setIsDetected(false);
        // Volver suavemente a estado neutro si se pierde la mano
        // handStateRef.current *= 0.95; // Podemos hacerlo, o dejar que los componentes lo bajen si no detectan
        // Mejor bajamos aquí también para mantener la lógica unificada
        handStateRef.current = handStateRef.current * 0.95;
      }
    });

    // === CALLBACK FACE MESH ===
    faceMesh.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        
        // Puntos clave para detectar sonrisa
        const leftMouth = landmarks[61];
        const rightMouth = landmarks[291];
        const topLip = landmarks[13];
        const bottomLip = landmarks[14];
        
        const mouthWidth = Math.sqrt(
          Math.pow(rightMouth.x - leftMouth.x, 2) + 
          Math.pow(rightMouth.y - leftMouth.y, 2)
        );
        
        const mouthHeight = Math.sqrt(
          Math.pow(topLip.x - bottomLip.x, 2) + 
          Math.pow(topLip.y - bottomLip.y, 2)
        );
        
        const ratio = mouthWidth / (mouthHeight || 0.01);
        let smile = (ratio - 3.0) / 2.5;
        smile = Math.max(0, Math.min(1, smile));
        
        const current = smileStateRef.current;
        smileStateRef.current = current + (smile - current) * 0.2;
      } else {
        smileStateRef.current = smileStateRef.current * 0.9;
      }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          frameCountRef.current++;
          // Alternamos: procesar hands en frames pares, face en impares
          // Esto reduce la carga computacional
          if (frameCountRef.current % 2 === 0 && handsRef.current) {
            await handsRef.current.send({ image: videoRef.current });
          } else if (faceMeshRef.current) {
            await faceMeshRef.current.send({ image: videoRef.current });
          }
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
       if (handsRef.current) {
         handsRef.current.close();
       }
       if (faceMeshRef.current) {
         faceMeshRef.current.close();
       }
    };
  }, [setIsDetected, smileStateRef]);

  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 0, opacity: 0, pointerEvents: 'none' }}>
      <video ref={videoRef} style={{ width: '320px', height: '240px' }} playsInline></video>
    </div>
  );
}
