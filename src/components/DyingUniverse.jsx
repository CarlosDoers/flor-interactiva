import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- CONFIGURACIÓN DE RENDIMIENTO ---
// Ajusta estos valores para equilibrar calidad visual y rendimiento
const SHADER_CONFIG = {
  NUM_STARS: 12,        // Cantidad de estrellas (Impacta mucho al rendimiento)
  NUM_BOUNCES: 3,       // Rebotes en la animación (Impacto medio)
  FLOOR_REFLECT: true, // Reflejos en el suelo (Costoso: true = Menos FPS)
  STAR_SIZE: 0.02       // Tamaño base de las estrellas
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float iTime;
  uniform vec2 iResolution;

  // "Dying Universe" by Martijn Steinrucken aka BigWings - 2015
  // License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

  // --- CONFIG INYECTADA ---
  #define NUM_STARS ${SHADER_CONFIG.NUM_STARS}
  #define NUM_BOUNCES ${SHADER_CONFIG.NUM_BOUNCES}
  ${SHADER_CONFIG.FLOOR_REFLECT ? '#define FLOOR_REFLECT' : '// #define FLOOR_REFLECT'}
  
  const vec4 COOLCOLOR_BASE = vec4(1.,.5,0.,1.);
  const vec4 HOTCOLOR_BASE = vec4(0.,0.1,1.,1.);
  const float STARSIZE = ${SHADER_CONFIG.STAR_SIZE};
  
  #define saturate(x) clamp(x,0.,1.)
  #define NUM_ARCS (NUM_BOUNCES + 1)

  // Optimización: Usar dot directamente para distancia al cuadrado
  float DistSqr(vec3 a, vec3 b) { vec3 D=a-b; return dot(D, D); } 

  const vec3 up = vec3(0.,1.,0.);
  const float pi = 3.14159265;
  float time;

  struct ray {
      vec3 o;
      vec3 d;
  };

  struct camera {
      vec3 p;
      vec3 forward;
      vec3 left;
      vec3 up;
      vec3 center;
      vec3 i;
      ray ray;
      vec3 lookAt;
      float zoom;
  };
  camera cam;

  void CameraSetup(vec2 uv, vec3 position, vec3 lookAt, float zoom) {
      cam.p = position;
      cam.lookAt = lookAt;
      cam.forward = normalize(cam.lookAt-cam.p);
      cam.left = normalize(cross(up, cam.forward));
      cam.up = cross(cam.forward, cam.left);
      cam.zoom = zoom;
      
      cam.center = cam.p+cam.forward*cam.zoom;
      cam.i = cam.center+cam.left*uv.x+cam.up*uv.y;
      
      cam.ray.o = cam.p;
      cam.ray.d = normalize(cam.i-cam.p);
  }

  // Hash sinusoide más rápido (estándar GLSL)
  float Hash11(float p) {
      return fract(sin(p * 127.1) * 43758.545);
  }

  vec4 Hash41(float p) {
      return fract(sin(vec4(p, p + 1.0, p + 2.0, p + 3.0) * vec4(127.1, 311.7, 74.7, 983.1)) * 43758.545) * 2.0 - 1.0;
  }

  float PeriodicPulse(float x, float p) {
    float c = cos(x + sin(x));
    return pow(c * 0.5 + 0.5, p);
  }

  vec3 ClosestPoint(ray r, vec3 p) {
      return r.o + max(0., dot(p-r.o, r.d))*r.d;
  }

  // Animación de rebote con desenrollado opcional o simplificación
  float BounceNorm(float t, float decay) {
      float height = 1.0;
      float halfDuration = 0.5;
      float h[4]; h[0] = 1.0; // Hardcoded para 3 bounces
      float hd[4]; hd[0] = 1.0;
      
      // Simulado para evitar loops dinámicos pesados
      float currH = 1.0;
      for(int i=1; i<=NUM_BOUNCES; i++) {
          currH *= decay;
          h[i] = currH;
          hd[i] = sqrt(currH);
          halfDuration += hd[i];
      }
      
      t *= halfDuration * 2.0;
      float y = 1.0 - t * t;
      
      float accumT = 0.0;
      for(int i=1; i<=NUM_BOUNCES; i++) {
          t -= (hd[i-1] + hd[i]);
          y = max(y, h[i] - t * t);
      }
      return saturate(y);
  }

  vec3 IntersectPlane(ray r) {
      float t = -r.o.y / r.d.y;
      return r.o + max(0.0, t) * r.d;
  }

  vec4 COOLCOLOR, HOTCOLOR, MIDCOLOR;

  // Calculamos la posición y color una sola vez por estrella
  struct StarState {
      vec3 pos;
      vec4 col;
      float fade;
  };

  StarState GetStar(float seed) {
      vec4 noise = Hash41(seed);
      float t = fract(time * 0.1 + seed) * 2.0;
      
      float fade = smoothstep(2.0, 0.5, t);
      vec4 col = mix(COOLCOLOR, HOTCOLOR, fade);
      float size = STARSIZE + seed * 0.03;
      size *= fade;
      
      float b = BounceNorm(t, 0.4 + seed * 0.1) * 7.0;
      b += size;
      
      vec3 sparkPos = vec3(noise.x * 10.0, b, noise.z * 10.0);
      
      StarState s;
      s.pos = sparkPos;
      s.col = col;
      s.fade = fade;
      return s;
  }

  void main() {
      vec2 uv = (vUv - 0.5);
      uv.y *= iResolution.y / iResolution.x;
      
      time = iTime * 0.4; // Ajuste de velocidad
      
      float t = time * pi * 0.1;
      COOLCOLOR = vec4(sin(t), cos(t * 0.23), cos(t * 0.345), 1.0) * 0.5 + 0.5;
      HOTCOLOR = vec4(sin(t * 2.0), cos(t * 0.66), cos(t * 0.345), 1.0) * 0.5 + 0.5;
      
      float whiteFade = sin(time * 2.0) * 0.5 + 0.5;
      HOTCOLOR = mix(HOTCOLOR, vec4(1.0), whiteFade);
      MIDCOLOR = (HOTCOLOR + COOLCOLOR) * 0.5;
      
      float s = sin(t), c = cos(t);
      mat3 rot = mat3(c, 0, s, 0, 1, 0, -s, 0, c);
      
      float camHeight = mix(3.5, 0.1, PeriodicPulse(time * 0.1, 2.0));
      vec3 pos = vec3(0., camHeight, -10.) * rot * (1.0 + sin(time) * 0.3);
      
      CameraSetup(uv, pos, vec3(0.), 0.5);
      
      vec4 finalCol = vec4(0.0);
      
      // Renderizado simplificado: una sola pasada de estrellas
      // Calculamos suelo y estrellas en un solo bucle si es posible
      bool hitGround = cam.ray.d.y < 0.0;
      vec3 groundPoint = vec3(0.0);
      if(hitGround) groundPoint = IntersectPlane(cam.ray);

      for(int i=0; i<NUM_STARS; i++) {
          StarState star = GetStar(Hash11(float(i)));
          
          // 1. Contribución de la estrella (brillo en cámara)
          vec3 closest = ClosestPoint(cam.ray, star.pos);
          float distStar = DistSqr(closest, star.pos);
          float size = (STARSIZE + Hash11(float(i)) * 0.03) * star.fade;
          finalCol += star.col * (1.0 / (distStar / (size * size) + 0.001));

          // 2. Contribución al suelo
          if(hitGround) {
              vec3 L = star.pos - groundPoint;
              float distL2 = dot(L, L);
              float distL = sqrt(distL2);
              vec3 Ln = L / distL;
              
              float lambert = saturate(Ln.y);
              float light = lambert / (distL + 0.001);
              
              vec4 groundCol = mix(COOLCOLOR, MIDCOLOR, star.fade);
              finalCol += groundCol * light * 0.05 * (sin(time) * 0.5 + 0.6);
              
              #ifdef FLOOR_REFLECT
                  vec3 R = reflect(cam.ray.d, up);
                  float spec = pow(saturate(dot(R, Ln)), 32.0); // Reducido de 400
                  float fresnel = pow(1.0 - saturate(Ln.y), 5.0); // Reducido de 10
                  finalCol += groundCol * (spec / (distL + 0.5)) * star.fade * fresnel * 0.2;
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
