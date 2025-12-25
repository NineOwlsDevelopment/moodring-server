/**
 * ProbabilityField - The Probability Field Hero Animation
 * 
 * A flagship Three.js visualization representing probability space convergence.
 * Particles start in chaotic motion and converge into orbital paths forming
 * a glowing ring (Moodring) over ~3 seconds.
 * 
 * Design Philosophy:
 * - Calm, mathematical, intentional motion
 * - Colors derived from CSS variables (brand consistency)
 * - Additive blending for ring glow
 * - Respects prefers-reduced-motion
 * - Production-ready with proper cleanup
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ProbabilityFieldProps {
  className?: string;
}

// Shader code - Vertex shader handles particle positioning and orbital mechanics
const vertexShader = `
  attribute float size;
  attribute float phase;
  attribute float orbitRadius;
  attribute float orbitSpeed;
  attribute vec3 initialPosition;
  attribute float convergenceProgress;
  
  uniform float uTime;
  uniform float uConvergenceTime;
  uniform float uRingRadius;
  uniform vec2 uResolution;
  uniform vec3 uColorIris;
  uniform vec3 uColorAqua;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDistance;
  
  // Smooth easing function for convergence
  float easeInOutCubic(float t) {
    return t < 0.5 
      ? 4.0 * t * t * t 
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }
  
  void main() {
    // Calculate convergence progress (0 = chaotic, 1 = orbital)
    float convergence = easeInOutCubic(min(uTime / uConvergenceTime, 1.0));
    
    vec3 pos;
    
    if (convergence < 1.0) {
      // Chaotic phase: particles move randomly with decreasing energy
      float chaosFactor = 1.0 - convergence;
      float energy = mix(0.3, 1.0, chaosFactor);
      
      // Random motion based on initial position and time
      vec3 randomOffset = vec3(
        sin(uTime * 0.5 + initialPosition.x * 10.0) * energy,
        cos(uTime * 0.7 + initialPosition.y * 10.0) * energy,
        sin(uTime * 0.6 + initialPosition.z * 10.0) * energy * 0.3
      );
      
      // Blend between initial chaotic position and orbital target
      vec3 orbitalTarget = vec3(
        cos(phase + uTime * orbitSpeed) * orbitRadius,
        sin(phase + uTime * orbitSpeed) * orbitRadius,
        0.0
      );
      
      pos = mix(initialPosition + randomOffset, orbitalTarget, convergence);
    } else {
      // Orbital phase: particles follow ring path
      float angle = phase + uTime * orbitSpeed;
      pos = vec3(
        cos(angle) * orbitRadius,
        sin(angle) * orbitRadius,
        sin(angle * 2.0) * 0.1 // Subtle vertical oscillation
      );
    }
    
    // Transform to clip space
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Point size based on distance (smaller when farther)
    vDistance = length(mvPosition.xyz);
    gl_PointSize = size * (300.0 / vDistance) * (1.0 + convergence * 0.5);
    
    // Color and alpha based on convergence and position
    float ringDistance = abs(length(pos.xy) - uRingRadius);
    float ringProximity = 1.0 - smoothstep(0.0, uRingRadius * 0.3, ringDistance);
    
    // Color shifts from purple (chaos) to teal (order) as convergence increases
    // Colors passed as uniforms from CSS variables
    vec3 colorChaos = uColorIris;
    vec3 colorOrder = uColorAqua;
    vColor = mix(colorChaos, colorOrder, convergence * 0.7 + ringProximity * 0.3);
    
    // Alpha increases with convergence and ring proximity
    vAlpha = mix(0.3, 1.0, convergence) * (0.6 + ringProximity * 0.4);
  }
`;

// Fragment shader handles particle rendering with glow
const fragmentShader = `
  uniform float uTime;
  uniform float uRingRadius;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDistance;
  
  void main() {
    // Calculate distance from center of particle
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Discard pixels outside particle radius
    if (dist > 0.5) discard;
    
    // Soft circular falloff
    float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;
    
    // Add subtle glow effect
    float glow = 1.0 + smoothstep(0.3, 0.5, dist) * 0.5;
    
    // Final color with additive blending consideration
    gl_FragColor = vec4(vColor * glow, alpha);
  }
`;

export const ProbabilityField = ({ className = '' }: ProbabilityFieldProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (isReducedMotion) return; // Skip animation if reduced motion is preferred

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup - orthographic for better control
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
    renderer.setClearColor(0x000000, 0); // Transparent background
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Get colors from CSS variables and convert hex to RGB
    const hexToRgb = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255,
          ]
        : [0.486, 0.302, 1.0]; // Fallback to neon-iris
    };

    const getCSSVariable = (varName: string, fallback: string): string => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
      return value || fallback;
    };

    // Extract brand colors from CSS variables
    const colorIrisHex = getCSSVariable('--color-neon-iris', '#7c4dff');
    const colorAquaHex = getCSSVariable('--color-aqua-pulse', '#21f6d2');
    const colorIris = hexToRgb(colorIrisHex);
    const colorAqua = hexToRgb(colorAquaHex);

    // Particle system parameters
    const PARTICLE_COUNT = 8000; // Thousands of particles
    const RING_RADIUS = 2.0;
    const CONVERGENCE_TIME = 3.0; // 3 seconds

    // Initialize particle data
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    const orbitRadii = new Float32Array(PARTICLE_COUNT);
    const orbitSpeeds = new Float32Array(PARTICLE_COUNT);
    const initialPositions = new Float32Array(PARTICLE_COUNT * 3);
    const convergenceProgress = new Float32Array(PARTICLE_COUNT);

    // Initialize particles with random positions and orbital parameters
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Random initial position in 3D space
      const spread = 4.0;
      initialPositions[i3] = (Math.random() - 0.5) * spread;
      initialPositions[i3 + 1] = (Math.random() - 0.5) * spread;
      initialPositions[i3 + 2] = (Math.random() - 0.5) * spread * 0.5;

      // Set current position to initial
      positions[i3] = initialPositions[i3];
      positions[i3 + 1] = initialPositions[i3 + 1];
      positions[i3 + 2] = initialPositions[i3 + 2];

      // Random size (smaller particles)
      sizes[i] = Math.random() * 0.02 + 0.01;

      // Orbital phase (angle around ring)
      phases[i] = Math.random() * Math.PI * 2;

      // Orbital radius (slight variation for ring thickness)
      orbitRadii[i] = RING_RADIUS + (Math.random() - 0.5) * 0.2;

      // Orbital speed (variation for visual interest)
      orbitSpeeds[i] = 0.3 + Math.random() * 0.2;

      // Convergence progress starts at 0
      convergenceProgress[i] = 0;
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('orbitRadius', new THREE.BufferAttribute(orbitRadii, 1));
    geometry.setAttribute('orbitSpeed', new THREE.BufferAttribute(orbitSpeeds, 1));
    geometry.setAttribute('initialPosition', new THREE.BufferAttribute(initialPositions, 3));
    geometry.setAttribute('convergenceProgress', new THREE.BufferAttribute(convergenceProgress, 1));

    // Create shader material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uConvergenceTime: { value: CONVERGENCE_TIME },
        uRingRadius: { value: RING_RADIUS },
        uResolution: { value: new THREE.Vector2(width, height) },
        uColorIris: { value: new THREE.Vector3(...colorIris) },
        uColorAqua: { value: new THREE.Vector3(...colorAqua) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending, // Additive blending for glow effect
      depthWrite: false,
      vertexColors: false,
    });

    // Create points system
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const elapsed = (Date.now() - startTimeRef.current) / 1000; // Convert to seconds

      // Update time uniform
      material.uniforms.uTime.value = elapsed;

      // Rotate camera slightly for dynamic view (optional, subtle)
      camera.position.x = Math.sin(elapsed * 0.1) * 0.3;
      camera.position.y = Math.cos(elapsed * 0.15) * 0.2;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;

      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      material.uniforms.uResolution.value.set(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Dispose of Three.js resources
      geometry.dispose();
      material.dispose();
      renderer.dispose();

      // Remove canvas from DOM
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Clear refs
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      pointsRef.current = null;
    };
  }, [isReducedMotion]);

  // Static fallback for reduced motion
  if (isReducedMotion) {
    return (
      <div
        ref={containerRef}
        className={`absolute inset-0 ${className}`}
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(124, 77, 255, 0.1) 0%, transparent 70%)',
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${className}`}
      style={{ background: 'transparent' }}
    />
  );
};

