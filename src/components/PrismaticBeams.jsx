import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandControl } from './HandContext';

// --- CONFIGURACIÓN DE LOS RAYOS (Aspecto Visual) ---
const BEAM_CONFIG = {
  count: 14,                // Aumentado ligeramente ya que es más eficiente
  radius: 0.05,             
  angleSpread: Math.PI * 0.4, 
  minLength: 0.5,           
  maxLength: 3.2,           
  baseOpacity: 0.3,         
  thicknessBase: 0.03,      
  thicknessTip: 0.001,      
  rotationSpeed: 0.1,       
};

const INTERACTION_CONFIG = {
  flowerGrowth: 0.15,       
  rotationBoost: 0.5,       
  beamLengthScale: 4.2,     
  opacityBoost: 2.9,        
};

// Shader optimizado para Instancing
const BeamShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uGlobalOpacity: { value: 1.0 }
  },
  vertexShader: `
    attribute vec3 instanceColor;
    attribute float instanceLength;
    
    varying vec2 vUv;
    varying vec3 vViewPosition;
    varying vec3 vColor;

    void main() {
      vUv = uv;
      vColor = instanceColor;
      
      // Aplicar escala vertical basada en instanceLength y el atributo de posición de la geometría
      vec3 pos = position;
      // La geometría de cilindro está centrada, pero queremos que crezca desde la base
      // En cylinderGeometry, y va de -half a +half. Lo movemos para que 0 sea la base.
      // Pero aquí es más fácil si la geometría ya nace en 0. 
      // Por simplicidad, escalamos y en el worldMatrix o aquí.
      
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    precision mediump float;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    varying vec3 vColor;
    
    uniform float uTime;
    uniform float uGlobalOpacity;

    // Simplex Noise 2D (Optimizado)
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865, 0.366025403, -0.577350269, 0.024390243);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 a0 = x - floor(x + 0.5);
      m *= 1.792842914 - 0.85373472 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      // 1. Ruido dinámico
      float noiseVal = snoise(vec2(vUv.x * 3.0, vUv.y * 1.5 - uTime * 0.4));
      float density = smoothstep(-0.3, 0.7, noiseVal); 

      // 2. Desvanecimiento vertical y lateral (Fresnel-like simplificado)
      float beamVertical = 1.0 - vUv.y;
      float edgeFade = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0);
      
      float alpha = beamVertical * edgeFade * density * uGlobalOpacity;
      
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(vColor + density * 0.1, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide
};

export function PrismaticBeams() {
  const meshRef = useRef();
  const materialRef = useRef();
  const geometryRef = useRef();
  const { faceStateRef } = useHandControl();
  
  const FLOWER_HEAD_HEIGHT = 0.8;

  // Aplicar traslación a la geometría para que crezca desde la base
  useEffect(() => {
    if (geometryRef.current) {
      geometryRef.current.translate(0, 0.5, 0);
    }
  }, []);

  // Generar datos estáticos de los rayos
  const beamData = useMemo(() => {
    const data = [];
    for (let i = 0; i < BEAM_CONFIG.count; i++) {
        const phi = Math.random() * BEAM_CONFIG.angleSpread; 
        const theta = Math.random() * Math.PI * 2; 
        
        const x = BEAM_CONFIG.radius * Math.sin(phi) * Math.cos(theta);
        const y = BEAM_CONFIG.radius * Math.cos(phi);
        const z = BEAM_CONFIG.radius * Math.sin(phi) * Math.sin(theta);
        
        const dir = new THREE.Vector3(x, y, z).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        
        data.push({
          position: new THREE.Vector3(x, y, z),
          quaternion: quaternion,
          length: BEAM_CONFIG.minLength + Math.random() * (BEAM_CONFIG.maxLength - BEAM_CONFIG.minLength),
          color: new THREE.Color().setHSL((i / BEAM_CONFIG.count + Math.random() * 0.1) % 1, 0.4, 0.78),
        });
    }
    return data;
  }, []);

  // Crear atributos de instancia
  const { colors, lengths } = useMemo(() => {
    const colors = new Float32Array(BEAM_CONFIG.count * 3);
    const lengths = new Float32Array(BEAM_CONFIG.count);
    beamData.forEach((beam, i) => {
      colors[i * 3] = beam.color.r;
      colors[i * 3 + 1] = beam.color.g;
      colors[i * 3 + 2] = beam.color.b;
      lengths[i] = beam.length;
    });
    return { colors, lengths };
  }, [beamData]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    const { eyebrows } = faceStateRef.current;
    if (!meshRef.current) return;

    const rotationSpeed = BEAM_CONFIG.rotationSpeed + (eyebrows * INTERACTION_CONFIG.rotationBoost);
    
    // 1. Actualizar Matrix de cada instancia (Escala local de cada rayo)
    beamData.forEach((beam, i) => {
      dummy.position.copy(beam.position);
      dummy.quaternion.copy(beam.quaternion);
      
      const targetYScale = eyebrows * INTERACTION_CONFIG.beamLengthScale * beam.length;
      dummy.scale.set(1, Math.max(0.001, targetYScale), 1);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    
    // 2. Rotación propia del grupo (opcional, para dar más dinamismo)
    meshRef.current.rotation.y += delta * rotationSpeed;

    // 3. Uniforms de material
    if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        const targetOpacity = BEAM_CONFIG.baseOpacity + (eyebrows * INTERACTION_CONFIG.opacityBoost);
        materialRef.current.uniforms.uGlobalOpacity.value = THREE.MathUtils.lerp(
            materialRef.current.uniforms.uGlobalOpacity.value, 
            targetOpacity, 
            0.1
        );
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, BEAM_CONFIG.count]}>
      <cylinderGeometry ref={geometryRef} args={[BEAM_CONFIG.thicknessTip, BEAM_CONFIG.thicknessBase, 1, 6, 1, true]}>
        <instancedBufferAttribute attach="attributes-instanceColor" args={[colors, 3]} />
        <instancedBufferAttribute attach="attributes-instanceLength" args={[lengths, 1]} />
      </cylinderGeometry>
      <shaderMaterial 
        ref={materialRef}
        {...BeamShaderMaterial}
        uniforms={useMemo(() => ({
            uTime: { value: 0 },
            uGlobalOpacity: { value: BEAM_CONFIG.baseOpacity }
        }), [])}
      />
    </instancedMesh>
  );
}
