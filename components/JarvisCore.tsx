
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
  
  // Use refs for animation variables to prevent scene disposal on prop change
  const stateRef = useRef({ isProcessing, isSpeaking });

  useEffect(() => {
    stateRef.current = { isProcessing, isSpeaking };
  }, [isProcessing, isSpeaking]);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 6;
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

    // 1. NEURAL SINGULARITY (Core heart)
    const singularityGeo = new THREE.IcosahedronGeometry(0.5, 3);
    const singularityMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    });
    const singularity = new THREE.Mesh(singularityGeo, singularityMat);
    rootGroup.add(singularity);

    const innerHeartGeo = new THREE.SphereGeometry(0.12, 32, 32);
    const innerHeartMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const innerHeart = new THREE.Mesh(innerHeartGeo, innerHeartMat);
    rootGroup.add(innerHeart);

    // 2. ROTATING RINGS (Holographic Panes)
    const createRing = (radius: number, color: number, opacity: number, segments: number = 64) => {
      const ringGroup = new THREE.Group();
      const ringGeo = new THREE.TorusGeometry(radius, 0.005, 4, segments, Math.PI * 1.5);
      const ringMat = new THREE.MeshBasicMaterial({ 
        color, 
        transparent: true, 
        opacity, 
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide 
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.random() * Math.PI;
      ring.rotation.y = Math.random() * Math.PI;
      ringGroup.add(ring);
      
      for(let i=0; i<8; i++) {
        const dotGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const dot = new THREE.Mesh(dotGeo, ringMat);
        const angle = (i / 8) * Math.PI * 2;
        dot.position.x = Math.cos(angle) * radius;
        dot.position.y = Math.sin(angle) * radius;
        ringGroup.add(dot);
      }
      return ringGroup;
    };

    const AMBER = 0xffaa00;
    const rings: THREE.Group[] = [
      createRing(0.9, AMBER, 0.5),
      createRing(1.2, AMBER, 0.4),
      createRing(1.7, AMBER, 0.2),
      createRing(2.1, AMBER, 0.1)
    ];
    rings.forEach(r => rootGroup.add(r));

    // 3. OUTER DATA SHELL
    const shellGeo = new THREE.SphereGeometry(2.5, 12, 12);
    const shellMat = new THREE.MeshBasicMaterial({
      color: AMBER,
      wireframe: true,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    rootGroup.add(shell);

    // 4. PARTICLE FIELD (Neural Network)
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 1000;
    const posArr = new Float32Array(particleCount * 3);
    for(let i=0; i<particleCount*3; i++) posArr[i] = (Math.random() - 0.5) * 8;
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const particlesMat = new THREE.PointsMaterial({ 
      size: 0.012, 
      color: AMBER, 
      transparent: true, 
      opacity: 0.3,
      blending: THREE.AdditiveBlending 
    });
    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    rootGroup.add(particleSystem);

    const animate = (time: number) => {
      const delta = time * 0.001;
      const { isProcessing: activeProcessing, isSpeaking: activeSpeaking } = stateRef.current;
      const reactivity = activeProcessing ? 6.0 : (activeSpeaking ? 3.0 : 1.0);

      rootGroup.rotation.y += 0.0015 * reactivity;
      rootGroup.rotation.x = Math.sin(delta * 0.5) * 0.1;
      
      rings.forEach((ring, i) => {
        ring.rotation.z += (0.008 + (i * 0.004)) * reactivity;
        ring.rotation.x += (0.003 + (i * 0.001)) * reactivity;
      });

      singularity.rotation.y -= 0.02 * reactivity;
      const s = 1.0 + Math.sin(delta * 5) * 0.06 * (activeSpeaking ? 2.5 : 1);
      singularity.scale.setScalar(s);
      innerHeart.scale.setScalar(s * 0.6);
      innerHeart.material.opacity = 0.5 + Math.sin(delta * 10) * 0.5;

      shell.rotation.y -= 0.0005 * reactivity;
      particleSystem.rotation.y -= 0.0003 * reactivity;

      renderer.render(scene, camera);
      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []); // Only run once on mount

  return <div ref={containerRef} className="w-full h-full relative z-0" />;
};
