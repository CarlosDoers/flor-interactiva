import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- CONFIGURACIÓN DE RENDIMIENTO ---
const SHADER_CONFIG = {
  NUM_STARS: 12,        
  NUM_BOUNCES: 3,       
  FLOOR_REFLECT: true, 
  STAR_SIZE: 0.02       
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision mediump float;
  varying vec2 vUv;
  uniform float iTime;
  uniform vec2 iResolution;

  // Optimized "Dying Universe"
  #define NUM_STARS ${SHADER_CONFIG.NUM_STARS}
  #define NUM_BOUNCES ${SHADER_CONFIG.NUM_BOUNCES}
  ${SHADER_CONFIG.FLOOR_REFLECT ? '#define FLOOR_REFLECT' : '// #define FLOOR_REFLECT'}
  
  const vec3 up = vec3(0., 1., 0.);
  const float pi = 3.14159;
  const float STARSIZE = ${SHADER_CONFIG.STAR_SIZE};
  
  #define saturate(x) clamp(x, 0., 1.)

  // Hash más optimizado
  float Hash11(float p) {
      return fract(sin(p * 12.9898) * 43758.5453);
  }

  vec4 Hash41(float p) {
      return fract(sin(vec4(p, p + 1.0, p + 2.0, p + 3.0) * 12.9898) * 43758.5453) * 2.0 - 1.0;
  }

  // Simplificación de Bounce para evitar bucles dinámicos
  float BounceNorm(float t, float decay) {
      float h1 = decay;
      float h2 = h1 * decay;
      float h3 = h2 * decay;
      
      float hd1 = sqrt(h1);
      float hd2 = sqrt(h2);
      float hd3 = sqrt(h3);
      
      float halfDuration = 0.5 + hd1 + hd2 + hd3;
      t *= halfDuration * 2.0;
      
      float y = 1.0 - t * t;
      
      t -= (1.0 + hd1);
      y = max(y, h1 - t * t);
      
      t -= (hd1 + hd2);
      y = max(y, h2 - t * t);
      
      t -= (hd2 + hd3);
      y = max(y, h3 - t * t);
      
      return saturate(y);
  }

  struct ray { vec3 o, d; };

  vec3 ClosestPoint(ray r, vec3 p) {
      return r.o + max(0., dot(p - r.o, r.d)) * r.d;
  }

  void main() {
      vec2 uv = (vUv - 0.5);
      uv.y *= iResolution.y / iResolution.x;
      
      float time = iTime * 0.4;
      float t = time * pi * 0.1;
      
      // Colores dinámicos
      vec4 cool = vec4(sin(t), cos(t * 0.23), cos(t * 0.345), 1.0) * 0.5 + 0.5;
      vec4 hot = vec4(sin(t * 2.0), cos(t * 0.66), cos(t * 0.345), 1.0) * 0.5 + 0.5;
      hot = mix(hot, vec4(1.0), sin(time * 2.0) * 0.5 + 0.5);
      vec4 mid = (hot + cool) * 0.5;
      
      float s = sin(t), c = cos(t);
      mat3 rot = mat3(c, 0, s, 0, 1, 0, -s, 0, c);
      
      // Cámara simplificada
      float pulse = cos(time * 0.1 + sin(time * 0.1)) * 0.5 + 0.5;
      pulse *= pulse; // pow(..., 2.0)
      float camHeight = mix(3.5, 0.1, pulse);
      vec3 camPos = vec3(0., camHeight, -10.) * rot * (1.0 + sin(time) * 0.3);
      
      vec3 lookAt = vec3(0.);
      vec3 f = normalize(lookAt - camPos);
      vec3 r = normalize(cross(up, f));
      vec3 u = cross(f, r);
      ray rayCam = ray(camPos, normalize(f * 0.5 + r * uv.x + u * uv.y));
      
      vec4 finalCol = vec4(0.0);
      bool hitGround = rayCam.d.y < 0.0;
      vec3 groundPoint = camPos + max(0.0, -camPos.y / rayCam.d.y) * rayCam.d;

      for(int i = 0; i < NUM_STARS; i++) {
          float seed = Hash11(float(i));
          vec4 noise = Hash41(seed);
          float starT = fract(time * 0.1 + seed) * 2.0;
          
          float fade = smoothstep(2.0, 0.5, starT);
          float b = BounceNorm(starT, 0.4 + seed * 0.1) * 7.0;
          
          float size = (STARSIZE + seed * 0.03) * fade;
          vec3 starPos = vec3(noise.x * 10.0, b + size, noise.z * 10.0);
          vec4 starCol = mix(cool, hot, fade);

          // Contribución estrella
          vec3 closest = ClosestPoint(rayCam, starPos);
          vec3 dStar = closest - starPos;
          float distStarSq = dot(dStar, dStar);
          finalCol += starCol * (1.0 / (distStarSq / (size * size) + 0.001));

          // Contribución suelo
          if(hitGround) {
              vec3 L = starPos - groundPoint;
              float dL2 = dot(L, L);
              float dL = sqrt(dL2);
              float light = saturate(L.y / dL) / (dL + 0.001);
              
              vec4 groundCol = mix(cool, mid, fade);
              finalCol += groundCol * light * 0.05 * (sin(time) * 0.5 + 0.6);
              
              #ifdef FLOOR_REFLECT
                  vec3 R = reflect(rayCam.d, up);
                  float spec = saturate(dot(R, L / dL));
                  // spec = pow(spec, 32.0) -> x^32
                  spec *= spec; spec *= spec; spec *= spec; spec *= spec; spec *= spec; 
                  finalCol += groundCol * (spec / (dL + 0.5)) * fade * 0.04;
              #endif
          }
      }
      
      gl_FragColor = vec4(finalCol.rgb, 1.0);
  }
`;

export function DyingUniverse() {
  const materialRef = useRef();
  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2() },
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.iTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.iResolution.value.set(state.size.width, state.size.height);
    }
  });

  return (
    <mesh renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
