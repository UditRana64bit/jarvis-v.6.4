
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface JarvisCoreProps {
  isProcessing: boolean;
  isSpeaking?: boolean;
}

export const JarvisCore: React.FC<JarvisCoreProps> = ({ isProcessing, isSpeaking }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const coreGroupRef = useRef<THREE.Group | null>(null);

  const AMBER = 0xffaa00;
  const BRIGHT_AMBER = 0xffcc33;
  const DEEP_ORANGE = 0xcc4400;

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. SCENE SETUP
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7);
    sceneRef.current = scene;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    coreGroupRef.current = rootGroup;

    // 2. CENTRAL SINGULARITY (The bright white-amber heart)
    const singularityGeo = new THREE.SphereGeometry(0.3, 32, 32);
    const singularityMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const singularity = new THREE.Mesh(singularityGeo, singularityMat);
    rootGroup.add(singularity);

    const singularityGlowGeo = new THREE.SphereGeometry(0.8, 32, 32);
    const singularityGlowMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(AMBER) } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 color;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 6.0);
          gl_FragColor = vec4(color, intensity * 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    const singularityGlow = new THREE.Mesh(singularityGlowGeo, singularityGlowMat);
    rootGroup.add(singularityGlow);

    // 3. THE "LOOM" - High density rotating arcs
    const createDataLayer = (radius: number, arcCount: number, thickness: number, speedMult: number, opacity: number) => {
      const layerGroup = new THREE.Group();
      
      for (let i = 0; i < arcCount; i++) {
        const arcLen = Math.random() * Math.PI * 0.8 + 0.2;
        const ringGeo = new THREE.TorusGeometry(radius, thickness, 4, 64, arcLen);
        const ringMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.3 ? AMBER : BRIGHT_AMBER,
          transparent: true,
          opacity: opacity + Math.random() * 0.2,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(ringGeo, ringMat);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mesh.userData = { speed: (Math.random() - 0.5) * 0.02 * speedMult };
        layerGroup.add(mesh);
      }
      return layerGroup;
    };

    // Inner Loom (Tight & Fast)
    const innerLoom = createDataLayer(1.2, 12, 0.015, 2.5, 0.4);
    rootGroup.add(innerLoom);

    // Outer Loom (Wider & Strategic)
    const outerLoom = createDataLayer(2.2, 8, 0.01, 1.2, 0.2);
    rootGroup.add(outerLoom);

    // 4. NEURAL NODES (Cloud of points)
    const pointsGeo = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const colorObj = new THREE.Color(AMBER);
    
    for (let i = 0; i < 400; i++) {
      const r = 2.0 + Math.random() * 0.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      colors.push(colorObj.r, colorObj.g, colorObj.b);
    }
    
    pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pointsGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const pointsMat = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const neuralNodes = new THREE.Points(pointsGeo, pointsMat);
    rootGroup.add(neuralNodes);

    // 5. EXTERNAL DATA SHELL (Broken circuitry segments)
    const shellGeo = new THREE.SphereGeometry(2.8, 24, 24);
    const shellMat = new THREE.MeshBasicMaterial({
      color: DEEP_ORANGE,
      wireframe: true,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    rootGroup.add(shell);

    // 6. ANIMATION LOOP
    const animate = (time: number) => {
      const delta = time * 0.001;
      const reactivity = isProcessing ? 3.0 : 1.0;
      const pulseFactor = isSpeaking ? 1.5 : 1.0;

      if (rootGroup) {
        // Base Rotation
        rootGroup.rotation.y += 0.002 * reactivity;
        rootGroup.rotation.z += 0.001;

        // Animate all meshes in loops
        rootGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.userData.speed) {
            obj.rotation.x += obj.userData.speed * reactivity;
            obj.rotation.y += obj.userData.speed * 0.5 * reactivity;
          }
        });

        // Singularity Pulse
        const s = 1.0 + Math.sin(delta * 10.0 * pulseFactor) * 0.1 * pulseFactor;
        singularity.scale.setScalar(s);
        singularityMat.opacity = 0.8 + Math.sin(delta * 15.0) * 0.2;
        
        // Glow Intensity
        singularityGlow.scale.setScalar(1.0 + Math.sin(delta * 2.0) * 0.05);
        
        // Nodes Rotation
        neuralNodes.rotation.y -= 0.001 * reactivity;
        
        // Shell Oscillation
        shell.rotation.y += 0.0005 * reactivity;
        shell.scale.setScalar(1.0 + Math.sin(delta * 0.5) * 0.02);
      }

      if (cameraRef.current) {
        // Subtle drift
        cameraRef.current.position.x = Math.sin(delta * 0.2) * 0.2;
        cameraRef.current.position.y = Math.cos(delta * 0.15) * 0.2;
        cameraRef.current.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    // RESIZE OBSERVER
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (!cameraRef.current || !rendererRef.current) continue;
        const { width, height } = entry.contentRect;
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
      }
    };
  }, [isProcessing, isSpeaking]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative z-0 flex items-center justify-center"
      style={{ 
        filter: isSpeaking ? 'url(#refraction) brightness(1.2) contrast(1.1)' : 'brightness(1)',
        transition: 'filter 0.3s ease'
      }}
    />
  );
};
