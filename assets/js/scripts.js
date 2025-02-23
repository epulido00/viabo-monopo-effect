const renderer = new THREE.WebGLRenderer({
    antialias: false
});

const banner = document.getElementById('banner');
banner.appendChild(renderer.domElement);
renderer.setSize(banner.offsetWidth, banner.offsetHeight);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(
    -0.5,
    0.5,
    0.5,
    -0.5,
    1e-5,
    100
);
camera.position.z = 1;

const mouse = new THREE.Vector2();

banner.addEventListener('mousemove', (e) => {
    const rect = banner.getBoundingClientRect();
    mouse.set(
        (e.clientX - rect.left) / rect.width - 0.5,
        0.5 - (e.clientY - rect.top) / rect.height
    );
});

// Create geometry and material for the plane
const geo = new THREE.PlaneBufferGeometry(1, 1);
const mat = new THREE.ShaderMaterial({
    depthTest: false,
    uniforms: {
        uTime: { value: 0 },
        uMouse: { value: mouse }
    },
    vertexShader: `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    uniform float uTime;
    uniform vec2 uMouse;
    varying vec2 vUv;
    
    // Noise functions taken from Ian McEwan
    vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
    float permute(float x) { return floor(mod(((x * 34.0) + 1.0) * x, 289.0)); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    vec4 grad4(float j, vec4 ip) {
        const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
        vec4 p, s;
        p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
        p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
        s = vec4(lessThan(p, vec4(0.0)));
        p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
        return p;
    }
    
    float snoise(vec4 v) {
        const vec2 C = vec2(0.138196601125010504, 0.309016994374947451);
        vec4 i = floor(v + dot(v, C.yyyy));
        vec4 x0 = v - i + dot(i, C.xxxx);
    
        vec4 i0;
        vec3 isX = step(x0.yzw, x0.xxx);
        vec3 isYZ = step(x0.zww, x0.yyz);
        i0.x = isX.x + isX.y + isX.z;
        i0.yzw = 1.0 - isX;
    
        i0.y += isYZ.x + isYZ.y;
        i0.zw += 1.0 - isYZ.xy;
        i0.z += isYZ.z;
        i0.w += 1.0 - isYZ.z;
    
        vec4 i3 = clamp(i0, 0.0, 1.0);
        vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
        vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
    
        vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
        vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
        vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
        vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;
    
        i = mod(i, 289.0);
        float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
        vec4 j1 = permute(permute(permute(permute(i.w + vec4(i1.w, i2.w, i3.w, 1.0)) + i.z + vec4(i1.z, i2.z, i3.z, 1.0)) + i.y + vec4(i1.y, i2.y, i3.y, 1.0)) + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
    
        vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
        vec4 p0 = grad4(j0, ip);
        vec4 p1 = grad4(j1.x, ip);
        vec4 p2 = grad4(j1.y, ip);
        vec4 p3 = grad4(j1.z, ip);
        vec4 p4 = grad4(j1.w, ip);
    
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        p4 *= taylorInvSqrt(dot(p4, p4));
    
        vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
        vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
        m0 = m0 * m0;
        m1 = m1 * m1;
        return 49.0 * (dot(m0 * m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2))) + dot(m1 * m1, vec2(dot(p3, x3), dot(p4, x4))));
    }
    
    void main() {
        // Get the noise value to drive color transitions
        float noise = snoise(vec4(vUv, uMouse + uTime * 0.0001));
    
        // Define the colors (black, red, and blue)
        vec3 black = vec3(0.0, 0.0, 0.0);  // Black
        vec3 red = vec3(1.0, 0.0, 0.0);    // Red
        vec3 blue = vec3(0.0, 0.0, 1.0);   // Blue
    
        // Mix between black, red, and blue
        // The formula makes black more dominant (by using a higher weight on black)
        float blackFactor = 1.0 - abs(noise);   // More black when noise is low
        vec3 color = mix(black, mix(red, blue, noise * 0.5 + 0.5), blackFactor);
    
        // Set the final color with an alpha value of 1.0
        gl_FragColor = vec4(color, 1.0);
    }
    `
    
    
});

const plane = new THREE.Mesh(geo, mat);
scene.add(plane);

const animate = () => {
    mat.uniforms.uTime.value = performance.now();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
};

requestAnimationFrame(animate);
