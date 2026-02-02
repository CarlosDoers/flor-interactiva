import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN DE LOS RAYOS (Aspecto Visual) ---
const BEAM_CONFIG = {
  count: 10,                // Cantidad de rayos
  radius: 0.05,             // Radio de la esfera de emisión (superficie de la flor)
  angleSpread: Math.PI * 0.4, // Ángulo de apertura (PI/2 = 90°, PI * 0.4 = 80°)
  minLength: 0.5,           // Longitud mínima
  maxLength: 3.2,           // Longitud máxima
  baseOpacity: 0.3,         // Opacidad base (mano cerrada)
  thicknessBase: 0.03,      // Grosor en la base (AUMENTADO de 0.016 a 0.05)
  thicknessTip: 0.001,      // Grosor en la punta (AUMENTADO de 0.001 a 0.015)
  rotationSpeed: 0.1,       // Velocidad de rotación base
  fresnelSoftness: 0.4,     // NUEVO: Cuánto se difuminan los bordes (0.0 = nítido, 1.0 = muy suave)
};

// --- CONFIGURACIÓN DE LA INTERACCIÓN (Gesto de la mano) ---
const INTERACTION_CONFIG = {
  flowerGrowth: 0.15,       // Cuánto crece la flor (y suben los rayos) - 0.15 = 15%
  rotationBoost: 0.5,       // Cuánto acelera la rotación al separar las manos
  beamLengthScale: 4.2,     // Escala total de los rayos (se multiplica por handState)
  opacityBoost: 2.9,        // Brillo total de los rayos (se multiplica por handState)
};

const BeamShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(1, 1, 1) },
    uOpacity: { value: BEAM_CONFIG.baseOpacity }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uTime;

    // --- Simplex Noise 2D (Clean Implementation) ---
    vec3 permute(vec3 x) { 
        return mod(((x*34.0)+1.0)*x, 289.0); 
    }

    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // 1. Textura de "Humo"
      float noiseVal = snoise(vec2(vUv.x * 4.0, vUv.y * 2.0 - uTime * 0.5));
      float density = smoothstep(-0.2, 0.8, noiseVal); 

      // 2. Caída vertical
      float beamVertical = smoothstep(1.0, 0.0, vUv.y);
      
      // 3. Fresnel agresivo
      float fresnel = abs(dot(viewDir, normal));
      float lateralFade = smoothstep(0.0, 0.5, fresnel);
      
      // Combinamos
      float alpha = beamVertical * lateralFade * density * uOpacity;
      vec3 finalColor = uColor + (density * 0.2); 

      if (alpha < 0.01) discard;
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide
};

// Función helper externa para generar los rayos
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
  const [beams] = useState(() => generateBeams());
  const { handStateRef } = useHandControl();
  
  const FLOWER_HEAD_HEIGHT = 0.8;

  useFrame((state, delta) => {
    const handState = handStateRef.current; 
    
    if (groupRef.current) {
      // 1. Sincronización de Posición y Escala con la Flor
      const expansion = handState * INTERACTION_CONFIG.flowerGrowth;
      const flowerScale = 1.0 + expansion;
      groupRef.current.scale.setScalar(flowerScale);
      groupRef.current.position.y = FLOWER_HEAD_HEIGHT * expansion;

      // 2. Animación de Rotación
      const speed = BEAM_CONFIG.rotationSpeed + (handState * INTERACTION_CONFIG.rotationBoost);
      groupRef.current.rotation.y += delta * speed;
      
      // 3. Modulación de los rayos existentes
      groupRef.current.children.forEach(childGroup => {
          const targetBeamScale = handState * INTERACTION_CONFIG.beamLengthScale;
          childGroup.scale.y = THREE.MathUtils.lerp(childGroup.scale.y, targetBeamScale, 0.1);
          
          if (childGroup.children.length > 0) {
              const mesh = childGroup.children[0];
              
              if (mesh.material && mesh.material.uniforms) {
                 // Actualizar tiempo para animación de ruido
                 mesh.material.uniforms.uTime.value = state.clock.elapsedTime;

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
