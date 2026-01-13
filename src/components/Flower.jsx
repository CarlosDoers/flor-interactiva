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
  
  // Consumir datos de la mano (OPTIMIZADO: ref)
  const { handStateRef } = useHandControl();

  // Preparamos la escena UNA sola vez con materiales mejorados (Brillo/Metal)
  const enhancedScene = useMemo(() => {
    // Clonamos para no afectar el caché global
    const clone = scene.clone();
    
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clonar material para hacerlo único
        const originalMat = child.material;
        child.material = originalMat.clone();
        
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
    const handState = handStateRef.current; // Leer valor actual sin re-render
    
    if (modelRef.current) {
      // Rotación
      const speed = FLOWER_CONFIG.baseRotationSpeed + (handState * FLOWER_CONFIG.rotationBoost);
      modelRef.current.rotation.y += delta * speed;

      // Escala (Respiración)
      const targetScale = FLOWER_CONFIG.baseScale + (handState * FLOWER_CONFIG.maxGrowth);
      modelRef.current.scale.set(targetScale, targetScale, targetScale);
    }
  });

  return (
    <group ref={modelRef} {...props}>
      <primitive object={enhancedScene} />
    </group>
  );
}

useGLTF.preload('/models/flor-2.glb');
