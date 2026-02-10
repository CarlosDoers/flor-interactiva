import { useRef, useState, useEffect, useMemo } from "react"
import { useGLTF, Center } from '@react-three/drei';
import { useFrame } from '@react-three/fiber'
import * as THREE from "three"
import doorsVertex from '../shaders/logo2.vertex.glsl?raw'
import doorsFragment from '../shaders/logo2.fragment.glsl?raw'
import { useHandControl } from './HandContext'; // Import HandContext

// Constantes para mejorar la mantenibilidad
const INITIAL_ROTATION = 0
const ROTATION_AMPLITUDE = Math.PI / 3 // 60 grados para más dramatismo
const LERP_FACTOR = 0.3 // Más rápido al "golpear"
const RETURN_LERP_FACTOR = 0.04 // Más lento al "rebotar"

const INITIAL_LOAD_ROTATION = Math.PI / 2
const ANIMATION_DURATION = 1
const DELAY_BEFORE_ROTATION = 0.5
const VELOCITY_INFLUENCE = 1.2 // Aumentado para más efecto de "golpe"

export default function LogoDoersModel({ ...props }) {
  const { scene } = useGLTF('/models/logo.glb')
  const modelRef = useRef()
  const customMaterialRef = useRef()
  const [mousePosition, setMousePosition] = useState({ x: 0, y: -100 })
  const [isLoaded, setIsLoaded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const animationStartTime = useRef(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const mouse = useMemo(() => new THREE.Vector2(-9999, -9999), [])
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const mouseVelocity = useRef(0);
  const rotationTargets = useRef({});
  
  const { cursorRef, isDetected } = useHandControl(); // Use Hand Control

  const loader = useMemo(() => new THREE.CubeTextureLoader(), []);
  loader.setCrossOrigin('anonymous');
  const envMap = useMemo(() => loader.load([
    '/imgs/environment/fondo-process.jpg',
    '/imgs/environment/fondo-process.jpg',
    '/imgs/environment/fondo-process.jpg',
    '/imgs/environment/fondo-process.jpg',
    '/imgs/environment/fondo-process.jpg', // Placeholder, ideally use correct cube map faces
    '/imgs/environment/fondo-process.jpg'
  ]), [loader]);
  
  // Efecto para manejar el movimiento del mouse
  // Update mouse state based on hand or actual mouse
  useFrame((state) => {
    let targetX, targetY;

    if (isDetected && cursorRef.current) {
        // Map normalized hand coordinates (0-1) to screen space (-1 to 1)
        // cursorRef.x is already inverted in HandTracker for mirroring, but for Three.js screen space:
        // x: -1 (left) to 1 (right)
        // y: -1 (bottom) to 1 (top)
        // cursorRef.current.x is 0 (left in mirror view? checked in HandTracker: 1-palm.x)
        // Let's assume cursorRef {x: 0..1, y: 0..1} where (0,0) is top-left usually for canvas but 
        // HandTracker maps directly.
        // Screen space conversion:
        targetX = (cursorRef.current.x * 2) - 1; 
        targetY = -(cursorRef.current.y * 2) + 1;
    } else {
        // Fallback to mouse position if hand is not detected
        // We use the state.mouse from R3F which is already normalized (-1 to 1)
        targetX = state.mouse.x;
        targetY = state.mouse.y;
    }

    // Smooth transition or direct update?
    // For responsiveness, direct update is often better for "touch"
    mouse.x = targetX;
    mouse.y = targetY;

    setMousePosition({ x: targetX, y: targetY });
  });

  
  // Efecto para iniciar la animación de carga
  useEffect(() => {
    // Iniciar la animación después de un pequeño retraso para asegurar que el modelo está cargado
    const timer = setTimeout(() => {
      setIsLoaded(true)
      setIsVisible(true)
      animationStartTime.current = Date.now() / 1000 + DELAY_BEFORE_ROTATION // Tiempo en segundos + retraso
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])
  
  const customMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
        vertexShader: doorsVertex,
        fragmentShader: doorsFragment,
        uniforms: {
            envMap: { value: envMap },
            // Colores base y de resaltado para el efecto visual
            baseColor1: { value: new THREE.Color(0x3b2a46) },
            baseColor2: { value: new THREE.Color(0x050516) },
            highlightColor: { value: new THREE.Color(0xffaaff) },
            highlightColor1: { value: new THREE.Color(0x543b34) },
            highlightColor2: { value: new THREE.Color(0x00aaff) },
            highlightColor3: { value: new THREE.Color(0xbba99b) },
            // Parámetros para controlar el comportamiento del shader
            lightPosition: { value: new THREE.Vector3(0, 0, 1) },
            frequency: { value: 10.01 },
            amplitude: { value: 10.01 },
            thickness0: { value: 10.04 },
            thicknessIncrease: { value: 0.1 },
            u_time: { value: 0.10 },
            rotationSpeed: { value: 0.1 },
            u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uMouse: { value: new THREE.Vector2(50.0, 50.0) },
            transparent: true,
            metalness: { value: 0.5 },
            roughness: { value: 0 },
            opacity: { value: 0 },
        },
        transparent: true,
    })
}, [envMap])
  
  useEffect(() => {
    customMaterialRef.current = customMaterial
  }, [customMaterial])
  
  useEffect(() => {
    if (!modelRef.current) return
  
    modelRef.current.traverse((child) => {
        if (child.isMesh && !child.userData.isCube) {
            // Aplicar el material personalizado inmediatamente
            child.material = customMaterialRef.current
            
            // Crear un cubo negro más grande para cada malla
            const cubeGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.8)
            const cubeMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x000000,
                transparent: true,
                opacity: 0,
                depthWrite: false // Evita que el cubo invisible ocluya la letra
            })
            const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
            cube.userData.isCube = true
            
            // Posicionar el cubo en el origen local de la malla
            cube.position.set(0, 0, 0)
            
            // Añadir el cubo como hijo de la letra
            child.add(cube)

            if (child.name === 'letra_d') {
                child.position.y = 0.15
            }
            
            child.geometry.center()
            child.rotation.z = INITIAL_LOAD_ROTATION
            // Guardamos la rotación inicial que queremos mantener
            child.userData.initialRotation = {
                x: child.rotation.x,
                y: child.rotation.y,
                z: INITIAL_ROTATION // Cambiamos a INITIAL_ROTATION en lugar de 0
            }
        }
    })
  }, [])
  
  useFrame((state, delta) => {
    const elapsedTime = state.clock.elapsedTime;
    const currentTime = Date.now() / 1000;

    // Calcular la velocidad del mouse para el efecto de "golpe"
    const mouseSpeed = Math.abs(mousePosition.x - lastMousePosition.current.x);
    mouseVelocity.current = THREE.MathUtils.lerp(mouseVelocity.current, mouseSpeed, 0.3);
    lastMousePosition.current = { ...mousePosition };

    raycaster.setFromCamera(mouse, state.camera)
    
    if (modelRef.current) {
      const cubes = []
      modelRef.current.traverse((child) => {
        if (child.isMesh && child.userData.isCube) cubes.push(child)
      })

      const intersects = raycaster.intersectObjects(cubes)
      const hoveredCube = intersects.length > 0 ? intersects[0].object : null
      
      modelRef.current.traverse((child) => {
        if (child.isMesh && !child.userData.isCube) {
          if (!rotationTargets.current[child.uuid]) {
            rotationTargets.current[child.uuid] = 0;
          }

          if (isLoaded && animationStartTime.current) {
            const timeUntilStart = animationStartTime.current - currentTime;
            
            if (timeUntilStart > 0) {
              child.rotation.z = INITIAL_LOAD_ROTATION;
            } else {
              const animationElapsed = currentTime - animationStartTime.current;
              const animationProgress = Math.min(animationElapsed / ANIMATION_DURATION, 1);
              
              if (animationProgress === 1) {
                let targetRotation = 0;
                
                // Verificar si el cubo hijo de esta letra está siendo hover
                const childCube = child.children.find(c => c.userData.isCube);
                if (childCube && childCube === hoveredCube) {
                  const boundingBox = new THREE.Box3().setFromObject(child);
                  const center = new THREE.Vector3();
                  boundingBox.getCenter(center);
                  
                  const intersectPoint = intersects[0].point;
                  const direction = Math.sign(intersectPoint.x - center.x);
                  
                  // Efecto de "golpe" basado en la velocidad del mouse
                  const impact = 1 + (mouseVelocity.current * VELOCITY_INFLUENCE);
                  targetRotation = direction * ROTATION_AMPLITUDE * impact;
                  
                  // Aplicar el "golpe" rápidamente
                  rotationTargets.current[child.uuid] = THREE.MathUtils.lerp(
                    rotationTargets.current[child.uuid],
                    targetRotation,
                    LERP_FACTOR
                  );
                } else {
                  // Retorno con "rebote" suave
                  const currentRotation = rotationTargets.current[child.uuid];
                  const returnSpeed = Math.abs(currentRotation) * RETURN_LERP_FACTOR + 0.001;
                  
                  rotationTargets.current[child.uuid] = THREE.MathUtils.lerp(
                    currentRotation,
                    0,
                    returnSpeed
                  );
                }

                // Aplicar la rotación con física de "tabla"
                child.rotation.z = THREE.MathUtils.lerp(
                  child.rotation.z,
                  rotationTargets.current[child.uuid],
                  LERP_FACTOR
                );
              } else {
                const initialRotationZ = THREE.MathUtils.lerp(
                  INITIAL_LOAD_ROTATION,
                  0,
                  animationProgress
                );
                child.rotation.z = initialRotationZ;
              }
            }
          }
        }
      });
    }

    // Animación de opacidad
    if (customMaterialRef.current && isLoaded) {
        const opacityProgress = Math.min((currentTime - animationStartTime.current) / ANIMATION_DURATION, 1);
        customMaterialRef.current.uniforms.opacity.value = THREE.MathUtils.lerp(0, 1, opacityProgress);
    }

    // Actualizar uniforms del shader
    if (customMaterialRef.current) {
      customMaterialRef.current.uniforms.u_time.value = elapsedTime;
      
      const radius = 2.5;
      const speed = .2;
      const x = radius * Math.cos(speed * elapsedTime);
      const y = radius * Math.sin(speed * elapsedTime);
      customMaterialRef.current.uniforms.lightPosition.value.set(x, y, customMaterialRef.current.uniforms.lightPosition.value.z);
    }
  })
  
  return (
    <Center>
      <primitive 
        ref={modelRef} 
        object={scene} 
        visible={isVisible} 
        {...props} 
      />
    </Center>
  )
}

useGLTF.preload('/models/logo.glb')
