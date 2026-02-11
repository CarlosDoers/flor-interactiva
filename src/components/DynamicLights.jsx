import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN DE LAS LUCES DINÁMICAS ---
const LIGHT_CONFIG = {
  // Luz Izquierda (controlada por mano izquierda)
  left: {
    position: [-1.5, 1, 0],    // MUY cerca de la flor (en el espacio local del grupo)
    baseColor: '#8dff30',      // Naranja suave (mano abajo)
    activeColor: '#00cb00',    // ROJO PURO (mano arriba) - Cambio dramático
    baseIntensity: 5,          // Subido de 1.5 a 5
    maxIntensity: 50,          // Subido de 8 a 50
    distance: 15,              // Radio un poco más amplio
    decay: 2,                  // Caída de la luz
  },
  // Luz Derecha (controlada por mano derecha)
  right: {
    position: [1.5, 1, 0],     // MUY cerca de la flor (en el espacio local del grupo)
    baseColor: '#b0aaff',      // Morado suave (mano abajo)
    activeColor: '#ffd900',    // MAGENTA NEÓN (mano arriba) - Cambio dramático
    baseIntensity: 5,          // Subido de 2 a 5
    maxIntensity: 80,          // Subido de 12 a 80
    distance: 15,              // Distancia de alcance de la luz
    decay: 2,                  // Caída de la luz
  },
  // LUZ DE GESTOS FACIALES (Efecto dramático de teatro)
  face: {
    // Luz Principal (Frontal/Superior)
    position: [0, 3, 2],
    smileColor: '#00ccff',     // Cian (Ahora para sonrisa)
    winkColor: '#ff2200',      // Rojo (Ahora para guiño)
    maxIntensity: 120,          
    distance: 15,
    angle: 0.6,
    penumbra: 0.6,             
    
    // Luz de Contorno (Rim Light)
    rimPosition: [0, 2, 5],
    rimIntensity: 18,          
  },
  // GESTO DE PINZA
  pinch: {
    color: '#bc13fe',
    influence: 0.8             // Cuánto domina el color violeta
  }
};

export function DynamicLights() {
  const leftLightRef = useRef();
  const rightLightRef = useRef();
  const faceMainLightRef = useRef();
  const faceRimLightRef = useRef();
  
  const { leftHandHeightRef, rightHandHeightRef, faceStateRef, pinchStateRef } = useHandControl();
  
  // Colores pre-creados para interpolación (optimización)
  const leftBaseColor = useRef(new THREE.Color(LIGHT_CONFIG.left.baseColor));
  const leftActiveColor = useRef(new THREE.Color(LIGHT_CONFIG.left.activeColor));
  const rightBaseColor = useRef(new THREE.Color(LIGHT_CONFIG.right.baseColor));
  const rightActiveColor = useRef(new THREE.Color(LIGHT_CONFIG.right.activeColor));
  
  const tempColor = useRef(new THREE.Color());
  const faceSmileColor = useRef(new THREE.Color(LIGHT_CONFIG.face.smileColor));
  const faceWinkColor = useRef(new THREE.Color(LIGHT_CONFIG.face.winkColor));
  const pinchColor = useRef(new THREE.Color(LIGHT_CONFIG.pinch.color));

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

    // --- LUCES DE GESTOS (Cara y Pinch unidos) ---
    const { smile, wink } = faceStateRef.current;
    const pinch = pinchStateRef.current;
    
    // 1. Calculamos intensidad combinada
    const gestureIntensity = Math.max(smile, wink, pinch * 0.8);
    
    // 2. Prioridad de color: Wink (Rojo) > Smile (Cian) > Pinch
    tempColor.current.copy(faceSmileColor.current);
    if (wink > 0.01) {
      tempColor.current.lerp(faceWinkColor.current, wink);
    }
    
    // 3. Mezclamos con el color de la pinza si existe
    if (pinch > 0.01) {
      tempColor.current.lerp(pinchColor.current, pinch * 0.8);
    }

    // APLICAR A LUZ FRONTAL (Spot)
    if (faceMainLightRef.current) {
      faceMainLightRef.current.color.copy(tempColor.current);
      const targetIntensity = gestureIntensity * LIGHT_CONFIG.face.maxIntensity;
      faceMainLightRef.current.intensity = THREE.MathUtils.lerp(
        faceMainLightRef.current.intensity, 
        targetIntensity, 
        0.1
      );
    }

    // APLICAR A LUZ DE CONTORNO (Rim)
    if (faceRimLightRef.current) {
      faceRimLightRef.current.color.copy(tempColor.current);
      const targetRimIntensity = gestureIntensity * LIGHT_CONFIG.face.rimIntensity;
      faceRimLightRef.current.intensity = THREE.MathUtils.lerp(
        faceRimLightRef.current.intensity, 
        targetRimIntensity, 
        0.1
      );
    }

    // 4. APLICAR INFLUENCIA DE PINCH A LAS LUCES LATERALES (solo color)
    if (pinch > 0.01) {
      [leftLightRef, rightLightRef].forEach(ref => {
        if (ref.current) {
          ref.current.color.lerp(pinchColor.current, pinch * 0.4);
        }
      });
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
      
      {/* Luz Focal de Cara (SpotLight para más drama) */}
      <spotLight 
        ref={faceMainLightRef}
        position={LIGHT_CONFIG.face.position}
        intensity={0}
        color={LIGHT_CONFIG.face.smileColor}
        distance={LIGHT_CONFIG.face.distance}
        angle={LIGHT_CONFIG.face.angle}
        penumbra={LIGHT_CONFIG.face.penumbra}
        decay={1}
      />

      {/* Luz de Contorno (Aporta profundidad y resalta la silueta) */}
      <pointLight 
        ref={faceRimLightRef}
        position={LIGHT_CONFIG.face.rimPosition}
        intensity={0}
        color={LIGHT_CONFIG.face.smileColor}
        distance={10}
        decay={1}
      />
    </>
  );
}
