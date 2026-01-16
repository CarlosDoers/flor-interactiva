import React, { createContext, useContext, useState, useRef } from 'react';

const HandContext = createContext({
  handStateRef: { current: 0 }, // Usamos Ref para valores que cambian en cada frame (optimización)
  faceStateRef: { current: { smile: 0, eyebrows: 0 } }, // Nuevo: Estado de gestos faciales
  isDetected: false,
  setIsDetected: () => {}
});

export const useHandControl = () => useContext(HandContext);

export function HandControlProvider({ children }) {
  const handStateRef = useRef(0); // Valor mutable directo entre 0 y 1
  const faceStateRef = useRef({ smile: 0, eyebrows: 0 }); // Nuevo: { smile: 0..1, eyebrows: 0..1 }
  const [isDetected, setIsDetected] = useState(false);

  return (
    <HandContext.Provider value={{ handStateRef, faceStateRef, isDetected, setIsDetected }}>
      {children}
    </HandContext.Provider>
  );
}
