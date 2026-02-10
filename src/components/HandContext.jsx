import React, { createContext, useContext, useState, useRef } from 'react';

const HandContext = createContext({
  handStateRef: { current: 0 }, 
  faceStateRef: { current: { smile: 0, eyebrows: 0 } }, 
  fistStateRef: { current: 0 }, 
  rotationImpulseRef: { current: 0 }, 
  pinchStateRef: { current: 0 }, 
  leftHandHeightRef: { current: 0 }, 
  rightHandHeightRef: { current: 0 }, 
  cursorRef: { current: { x: 0, y: 0 } }, // Nuevo: Posición del cursor (mano)
  isDetected: false,
  setIsDetected: () => {}
});

export const useHandControl = () => useContext(HandContext);

export function HandControlProvider({ children }) {
  const handStateRef = useRef(0); 
  const faceStateRef = useRef({ smile: 0, eyebrows: 0 }); 
  const fistStateRef = useRef(0); 
  const rotationImpulseRef = useRef(0); 
  const pinchStateRef = useRef(0); 
  const leftHandHeightRef = useRef(0); 
  const rightHandHeightRef = useRef(0); 
  const cursorRef = useRef({ x: 0, y: 0 }); // Nuevo: Posición del cursor
  const [isDetected, setIsDetected] = useState(false);

  return (
    <HandContext.Provider value={{ 
      handStateRef, 
      faceStateRef, 
      fistStateRef, 
      rotationImpulseRef,
      pinchStateRef, 
      leftHandHeightRef, 
      rightHandHeightRef, 
      cursorRef,
      isDetected, 
      setIsDetected 
    }}>
      {children}
    </HandContext.Provider>
  );
}
