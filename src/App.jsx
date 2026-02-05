import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Caustics, Html, useProgress } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Flower } from './components/Flower';
// import { DynamicBackground } from './components/DynamicBackground';
import { DyingUniverse } from './components/DyingUniverse';
import { DynamicLights } from './components/DynamicLights';
import { HandControlProvider } from './components/HandContext';
import { HandTracker } from './components/HandTracker';
import './App.css';

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{
        width: '200px',
        height: '6px',
        background: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '3px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'white',
          transition: 'width 0.2s ease-out'
        }} />
      </div>
    </Html>
  );
}

function App() {
  return (
    <HandControlProvider>
      <HandTracker />
      <Canvas
        shadows
        camera={{ position: [0, 1.5, 4], fov: 45 }}
        dpr={[1, 1.25]}
        gl={{ powerPreference: 'high-performance', antialias: false }}
      >
        {/* Luces ajustadas para generar mejores cáusticas */}
      <ambientLight intensity={0.3} />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={1.5}  // Reducida para que las luces dinámicas sean más visibles
        // castShadow 
        // shadow-mapSize={2048} 
        // shadow-bias={-0.0001}
      />
      
      <Suspense fallback={<Loader />}>

        
        {/* Fondo shader Dying Universe */}
        <DyingUniverse />
        {/* <DynamicBackground /> */}
        
        <group position={[0, 0.1, 2.2]} rotation={[0.3, 0, 0]}>
          {/* Luces dinámicas MUY cerca de la flor */}
          <DynamicLights />
          
          {/* Efecto de Cáusticas (Rayos de luz proyectados) */}
          <Caustics
            backfaces
            color="#ffffff" 
            focus={[2, -1.2, 3]} 
            lightSource={[5, 10, 5]} 
            intensity={50} 
            worldRadius={8} 
            ior={1.2}
            chromaticAberration={0.5} 
            backside={true}
            causticsOnly={false} 
            resolution={720}
          >
             <Flower />
          </Caustics>
        </group>
        
      </Suspense>
      
      {/* Efectos de Post-Procesado para potenciar el brillo */}
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={0.5} radius={0.8} />
      </EffectComposer>
      
      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
      </Canvas>
      <div className="ui-hint" style={{
        position: 'absolute', 
        bottom: 30, 
        left: '50%', 
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.7)',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        textAlign: 'center',
        pointerEvents: 'none'
      }}>
        🙌 Junta y separa tus dos manos para interactuar<br />
        ✋ Levanta cada mano para cambiar las luces
      </div>
    </HandControlProvider>
  );
}

export default App;
