import React, { useEffect, useRef } from 'react';
import { Holistic, FACEMESH_TESSELATION, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Camera } from '@mediapipe/camera_utils';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN VISUAL ---
// Ajusta aquí los colores, tamaños y comportamientos visuales
const VISUAL_CONFIG = {
  hands: {
    color: '#00ffee',       // Color exterior/aura
    coreColor: '#ffffff',    // Color del núcleo de la línea
    glowColor: '#00ffee',    // Color del resplandor (shadow)
    glowRadius: 15,          // Intensidad del resplandor
    lineWidth: 3,            // Grosor de la línea exterior
    coreWidth: 1.5,          // Grosor del núcleo blanco
    landmarkRadius: 4,       // Radio de los puntos (nodos)
    opacity: 0.8,            // Opacidad general
    zoom: 1.25,              // ZOOM DE LAS MANOS: 1.0 = normal, 1.5 = 50% más grandes
  },
  face: {
    color: 'rgba(224, 224, 224, 0.4)', 
    lineWidth: 0.5,
    scale: 0.45,             // Tamaño de la caja del mini-mapa
    zoom: 2.0,               // ZOOM DE LA CARA: Para verla de cerca aunque el usuario esté lejos
    autoCenter: true,        // Centrar automáticamente la cara en el recorte
    margin: 30,
    offsetX: 0,              // Ajuste fino horizontal
    offsetY: 0,              // Ajuste fino vertical
    position: 'bottom-right'
  },
  interaction: {
    targetX: 0.5,        // Centro horizontal de la flor (0.5 = centro pantalla)
    targetY: 0.5,        // Centro vertical de la flor (0.5 = centro pantalla)
    touchRadius: 0.25,   // Cuán cerca hay que estar para activar (0.1 - 0.5 típico)
    smoothing: 0.15      // Suavizado de la interacción
  }
};

// Función auxiliar para dibujo estilo Neón/Holográfico
function drawNeonHand(ctx, landmarks, connections) {
  if (!landmarks) return;

  const { color, coreColor, glowColor, glowRadius, lineWidth, coreWidth, landmarkRadius } = VISUAL_CONFIG.hands;

  ctx.save();
  
  // 1. Dibujar Conexiones (Líneas)
  connections.forEach(([i, j]) => {
    const start = landmarks[i];
    const end = landmarks[j];
    
    // Capa de Resplandor (Glow)
    ctx.beginPath();
    ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
    ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
    
    ctx.shadowBlur = glowRadius;
    ctx.shadowColor = glowColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Capa de Núcleo (Core) - Brillo central blanco
    ctx.shadowBlur = 0;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = coreWidth;
    ctx.stroke();
  });

  // 2. Dibujar Puntos (Nodos/Articulaciones)
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
  const { handStateRef, faceStateRef, pinchStateRef, leftHandHeightRef, rightHandHeightRef, setIsDetected } = useHandControl();
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
      modelComplexity: 0, // Optimización: 0 (Lite) para mejor rendimiento
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      refineFaceLandmarks: true // Crítico para detección de iris/labios precisos
    });

    // --- PROCESADO ---
    holistic.onResults((results) => {
        // --- VISUALIZACIÓN DEBUG (CANVAS) ---
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas && video) {
            const ctx = canvas.getContext('2d');
            
            // Ajustar tamaño del canvas a la ventana para pantalla completa
            if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                 canvas.width = window.innerWidth;
                 canvas.height = window.innerHeight;
            }

            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 1. Configurar Espejo (solo coordenadas para landmarks)
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            
            // --- NUEVO: Zoom Global de Manos ---
            if (VISUAL_CONFIG.hands.zoom !== 1.0) {
              const z = VISUAL_CONFIG.hands.zoom;
              // Escalar desde el centro del canvas
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.scale(z, z);
              ctx.translate(-canvas.width / 2, -canvas.height / 2);
            }
            
            // 2. Dibujar Skeleton/Mesh usando el nuevo sistema Neon
            ctx.globalAlpha = VISUAL_CONFIG.hands.opacity;
            
            // --- CAPA 1: MANOS (PANTALLA COMPLETA) ---
            if (results.leftHandLandmarks) {
               drawNeonHand(ctx, results.leftHandLandmarks, HAND_CONNECTIONS);
            }
            if (results.rightHandLandmarks) {
               drawNeonHand(ctx, results.rightHandLandmarks, HAND_CONNECTIONS);
            }
            ctx.globalAlpha = 1.0; // Restaurar opacidad

            // --- CAPA 2: CARA (MINI-MAPA CON ZOOM E INTELIGENCIA) ---
            if (results.faceLandmarks) {
                ctx.restore(); 
                ctx.save();   

                const cfg = VISUAL_CONFIG.face;
                const canvasW = canvas.width;
                const canvasH = canvas.height;
                const boxW = canvasW * cfg.scale;
                const boxH = canvasH * cfg.scale;
                
                // Posicionar caja
                const destX = canvasW - boxW - cfg.margin + cfg.offsetX;
                const destY = canvasH - boxH - cfg.margin + cfg.offsetY;
                ctx.translate(destX, destY);
                
                // Clipping (para que el zoom no se salga de la caja)
                ctx.beginPath();
                ctx.rect(0, 0, boxW, boxH);
                ctx.clip();

                // Aplicar escala del contenedor
                ctx.scale(cfg.scale, cfg.scale);
                
                // Centrar y Zoomear sobre la cara
                if (cfg.autoCenter) {
                    const face = results.faceLandmarks;
                    // El landmark 1 es la punta de la nariz, punto central ideal
                    const faceCX = face[1].x;
                    const faceCY = face[1].y;

                    // 1. Mover al centro del mini-mapa (en coordenadas base 0-canvasW)
                    ctx.translate(canvasW / 2, canvasH / 2);
                    
                    // 2. Aplicar ZOOM
                    ctx.scale(cfg.zoom, cfg.zoom);
                    
                    // 3. Mover para que la nariz (espejada) esté en el centro
                    // Como el video está espejado en el mini-mapa, X es (1 - faceCX)
                    ctx.translate(-(1 - faceCX) * canvasW, -faceCY * canvasH);
                }

                // Espejo (solo si no se aplicó arriba en el autoCenter de forma implícita o si queremos mantener lógica clara)
                // Si no hay autoCenter, usamos el frame completo escalado
                if (!cfg.autoCenter) {
                    ctx.translate(canvasW, 0); 
                    ctx.scale(-1, 1);
                    ctx.scale(cfg.zoom, cfg.zoom);
                    // (Aquí el zoom escalaría desde top-left, menos útil)
                } else {
                    // En el modo autoCenter, el translate ya maneja el espejo (1-faceCX)
                    // pero necesitamos que la geometría interna (drawConnectors) se dibuje espejada
                    ctx.translate(canvasW, 0); 
                    ctx.scale(-1, 1);
                }

                const faceStyle = { color: cfg.color, lineWidth: cfg.lineWidth };
                drawConnectors(ctx, results.faceLandmarks, FACEMESH_TESSELATION, faceStyle);
            } 

            
            ctx.restore();
        }

        // 1. PROCESAMIENTO MANOS - INTERACCIÓN POR PROXIMIDAD ("TOCAR LA FLOR")
        const rightHand = results.rightHandLandmarks;
        const leftHand = results.leftHandLandmarks;

        if (rightHand || leftHand) {
            setIsDetected(true);
            
            const cfg = VISUAL_CONFIG.interaction;
            let maxTouchFactor = 0;

            // Procesar cada mano detectada
            [leftHand, rightHand].forEach((hand, idx) => {
                if (!hand) return;

                // Usamos el punto 9 (Palma / Base del dedo corazón) como referencia de posición
                const palm = hand[9];
                
                // Calcular distancia euclidiana al centro de la flor (normalizado 0-1)
                const dist = Math.sqrt(
                    Math.pow(palm.x - cfg.targetX, 2) + 
                    Math.pow(palm.y - cfg.targetY, 2)
                );

                // Calcular factor de toque (1 = en el centro, 0 = fuera del radio)
                let touchFactor = 1 - (dist / cfg.touchRadius);
                touchFactor = Math.max(0, Math.min(1, touchFactor));
                
                if (touchFactor > maxTouchFactor) maxTouchFactor = touchFactor;

                // --- ALTURA DE MANO (Control de Luces independiente) ---
                // Mantenemos la lógica de altura para las luces dinámicas
                const wrist = hand[0];
                let height = 1 - wrist.y;
                height = (height - 0.3) / 0.4;
                height = Math.max(0, Math.min(1, height));

                if (idx === 0) { // Mano Izquierda
                    leftHandHeightRef.current += (height - leftHandHeightRef.current) * 0.2;
                } else { // Mano Derecha
                    rightHandHeightRef.current += (height - rightHandHeightRef.current) * 0.2;
                }
            });

            // Actualizar estado general de la flor (handStateRef)
            const currentHandState = handStateRef.current;
            handStateRef.current = currentHandState + (maxTouchFactor - currentHandState) * cfg.smoothing;

            // --- DETECCIÓN DE PINZA (Color) ---
            // Usamos la mano derecha preferentemente para el pinch o la primera que se encuentre
            const controlHand = rightHand || leftHand;
            if (controlHand) {
                const wrist = controlHand[0];
                const rightMidMCP = controlHand[9];
                const distToMCP = Math.sqrt(Math.pow(rightMidMCP.x - wrist.x, 2) + Math.pow(rightMidMCP.y - wrist.y, 2));
                const thumbTip = controlHand[4];
                const indexTip = controlHand[8];
                const pinchDist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
                const pinchRatio = pinchDist / (distToMCP || 0.001);
                
                let pinch = 1 - (pinchRatio / 0.35);
                pinch = Math.max(0, Math.min(1, pinch));
                
                const currentPinch = pinchStateRef.current;
                pinchStateRef.current = currentPinch + (pinch - currentPinch) * 0.2;
            }
            
        } else {
            setIsDetected(false);
            handStateRef.current *= 0.85;
            pinchStateRef.current *= 0.85;
            leftHandHeightRef.current *= 0.9;
            rightHandHeightRef.current *= 0.9;
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

            const isSmiling = smile > currentSmile;
            const smileSmoothing = isSmiling ? 0.1 : 0.4;

            const isBrowsing = eyebrows > currentBrows;
            const browSmoothing = isBrowsing ? 0.1 : 0.4;
            
            faceStateRef.current = {
                smile: currentSmile + (smile - currentSmile) * smileSmoothing,
                eyebrows: currentBrows + (eyebrows - currentBrows) * browSmoothing
            };
        } else {
             // Relajar cara más rápido si no se detecta
             faceStateRef.current = {
                smile: faceStateRef.current.smile * 0.8,
                eyebrows: faceStateRef.current.eyebrows * 0.8
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
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none' }}>
      {/* Ocultamos el video raw, mostramos el canvas procesado */}
      <video ref={videoRef} style={{ display: 'none' }} playsInline></video>
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'block'
        }} 
      />
    </div>
  );
}
