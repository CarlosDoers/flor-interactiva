import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandControl } from './HandContext';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uInteraction; // 0.0 a 1.0
varying vec2 vUv;

// Función simple de ruido pseudo-aleatorio
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// Ruido suave 2D
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    float t = uTime * 0.2;
    // Coordenadas polares para un efecto radial interesante
    vec2 pos = vUv - 0.5;
    float r = length(pos);
    float a = atan(pos.y, pos.x);
    
    // Crear ondas de color
    float n = noise(pos * 3.0 + t);
    float n2 = noise(pos * 6.0 - t * 1.5);
    
    // Colores prismáticos suaves (cian, magenta, amarillo, etc)
    vec3 c1 = vec3(0.1, 0.5, 0.8); // Azul cristal
    vec3 c2 = vec3(0.8, 0.2, 0.5); // Rosa magenta
    vec3 c3 = vec3(0.1, 0.8, 0.6); // Turquesa
    vec3 c4 = vec3(0.1, 0.1, 0.2); // Fondo oscuro
    
    // Mezcla basada en ruido y posición
    vec3 color = mix(c1, c2, sin(a * 2.0 + n * 4.0) * 0.5 + 0.5);
    color = mix(color, c3, cos(r * 5.0 - t) * 0.5 + 0.5);
    
    // Viñeta oscura - se reduce cuando uInteraction es alto (abres la mano)
    float openFactor = uInteraction * 0.4;
    color = mix(color, c4, smoothstep(0.2 + openFactor, 0.8 + openFactor, r));
    
    // Añadir un poco de "brillo" en las zonas claras
    // Intensifica brillo con interacción
    color += (vec3(0.1) + vec3(0.2 * uInteraction)) * smoothstep(0.6, 1.0, n2);

    gl_FragColor = vec4(color, 1.0);
    
    // Espacio de color correcto
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

export function Background() {
  const meshRef = useRef();
  const { handStateRef } = useHandControl(); // OPTIMIZADO: Ref
  
  const uniforms = React.useMemo(() => ({
    uTime: { value: 0 },
    uInteraction: { value: 0 }
  }), []);

  useFrame((state, delta) => {
    if (meshRef.current?.material) {
        const handState = handStateRef.current; // Lectura sin render
        
        // Acelerar animación de fondo si la mano está abierta
        const speed = 1.0 + (handState * 2.5);
        meshRef.current.material.uniforms.uTime.value += delta * speed;
        
        // Suavizar valor de interacción
        meshRef.current.material.uniforms.uInteraction.value = THREE.MathUtils.lerp(
            meshRef.current.material.uniforms.uInteraction.value,
            handState,
            0.1
        );
    }
  });

  return (
    <mesh ref={meshRef} scale={100}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial 
        side={THREE.BackSide}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
