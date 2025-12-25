/**
 * GradientProbabilityRing - First-Class Design System Primitive
 * 
 * A flagship Three.js visualization that serves as the visual and motion anchor
 * for the entire landing page. Features a shader-driven gradient ring with
 * particle flow along tangents, exposing rotation state for page-wide synchronization.
 * 
 * Design Philosophy:
 * - Institutional-grade visual quality
 * - Shader-driven gradient (no static textures)
 * - Calm, mathematical, intentional motion
 * - Colors derived from CSS variables (brand consistency)
 * - Exposes state for page-wide design system integration
 * - Respects prefers-reduced-motion
 * - Production-ready with proper cleanup
 */

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';

export interface GradientProbabilityRingRef {
  getRotation: () => number;
  getGradientAngle: () => number;
}

interface GradientProbabilityRingProps {
  className?: string;
  onRotationUpdate?: (rotation: number, gradientAngle: number) => void;
}

// Ring geometry vertex shader - handles ring positioning and gradient UV mapping
const ringVertexShader = `
  uniform float uRotation;
  uniform float uRingRadius;
  uniform float uRingThickness;
  
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  void main() {
    vUv = uv;
    
    // Create ring geometry in vertex shader
    vec3 pos = position;
    
    // Transform to clip space
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Ring geometry fragment shader - shader-driven gradient
const ringFragmentShader = `
  uniform float uRotation;
  uniform float uRingRadius;
  uniform float uRingThickness;
  uniform vec3 uColorCyan;
  uniform vec3 uColorTeal;
  uniform vec3 uColorBlue;
  uniform vec3 uColorPurple;
  uniform float uTime;
  
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  // Convert angle to color in gradient: cyan → teal → blue → purple
  vec3 gradientColor(float angle) {
    // Normalize angle to 0-1 range
    float normalized = mod(angle + uRotation, 6.28318) / 6.28318;
    
    // Four-color gradient stops
    if (normalized < 0.25) {
      // Cyan to Teal (0.0 - 0.25)
      float t = normalized / 0.25;
      return mix(uColorCyan, uColorTeal, t);
    } else if (normalized < 0.5) {
      // Teal to Blue (0.25 - 0.5)
      float t = (normalized - 0.25) / 0.25;
      return mix(uColorTeal, uColorBlue, t);
    } else if (normalized < 0.75) {
      // Blue to Purple (0.5 - 0.75)
      float t = (normalized - 0.5) / 0.25;
      return mix(uColorBlue, uColorPurple, t);
    } else {
      // Purple to Cyan (0.75 - 1.0)
      float t = (normalized - 0.75) / 0.25;
      return mix(uColorPurple, uColorCyan, t);
    }
  }
  
  void main() {
    // Calculate angle around ring from world position
    float angle = atan(vWorldPosition.y, vWorldPosition.x);
    
    // Get gradient color based on angle
    vec3 color = gradientColor(angle);
    
    // Calculate distance from ring center
    float dist = length(vWorldPosition.xy);
    float ringDist = abs(dist - uRingRadius);
    
    // Soft falloff for ring edges
    float alpha = 1.0 - smoothstep(0.0, uRingThickness * 0.5, ringDist);
    
    // Add subtle glow
    float glow = 1.0 + smoothstep(uRingThickness * 0.3, uRingThickness * 0.5, ringDist) * 0.3;
    
    // Pulsing intensity based on time
    float pulse = 0.9 + sin(uTime * 0.5) * 0.1;
    
    gl_FragColor = vec4(color * glow * pulse, alpha * 0.8);
  }
`;

// Particle vertex shader - particles flow along ring tangents
const particleVertexShader = `
  attribute float size;
  attribute float phase;
  attribute float orbitRadius;
  attribute float orbitSpeed;
  attribute vec3 initialPosition;
  attribute float flowSpeed;
  
  uniform float uTime;
  uniform float uConvergenceTime;
  uniform float uRingRadius;
  uniform float uRotation;
  uniform vec2 uResolution;
  uniform vec3 uColorCyan;
  uniform vec3 uColorTeal;
  uniform vec3 uColorBlue;
  uniform vec3 uColorPurple;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDistance;
  
  // Smooth easing function for convergence
  float easeInOutCubic(float t) {
    return t < 0.5 
      ? 4.0 * t * t * t 
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }
  
  // Get gradient color at angle (matches ring shader)
  vec3 gradientColor(float angle) {
    float normalized = mod(angle + uRotation, 6.28318) / 6.28318;
    if (normalized < 0.25) {
      float t = normalized / 0.25;
      return mix(uColorCyan, uColorTeal, t);
    } else if (normalized < 0.5) {
      float t = (normalized - 0.25) / 0.25;
      return mix(uColorTeal, uColorBlue, t);
    } else if (normalized < 0.75) {
      float t = (normalized - 0.5) / 0.25;
      return mix(uColorBlue, uColorPurple, t);
    } else {
      float t = (normalized - 0.75) / 0.25;
      return mix(uColorPurple, uColorCyan, t);
    }
  }
  
  void main() {
    // Calculate convergence progress
    float convergence = easeInOutCubic(min(uTime / uConvergenceTime, 1.0));
    
    vec3 pos;
    
    if (convergence < 1.0) {
      // Chaotic phase: particles move randomly with decreasing energy
      float chaosFactor = 1.0 - convergence;
      float energy = mix(0.2, 1.0, chaosFactor);
      
      vec3 randomOffset = vec3(
        sin(uTime * 0.5 + initialPosition.x * 10.0) * energy,
        cos(uTime * 0.7 + initialPosition.y * 10.0) * energy,
        sin(uTime * 0.6 + initialPosition.z * 10.0) * energy * 0.3
      );
      
      // Blend to orbital target
      vec3 orbitalTarget = vec3(
        cos(phase + uTime * orbitSpeed) * orbitRadius,
        sin(phase + uTime * orbitSpeed) * orbitRadius,
        0.0
      );
      
      pos = mix(initialPosition + randomOffset, orbitalTarget, convergence);
    } else {
      // Orbital phase: particles flow along ring with tangent velocity
      float angle = phase + uTime * orbitSpeed + uTime * flowSpeed;
      
      // Position on ring
      pos = vec3(
        cos(angle) * orbitRadius,
        sin(angle) * orbitRadius,
        sin(angle * 3.0) * 0.05 // Subtle vertical oscillation
      );
      
      // Add tangent flow offset (particles flow along ring)
      vec2 tangent = vec2(-sin(angle), cos(angle));
      pos.xy += tangent * flowSpeed * 0.1;
    }
    
    // Transform to clip space
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Point size
    vDistance = length(mvPosition.xyz);
    gl_PointSize = size * (300.0 / vDistance) * (1.0 + convergence * 0.3);
    
    // Color from gradient based on angle
    float angle = atan(pos.y, pos.x);
    vColor = gradientColor(angle);
    
    // Alpha based on convergence and ring proximity
    float ringDistance = abs(length(pos.xy) - uRingRadius);
    float ringProximity = 1.0 - smoothstep(0.0, uRingRadius * 0.2, ringDistance);
    vAlpha = mix(0.2, 1.0, convergence) * (0.7 + ringProximity * 0.3);
  }
`;

// Particle fragment shader
const particleFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDistance;
  
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    if (dist > 0.5) discard;
    
    float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;
    float glow = 1.0 + smoothstep(0.3, 0.5, dist) * 0.4;
    
    gl_FragColor = vec4(vColor * glow, alpha);
  }
`;

export const GradientProbabilityRing = forwardRef<GradientProbabilityRingRef, GradientProbabilityRingProps>(
  ({ className = '', onRotationUpdate }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const ringMeshRef = useRef<THREE.Mesh | null>(null);
    const pointsRef = useRef<THREE.Points | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(Date.now());
    const rotationRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);
    const [isReducedMotion, setIsReducedMotion] = useState(false);

    // Expose rotation state via ref
    useImperativeHandle(ref, () => ({
      getRotation: () => rotationRef.current,
      getGradientAngle: () => rotationRef.current,
    }));

    useEffect(() => {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setIsReducedMotion(mediaQuery.matches);
      
      const handleChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      
      return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
      if (!containerRef.current) return;
      if (isReducedMotion) return;

      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      // Scene setup
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera setup
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Color extraction from CSS variables
      const hexToRgb = (hex: string): [number, number, number] => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? [
              parseInt(result[1], 16) / 255,
              parseInt(result[2], 16) / 255,
              parseInt(result[3], 16) / 255,
            ]
          : [0.129, 0.965, 0.824]; // Fallback to aqua
      };

      const getCSSVariable = (varName: string, fallback: string): string => {
        const value = getComputedStyle(document.documentElement)
          .getPropertyValue(varName)
          .trim();
        return value || fallback;
      };

      // Extract brand colors - cyan → teal → blue → purple gradient
      const colorAquaHex = getCSSVariable('--color-aqua-pulse', '#21f6d2'); // Teal/Cyan
      const colorIrisHex = getCSSVariable('--color-neon-iris', '#7c4dff'); // Purple
      
      // Define gradient stops: cyan → teal → blue → purple
      const colorCyan = hexToRgb('#00d4ff'); // Bright cyan
      const colorTeal = hexToRgb(colorAquaHex); // Aqua pulse (teal)
      const colorBlue = hexToRgb('#3b82f6'); // Blue
      const colorPurple = hexToRgb(colorIrisHex); // Neon iris (purple)

      // Ring parameters
      const RING_RADIUS = 2.2;
      const RING_THICKNESS = 0.35; // Thick ring with filled center
      const CONVERGENCE_TIME = 3.0;
      const ROTATION_SPEED = 0.1; // Slow, calm rotation

      // Create ring geometry (torus) - thicker to fill center
      const ringGeometry = new THREE.TorusGeometry(
        RING_RADIUS,
        RING_THICKNESS,
        32,
        128
      );
      
      // Create disc geometry to fill the center gap
      const innerRadius = Math.max(0.1, RING_RADIUS - RING_THICKNESS);
      const discGeometry = new THREE.CircleGeometry(innerRadius, 64);

      // Ring material with gradient shader
      const ringMaterial = new THREE.ShaderMaterial({
        vertexShader: ringVertexShader,
        fragmentShader: ringFragmentShader,
        uniforms: {
          uRotation: { value: 0 },
          uRingRadius: { value: RING_RADIUS },
          uRingThickness: { value: RING_THICKNESS },
          uColorCyan: { value: new THREE.Vector3(...colorCyan) },
          uColorTeal: { value: new THREE.Vector3(...colorTeal) },
          uColorBlue: { value: new THREE.Vector3(...colorBlue) },
          uColorPurple: { value: new THREE.Vector3(...colorPurple) },
          uTime: { value: 0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
      scene.add(ringMesh);
      ringMeshRef.current = ringMesh;
      
      // Add disc to fill center gap with same gradient material
      const discMesh = new THREE.Mesh(discGeometry, ringMaterial);
      scene.add(discMesh);

      // Particle system
      const PARTICLE_COUNT = 6000;
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const sizes = new Float32Array(PARTICLE_COUNT);
      const phases = new Float32Array(PARTICLE_COUNT);
      const orbitRadii = new Float32Array(PARTICLE_COUNT);
      const orbitSpeeds = new Float32Array(PARTICLE_COUNT);
      const initialPositions = new Float32Array(PARTICLE_COUNT * 3);
      const flowSpeeds = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const spread = 3.5;
        
        initialPositions[i3] = (Math.random() - 0.5) * spread;
        initialPositions[i3 + 1] = (Math.random() - 0.5) * spread;
        initialPositions[i3 + 2] = (Math.random() - 0.5) * spread * 0.5;

        positions[i3] = initialPositions[i3];
        positions[i3 + 1] = initialPositions[i3 + 1];
        positions[i3 + 2] = initialPositions[i3 + 2];

        sizes[i] = Math.random() * 0.015 + 0.008;
        phases[i] = Math.random() * Math.PI * 2;
        orbitRadii[i] = RING_RADIUS + (Math.random() - 0.5) * 0.15;
        orbitSpeeds[i] = 0.25 + Math.random() * 0.15;
        flowSpeeds[i] = 0.1 + Math.random() * 0.1; // Tangential flow speed
      }

      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      particleGeometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
      particleGeometry.setAttribute('orbitRadius', new THREE.BufferAttribute(orbitRadii, 1));
      particleGeometry.setAttribute('orbitSpeed', new THREE.BufferAttribute(orbitSpeeds, 1));
      particleGeometry.setAttribute('initialPosition', new THREE.BufferAttribute(initialPositions, 3));
      particleGeometry.setAttribute('flowSpeed', new THREE.BufferAttribute(flowSpeeds, 1));

      const particleMaterial = new THREE.ShaderMaterial({
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uConvergenceTime: { value: CONVERGENCE_TIME },
          uRingRadius: { value: RING_RADIUS },
          uRotation: { value: 0 },
          uResolution: { value: new THREE.Vector2(width, height) },
          uColorCyan: { value: new THREE.Vector3(...colorCyan) },
          uColorTeal: { value: new THREE.Vector3(...colorTeal) },
          uColorBlue: { value: new THREE.Vector3(...colorBlue) },
          uColorPurple: { value: new THREE.Vector3(...colorPurple) },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const points = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(points);
      pointsRef.current = points;

      // Animation loop
      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        frameCountRef.current += 1;
        
        // Update rotation (slow, calm rotation)
        rotationRef.current = elapsed * ROTATION_SPEED;
        
        // Update uniforms
        ringMaterial.uniforms.uTime.value = elapsed;
        ringMaterial.uniforms.uRotation.value = rotationRef.current;
        particleMaterial.uniforms.uTime.value = elapsed;
        particleMaterial.uniforms.uRotation.value = rotationRef.current;

        // Throttle parent updates to every 2 frames (~30fps instead of 60fps)
        // This reduces re-renders in the parent component significantly
        if (onRotationUpdate && frameCountRef.current % 2 === 0) {
          onRotationUpdate(rotationRef.current, rotationRef.current);
        }

        // Subtle camera movement
        camera.position.x = Math.sin(elapsed * 0.08) * 0.2;
        camera.position.y = Math.cos(elapsed * 0.1) * 0.15;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      };

      animate();

      // Handle resize
      const handleResize = () => {
        if (!containerRef.current || !camera || !renderer) return;
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
        particleMaterial.uniforms.uResolution.value.set(newWidth, newHeight);
      };

      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        ringGeometry.dispose();
        discGeometry.dispose();
        ringMaterial.dispose();
        particleGeometry.dispose();
        particleMaterial.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        sceneRef.current = null;
        rendererRef.current = null;
        cameraRef.current = null;
        ringMeshRef.current = null;
        pointsRef.current = null;
      };
    }, [isReducedMotion, onRotationUpdate]);

    if (isReducedMotion) {
      return (
        <div
          ref={containerRef}
          className={`absolute inset-0 ${className}`}
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(124, 77, 255, 0.08) 0%, transparent 70%)',
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
  }
);

GradientProbabilityRing.displayName = 'GradientProbabilityRing';

