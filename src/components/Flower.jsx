import React, { useRef, useMemo, useEffect } from 'react';
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
  const { scene } = useGLTF('/models/flor-4.glb');
  const modelRef = useRef();
  const targetMeshes = useRef([]); // Optimización: Cache de meshes
  
  // Consumir datos de la mano Y de la cara
  const { handStateRef, faceStateRef, pinchStateRef } = useHandControl();

  // Colores emocionales (el base se tomará del modelo original)
  const smileColor = useMemo(() => new THREE.Color('#ff0033'), []); // Rojo intenso (Alegría/Amor)
  const surpriseColor = useMemo(() => new THREE.Color('#00bfff'), []); // Azul Cian (Sorpresa/Energía)
  const pinchColor = useMemo(() => new THREE.Color('#bc13fe'), []); // Nuevo: Violeta Neón (Pinch)
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
        child.material.metalness = 0.8;       // Más metálico para reflejar luz
        child.material.roughness = 0.5;       // Liso para brillos definidos
        child.material.envMapIntensity = 2.0; // Intensidad del reflejo del entorno
        
        // Aseguramos que sea StandardMaterial para soportar luces físicas
        if (!(child.material instanceof THREE.MeshStandardMaterial)) {
          const newMat = new THREE.MeshStandardMaterial();
          if (originalMat.map) newMat.map = originalMat.map;
          if (originalMat.color) newMat.color = originalMat.color;
          // Re-aplicar propiedades si tuvimos que crear material nuevo
          newMat.metalness = 0.8;
          newMat.roughness = 0.5;
          newMat.envMapIntensity = 2.0;
          child.material = newMat;
        }
      }
    });
    return clone;
  }, [scene]);

  // Optimización: Cache de meshes en useEffect para evitar warnings de render
  useEffect(() => {
    targetMeshes.current = [];
    enhancedScene.traverse((child) => {
      if (child.isMesh && child.material && child.userData.originalColor) {
        targetMeshes.current.push(child);
      }
    });
  }, [enhancedScene]);

  // Mantenemos el movimiento de rotación existente, ahora reactivo
  useFrame((state, delta) => {
    const handState = handStateRef.current; 
    const { smile, eyebrows } = faceStateRef.current;
    const pinch = pinchStateRef.current;
    
    if (modelRef.current) {
      // 1. Dinámica de Movimiento (Mano)
      const speed = FLOWER_CONFIG.baseRotationSpeed + (handState * FLOWER_CONFIG.rotationBoost);
      modelRef.current.rotation.y += delta * speed;

      const targetScale = FLOWER_CONFIG.baseScale + (handState * FLOWER_CONFIG.maxGrowth);
      modelRef.current.scale.set(targetScale, targetScale, targetScale);

      // 2. Dinámica de Color (Cara y Gestos) -- OPTIMIZADO: Itera array plano, no el árbol
      targetMeshes.current.forEach((child) => {
          if (child.userData.originalColor) {
              // Recuperamos el color original
              tempColor.copy(child.userData.originalColor);
              
              // Definimos prioridades de mezcla
              // Pinza (Mano) -> Violeta
              if (pinch > 0.01) tempColor.lerp(pinchColor, pinch);

              // Sonrisa (Cara) -> Dorado
              if (smile > 0.01) tempColor.lerp(smileColor, smile); 
              
              // Sorpresa (Cara) -> Azul
              if (eyebrows > 0.01) tempColor.lerp(surpriseColor, eyebrows);

              // Aplicamos al material suavemente
              child.material.color.lerp(tempColor, 0.1);
              
              // Efecto de emisión (brillo)
              const intensity = Math.max(smile, eyebrows, pinch);
              if (child.material.emissive) {
                  // Si hay intensidad, actualizamos el color emisivo
                  if (intensity > 0.05) child.material.emissive.copy(tempColor);

                  child.material.emissiveIntensity = THREE.MathUtils.lerp(
                      child.material.emissiveIntensity || 0, 
                      intensity * 0.5, 
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

useGLTF.preload('/models/flor-4.glb');
