import React, { useState, useEffect, useRef } from 'react';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN DE UMBRALES PARA EL TUTORIAL ---
const INSTRUCTION_CONFIG = {
  swipe: 0.05,     // Sensibilidad del swipe
  fist: 0.7,      // Cierre de puño
  eyebrows: 0.3,  // Levantar cejas
  smile: 0.3,     // Sonreír
  pinch: 0.4      // Unir dedos
};

const GESTURES = [
  {
    id: 'swipe',
    text: 'Desliza tu mano hacia un lado u otro',
    icon: '« 🖐️ »',
    check: (state) => Math.abs(state.rotationImpulseRef.current) > INSTRUCTION_CONFIG.swipe
  },
  {
    id: 'fist',
    text: 'Cierra el puño para encoger la flor',
    icon: '✊',
    check: (state) => state.fistStateRef.current > INSTRUCTION_CONFIG.fist
  },
  {
    id: 'eyebrows',
    text: 'Levanta las cejas para expandir la luz',
    icon: '🤨',
    check: (state) => state.faceStateRef.current.eyebrows > INSTRUCTION_CONFIG.eyebrows
  },
  {
    id: 'smile',
    text: 'Sonríe para cambiar el color',
    icon: '😊',
    check: (state) => state.faceStateRef.current.smile > INSTRUCTION_CONFIG.smile
  },
  {
    id: 'pinch',
    text: 'Une tus dedos para un brillo íntimo',
    icon: '👌',
    check: (state) => state.pinchStateRef.current > INSTRUCTION_CONFIG.pinch
  }
];

export function InteractiveInstructions() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const state = useHandControl();
  const lastCheckTime = useRef(0);

  useEffect(() => {
    let animationFrame;
    
    const checkGesture = (time) => {
      // Evitar checks demasiado frecuentes
      if (time - lastCheckTime.current > 100) {
        const currentGesture = GESTURES[currentIndex];
        
        if (currentGesture.check(state)) {
          setIsSuccess(true);
          
          // Esperar un poco antes de cambiar al siguiente gesto
          setTimeout(() => {
            setIsSuccess(false);
            setCurrentIndex((prev) => (prev + 1) % GESTURES.length);
          }, 1500);
          
          lastCheckTime.current = time + 2000; // Bloquear checks durante la transición
        } else {
          lastCheckTime.current = time;
        }
      }
      animationFrame = requestAnimationFrame(checkGesture);
    };

    animationFrame = requestAnimationFrame(checkGesture);
    return () => cancelAnimationFrame(animationFrame);
  }, [currentIndex, state]);

  const current = GESTURES[currentIndex];

  return (
    <div className="instructions-container">
      <div className={`instruction-card ${isSuccess ? 'success' : ''}`}>
        <div className="instruction-icon">{current.icon}</div>
        <div className="instruction-text">{current.text}</div>
      </div>
      
      <div className="face-mesh-card">
        <canvas id="face-mesh-canvas" />
      </div>

      <style jsx="true">{`
        .instructions-container {
          position: fixed;
          bottom: 40px;
          left: 40px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          z-index: 100;
          pointer-events: none;
        }

        .instruction-card, .face-mesh-card {
          width: 420px;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          padding: 15px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .instruction-card {
           min-height: 160px;
           text-align: center;
        }

        .instruction-card.success {
          border-color: rgba(0, 255, 238, 0.6);
          background: rgba(0, 255, 238, 0.1);
          transform: scale(1.02);
        }

        .instruction-icon {
          font-size: 32px;
          margin-bottom: 15px;
          color: white;
          filter: drop-shadow(0 0 8px rgba(255,255,255,0.3));
        }

        .instruction-text {
          color: white;
          font-family: 'Inter', sans-serif;
          font-size: 18px;
          line-height: 1.4;
          font-weight: 300;
          letter-spacing: 0.3px;
        }

        .face-mesh-card {
          height: 300px;
          padding: 15px;
          overflow: hidden;
        }

        #face-mesh-canvas {
          width: 100%;
          height: 100%;
          object-fit: contain;
          opacity: 0.9;
        }

        @keyframes pulseSuccess {
          0% { box-shadow: 0 0 0 0 rgba(0, 255, 238, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(0, 255, 238, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 255, 238, 0); }
        }

        .instruction-card.success {
          animation: pulseSuccess 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
