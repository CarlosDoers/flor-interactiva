
#ifdef GL_ES
precision mediump float;
#endif

// Variables que se pasarán al fragment shader
varying vec3 worldPosition;
varying vec3 worldNormal;

void main() {
    // Convertimos la posición local a posición en espacio mundial
    worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    
    // Transformamos la normal utilizando normalMatrix (inversa transpuesta de modelMatrix)
    worldNormal = normalize(normalMatrix * normal);
    
    // Posición final del vértice en pantalla
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
