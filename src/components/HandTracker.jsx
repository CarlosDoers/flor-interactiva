import React, { useEffect, useRef } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { useHandControl } from './HandContext';

export function HandTracker() {
  const videoRef = useRef(null);
  const { handStateRef, setIsDetected } = useHandControl();
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Prevenir doble inicialización
    if (handsRef.current) return;

    const hands = new Hands({
      locateFile: (file) => {
        // Usar unpkg como CDN alternativo más estable
        return `https://unpkg.com/@mediapipe/hands@0.4.1646424915/${file}`;
      }
    });

    handsRef.current = hands;

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0, // Cambiado a 0 (lite) para mejor compatibilidad
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

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

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && handsRef.current) {
          await handsRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480
    });

    cameraRef.current = camera;
    camera.start();

    return () => {
       // Cleanup adecuado
       if (cameraRef.current) {
         cameraRef.current.stop();
       }
       if (handsRef.current) {
         handsRef.current.close();
       }
    };
  }, [setIsDetected]);

  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 0, opacity: 0, pointerEvents: 'none' }}>
      <video ref={videoRef} style={{ width: '320px', height: '240px' }} playsInline></video>
    </div>
  );
}
