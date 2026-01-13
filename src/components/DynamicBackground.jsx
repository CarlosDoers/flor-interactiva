import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandControl } from './HandContext';

// Configuración de colores del fondo
const BG_CONFIG = {
  closedColor: '#101010',  // Negro oscuro (mano cerrada)
  openColor: '#4389ac',    // Azul oscuro sutil (mano abierta)
};

export function DynamicBackground() {
  const colorRef = useRef(new THREE.Color(BG_CONFIG.closedColor));
  const { handStateRef } = useHandControl();
  
  const targetClosed = new THREE.Color(BG_CONFIG.closedColor);
  const targetOpen = new THREE.Color(BG_CONFIG.openColor);

  useFrame(() => {
    const handState = handStateRef.current;
    
    // Interpolar entre los dos colores según handState
    colorRef.current.lerpColors(targetClosed, targetOpen, handState);
  });

  return <color ref={colorRef} attach="background" />;
}
