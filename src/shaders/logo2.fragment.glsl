
#ifdef GL_ES
precision mediump float;
#endif

uniform samplerCube envMap;
uniform float u_time;
uniform float opacity;

varying vec3 worldPosition;
varying vec3 worldNormal;

// ----------------------------------------------------------------------
// Función de ruido similar a la que usabas
float cheapNoise(vec3 stp, float ax, float ay, float az, float aw) {
    vec3 p = vec3(stp.xy, stp.z);
    vec4 a = vec4(ax, ay, az, aw);
    return mix(
        sin(p.z + p.x * a.x + cos(p.x * a.x - p.z)) * cos(p.z + p.y * a.y + cos(p.y * a.x + p.z)),
        sin(1.0 + p.x * a.z + p.z + cos(p.y * a.w - p.z)) * cos(1.0 + p.y * a.w + p.z + cos(p.x * a.x + p.z)),
        0.436
    );
}

// ----------------------------------------------------------------------
// Conversión de HSV a RGB para generar colores del espectro
vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    rgb = rgb * rgb * (3.0 - 2.0 * rgb);
    return c.z * mix(vec3(1.0), rgb, c.y);
}
// ----------------------------------------------------------------------

void main() {
    // La variable cameraPosition la inyecta Three.js automáticamente.
    vec3 viewDir = normalize(cameraPosition - worldPosition);
    vec3 N = normalize(worldNormal);
    
    // Vector de reflexión para samplear el cubemap
    vec3 reflectDir = reflect(-viewDir, N);
    vec3 envColor = textureCube(envMap, reflectDir).rgb;
    
    // Cálculo del factor Fresnel: cuanto más de costado (borde) se vea, mayor será el efecto rim.
    float ndotv = max(dot(N, viewDir), 0.0);
    float fresnelFactor = pow(1.0 - ndotv, 3.0);
    
    // Además, definimos un factor para las caras frontales: cuanto más frontal es la superficie, mayor el reflejo.
    float frontFactor = smoothstep(0.5, 1.0, ndotv);
    
    // Para una animación más lenta, usamos un tiempo reducido.
    float slowTime = u_time * 0.1;
    
    // Coordenadas base para el ruido (usamos el plano XZ)
    vec2 st = worldPosition.xz;
    
    // Parámetros para el ruido (ajústalos si es necesario)
    float ax = 2.0, ay = 2.0, az = 2.0, aw = 2.0;
    float S = sin(slowTime);
    float C = cos(slowTime);
    
    // Cálculo del ruido para modular el efecto en los bordes
    vec2 v1 = vec2(
        cheapNoise(vec3(st, worldPosition.y), ax, ay, az, aw),
        cheapNoise(vec3(st, 1.0), ax, ay, az, aw)
    );
    vec2 v2 = vec2(
        cheapNoise(vec3(st + v1 + vec2(C * 1.7, S * 9.2), 0.15 * slowTime), ax, ay, az, aw),
        cheapNoise(vec3(st + v1 + vec2(S * 8.3, C * 2.8), 0.126 * slowTime), ax, ay, az, aw)
    );
    float n = 0.4 + 0.70 * cheapNoise(vec3(st + v2, worldPosition.y), ax, ay, az, aw);
    
    // Generamos un valor de matiz (hue) que varía lentamente con el tiempo y el ruido,
    // dando lugar a un borde multicolor que simula la descomposición de la luz.
    float hue = mod(slowTime * 0.1 + n, 1.0);
    vec3 colorfulRim = hsv2rgb(vec3(hue, 1.0, 1.0));
    
    // Mezcla del efecto rim con la reflexión:
    // - En áreas de borde (cuando fresnelFactor es alto), se usa mayormente el efecto multicolor.
    // - En áreas frontales (cuando frontFactor es alto), se refuerza el color del entorno.
    vec3 baseColor = mix(envColor, colorfulRim, fresnelFactor);
    baseColor = mix(baseColor, envColor, frontFactor);
    
    // Ajustamos la opacidad para un efecto más cristalino
    float baseOpacity = 0.4;
    
    // La opacidad aumenta en los bordes (efecto Fresnel) y en las reflexiones más brillantes
    float reflectionIntensity = length(envColor);
    float glassOpacity = mix(
        baseOpacity,
        1.0,
        max(fresnelFactor * 1.2, reflectionIntensity)
    );
    
    // Multiplicamos por el uniform opacity para permitir la transición gradual
    glassOpacity *= opacity;
    
    gl_FragColor = vec4(baseColor, glassOpacity);
}
