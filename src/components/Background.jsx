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
precision mediump float;
uniform float uTime;
uniform float uInteraction; // 0.0 a 1.0
varying vec2 vUv;

float Hash21(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Ruido bilineal rápido
float FastNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    
    float a = Hash21(i);
    float b = Hash21(i + vec2(1.0, 0.0));
    float c = Hash21(i + vec2(0.0, 1.0));
    float d = Hash21(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    float t = uTime * 0.2;
    vec2 pos = vUv - 0.5;
    float r = length(pos);
    float a = atan(pos.y, pos.x);
    
    float n = FastNoise(pos * 3.0 + t);
    float n2 = FastNoise(pos * 6.0 - t * 1.5);
    
    vec3 c1 = vec3(0.1, 0.5, 0.8);
    vec3 c2 = vec3(0.8, 0.2, 0.5);
    vec3 c3 = vec3(0.1, 0.8, 0.6);
    vec3 c4 = vec3(0.05, 0.05, 0.1); // Fondo un poco más profundo
    
    vec3 color = mix(c1, c2, sin(a * 2.0 + n * 4.0) * 0.5 + 0.5);
    color = mix(color, c3, cos(r * 5.0 - t) * 0.5 + 0.5);
    
    float openFactor = uInteraction * 0.4;
    color = mix(color, c4, vUv.y * 0.3 + smoothstep(0.2 + openFactor, 0.9 + openFactor, r));
    
    color += (0.1 + 0.2 * uInteraction) * smoothstep(0.6, 1.0, n2);

    gl_FragColor = vec4(color, 1.0);
    
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
      <sphereGeometry args={[1, 32, 32]} />
      <shaderMaterial 
        side={THREE.BackSide}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
