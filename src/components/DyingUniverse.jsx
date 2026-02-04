import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- CONFIGURACIÓN DE RENDIMIENTO ---
// Ajusta estos valores para equilibrar calidad visual y rendimiento
const SHADER_CONFIG = {
  NUM_STARS: 20,        // Cantidad de estrellas (Impacta mucho al rendimiento)
  NUM_BOUNCES: 3,       // Rebotes en la animación (Impacto medio)
  FLOOR_REFLECT: true, // Reflejos en el suelo (Costoso: true = Menos FPS)
  STAR_SIZE: 0.015       // Tamaño base de las estrellas
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform float iTime;
  uniform vec2 iResolution;

  // "Dying Universe" by Martijn Steinrucken aka BigWings - 2015
  // License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

  // --- CONFIG INYECTADA ---
  #define NUM_STARS ${SHADER_CONFIG.NUM_STARS}
  #define NUM_BOUNCES ${SHADER_CONFIG.NUM_BOUNCES}
  ${SHADER_CONFIG.FLOOR_REFLECT ? '#define FLOOR_REFLECT' : '// #define FLOOR_REFLECT'}
  
  vec4 COOLCOLOR = vec4(1.,.5,0.,0.);
  vec4 HOTCOLOR = vec4(0.,0.1,1.,1.);
  vec4 MIDCOLOR = vec4(0.5,0.3,0.,1.);
  float STARSIZE = ${SHADER_CONFIG.STAR_SIZE};
  
  #define saturate(x) clamp(x,0.,1.)
  #define NUM_ARCS NUM_BOUNCES+1

  float DistSqr(vec3 a, vec3 b) { vec3 D=a-b; return dot(D, D); } 

  const vec3 up = vec3(0.,1.,0.);
  const float pi = 3.141592653589793238;
  float time;

  struct ray {
      vec3 o;
      vec3 d;
  };

  struct camera {
      vec3 p;       // the position of the camera
      vec3 forward; // the camera forward vector
      vec3 left;    // the camera left vector
      vec3 up;      // the camera up vector
    
      vec3 center;  // the center of the screen, in world coords
      vec3 i;       // where the current ray intersects the screen, in world coords
      ray ray;      // the current ray
      vec3 lookAt;  // the lookat point
      float zoom;   // the zoom factor
  };
  camera cam;

  void CameraSetup(vec2 uv, vec3 position, vec3 lookAt, float zoom) {
      cam.p = position;
      cam.lookAt = lookAt;
      cam.forward = normalize(cam.lookAt-cam.p);
      cam.left = cross(up, cam.forward);
      cam.up = cross(cam.forward, cam.left);
      cam.zoom = zoom;
      
      cam.center = cam.p+cam.forward*cam.zoom;
      cam.i = cam.center+cam.left*uv.x+cam.up*uv.y;
      
      cam.ray.o = cam.p;
      cam.ray.d = normalize(cam.i-cam.p);
  }

  // Funciones de ruido simplificadas
  vec4 Noise4( vec4 x ) { return fract(sin(x)*5346.1764)*2. - 1.; }
  float Noise101( float x ) { return fract(sin(x)*5346.1764); }

  float PeriodicPulse(float x, float p) {
    return pow((cos(x+sin(x))+1.)/2., p);
  }

  vec3 ClosestPoint(ray r, vec3 p) {
      return r.o + max(0., dot(p-r.o, r.d))*r.d;
  }

  // Animación de rebote con decaimiento
  float BounceNorm(float t, float decay) {
      float height = 1.;
      
      float heights[NUM_ARCS]; heights[0] = 1.;
      float halfDurations[NUM_ARCS]; halfDurations[0] = 1.;
      float halfDuration = 0.5;
      
      // Precalcular alturas y duraciones
      for(int i=1; i<NUM_ARCS; i++) {
          height *= decay;
          heights[i]= height;
          halfDurations[i] = sqrt(height);
          halfDuration += halfDurations[i];
      }	
      t*=halfDuration*2.;
            
      float y = 1.-t*t;
    
      for(int i=1; i<NUM_ARCS; i++) {
          t -=  halfDurations[i-1] + halfDurations[i];
          y = max(y, heights[i] - t*t);
      }
      return saturate( y );
  }

  vec3 IntersectPlane(ray r) {
      // Intersección con plano suelo (y=0)
      vec3 n = vec3(0.,1.,0.);
      float t = dot(-r.o, n)/dot(r.d, n);
      return r.o+max(0.,t)*r.d;
  }

  // Renderiza una estrella individual
  vec4 Star(ray r, float seed) {
      vec4 noise = Noise4(vec4(seed, seed+1., seed+2., seed+3.));
      float t = fract(time*0.1+seed)*2.;
      
      float fade = smoothstep(2., 0.5, t);
      vec4 col = mix(COOLCOLOR, HOTCOLOR, fade);
      float size = STARSIZE+seed*0.03;
      size *= fade;
      
      float b = BounceNorm(t, 0.4+seed*0.1)*7.;
      b+=size;
      
      vec3 sparkPos = vec3(noise.x*10., b, noise.y*10.);
      vec3 closestPoint = ClosestPoint(r, sparkPos);
      
      float dist = DistSqr(closestPoint, sparkPos)/(size*size);
      float brightness = 1./dist;
      col *= brightness;
      
      return col;
  }

  vec4 Stars(ray r) {
      vec4 col = vec4( 0. );
      float s = 0.;
      for(int i=0; i<NUM_STARS; i++) {
          s++;
          col += Star(r, Noise101(s));
      }
      return col;
  }

  vec4 CalcStarPos(int i) {
      float n = Noise101(float(i));
      vec4 noise = Noise4(vec4(n, n+1., n+2., n+3.));
      float t = fract(time*0.1+n)*2.;
      float fade = smoothstep(2., 0.5, t);
      
      float size = STARSIZE+n*0.03;
      size *= fade;
      
      float b = BounceNorm(t, 0.4+n*0.1)*7.;
      b+=size;
      
      vec3 sparkPos = vec3(noise.x*10., b, noise.y*10.);
      return vec4(sparkPos.xyz, fade);
  }

  vec4 Ground(ray r) {
      vec4 ground = vec4(0.);
      if(r.d.y>0.) return ground;
      
      vec3 I = IntersectPlane(r);
      
      // Solo calculamos luz difusa básica de las estrellas en el suelo
      for(int i=0; i<NUM_STARS; i++) {
          vec4 star = CalcStarPos(i);
          
          vec3 L = star.xyz-I;
          float dist = length(L);
          L /= dist;
          
          float lambert = saturate(dot(L, up));
          float light = lambert/pow(dist,1.);
          
          vec4 col = mix(COOLCOLOR, MIDCOLOR, star.w);
          vec4 diffuseLight =  vec4(light)*0.1*col;
          
          ground += diffuseLight*(sin(time)*0.5+0.6);
          
          #ifdef FLOOR_REFLECT
            vec3 R = reflect(r.d, up);
            float spec = pow(saturate(dot(R, L)), 400.);
            float fresnel = 1.-saturate(dot(L, up));
            fresnel = pow(fresnel, 10.);
            
            vec4 specLight = col*spec/(dist);
            specLight *= star.w;
            ground += specLight*0.5*fresnel;
          #endif
      }
      return ground;
  }

  void main()
  {
      vec2 uv = vUv - 0.5;
      uv.y *= iResolution.y/iResolution.x;
      
      time = iTime*0.2;
      time *= 2.;
      
      float t = time*pi*0.1;
      COOLCOLOR = vec4(sin(t), cos(t*0.23), cos(t*0.3453), 1.)*0.5+0.5;
      HOTCOLOR = vec4(sin(t*2.), cos(t*2.*0.33), cos(t*0.3453), 1.)*0.5+0.5;
      
      vec4 white = vec4(1.);
      float whiteFade = sin(time*2.)*0.5+0.5;
      HOTCOLOR = mix(HOTCOLOR, white, whiteFade);
      MIDCOLOR = (HOTCOLOR+COOLCOLOR)*0.5;
      
      float s = sin(t);
      float c = cos(t);
      mat3 rot = mat3(c, 0., s,
                      0., 1., 0.,
                      s, 0., -c);
      
      float camHeight = mix(3.5, 0.1, PeriodicPulse(time*0.1, 2.));
      vec3 pos = vec3(0., camHeight, -10.)*rot*(1.+sin(time)*0.3);
      
      CameraSetup(uv, pos, vec3(0.), 0.5);
      
      gl_FragColor = Ground(cam.ray);
      gl_FragColor += Stars(cam.ray);
      gl_FragColor.a = 1.0;
  }
`;

export function DyingUniverse() {
  const mesh = useRef();
  const materialRef = useRef();
  
  // Usamos useMemo para definir los uniforms iniciales (estable entre renders)
  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2() },
    }),
    []
  );

  useFrame((state) => {
    // Modificamos los valores a través de la referencia del material
    // Esto evita errores de linting sobre mutación de estado/props
    if (materialRef.current) {
      materialRef.current.uniforms.iTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.iResolution.value.set(state.size.width, state.size.height);
    }
  });

  return (
    <mesh ref={mesh} renderOrder={-1}>
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
