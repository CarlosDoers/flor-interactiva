import React, { useRef, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN DE LA FLOR REACTIVA ---
const FLOWER_CONFIG = {
  baseScale: 1.0,           // Tamaño inicial de la flor
  maxGrowth: 0.15,          // Cuánto crece al abrir la mano (0.15 = 15%). 
                            // NOTA: Si cambias esto, ajusta 'flowerGrowth' en PrismaticBeams.jsx igual
  baseRotationSpeed: 0.1,   // Velocidad de giro normal
  rotationBoost: 0.5,       // Cuánto acelera al interactuar
};

export function Flower(props) {
  const { scene } = useGLTF('/models/flor-2.glb');
  const modelRef = useRef();
  
  // Consumir datos de la mano Y de la cara
  const { handStateRef, faceStateRef } = useHandControl();

  // Colores emocionales (el base se tomará del modelo original)
  const smileColor = useMemo(() => new THREE.Color('#ffaa00'), []); // Dorado/Naranja (Alegría)
  const surpriseColor = useMemo(() => new THREE.Color('#00bfff'), []); // Azul Cian (Sorpresa/Energía)
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Preparamos la escena UNA sola vez con materiales mejorados (Brillo/Metal)
  const enhancedScene = useMemo(() => {
    // Clonamos para no afectar el caché global
    const clone = scene.clone();
    
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clonar material para hacerlo único
        const originalMat = child.material;
        child.material = originalMat.clone();
        
        // Guardamos el color original en userData para recuperarlo después
        // Si tiene textura (map), el color suele ser blanco, si no, es el color del material
        child.userData.originalColor = child.material.color.clone();

        // --- PROPIEDADES VISUALES PRINCIPALES ---
        // Aquí es donde ocurre la magia visual
        child.material.metalness = 0.3;       // Más metálico para reflejar luz
        child.material.roughness = 0.2;       // Liso para brillos definidos
        child.material.envMapIntensity = 2.0; // Intensidad del reflejo del entorno
        
        // Aseguramos que sea StandardMaterial para soportar luces físicas
        if (!(child.material instanceof THREE.MeshStandardMaterial)) {
          const newMat = new THREE.MeshStandardMaterial();
          if (originalMat.map) newMat.map = originalMat.map;
          if (originalMat.color) newMat.color = originalMat.color;
          // Re-aplicar propiedades si tuvimos que crear material nuevo
          newMat.metalness = 0.3;
          newMat.roughness = 0.2;
          newMat.envMapIntensity = 2.0;
          child.material = newMat;
        }
      }
    });
    return clone;
  }, [scene]);

  // Mantenemos el movimiento de rotación existente, ahora reactivo
  useFrame((state, delta) => {
    const handState = handStateRef.current; 
    const { smile, eyebrows } = faceStateRef.current;
    
    if (modelRef.current) {
      // 1. Dinámica de Movimiento (Mano)
      const speed = FLOWER_CONFIG.baseRotationSpeed + (handState * FLOWER_CONFIG.rotationBoost);
      modelRef.current.rotation.y += delta * speed;

      const targetScale = FLOWER_CONFIG.baseScale + (handState * FLOWER_CONFIG.maxGrowth);
      modelRef.current.scale.set(targetScale, targetScale, targetScale);

      // 2. Dinámica de Color (Cara)
      // Recorremos cada mesh para aplicar su color específico
      modelRef.current.traverse((child) => {
          if (child.isMesh && child.material && child.userData.originalColor) {
              // Recuperamos el color original de ESE pétalo/parte
              tempColor.copy(child.userData.originalColor);
              
              // Interpolamos hacia el color de sonrisa
              if (smile > 0.01) {
                  tempColor.lerp(smileColor, smile); 
              }
              
              // Interpolamos hacia el color de sorpresa (puede mezclarse con sonrisa)
              if (eyebrows > 0.01) {
                  tempColor.lerp(surpriseColor, eyebrows);
              }

              // Interpolación suave del material actual hacia el objetivo calculado
              child.material.color.lerp(tempColor, 0.1);
              
              // Opcional: Aumentar emisión si hay emoción fuerte
              const emotionIntensity = Math.max(smile, eyebrows);
              if (child.material.emissive) {
                  child.material.emissive.copy(tempColor);
                  child.material.emissiveIntensity = THREE.MathUtils.lerp(
                      child.material.emissiveIntensity, 
                      emotionIntensity * 0.5, 
                      0.1
                  );
              }
          }
      });
    }
  });

  return (
    <group ref={modelRef} {...props}>
      <primitive object={enhancedScene} />
    </group>
  );
}

useGLTF.preload('/models/flor-2.glb');
