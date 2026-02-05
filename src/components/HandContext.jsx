import React, { createContext, useContext, useState, useRef } from 'react';

const HandContext = createContext({
  handStateRef: { current: 0 }, 
  faceStateRef: { current: { smile: 0, eyebrows: 0 } }, 
  fistStateRef: { current: 0 }, // Nuevo: Estado de puño cerrado (0 = abierto, 1 = cerrado)
  rotationImpulseRef: { current: 0 }, // Nuevo: Impulso de rotación (física)
  pinchStateRef: { current: 0 }, 
  leftHandHeightRef: { current: 0 }, 
  rightHandHeightRef: { current: 0 }, 
  isDetected: false,
  setIsDetected: () => {}
});

export const useHandControl = () => useContext(HandContext);

export function HandControlProvider({ children }) {
  const handStateRef = useRef(0); 
  const faceStateRef = useRef({ smile: 0, eyebrows: 0 }); 
  const fistStateRef = useRef(0); 
  const rotationImpulseRef = useRef(0); // Impulso de giro
  const pinchStateRef = useRef(0); 
  const leftHandHeightRef = useRef(0); 
  const rightHandHeightRef = useRef(0); 
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
      isDetected, 
      setIsDetected 
    }}>
      {children}
    </HandContext.Provider>
  );
}
