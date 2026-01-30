import React, { useEffect, useRef } from 'react';
import { Holistic, FACEMESH_TESSELATION, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Camera } from '@mediapipe/camera_utils';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN VISUAL ---
// Ajusta aquí los colores, tamaños y comportamientos visuales
const VISUAL_CONFIG = {
  hands: {
    color: '#00ffee', // Color de las líneas
    lineWidth: 4,     // Grosor de las líneas
    landmarkColor: '#ff0033', // Color de los puntos
    landmarkRadius: 4,        // Tamaño de los puntos
    opacity: 1.0      // Opacidad general de las manos (0.0 - 1.0)
  },
  face: {
    color: 'rgba(224, 224, 224, 0.8)', // Color de la malla (incluye alfa)
    lineWidth: 1,                      // Grosor de la línea
    scale: 0.35,                       // Escala del mini-mapa (0.25 = 25%, 0.35 = 35%)
    margin: 20,                        // Margen desde la esquina
    position: 'bottom-right'           // (No implementado dinámicamente pero indicativo)
  }
};

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
            
            // 2. Dibujar Skeleton/Mesh
            // Configuración de estilo "Holográfico" usando VISUAL_CONFIG
            
            // Estilos para manos
            // Nota: drawConnectors/drawLandmarks no soportan opacidad global directa en el objeto de estilo simple
            // pero podemos usar globalAlpha del context si quisiéramos afectar todo.
            // Para mantener simpleza, usamos los colores definidos.
            
            ctx.globalAlpha = VISUAL_CONFIG.hands.opacity;
            const handConnectionStyle = { color: VISUAL_CONFIG.hands.color, lineWidth: VISUAL_CONFIG.hands.lineWidth };
            const handLandmarkStyle = { color: VISUAL_CONFIG.hands.landmarkColor, lineWidth: 0, radius: VISUAL_CONFIG.hands.landmarkRadius };
            
            // --- CAPA 1: MANOS (PANTALLA COMPLETA) ---
            if (results.leftHandLandmarks) {
               drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, handConnectionStyle);
               drawLandmarks(ctx, results.leftHandLandmarks, handLandmarkStyle);
            }
            if (results.rightHandLandmarks) {
               drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, handConnectionStyle);
               drawLandmarks(ctx, results.rightHandLandmarks, handLandmarkStyle);
            }
            ctx.globalAlpha = 1.0; // Restaurar opacidad

            // --- CAPA 2: CARA (MINI-MAPA ESQUINA INFERIOR DERECHA) ---
            if (results.faceLandmarks) {
                ctx.restore(); // Restaurar para limpiar transformaciones anteriores (Full Screen Mirror)
                ctx.save();    // Guardar nuevo estado limpia

                // Configuración Mini-mapa desde VISUAL_CONFIG
                const scale = VISUAL_CONFIG.face.scale; 
                const margin = VISUAL_CONFIG.face.margin;
                const miniWidth = canvas.width * scale;
                const miniHeight = canvas.height * scale;
                
                // Posicionar en esquina inferior derecha
                // Translate al origen del mini-mapa
                const destX = canvas.width - miniWidth - margin;
                const destY = canvas.height - miniHeight - margin;
                
                ctx.translate(destX, destY);
                
                // Aplicar escala reducida
                ctx.scale(scale, scale);
                
                // Aplicar Espejo (dentro del espacio escalado)
                ctx.translate(canvas.width, 0); 
                ctx.scale(-1, 1);

                // Estilo para la cara
                const faceStyle = { color: VISUAL_CONFIG.face.color, lineWidth: VISUAL_CONFIG.face.lineWidth };
                
                drawConnectors(ctx, results.faceLandmarks, FACEMESH_TESSELATION, faceStyle);
                
                // Nota: No llamamos a restore() aquí porque el restore del final del bloque lo hará, 
                // pero como hicimos un restore/save intermedio, necesitamos alinear el stack.
                // El bloque original tiene un ctx.save() al principio (linea 49) y ctx.restore() al final (linea 77).
                // Al hacer restore() en linea 71, vaciamos ese save inicial.
                // Luego hacemos save().
                // Al final del bloque se llamará restore() que cerrará este nuevo save.
                // Todo cuadra.
            } else {
                 // Si no hay cara, simplemente no hacemos nada extra, 
                 // pero como el bloque principal espera un restore() al final,
                 // y nosotros no rompimos el stack (porque el 'if' no se ejecutó),
                 // el restore() final funcionará con el save() inicial.
                 // PROBLEMA: Si entro en el IF, hago restore+save. Si NO entro, no.
                 // El restore() final de la linea 77 cerrará LO QUE HAYA ABIERTO.
                 // Si entre en IF: Cierra el save() de la linea 72. Correcto.
                 // Si NO entre: Cierra el save() de la linea 49. Correcto.
            }
            
            ctx.restore();
        }

        // 1. PROCESAMIENTO MANOS - GESTO "MOISÉS ABRIENDO LAS AGUAS"
        // Detectamos DOS manos simultáneamente y medimos la separación entre ellas
        const rightHand = results.rightHandLandmarks;
        const leftHand = results.leftHandLandmarks;

        if (rightHand && leftHand) {
            setIsDetected(true);
            
            // Usamos las muñecas (landmark 0) para medir la distancia entre las manos
            const leftWrist = leftHand[0];
            const rightWrist = rightHand[0];
            
            // Calculamos la distancia horizontal (eje X) entre las manos
            const horizontalDist = Math.abs(rightWrist.x - leftWrist.x);
            
            // Normalizamos la distancia (0 = juntas, 1 = muy separadas)
            // Rango típico: 0.05 (juntas) a 0.5+ (separadas)
            let separation = (horizontalDist - 0.05) / 0.35;
            separation = Math.max(0, Math.min(1, separation));
            
            const current = handStateRef.current;
            // Ajuste de velocidades: Separar (suave) vs Juntar (rápido)
            const isSeparating = separation > current;
            const smoothing = isSeparating ? 0.1 : 0.4; // 0.4 para juntar muy rápido
            
            handStateRef.current = current + (separation - current) * smoothing;

            // --- DETECCIÓN DE ALTURA DE CADA MANO (Para control de luces) ---
            // La coordenada Y va de 0 (arriba) a 1 (abajo) en MediaPipe
            // Invertimos para que sea intuitivo: 0 = abajo, 1 = arriba
            
            // Mano izquierda
            let leftHeight = 1 - leftWrist.y;
            // Normalizamos al rango visible típico (0.3 - 0.7)
            leftHeight = (leftHeight - 0.3) / 0.4;
            leftHeight = Math.max(0, Math.min(1, leftHeight));
            
            const currentLeftHeight = leftHandHeightRef.current;
            leftHandHeightRef.current = currentLeftHeight + (leftHeight - currentLeftHeight) * 0.2;
            
            // Mano derecha
            let rightHeight = 1 - rightWrist.y;
            rightHeight = (rightHeight - 0.3) / 0.4;
            rightHeight = Math.max(0, Math.min(1, rightHeight));
            
            const currentRightHeight = rightHandHeightRef.current;
            rightHandHeightRef.current = currentRightHeight + (rightHeight - currentRightHeight) * 0.2;

            // --- NUEVO: Detección de Pinza (Índice vs Pulgar) para color ---
            // Usamos la mano derecha para el gesto de pinza
            const rightMidMCP = rightHand[9];
            const distToMCP = Math.sqrt(Math.pow(rightMidMCP.x - rightWrist.x, 2) + Math.pow(rightMidMCP.y - rightWrist.y, 2));
            
            const thumbTip = rightHand[4];
            const indexTip = rightHand[8];
            const pinchDist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
            const pinchRatio = pinchDist / (distToMCP || 0.001);

            // Si el ratio es bajo (dedos juntos), pinch = 1
            // Umbral aprox 0.3. Invertimos rango.
            let pinch = 1 - (pinchRatio / 0.35);
            pinch = Math.max(0, Math.min(1, pinch));

            const currentPinch = pinchStateRef.current;
            const isPinching = pinch > currentPinch;
            const pinchSmoothing = isPinching ? 0.15 : 0.4;

            pinchStateRef.current = currentPinch + (pinch - currentPinch) * pinchSmoothing;
            
        } else {
            setIsDetected(false);
            // Decay más rápido (0.8) para resetear sensación ágil al perder tracking
            handStateRef.current = handStateRef.current * 0.8;
            pinchStateRef.current = pinchStateRef.current * 0.8;
            leftHandHeightRef.current = leftHandHeightRef.current * 0.9;
            rightHandHeightRef.current = rightHandHeightRef.current * 0.9;
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
