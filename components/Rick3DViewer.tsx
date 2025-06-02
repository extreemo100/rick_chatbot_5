import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const Rick3DViewer = ({ isPlayingAudio, modelUrl = '/models/correctrick.glb', backgroundImageUrl = null, isLoading = false }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const mixerRef = useRef(null);
  const modelRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const animationsRef = useRef({});
  const currentActionRef = useRef(null);
  const controlsRef = useRef(null);
  
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);

  const normalizeModel = (model) => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    model.position.x = -center.x;
    model.position.y = -center.y;
    model.position.z = -center.z;
    
    const maxDimension = Math.max(size.x, size.y, size.z);
    const targetSize = 2;
    const scale = maxDimension > 0.01 ? targetSize / maxDimension : 1;
    model.scale.setScalar(scale);
    
    const updatedBox = new THREE.Box3().setFromObject(model);
    const updatedSize = updatedBox.getSize(new THREE.Vector3());
    model.position.y = updatedSize.y / 2;
    
    return { size: updatedSize, center: updatedBox.getCenter(new THREE.Vector3()) };
  };

  const adjustCameraForModel = (camera, controls, modelInfo) => {
    const distance = Math.max(modelInfo.size.x, modelInfo.size.y, modelInfo.size.z) * 2;
    const height = modelInfo.size.y * 0.6;
    
    camera.position.set(distance * 0.8, height + distance * 0.5, distance);
    camera.lookAt(0, height, 0);
    
    if (controls) {
      controls.target.set(0, height, 0);
      controls.minDistance = distance * 0.3;
      controls.maxDistance = distance * 3;
      controls.update();
    }
  };

  // Function to start an animation properly
  const startAnimation = (action, animationName) => {
    if (!action) return;
    
    // Reset the action to its initial state
    action.reset();
    
    // Set it to play once to ensure it starts
    action.setLoop(THREE.LoopRepeat);
    action.clampWhenFinished = false;
    action.enabled = true;
    
    // Set weight and time scale
    action.setEffectiveWeight(1.0);
    action.setEffectiveTimeScale(1.0);
    
    // Play the action
    action.play();
    
    console.log(`Started animation: ${animationName}`);
  };

  useEffect(() => {
    let animationFrameId;
    let mounted = true;
    const currentMount = mountRef.current;

    const initScene = () => {
      // Scene setup
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Add background image if provided
      if (backgroundImageUrl) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          backgroundImageUrl,
          (texture) => {
            scene.background = texture;
            console.log('Background image loaded successfully');
          },
          (progress) => {
            console.log('Background loading progress:', progress);
          },
          (error) => {
            console.error('Error loading background image:', error);
            // Fallback to gradient background
            scene.background = new THREE.Color(0x1a1a2e);
          }
        );
      } else {
        // Default background color
        scene.background = new THREE.Color(0x1a1a2e);
      }

      const camera = new THREE.PerspectiveCamera(
        45,
        currentMount.clientWidth / currentMount.clientHeight,
        0.1,
        1000
      );
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: !backgroundImageUrl, // Only use alpha if no background image
        preserveDrawingBuffer: true
      });
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // Add output encoding for proper color display
      renderer.outputEncoding = THREE.sRGBEncoding;
      // Tone mapping - comment out if colors appear wrong
      // renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // renderer.toneMappingExposure = 1;
      rendererRef.current = renderer;
      currentMount.appendChild(renderer.domElement);

      // Enhanced lighting for better material visibility
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(5, 10, 5);
      directionalLight.castShadow = true;
      scene.add(directionalLight);
      
      // Add a second light from the opposite direction
      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
      directionalLight2.position.set(-5, 5, -5);
      scene.add(directionalLight2);

      // Ground plane - make it transparent if we have a background image
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ 
          color: 0xcccccc,
          roughness: 0.8,
          metalness: 0.2,
          transparent: backgroundImageUrl ? true : false,
          opacity: backgroundImageUrl ? 0.3 : 1.0
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controlsRef.current = controls;

      // Start the clock
      clockRef.current.start();

      // Model loading
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          if (!mounted) return;
          
          const model = gltf.scene;
          modelRef.current = model;

          // Setup materials - preserve original materials
          let materialCount = 0;
          let textureCount = 0;
          
          model.traverse((child) => {
            if (child.isMesh) {
              console.log(`Mesh: ${child.name || 'unnamed'}`);
              
              // Handle both single materials and material arrays
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              
              materials.forEach((mat, index) => {
                if (mat) {
                  materialCount++;
                  console.log(`  Material ${index}: ${mat.type}`);
                  console.log(`    Color: ${mat.color ? `#${mat.color.getHexString()}` : 'none'}`);
                  console.log(`    Map: ${mat.map ? 'yes' : 'no'}`);
                  console.log(`    Vertex Colors: ${mat.vertexColors ? 'yes' : 'no'}`);
                  
                  // Count textures
                  if (mat.map) textureCount++;
                  if (mat.normalMap) textureCount++;
                  if (mat.roughnessMap) textureCount++;
                  if (mat.metalnessMap) textureCount++;
                  if (mat.emissiveMap) textureCount++;
                  
                  // Handle different material types
                  if (mat.type === 'MeshPhysicalMaterial' || mat.type === 'MeshStandardMaterial') {
                    // These materials might have additional properties
                    if (mat.emissive && !mat.emissive.equals(new THREE.Color(0x000000))) {
                      console.log(`    Emissive: #${mat.emissive.getHexString()}`);
                    }
                    console.log(`    Roughness: ${mat.roughness}`);
                    console.log(`    Metalness: ${mat.metalness}`);
                  }
                  
                  // Ensure the material supports skinning if needed
                  if (child.skeleton && mat.skinning !== undefined) {
                    mat.skinning = true;
                  }
                  
                  // Ensure vertex colors are enabled if present
                  if (child.geometry && child.geometry.attributes.color) {
                    mat.vertexColors = true;
                    console.log('    Enabled vertex colors');
                  }
                  
                  // Force material update
                  mat.needsUpdate = true;
                }
              });
              
              child.castShadow = true;
              child.receiveShadow = true;
              child.frustumCulled = true;
            }
          });
          
          console.log(`Total materials: ${materialCount}, Total textures: ${textureCount}`);

          const modelInfo = normalizeModel(model);
          adjustCameraForModel(camera, controls, modelInfo);
          scene.add(model);

          // Animation setup
          if (gltf.animations && gltf.animations.length > 0) {
            console.log(`Found ${gltf.animations.length} animations:`);
            
            // Create mixer
            const mixer = new THREE.AnimationMixer(model);
            mixerRef.current = mixer;
            
            // Clear previous animations
            animationsRef.current = {};
            
            // Process all animations
            gltf.animations.forEach((clip, index) => {
              console.log(`Animation ${index}: "${clip.name}" (duration: ${clip.duration}s)`);
              
              const action = mixer.clipAction(clip);
              action.setLoop(THREE.LoopRepeat);
              
              // Store by name and index
              if (clip.name) {
                animationsRef.current[clip.name] = action;
              }
              animationsRef.current[index] = action;
              
              // Identify animation types
              const lowerName = clip.name.toLowerCase();
              
              // Check for idle animations
              if (index === 0 || 
                  lowerName.includes('idle') || 
                  lowerName.includes('wait') || 
                  lowerName.includes('stand') ||
                  lowerName.includes('default')) {
                animationsRef.current['idle'] = action;
                console.log(`Assigned "${clip.name}" as idle animation`);
              }
              
              // Check for talk animations
              if (lowerName.includes('talk') || 
                  lowerName.includes('speak') || 
                  lowerName.includes('attack') ||
                  lowerName.includes('action') ||
                  lowerName.includes('move') ||
                  (index === 1 && !animationsRef.current['talk'])) {
                animationsRef.current['talk'] = action;
                console.log(`Assigned "${clip.name}" as talk animation`);
              }
            });

            // Ensure we have both idle and talk
            if (!animationsRef.current['idle']) {
              animationsRef.current['idle'] = animationsRef.current[0];
              console.log('Using first animation as idle');
            }
            
            if (!animationsRef.current['talk']) {
              if (animationsRef.current[1]) {
                animationsRef.current['talk'] = animationsRef.current[1];
              } else {
                animationsRef.current['talk'] = animationsRef.current['idle'];
              }
              console.log('Assigned talk animation');
            }

            // Force an initial update of the mixer
            mixer.update(0);

            // Start idle animation after a brief delay to ensure everything is ready
            setTimeout(() => {
              if (mounted && animationsRef.current['idle']) {
                startAnimation(animationsRef.current['idle'], 'idle');
                currentActionRef.current = animationsRef.current['idle'];
                setModelLoaded(true);
              }
            }, 100);
            
          } else {
            console.warn('No animations found');
            setModelLoaded(true);
          }
        },
        (xhr) => {
          if (mounted) {
            setLoadingProgress((xhr.loaded / xhr.total) * 100);
          }
        },
        (error) => {
          if (mounted) {
            setError(`Failed to load model: ${error.message}`);
          }
        }
      );

      // Animation loop
      const animate = () => {
        if (!mounted) return;
        
        animationFrameId = requestAnimationFrame(animate);
        
        // Get delta time
        const delta = clockRef.current.getDelta();
        
        // Update animations
        if (mixerRef.current) {
          mixerRef.current.update(delta);
        } else if (modelRef.current) {
          // Fallback rotation if no animations
          modelRef.current.rotation.y += 0.01;
        }
        
        // Update controls
        if (controls) {
          controls.update();
        }
        
        // Render
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      };

      animate();

      // Handle window resize
      const handleResize = () => {
        if (!camera || !renderer || !currentMount) return;
        
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      };
      
      window.addEventListener('resize', handleResize);

      return () => {
        mounted = false;
        window.removeEventListener('resize', handleResize);
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        if (currentMount && renderer) {
          currentMount.removeChild(renderer.domElement);
        }
        if (renderer) {
          renderer.dispose();
        }
      };
    };

    const cleanup = initScene();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [modelUrl, backgroundImageUrl]);

  // Handle animation switching based on audio playback
  useEffect(() => {
    if (!modelLoaded || !mixerRef.current) return;

    const targetAnimationKey = isPlayingAudio ? 'talk' : 'idle';
    const targetAction = animationsRef.current[targetAnimationKey];
    
    if (!targetAction) {
      console.warn(`No ${targetAnimationKey} animation available`);
      return;
    }

    if (targetAction !== currentActionRef.current) {
      console.log(`Switching to ${targetAnimationKey} animation`);
      
      // Stop current animation
      if (currentActionRef.current) {
        currentActionRef.current.fadeOut(0.5);
      }
      
      // Start new animation
      targetAction.reset();
      targetAction.fadeIn(0.5);
      targetAction.play();
      
      currentActionRef.current = targetAction;
    }
  }, [isPlayingAudio, modelLoaded]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mountRef} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      
      {!modelLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-center">
            <div className="text-green-400 text-lg mb-2">Loading model...</div>
            <div className="w-48 bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="text-green-300 text-sm mt-2">{Math.round(loadingProgress)}%</div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-red-400 text-center">
            <div className="text-lg mb-2">{error}</div>
            <div className="text-sm">Model path: {modelUrl}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rick3DViewer;