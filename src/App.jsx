import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Caustics, Html, useProgress } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Flower } from './components/Flower';
import LogoDoersModel from './components/LogoDoersModel'; // Nueva experiencia
import { DyingUniverse } from './components/DyingUniverse';
import { DynamicLights } from './components/DynamicLights';
import { HandControlProvider, useHandControl } from './components/HandContext';
import { HandTracker } from './components/HandTracker';
import { InteractiveInstructions } from './components/InteractiveInstructions';
import './App.css';

// Componente Wrapper para el botón de cambio de modo que usa el contexto
function ModeSwitcherWrapper({ currentMode, setMode }) {
  const { cursorRef, isDetected } = useHandControl();
  const [hoverProgress, setHoverProgress] = useState(0);
  const buttonRef = React.useRef(null);
  const startTimeRef = React.useRef(null);
  const wasRecentlyActivated = React.useRef(false); // Evita reactivación continua

  React.useEffect(() => {
    let animationFrameId;

    const checkHover = () => {
      if (buttonRef.current && isDetected && cursorRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const x = cursorRef.current.x * window.innerWidth;
        const y = cursorRef.current.y * window.innerHeight;
        
        // Actualizar posición del cursor visual
        const cursorEl = document.getElementById('hand-cursor-debug');
        if (cursorEl) {
          cursorEl.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
          cursorEl.style.display = 'block';
          cursorEl.style.backgroundColor = (currentMode === 'doers') ? '#00ffaa' : 'rgba(255, 255, 255, 0.8)';
        }

        const isOver = (
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom
        );

        if (isOver) {
          // Solo procesar hover si no se acaba de activar
          if (!wasRecentlyActivated.current) {
            if (!startTimeRef.current) startTimeRef.current = Date.now();
            const elapsed = Date.now() - startTimeRef.current;
            const progress = Math.min(elapsed / 1500, 1); // 1.5s to activate
            setHoverProgress(progress);
            
            if (progress >= 1) {
              setMode(currentMode === 'flower' ? 'doers' : 'flower');
              wasRecentlyActivated.current = true; // Bloquear hasta que quite la mano
              startTimeRef.current = null;
              setHoverProgress(0);
            }
          }
        } else {
          // El usuario quitó la mano, desbloqueamos para la próxima vez
          wasRecentlyActivated.current = false;
          startTimeRef.current = null;
          setHoverProgress(0);
        }
      } else {
        wasRecentlyActivated.current = false;
        startTimeRef.current = null;
        setHoverProgress(0);
        // Ocultar cursor si no se detecta mano
        const cursorEl = document.getElementById('hand-cursor-debug');
        if (cursorEl) cursorEl.style.display = 'none';
      }
      animationFrameId = requestAnimationFrame(checkHover);
    };

    checkHover();
    return () => cancelAnimationFrame(animationFrameId);
  }, [currentMode, setMode, isDetected]);

  return (
    <>
      {/* Cursor visual para feedback */}
      <div 
        id="hand-cursor-debug"
        style={{
          position: 'fixed',
          top: 0, 
          left: 0,
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: '2px solid white',
          boxShadow: '0 0 10px rgba(0,255,255,0.8)',
          pointerEvents: 'none',
          zIndex: 9999,
          display: 'none', // Oculto por defecto hasta que se detecte
          transition: 'background-color 0.3s'
        }}
      />
      
      <div 
        ref={buttonRef}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          transform: hoverProgress > 0 ? 'scale(1.1)' : 'scale(1)'
        }}
        onClick={() => setMode(currentMode === 'flower' ? 'doers' : 'flower')}
      >
      <div style={{
        position: 'absolute',
        top: -6, left: -6, right: -6, bottom: -6,
        borderRadius: '50%',
        border: '3px solid #00ffaa',
        opacity: hoverProgress,
        transform: `scale(${1 + hoverProgress * 0.2})`,
        transition: 'opacity 0.2s'
      }} />
      
      {/* Circle progress fill */}
       <svg width="150" height="150" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
          <circle
            cx="75"
            cy="75"
            r="69"
            stroke="#00ffaa"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={433.5}
            strokeDashoffset={433.5 * (1 - hoverProgress)}
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>

      <span style={{ 
        color: 'white', 
        fontSize: '18px', 
        fontWeight: 'bold',
        letterSpacing: '2px'
      }}>
        {currentMode === 'flower' ? 'DOERS' : 'FLOR'}
      </span>
    </div>
    </>
  );
}

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
  const [mode, setMode] = useState('flower'); // 'flower' | 'doers'

  return (
    <HandControlProvider>
      <HandTracker />
      <ModeSwitcherWrapper currentMode={mode} setMode={setMode} />
      
      {/* Instrucciones solo visibles en modo Flor, o adaptadas? Por ahora solo flor */}
      {mode === 'flower' && <InteractiveInstructions />}

      <Canvas
        shadows
        // Ajustamos la cámara dependiendo del modo si es necesario, o mantenemos una genérica
        camera={{ position: [0, 1.5, 4], fov: 45 }}
        dpr={[1, 1.25]}
        gl={{ powerPreference: 'high-performance', antialias: false }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={1.5}
        />
        
        <Suspense fallback={<Loader />}>
          
          <DyingUniverse />
          
          {mode === 'flower' ? (
            <group position={[0, 0.1, 2.2]} rotation={[0.3, 0, 0]}>
              <DynamicLights />
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
          ) : (
            <group position={[0, 0.3, 0]}>
               {/* Modo DOERS */}
               <LogoDoersModel scale={0.8} />
            </group>
          )}
          
        </Suspense>
        
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={0.5} radius={0.8} />
        </EffectComposer>
        
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
      </Canvas>
    </HandControlProvider>
  );
}

export default App;
