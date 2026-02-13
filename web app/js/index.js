import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { ContrastSaturationShader } from './shader.js';

var bottle = null;
var rotationOffset = 0;
var isRotating = false;
var rotationBaseline = 0;

var plasticMat = new THREE.MeshPhysicalMaterial({
      "color": 16121854,
      "roughness": 0.08,
      "metalness": 0,
      "sheen": 0,
      "sheenColor": 0,
      "sheenRoughness": 1,
      "emissive": 0,
      "specularIntensity": 1,
      "specularColor": new THREE.Color(0xffffff),
      "clearcoat": 0.8,
      "clearcoatRoughness": 0.04,
      "dispersion": 0,
      "iridescence": 0,
      "iridescenceIOR": 1.3,
      "iridescenceThicknessRange": [
          100,
          400
      ],
      "anisotropy": 0,
      "anisotropyRotation": 0,
      "envMapRotation": [
          0,
          0,
          0,
          "XYZ"
      ],
      "envMapIntensity": 1.4,
      "reflectivity": 0.4591837131892669,
      "transmission": 0,
      "thickness": 0,
      "attenuationColor": 16777215,
      "side": 2,
      "opacity": 0.29999998211860657,
      "transparent": true,
      "blendColor": 0,
      "depthWrite": false
});

var capMat = new THREE.MeshPhysicalMaterial({
  color: 0xdce2dd,        // same color as before (converted to hex)
  roughness: 0.75,        // high roughness = matte
  metalness: 0.0,         // plastic is non-metal

  // Specular highlights should be subtle
  specularIntensity: 0.25,
  specularColor: new THREE.Color(0xffffff),

  // No glass-like effects
  transmission: 0,
  thickness: 0,
  clearcoat: 0,
  clearcoatRoughness: 0,

  // Disable advanced effects not used by matte plastic
  sheen: 0,
  iridescence: 0,
  dispersion: 0,
  anisotropy: 0,

  // Environment reflections should be soft
  envMapIntensity: 0.6,

  // Opaque surface
  transparent: false,
  opacity: 1.0,
  side: THREE.FrontSide,
  depthWrite: true
});

var labelMat = null;

var labelBody = null;
var bottleBody = null;
var capBody = null;

var decalMeshArray = [null, null, null];
var decalBackingMeshArray = [null, null, null];
var bottleArray = [null, null, null];

var labelHeights = [235, 213, 248];
var labelXOffsets = [126, 154, 102];
var labelYOffsets = [126, 217, 122]; 
var areaHeights = [245, 333, 310];

var bottleIndex = 2;
var scaleFactor = 4;
var textureRes = 1024;


// === Load label texture ===
const textureLoader = new THREE.TextureLoader();

// === Scene setup ===
const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(3, 2, 5);
  
  // Renderer
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true
  });
  
  // === Load 3DS model ===
  loadBottle('./resources/bottleSmall.glb', './resources/bottleLabelTemplateSmall.png', 0)
  loadBottle('./resources/bottleMed.glb', './resources/bottleLabelTemplateMed.png', 1)
  loadBottle('./resources/bottleLarge.glb', './resources/bottleLabelTemplateLarge.png', 2)
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  renderer.setClearColor(0x808080); // hex for medium gray

  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.physicallyCorrectLights = true;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const options = { mimeType: 'video/webm; codecs=vp9', bitsPerSecond: 10_000_000 };
  const stream = renderer.domElement.captureStream(60); // 30 FPS
  var recorder = null
  var chunks = [];
  
  // Light
  const light = new THREE.HemisphereLight(
    0xffffff, // sky color
    0x444444, // ground color
    1.2       // intensity
  );

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  
  /*
  const keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(-5, 10, -5);

  const fillLight = new THREE.DirectionalLight(0xffffff, 1);
  fillLight.position.set(5, 5, -5);
  
  const rimLight = new THREE.DirectionalLight(0xffffff, 2);
  rimLight.position.set(0, 5, -10);

  scene.add(rimLight);
  scene.add(keyLight);
  scene.add(light);
  scene.add(fillLight);
  */

  const keyLight = new THREE.DirectionalLight(0xffffff, 4);
  keyLight.position.set(6, 10, 6);
  scene.add(keyLight);

  // Fill light (softens contrast)
  const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
  fillLight.position.set(-6, 4, 6);
  scene.add(fillLight);

  const fillLight2 = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
  scene.add(fillLight2);

  // Rim light (edge definition)
  const rimLight = new THREE.DirectionalLight(0xffffff, 3);
  rimLight.position.set(0, 6, -10);
  scene.add(rimLight);
  
  const softbox = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  softbox.position.set(0, 4, 6);
  scene.add(softbox);
  
  softbox.visible = false;
  scene.environment = softbox; // conceptually — HDR is still better
  scene.environmentIntensity = 1.5;

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.update();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const colorPass = new ShaderPass(ContrastSaturationShader);
  colorPass.uniforms.contrast.value = 1.08;
  colorPass.uniforms.saturation.value = 1.15;

  composer.addPass(colorPass);
  
  // Animation loop
  function animate() {
    bottleArray.forEach(bottle => {
      if(bottle !== null) {
        bottle.visible = false;
      }
    });
    if(bottleArray[bottleIndex] !== null) {
      bottleArray[bottleIndex].visible = true;
    }
    requestAnimationFrame(animate);

    controls.update();
    composer.render();
    
    if(bottleArray[bottleIndex] !== null) {
      bottleArray[bottleIndex].rotation.y = rotationBaseline;

      if(isRotating) {
        rotationOffset += 0.02
        bottleArray[bottleIndex].rotation.y = rotationBaseline + rotationOffset;
        if (rotationOffset >= Math.PI * 2) {
          console.log("Stopping recording");
          recorder.stop();
          recorder = null;
          rotationOffset = 0;
          isRotating = false;
        }
      }
    }
  }
  animate();

function recordRotation() {
  console.log("Starting recording");
  resetRecorder();
  recorder.start();
  isRotating = true;
  rotationOffset = 0.00001;
}

function resetCamera() {
  camera.position.set(3, 2, 5);
  controls.target.set(0, 0, 0);
  controls.update();
  renderer.render(scene, camera);
}

function resetRecorder() {
  recorder = new MediaRecorder(stream, options);
  chunks.length = 0;

  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animation.webm';
    a.click();
  };
}

function loadLabel() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*'; // optional filter
  fileInput.multiple = false;
  
  // Add your listener
  fileInput.addEventListener('change', async (event) => {
    const file = fileInput.files[0];
    if (!file) return;
  
    const reader = new FileReader();

    // Read as ArrayBuffer (raw binary)
    reader.readAsArrayBuffer(file);
  
    reader.onload = () => {
      const arrayBuffer = reader.result;
      console.log('Binary loaded:', arrayBuffer.byteLength, 'bytes');
  
      // You can now use this ArrayBuffer to create a Blob for Three.js textures
      const blob = new Blob([arrayBuffer], { type: file.type });
      const url = URL.createObjectURL(blob);

      // Load as texture
      textureLoader.load(url, (texture) => {

        const canvas = document.createElement('canvas');
        canvas.width = textureRes * scaleFactor;
        canvas.height = textureRes * scaleFactor;

        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const atlasTexture = new THREE.CanvasTexture(canvas);
        atlasTexture.colorSpace = THREE.SRGBColorSpace;

        ctx.drawImage(
          texture.image,
          (labelXOffsets[bottleIndex]) * scaleFactor,
          (labelYOffsets[bottleIndex] + ((areaHeights[bottleIndex] - labelHeights[bottleIndex]) / 2)) * scaleFactor,
          (texture.image.width * (labelHeights[bottleIndex] / texture.image.height)) * scaleFactor,
          (labelHeights[bottleIndex]) * scaleFactor
        );

        atlasTexture.needsUpdate = true;
        atlasTexture.flipY = false;

        atlasTexture.minFilter = THREE.LinearMipmapLinearFilter;
        atlasTexture.magFilter = THREE.LinearFilter;
        atlasTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        atlasTexture.premultiplyAlpha = true;
        atlasTexture.colorSpace = THREE.SRGBColorSpace;
        decalMeshArray[bottleIndex].material.alphaTest = 0.5;
        decalMeshArray[bottleIndex].material.transparent = false;
        decalMeshArray[bottleIndex].material.envMapIntensity = 1.3;
        decalMeshArray[bottleIndex].material.color.setRGB(1.15, 1.15, 1.15);

        texture.flipY = false; // important: set before assignment
        decalMeshArray[bottleIndex].material.map = atlasTexture;
        decalMeshArray[bottleIndex].material.needsUpdate = true;
        decalMeshArray[bottleIndex].material.premultipliedAlpha = true;

        decalBackingMeshArray[bottleIndex].material.map = atlasTexture;
        decalBackingMeshArray[bottleIndex].material.needsUpdate = true;
      });
    };
  
    reader.onerror = (err) => {
      console.error('Error reading file:', err);
    };
  });
  
  // Trigger the file browser
  fileInput.click();
}

function setSmallBottle() {
  bottleIndex = 0;
}

function setMedBottle() {
  bottleIndex = 1;
}

function setLargeBottle() {
  bottleIndex = 2;
}

/**
 * Creates a perfect world-space duplicate of a mesh
 * @param {THREE.Mesh} sourceMesh - The mesh to duplicate
 * @param {number} scaleOffset - Optional scale multiplier to avoid z-fighting (default 1.0 = no offset)
 * @returns {THREE.Mesh} The duplicated mesh
 */
function duplicateMesh(sourceMesh, scaleOffset = 1.0) {
  const geometryClone = sourceMesh.geometry.clone();
  const materialClone = Array.isArray(sourceMesh.material)
    ? sourceMesh.material.map(m => m.clone())
    : sourceMesh.material.clone();

  const duplicate = new THREE.Mesh(geometryClone, materialClone);
  const box = new THREE.Box3().setFromObject(sourceMesh);
  const center = box.getCenter(new THREE.Vector3());

  sourceMesh.parent.add(duplicate);

  // Copy local transform instead of world transform
  duplicate.position.copy(sourceMesh.position);
  duplicate.rotation.copy(sourceMesh.rotation);
  duplicate.scale.copy(sourceMesh.scale);

  // Move target so scaling happens about the center
  duplicate.position.sub(center);
  duplicate.scale.multiplyScalar(scaleOffset);
  duplicate.position.add(center);

  duplicate.position.set(duplicate.position.x * scaleOffset, duplicate.position.y, duplicate.position.z * scaleOffset);

  return duplicate;
}

function setCapColor(color) {
  capBody.material.color = new THREE.Color(color);
}

document.getElementById("buttonSmall").onclick = setSmallBottle;
document.getElementById("buttonMed").onclick = setMedBottle;
document.getElementById("buttonLarge").onclick = setLargeBottle;
document.getElementById("recordButton").onclick = recordRotation;
document.getElementById("resetCameraButton").onclick = resetCamera;
document.getElementById("loadLabelButton").onclick = loadLabel;
document.getElementById('colorPicker').addEventListener('input', (event) => {
  const selectedColor = event.target.value; // e.g. "#ff8800"
  renderer.setClearColor(selectedColor);
});
document.querySelectorAll("button.swatch").forEach(btn => {
  btn.addEventListener("click", () => {
    setCapColor(btn.style.background);
  });
})

const fovSlider = document.getElementById('fov-slider');
parseFloat(setFovPreserveFraming(fovSlider.value));
fovSlider.addEventListener('input', () => {
  parseFloat(setFovPreserveFraming(fovSlider.value));
});

const rotSlider = document.getElementById('rot-slider');
rotationBaseline = rotSlider.value / (180 / Math.PI);
rotSlider.addEventListener('input', () => {
  rotationBaseline = rotSlider.value / (180 / Math.PI);
});

function setFovPreserveFraming(newFov) {
  const oldFovRad = THREE.MathUtils.degToRad(camera.fov);
  const newFovRad = THREE.MathUtils.degToRad(newFov);

  const scale =
    Math.tan(oldFovRad / 2) /
    Math.tan(newFovRad / 2);

  camera.fov = newFov;

  camera.position
    .sub(controls.target)
    .multiplyScalar(scale)
    .add(controls.target);

  camera.updateProjectionMatrix();
  controls.update();
}

function loadBottle(modelPath, texturePath, modelIndex) {
  const loader = new GLTFLoader();
  loader.load(modelPath, (object) => {
    bottle = object.scene;

    bottleBody = bottle.getObjectByName('bottleBody');
    bottleBody.material = plasticMat;
    labelBody = bottle.getObjectByName('bottleLabel');
    labelMat = labelBody.material;

    capBody = bottle.getObjectByName('bottleCap');
    capBody.material = capMat;

    let texture = textureLoader.load(texturePath, (texture) => {
      texture.flipY = false;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    let decalMesh = duplicateMesh(labelBody, 1.01);
    decalMesh.material = new THREE.MeshStandardMaterial({
      map: texture,
      alphaTest: 0.01,    // discard pixels with alpha < 0.01
      depthWrite: true,    // write depth for correct occlusion
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: 1,

      opacity: 1.0,

      transmission: 0.0,      // IMPORTANT: use alpha, not transmission
      thickness: 0.0,
    
      roughness: 0.15,        // allows specular
      metalness: 0.0,
    
      specularIntensity: 0.6,
      envMapIntensity: 1.0,
    })

    let decalBackingMesh = duplicateMesh(labelBody, 1.008);
    decalBackingMesh.material = new THREE.MeshStandardMaterial({
      map: texture,       // texture with alpha
      color: 0xffffff,         // the solid color to show in opaque areas
      transparent: true,
      alphaTest: 0.01,         // omit transparent pixels entirely
      depthWrite: false,       // so it doesn’t occlude transparent materials
    })

    //bottle.scale.set(1, 1, 1);

    // Center the model
    const box = new THREE.Box3().setFromObject(bottle);
    const center = box.getCenter(new THREE.Vector3());

    bottle.position.y = -center.y
    //bottle.rotation.y = Math.PI

    labelBody.material = plasticMat;
    
    scene.add(bottle);
    bottleArray[modelIndex] = bottle;
    decalMeshArray[modelIndex] = decalMesh;
    decalBackingMeshArray[modelIndex] = decalBackingMesh;
  });
}