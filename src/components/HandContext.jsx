import React, { createContext, useContext, useState, useRef } from 'react';

const HandContext = createContext({
  handStateRef: { current: 0 }, // Usamos Ref para valores que cambian en cada frame (optimización)
  faceStateRef: { current: { smile: 0, eyebrows: 0 } }, // Nuevo: Estado de gestos faciales
  pinchStateRef: { current: 0 }, // Nuevo: Estado de gesto de pinza (color)
  leftHandHeightRef: { current: 0 }, // Altura de la mano izquierda (0 = abajo, 1 = arriba)
  rightHandHeightRef: { current: 0 }, // Altura de la mano derecha (0 = abajo, 1 = arriba)
  isDetected: false,
  setIsDetected: () => {}
});

export const useHandControl = () => useContext(HandContext);

export function HandControlProvider({ children }) {
  const handStateRef = useRef(0); // Valor mutable directo entre 0 y 1
  const faceStateRef = useRef({ smile: 0, eyebrows: 0 }); // Nuevo: { smile: 0..1, eyebrows: 0..1 }
  const pinchStateRef = useRef(0); // Nuevo: Gesto de pinza
  const leftHandHeightRef = useRef(0); // Altura mano izquierda
  const rightHandHeightRef = useRef(0); // Altura mano derecha
  const [isDetected, setIsDetected] = useState(false);

  return (
    <HandContext.Provider value={{ handStateRef, faceStateRef, pinchStateRef, leftHandHeightRef, rightHandHeightRef, isDetected, setIsDetected }}>
      {children}
    </HandContext.Provider>
  );
}
