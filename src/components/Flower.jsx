import React, { useRef, useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandControl } from './HandContext';
import { PrismaticBeams } from './PrismaticBeams';

// --- CONFIGURACIÓN DE LA FLOR REACTIVA ---
const FLOWER_CONFIG = {
  baseScale: 1.0,           // Tamaño inicial de la flor
  maxGrowth: 0.15,          // Cuánto crece al separar las manos (0.15 = 15%). 
                            // NOTA: Si cambias esto, ajusta 'flowerGrowth' en PrismaticBeams.jsx igual
  baseRotationSpeed: 0.1,   // Velocidad de giro normal
  rotationBoost: 0.5,       // Cuánto acelera al interactuar
};

export function Flower(props) {
  const { scene } = useGLTF('/models/flor-4.glb');
  const modelRef = useRef();
  const targetMeshes = useRef([]); // Optimización: Cache de meshes
  
  // Consumir datos de la mano Y de la cara
  const { faceStateRef, fistStateRef, rotationImpulseRef } = useHandControl();

  const tempColor = useMemo(() => new THREE.Color(), []);
  
  // Refs para física de rotación (Swipe)
  const extraVelocityRef = useRef(0);
  const directionRef = useRef(1); // 1 = Derecha, -1 = Izquierda

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
        child.material.metalness = 0.9;       // Más metálico para reflejar luz
        child.material.roughness = 0.4;       // Liso para brillos definidos
        child.material.envMapIntensity = 4.0; // Intensidad del reflejo del entorno
        
        // Aseguramos que sea StandardMaterial para soportar luces físicas
        if (!(child.material instanceof THREE.MeshStandardMaterial)) {
          const newMat = new THREE.MeshStandardMaterial();
          if (originalMat.map) newMat.map = originalMat.map;
          if (originalMat.color) newMat.color = originalMat.color;
          // Re-aplicar propiedades si tuvimos que crear material nuevo
          newMat.metalness = 0.9;
          newMat.roughness = 0.4;
          newMat.envMapIntensity = 4.0;
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

  // Mantenemos el movimiento de rotación existente, ahora reactivo a sonrisa y swipes
  useFrame((state, delta) => {
    const { smile, wink } = faceStateRef.current; 
    const fistState = fistStateRef.current;
    const impulse = rotationImpulseRef.current;
    
    if (modelRef.current) {
      // 1. Dinámica de Movimiento (Swipe/Giro Manual)
      if (Math.abs(impulse) > 0.05) {
        // Invertimos el signo para que la dirección sea intuitiva al espejo
        directionRef.current = Math.sign(impulse) * -1;
        extraVelocityRef.current += Math.abs(impulse);
        rotationImpulseRef.current = 0; // Consumimos el impulso
      }

      // Decaimiento de la velocidad extra (Inercia)
      extraVelocityRef.current *= 0.97; // Un poco más de inercia para que sea fluido

      // Velocidad base + sonrisa.
      const baseSpeed = FLOWER_CONFIG.baseRotationSpeed + (smile * FLOWER_CONFIG.rotationBoost);
      const currentVelocity = (baseSpeed + extraVelocityRef.current) * directionRef.current;
      
      modelRef.current.rotation.y += delta * currentVelocity;

      // 2. Escala: Base + Sonrisa (crece) - Puño (encoge)
      const growth = smile * FLOWER_CONFIG.maxGrowth;
      const shrink = fistState * 0.4; // Factor de encogimiento
      const targetScale = Math.max(0.5, FLOWER_CONFIG.baseScale + growth - shrink);
      
      modelRef.current.scale.set(targetScale, targetScale, targetScale);

      // 3. Dinámica de Color (El guiño pone la flor roja)
      targetMeshes.current.forEach((child) => {
          if (child.userData.originalColor) {
              tempColor.copy(child.userData.originalColor);
              if (wink > 0.01) {
                  tempColor.lerp(new THREE.Color('#ff0000'), wink);
              }
              child.material.color.lerp(tempColor, 0.1);
          }
      });
    }
  });

  return (
    <group ref={modelRef} {...props}>
      <primitive object={enhancedScene} />
      {/* Rayos unificados: se mueven y escalan con el grupo padre */}
      <group position={[0, 0.82, 0]}>
        <PrismaticBeams />
      </group>
    </group>
  );
}

useGLTF.preload('/models/flor-4.glb');
