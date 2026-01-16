import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN DE LOS RAYOS (Aspecto Visual) ---
const BEAM_CONFIG = {
  count: 12,                // Cantidad de rayos
  radius: 0.05,             // Radio de la esfera de emisión (superficie de la flor)
  angleSpread: Math.PI * 0.4, // Ángulo de apertura (PI/2 = 90°, PI * 0.4 = 80°)
  minLength: 0.5,           // Longitud mínima
  maxLength: 3.2,           // Longitud máxima
  baseOpacity: 0.5,         // Opacidad base (mano cerrada)
  thicknessBase: 0.020,     // Grosor en la base
  thicknessTip: 0.002,      // Grosor en la punta
  rotationSpeed: 0.1,       // Velocidad de rotación base
};

// --- CONFIGURACIÓN DE LA INTERACCIÓN (Gesto de la mano) ---
const INTERACTION_CONFIG = {
  flowerGrowth: 0.15,       // Cuánto crece la flor (y suben los rayos) - 0.15 = 15%
  rotationBoost: 0.5,       // Cuánto acelera la rotación al abrir la mano
  beamLengthScale: 1.2,     // Cuánto se estiran los rayos (valor añadido a escala 1.0)
                            // 1.2 significa que llegará a ser 2.2 veces su tamaño original
  opacityBoost: 0.4,        // Cuánto brillo añade abrir la mano
};

const BeamShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(1, 1, 1) },
    uOpacity: { value: BEAM_CONFIG.baseOpacity }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform vec3 uColor;
    uniform float uOpacity;
    
    void main() {
      // El rayo empieza fuerte en la base (vUv.y = 0) y desaparece hacia afuera
      float beam = 1.0 - vUv.y;
      beam = pow(beam, 3.0); // Caída más pronunciada
      
      // Suavizar también los bordes laterales
      float edge = 1.0 - smoothstep(0.3, 0.5, abs(vUv.x - 0.5));
      
      // Opacidad configurable
      gl_FragColor = vec4(uColor, beam * edge * uOpacity);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide
};

// Función helper externa para generar los rayos
// Al estar fuera del componente, evitamos problemas de pureza en el render directo
const generateBeams = () => {
  return Array.from({ length: BEAM_CONFIG.count }, (_, i) => {
    // Distribución aleatoria
    const phi = Math.random() * BEAM_CONFIG.angleSpread; 
    const theta = Math.random() * Math.PI * 4; 
    
    const x = BEAM_CONFIG.radius * Math.sin(phi) * Math.cos(theta);
    const y = BEAM_CONFIG.radius * Math.cos(phi);
    const z = BEAM_CONFIG.radius * Math.sin(phi) * Math.sin(theta);
    
    const dir = new THREE.Vector3(x, y, z).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    
    return {
      position: [x, y, z],
      rotation: [euler.x, euler.y, euler.z],
      length: BEAM_CONFIG.minLength + Math.random() * (BEAM_CONFIG.maxLength - BEAM_CONFIG.minLength),
      // HSL: H (tono arcoíris), S (saturación 0.4 = colores suaves), L (luminosidad 0.78 = claros/pastel)
      color: new THREE.Color().setHSL((i / BEAM_CONFIG.count + Math.random() * 0.1) % 1, 0.4, 0.78),
    };
  });
};

export function PrismaticBeams() {
  const groupRef = useRef();
  // Usamos lazy initial state para calcular los rayos una sola vez al montar
  const [beams] = useState(() => generateBeams());
  
  // Consumir el contexto de la mano
  // OPTIMIZACIÓN: Usamos `handStateRef` en lugar de estado para leer sin re-renderizar
  const { handStateRef } = useHandControl();
  
  // Altura aproximada del centro de la flor (coincide con App.jsx)
  const FLOWER_HEAD_HEIGHT = 0.8;

  useFrame((state, delta) => {
    const handState = handStateRef.current; // Leer valor actual del ref
    
    if (groupRef.current) {
      // 1. Sincronización de Posición y Escala con la Flor
      // La flor crece según INTERACTION_CONFIG.flowerGrowth
      const expansion = handState * INTERACTION_CONFIG.flowerGrowth;
      const flowerScale = 1.0 + expansion;
      
      // Escalar el grupo entero para que el radio de emisión crezca con la flor
      groupRef.current.scale.setScalar(flowerScale);
      
      // Mover el grupo hacia arriba porque la flor crece desde su base
      groupRef.current.position.y = FLOWER_HEAD_HEIGHT * expansion;

      // 2. Animación de Rotación
      const speed = BEAM_CONFIG.rotationSpeed + (handState * INTERACTION_CONFIG.rotationBoost);
      groupRef.current.rotation.y += delta * speed;
      
      // 3. Modulación de los rayos existentes
      groupRef.current.children.forEach(childGroup => {
          // Escalar el GRUPO contenedor en Y estira todo el sistema de coordenadas local
          // Base 1.0 + (estado * factor de estiramiento)
          const targetBeamScale = 1.0 + (handState * INTERACTION_CONFIG.beamLengthScale);
          childGroup.scale.y = THREE.MathUtils.lerp(childGroup.scale.y, targetBeamScale, 0.1);
          
          if (childGroup.children.length > 0) {
              const mesh = childGroup.children[0];
              
              // SOLO modificamos la opacidad del material
              if (mesh.material && mesh.material.uniforms) {
                 const targetOpacity = BEAM_CONFIG.baseOpacity + (handState * INTERACTION_CONFIG.opacityBoost);
                 mesh.material.uniforms.uOpacity.value = THREE.MathUtils.lerp(
                     mesh.material.uniforms.uOpacity.value, 
                     targetOpacity, 
                     0.1
                 );
              }
          }
      });
    }
  });

  return (
    <group ref={groupRef}>
      {beams.map((beam, i) => (
        <group key={i} position={beam.position} rotation={beam.rotation}>
           {/* El cilindro crece hacia Y+, así que lo desplazamos para que nazca en 0 */}
           <mesh position={[0, beam.length / 2, 0]}>
            {/* Muy fino en la punta, un poco más grueso en la base */}
            <cylinderGeometry args={[BEAM_CONFIG.thicknessTip, BEAM_CONFIG.thicknessBase, beam.length, 6, 1, true]} />
            
            {/* 
                CORRECCIÓN DE COLOR:
                Definimos el shaderMaterial explícitamente con sus uniforms únicos para cada rayo.
                Esto evita que compartan la referencia de "uColor" y todos se vean iguales.
            */}
            <shaderMaterial 
               vertexShader={BeamShaderMaterial.vertexShader}
               fragmentShader={BeamShaderMaterial.fragmentShader}
               transparent={true}
               depthWrite={false}
               blending={THREE.AdditiveBlending}
               side={THREE.DoubleSide}
               uniforms={{
                 uTime: { value: 0 },
                 uColor: { value: beam.color }, // Color único por instancia
                 uOpacity: { value: BEAM_CONFIG.baseOpacity }
               }}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
