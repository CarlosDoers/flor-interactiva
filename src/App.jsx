import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Caustics, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Flower } from './components/Flower';
// Background shader eliminado para optimizar rendimiento
import { PrismaticBeams } from './components/PrismaticBeams';
import { HandControlProvider } from './components/HandContext';
import { HandTracker } from './components/HandTracker';
import './App.css';

function App() {
  return (
    <HandControlProvider>
      <HandTracker />
      <Canvas
        shadows
        camera={{ position: [0, 2, 5], fov: 45 }}
        dpr={[1, 1.25]}
        gl={{ powerPreference: 'high-performance', antialias: false }}
      >
        {/* Luces ajustadas para generar mejores cáusticas */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={4} 
        castShadow 
        shadow-mapSize={2048} 
        shadow-bias={-0.0001}
      />
      <pointLight position={[-4, 2, -3]} intensity={2} color="#ffddaa" />
      <pointLight position={[4, 2, 3]} intensity={1.5} color="#aaddff" />
      
      <Suspense fallback={<Html center style={{ color: 'white', fontFamily: 'system-ui' }}>Cargando…</Html>}>
        {/* Entorno visible para reflejos ricos */}
        <Environment preset="city" />
        
        {/* Fondo plano simple para mejor rendimiento */}
        <color attach="background" args={['#101010']} /> 
        
        <group position={[0, 0.1, 2.2]}>
          {/* Efectos de Luz Volumétrica (Rayos Prisma) */}
          <group position={[0, 0.82, 0]}>
            <PrismaticBeams />
          </group>

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
            resolution={1024}
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
        🖖 Abre y cierra tu mano frente a la cámara para interactuar
      </div>
    </HandControlProvider>
  );
}

export default App;
