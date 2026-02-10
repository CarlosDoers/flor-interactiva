import React, { useEffect, useRef } from 'react';
import { Holistic, FACEMESH_TESSELATION, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN VISUAL ---
const VISUAL_CONFIG = {
  // Configuración de detección MediaPipe
  detection: {
    modelComplexity: 1,           // 1=preciso (mantiene mejor el tracking)
    minDetectionConfidence: 0.4,
    minTrackingConfidence: 0.4,
    cameraWidth: 960,             // Bajamos ligeramente de 1280 para ganar velocidad
    cameraHeight: 540,
    landmarkSmoothing: 0.75       // Aumentado (0.3 -> 0.75) para que sea MUCHO más responsivo
  },
  hands: {
    color: '#00ffee',
    coreColor: '#ffffff',
    glowColor: '#00ffee',
    glowRadius: 15,
    lineWidth: 3,
    coreWidth: 1.5,
    landmarkRadius: 6,
    opacity: 0.3,
    zoom: 1.25,
  },
  interaction: {
    targetX: 0.5,
    targetY: 0.5,
    touchRadius: 0.15,
    smoothing: 0.15
  },
  swipe: {
    threshold: 0.35,      // Reducido de 0.5 para compensar el smoothing
    intensity: 1.3,       // Aumentado de 1.1 para dar más impulso
    minX: 0.25,           // Ampliado de 0.4 para dar más margen de detección
    maxX: 0.75            // Ampliado de 0.6 para dar más margen de detección
  },
  fist: {
    minX: 0.25,           // Rango horizontal (30%)
    maxX: 0.75,           // Rango horizontal (70%)
    minY: 0.25,           // Rango vertical (40%)
    maxY: 0.75,           // Rango vertical (60%)
    smoothing: 0.15      // Velocidad de transición
  },
  face: {
    smileLower: 0.42,    // Humbral base sonrisa
    smileUpper: 0.52,    // Humbral tope sonrisa
    eyebrowsLower: 0.08, // Humbral base cejas (Aumentado para evitar falsos positivos) Si ves que se activa solo, sube este valor (ej: 0.10)
    eyebrowsUpper: 0.12, // Humbral tope cejas - Si te cuesta mucho activarlo al máximo, baja este valor (ej: 0.11).
    smoothingActive: 0.1, // Suavizado al activar
    smoothingRelax: 0.4   // Suavizado al relajar
  }
};

// Clase para suavizar landmarks y reducir jitter
class LandmarkSmoother {
  constructor(smoothingFactor = 0.3) {
    this.history = null;
    this.alpha = smoothingFactor;
  }
  
  smooth(landmarks) {
    if (!landmarks) {
      this.history = null;
      return null;
    }
    if (!this.history) {
      this.history = landmarks.map(l => ({ x: l.x, y: l.y, z: l.z || 0 }));
      return landmarks;
    }
    const smoothed = landmarks.map((l, i) => {
      const h = this.history[i];
      const newX = h.x + (l.x - h.x) * this.alpha;
      const newY = h.y + (l.y - h.y) * this.alpha;
      const newZ = l.z !== undefined ? h.z + (l.z - h.z) * this.alpha : l.z;
      this.history[i] = { x: newX, y: newY, z: newZ || 0 };
      return { x: newX, y: newY, z: newZ };
    });
    return smoothed;
  }
  
  reset() {
    this.history = null;
  }
}

// Función auxiliar para dibujo estilo Neón/Holográfico
function drawNeonHand(ctx, landmarks, connections) {
  if (!landmarks) return;
  const { color, coreColor, glowColor, glowRadius, lineWidth, coreWidth, landmarkRadius } = VISUAL_CONFIG.hands;
  ctx.save();
  connections.forEach(([i, j]) => {
    const start = landmarks[i];
    const end = landmarks[j];
    ctx.beginPath();
    ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
    ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
    ctx.shadowBlur = glowRadius;
    ctx.shadowColor = glowColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = coreWidth;
    ctx.stroke();
  });
  landmarks.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x * ctx.canvas.width, pt.y * ctx.canvas.height, landmarkRadius, 0, Math.PI * 2);
    ctx.shadowBlur = glowRadius * 1.5;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(pt.x * ctx.canvas.width, pt.y * ctx.canvas.height, landmarkRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

export function HandTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const { 
    handStateRef, 
    faceStateRef, 
    fistStateRef, 
    rotationImpulseRef, 
    pinchStateRef, 
    leftHandHeightRef, 
    rightHandHeightRef, 
    cursorRef,
    setIsDetected 
  } = useHandControl();
  const holisticRef = useRef(null);
  const cameraRef = useRef(null);
  const lastPalmXRef = useRef(0.5);
  const lastPalmTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!videoRef.current || holisticRef.current) return;

    const holistic = new Holistic({
      locateFile: (file) => `${window.location.origin}/mediapipe/holistic/${file}`
    });
    holisticRef.current = holistic;
    
    const cfgDetection = VISUAL_CONFIG.detection;
    holistic.setOptions({
      modelComplexity: cfgDetection.modelComplexity,
      smoothLandmarks: true,
      minDetectionConfidence: cfgDetection.minDetectionConfidence,
      minTrackingConfidence: cfgDetection.minTrackingConfidence,
      refineFaceLandmarks: true
    });
    
    // Smoothers para estabilizar landmarks
    const leftHandSmoother = new LandmarkSmoother(cfgDetection.landmarkSmoothing);
    const rightHandSmoother = new LandmarkSmoother(cfgDetection.landmarkSmoothing);
    const faceSmoother = new LandmarkSmoother(cfgDetection.landmarkSmoothing);

    holistic.onResults((rawResults) => {
        // Aplicar smoothing a los landmarks
        const results = {
          ...rawResults,
          leftHandLandmarks: leftHandSmoother.smooth(rawResults.leftHandLandmarks),
          rightHandLandmarks: rightHandSmoother.smooth(rawResults.rightHandLandmarks),
          faceLandmarks: faceSmoother.smooth(rawResults.faceLandmarks)
        };
        // --- 1. RENDERIZACIÓN MANOS (CANVAS PRINCIPAL) ---
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Espejo
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            
            // Zoom hands
            if (VISUAL_CONFIG.hands.zoom !== 1.0) {
              const z = VISUAL_CONFIG.hands.zoom;
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.scale(z, z);
              ctx.translate(-canvas.width / 2, -canvas.height / 2);
            }
            
            ctx.globalAlpha = VISUAL_CONFIG.hands.opacity;
            if (results.leftHandLandmarks) drawNeonHand(ctx, results.leftHandLandmarks, HAND_CONNECTIONS);
            if (results.rightHandLandmarks) drawNeonHand(ctx, results.rightHandLandmarks, HAND_CONNECTIONS);
            ctx.restore();
        }

        // --- 2. RENDERIZACIÓN DEL FACE MESH MINI (INSTRUCCIONES) ---
        const miniCanvas = document.getElementById('face-mesh-canvas');
        if (miniCanvas && results.faceLandmarks) {
            const mCtx = miniCanvas.getContext('2d');
            if (miniCanvas.width !== miniCanvas.clientWidth) {
                miniCanvas.width = miniCanvas.clientWidth;
                miniCanvas.height = miniCanvas.clientHeight;
            }
            mCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
            mCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            mCtx.lineWidth = 0.8;
            
            mCtx.beginPath();
            const landmarks = results.faceLandmarks;
            FACEMESH_TESSELATION.forEach(([i, j]) => {
                const p1 = landmarks[i];
                const p2 = landmarks[j];
                const x1 = (1 - p1.x - 0.5) * 2.5 * miniCanvas.height + miniCanvas.width / 2;
                const y1 = (p1.y - 0.5) * 2.5 * miniCanvas.height + miniCanvas.height / 2;
                const x2 = (1 - p2.x - 0.5) * 2.5 * miniCanvas.height + miniCanvas.width / 2;
                const y2 = (p2.y - 0.5) * 2.5 * miniCanvas.height + miniCanvas.height / 2;
                mCtx.moveTo(x1, y1);
                mCtx.lineTo(x2, y2);
            });
            mCtx.stroke();
        }

        // --- 3. PROCESAMIENTO DE GESTOS ---
        const rightHand = results.rightHandLandmarks;
        const leftHand = results.leftHandLandmarks;

        if (rightHand || leftHand) {
            setIsDetected(true);
            const cfg = VISUAL_CONFIG.interaction;
            let maxTouchFactor = 0;

            [leftHand, rightHand].forEach((hand, idx) => {
                if (!hand) return;
                const palm = hand[9];
                
                // Actualizar cursorRef con la posición de la mano dominante (o la última procesada)
                // Invertimos X porque el video está en espejo
                // Aplicamos un margen (zoom) para evitar los bordes distorsionados de la cámara ("ojo de pez")
                const margin = 0.15; // 15% de margen a cada lado
                const remap = (val, min, max) => Math.max(0, Math.min(1, (val - min) / (max - min)));

                cursorRef.current = { 
                    x: remap(1 - palm.x, margin, 1 - margin), 
                    y: remap(palm.y, margin, 1 - margin) 
                };

                const dist = Math.sqrt(Math.pow(palm.x - cfg.targetX, 2) + Math.pow(palm.y - cfg.targetY, 2));
                let touchFactor = Math.max(0, Math.min(1, 1 - (dist / cfg.touchRadius)));
                if (touchFactor > maxTouchFactor) maxTouchFactor = touchFactor;

                const wrist = hand[0];
                let height = Math.max(0, Math.min(1, (1 - wrist.y - 0.3) / 0.4));
                if (idx === 0) leftHandHeightRef.current += (height - leftHandHeightRef.current) * 0.2;
                else rightHandHeightRef.current += (height - rightHandHeightRef.current) * 0.2;
            });

            handStateRef.current += (maxTouchFactor - handStateRef.current) * cfg.smoothing;

            const controlHand = rightHand || leftHand;
            if (controlHand) {
                // Pinch
                const wrist = controlHand[0];
                const rightMidMCP = controlHand[9];
                const distToMCP = Math.sqrt(Math.pow(rightMidMCP.x - wrist.x, 2) + Math.pow(rightMidMCP.y - wrist.y, 2));
                const thumbTip = controlHand[4];
                const indexTip = controlHand[8];
                const pinchDist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
                let pinch = Math.max(0, Math.min(1, 1 - (pinchDist / (distToMCP || 0.001)) / 0.35));
                pinchStateRef.current += (pinch - pinchStateRef.current) * 0.2;

                // Swipe (Detección de velocidad lateral)
                const currentX = controlHand[9].x;
                const currentTime = performance.now();
                const dt = (currentTime - lastPalmTimeRef.current) / 1000;
                
                // Si ha pasado más de 100ms, es una nueva detección o un salto
                // No calculamos velocidad el primer frame para evitar "swipes fantasmas"
                const isNewDetection = dt > 0.1;

                if (dt > 0.01) {
                    if (!isNewDetection) {
                      const vx = (currentX - lastPalmXRef.current) / dt;
                      const cfgSwipe = VISUAL_CONFIG.swipe;
                      // Verificamos umbral de velocidad y que la mano esté en la zona central
                      if (Math.abs(vx) > cfgSwipe.threshold && currentX > cfgSwipe.minX && currentX < cfgSwipe.maxX) {
                          rotationImpulseRef.current = vx * cfgSwipe.intensity;
                      }
                    }
                    lastPalmXRef.current = currentX;
                    lastPalmTimeRef.current = currentTime;
                }

                // Fist
                const cfgFist = VISUAL_CONFIG.fist;
                const fingerTips = [8, 12, 16, 20];
                let avgFingerDist = 0;
                
                // Solo detectar si la mano está en el centro
                const isFistInZone = controlHand[9].x > cfgFist.minX && controlHand[9].x < cfgFist.maxX && 
                                    controlHand[9].y > cfgFist.minY && controlHand[9].y < cfgFist.maxY;

                if (isFistInZone) {
                    fingerTips.forEach(idx => {
                        avgFingerDist += Math.sqrt(Math.pow(controlHand[idx].x - wrist.x, 2) + Math.pow(controlHand[idx].y - wrist.y, 2));
                    });
                    let fist = Math.max(0, Math.min(1, 1 - (avgFingerDist / 4 / (distToMCP || 0.001) - 0.6)));
                    fistStateRef.current += (fist - fistStateRef.current) * cfgFist.smoothing;
                } else {
                    // Si sale de la zona, relajamos el puño suavemente
                    fistStateRef.current *= 0.9;
                }
            }
        } else {
            setIsDetected(false);
            handStateRef.current *= 0.85;
            pinchStateRef.current *= 0.85;
            fistStateRef.current *= 0.85;
            leftHandHeightRef.current *= 0.9;
            rightHandHeightRef.current *= 0.9;
        }

        // Rostro
        if (results.faceLandmarks) {
            const landmarks = results.faceLandmarks;
            const cfgFace = VISUAL_CONFIG.face;
            const dist = (i1, i2) => Math.sqrt(Math.pow(landmarks[i1].x - landmarks[i2].x, 2) + Math.pow(landmarks[i1].y - landmarks[i2].y, 2));
            
            // --- VERIFICACIÓN DE VISIBILIDAD (Dentro del recuadro de instrucciones) ---
            // Usamos la punta de la nariz (Landmark 1) para centrar la detección
            const nose = landmarks[1];
            // Estos rangos coinciden aproximadamente con lo que se ve en el canvas de instrucciones
            const isFaceVisible = nose.x > 0.25 && nose.x < 0.75 && nose.y > 0.3 && nose.y < 0.7;

            if (isFaceVisible) {
                // Detección Sonrisa
                const mouthWidth = dist(61, 291);
                const faceWidth = dist(234, 454); // Distancia entre sienes para normalizar
                let smile = Math.max(0, Math.min(1, (mouthWidth / (faceWidth || 0.1) - cfgFace.smileLower) / (cfgFace.smileUpper - cfgFace.smileLower)));

                // Detección Cejas
                const faceHeight = dist(10, 152); // Altura total cara
                const avgBrowHeight = (dist(65, 159) + dist(295, 386)) / 2;
                let eyebrows = Math.max(0, Math.min(1, (avgBrowHeight / (faceHeight || 0.1) - cfgFace.eyebrowsLower) / (cfgFace.eyebrowsUpper - cfgFace.eyebrowsLower)));

                faceStateRef.current = {
                    smile: faceStateRef.current.smile + (smile - faceStateRef.current.smile) * (smile > faceStateRef.current.smile ? cfgFace.smoothingActive : cfgFace.smoothingRelax),
                    eyebrows: faceStateRef.current.eyebrows + (eyebrows - faceStateRef.current.eyebrows) * (eyebrows > faceStateRef.current.eyebrows ? cfgFace.smoothingActive : cfgFace.smoothingRelax)
                };
            } else {
                // Si el rostro se sale del cuadro, relajamos los gestos suavemente a 0
                faceStateRef.current = {
                    smile: faceStateRef.current.smile * 0.9,
                    eyebrows: faceStateRef.current.eyebrows * 0.9
                };
            }
        }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && holisticRef.current) {
          try { await holisticRef.current.send({ image: videoRef.current }); } catch (e) {}
        }
      },
      width: cfgDetection.cameraWidth,
      height: cfgDetection.cameraHeight
    });
    camera.start();

    return () => {
       if (cameraRef.current) cameraRef.current.stop();
       if (holisticRef.current) holisticRef.current.close();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none' }}>
      <video ref={videoRef} style={{ display: 'none' }} playsInline></video>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
