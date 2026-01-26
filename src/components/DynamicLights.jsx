import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN DE LAS LUCES DINÁMICAS ---
const LIGHT_CONFIG = {
  // Luz Izquierda (controlada por mano izquierda)
  left: {
    position: [-1.5, 1, 0],    // MUY cerca de la flor (en el espacio local del grupo)
    baseColor: '#ffc8aa',      // Naranja suave (mano abajo)
    activeColor: '#ff0000',    // ROJO PURO (mano arriba) - Cambio dramático
    baseIntensity: 4,          // Intensidad base aumentada
    maxIntensity: 20,          // Intensidad MÁXIMA para efecto muy visible
    distance: 10,              // Distancia de alcance de la luz
    decay: 2,                  // Caída de la luz
  },
  // Luz Derecha (controlada por mano derecha)
  right: {
    position: [1.5, 1, 0],     // MUY cerca de la flor (en el espacio local del grupo)
    baseColor: '#b0aaff',      // Morado suave (mano abajo)
    activeColor: '#ff00ff',    // MAGENTA NEÓN (mano arriba) - Cambio dramático
    baseIntensity: 4,          // Intensidad base aumentada
    maxIntensity: 20,          // Intensidad MÁXIMA para efecto muy visible
    distance: 10,              // Distancia de alcance de la luz
    decay: 2,                  // Caída de la luz
  }
};

export function DynamicLights() {
  const leftLightRef = useRef();
  const rightLightRef = useRef();
  
  const { leftHandHeightRef, rightHandHeightRef } = useHandControl();
  
  // Colores pre-creados para interpolación (optimización)
  const leftBaseColor = useRef(new THREE.Color(LIGHT_CONFIG.left.baseColor));
  const leftActiveColor = useRef(new THREE.Color(LIGHT_CONFIG.left.activeColor));
  const rightBaseColor = useRef(new THREE.Color(LIGHT_CONFIG.right.baseColor));
  const rightActiveColor = useRef(new THREE.Color(LIGHT_CONFIG.right.activeColor));
  
  const tempColor = useRef(new THREE.Color());

  useFrame(() => {
    const leftHeight = leftHandHeightRef.current;
    const rightHeight = rightHandHeightRef.current;
    
    // --- LUZ IZQUIERDA (Mano Izquierda) ---
    if (leftLightRef.current) {
      // Interpolar color
      tempColor.current.copy(leftBaseColor.current);
      tempColor.current.lerp(leftActiveColor.current, leftHeight);
      leftLightRef.current.color.copy(tempColor.current);
      
      // Interpolar intensidad
      const targetIntensity = LIGHT_CONFIG.left.baseIntensity + 
        (leftHeight * (LIGHT_CONFIG.left.maxIntensity - LIGHT_CONFIG.left.baseIntensity));
      leftLightRef.current.intensity = THREE.MathUtils.lerp(
        leftLightRef.current.intensity,
        targetIntensity,
        0.15
      );
    }
    
    // --- LUZ DERECHA (Mano Derecha) ---
    if (rightLightRef.current) {
      // Interpolar color
      tempColor.current.copy(rightBaseColor.current);
      tempColor.current.lerp(rightActiveColor.current, rightHeight);
      rightLightRef.current.color.copy(tempColor.current);
      
      // Interpolar intensidad
      const targetIntensity = LIGHT_CONFIG.right.baseIntensity + 
        (rightHeight * (LIGHT_CONFIG.right.maxIntensity - LIGHT_CONFIG.right.baseIntensity));
      rightLightRef.current.intensity = THREE.MathUtils.lerp(
        rightLightRef.current.intensity,
        targetIntensity,
        0.15
      );
    }
  });

  return (
    <>
      <pointLight 
        ref={leftLightRef}
        position={LIGHT_CONFIG.left.position} 
        intensity={LIGHT_CONFIG.left.baseIntensity} 
        color={LIGHT_CONFIG.left.baseColor}
        distance={LIGHT_CONFIG.left.distance}
        decay={LIGHT_CONFIG.left.decay}
      />
      <pointLight 
        ref={rightLightRef}
        position={LIGHT_CONFIG.right.position} 
        intensity={LIGHT_CONFIG.right.baseIntensity} 
        color={LIGHT_CONFIG.right.baseColor}
        distance={LIGHT_CONFIG.right.distance}
        decay={LIGHT_CONFIG.right.decay}
      />
    </>
  );
}
