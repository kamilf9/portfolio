/**
 * Hero 3D: loads only kamil.obj from ./portfolio/obj/kamil.obj (no other filenames).
 * Hot pink glossy material (roughness 0); directional light eases toward pointer (canvas-local) when width ≥ 768px.
 */
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const KAMIL_OBJ_PATH = './portfolio/obj/kamil.obj';
const HOT_PINK = 0xff69b4;
/** Base scale when pink type matched ~10/12 cols; canvas stays full width, mesh uses 8/12. */
const MODEL_SCALE_BASE = 6;
const PINK_GRID_COLS = 8;
const LAYER1_GRID_COLS = 10;
const MODEL_SCALE = MODEL_SCALE_BASE * (PINK_GRID_COLS / LAYER1_GRID_COLS);
/**
 * Camera distance must be derived from the *unscaled* bbox, not scaled — otherwise
 * dist grows with MODEL_SCALE and the mesh stays tiny on screen vs layer2.png shadow.
 */
const CAMERA_FRAMING = 2.35;
/**
 * Vertical alignment: nudge model in world +Y so the bottom of the lettering lines up with the
 * comma / subline baseline in layer1.png (tune if PNG layout changes).
 */
const BASELINE_ALIGN_Y = 0.085;
/** Framerate-independent smoothing: higher = follows pointer more tightly (no spring overshoot). */
const LIGHT_FOLLOW_LAMBDA = 21;

function init() {
  const mount = document.getElementById('heroKamilMount');
  const canvas = document.getElementById('heroKamilCanvas');
  if (!mount || !canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 2000);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  const ambient = new THREE.AmbientLight(0xffffff, 0.22);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
  dirLight.castShadow = true;
  dirLight.shadow.bias = -0.0002;
  dirLight.shadow.normalBias = 0.02;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 200;
  scene.add(dirLight);
  scene.add(dirLight.target);

  const glossyMat = new THREE.MeshPhysicalMaterial({
    color: HOT_PINK,
    roughness: 0,
    metalness: 0.08,
    envMapIntensity: 1.15,
    clearcoat: 1,
    clearcoatRoughness: 0,
  });

  const lightPosCurrent = new THREE.Vector3(4, 6, 14);
  const lightPosTarget = new THREE.Vector3(4, 6, 14);
  /** Aim point for directional light (model center after scale + baseline shift). */
  const lightAim = new THREE.Vector3(0, 0, 0);
  dirLight.position.copy(lightPosCurrent);
  dirLight.target.position.copy(lightAim);

  const loader = new OBJLoader();
  loader.load(
    KAMIL_OBJ_PATH,
    function (obj) {
      const box0 = new THREE.Box3().setFromObject(obj);
      const center = box0.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      obj.updateMatrixWorld(true);

      const boxUnscaled = new THREE.Box3().setFromObject(obj);
      const rawSize = boxUnscaled.getSize(new THREE.Vector3());
      var rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z, 1e-6);

      obj.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
      obj.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1);

      obj.position.y += maxDim * BASELINE_ALIGN_Y;

      obj.updateMatrixWorld(true);
      const boxFit = new THREE.Box3().setFromObject(obj);
      const fitSize = boxFit.getSize(new THREE.Vector3());
      const maxFit = Math.max(fitSize.x, fitSize.y, fitSize.z, 1);
      boxFit.getCenter(lightAim);
      sceneLightScale = maxFit;

      const pad = maxFit * 0.35;
      dirLight.shadow.camera.left = -(maxFit + pad);
      dirLight.shadow.camera.right = maxFit + pad;
      dirLight.shadow.camera.top = maxFit + pad;
      dirLight.shadow.camera.bottom = -(maxFit + pad);
      dirLight.shadow.camera.far = maxFit * 12 + 20;
      dirLight.shadow.camera.near = 0.1;
      dirLight.shadow.camera.updateProjectionMatrix();

      obj.traverse(function (child) {
        if (child.isMesh) {
          child.material = glossyMat;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(obj);

      var dist = rawMax * CAMERA_FRAMING;
      if (dist < 0.4) dist = 0.4;
      camera.position.set(0, 0, dist);
      camera.near = Math.max(0.01, dist * 0.001);
      camera.far = dist * 100;
      camera.lookAt(lightAim);
      dirLight.target.position.copy(lightAim);

      var s0 = sceneLightScale;
      lightPosCurrent.set(s0 * 0.12, s0 * 0.32, s0 * 0.95);
      lightPosTarget.copy(lightPosCurrent);
    },
    undefined,
    function (err) {
      console.error('OBJLoader failed for', KAMIL_OBJ_PATH, err);
    }
  );

  function resize() {
    const w = mount.clientWidth;
    const h = Math.max(mount.clientHeight || Math.round(w * 0.38), 120);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  let mx = 0;
  let my = 0;
  let lightFollowLastTs = 0;
  /** World scale of loaded mesh (max bbox edge); drives light orbit radius. */
  let sceneLightScale = 14;
  const mq = window.matchMedia('(min-width: 768px)');

  function onPointerMove(e) {
    if (!mq.matches) return;
    const r = canvas.getBoundingClientRect();
    const rw = Math.max(r.width, 1);
    const rh = Math.max(r.height, 1);
    mx = ((e.clientX - r.left) / rw) * 2 - 1;
    my = ((e.clientY - r.top) / rh) * 2 - 1;
    mx = Math.max(-1, Math.min(1, mx));
    my = Math.max(-1, Math.min(1, my));
  }

  window.addEventListener('mousemove', onPointerMove, { passive: true });

  const ro = new ResizeObserver(function () {
    resize();
  });
  ro.observe(mount);
  window.addEventListener('resize', resize, { passive: true });
  resize();

  function tick(ts) {
    requestAnimationFrame(tick);
    const now = ts !== undefined ? ts : performance.now();
    const dtSec = lightFollowLastTs ? Math.min(0.05, (now - lightFollowLastTs) / 1000) : 1 / 60;
    lightFollowLastTs = now;
    const followAlpha = 1 - Math.exp(-LIGHT_FOLLOW_LAMBDA * dtSec);
    const mobileAlpha = 1 - Math.exp(-9 * dtSec);

    var s = sceneLightScale;
    if (mq.matches) {
      const r2 = mx * mx + my * my;
      lightPosTarget.set(
        mx * s * 0.78 + s * 0.12,
        -my * s * 0.55 + s * 0.32,
        s * 0.96 + r2 * s * 0.05
      );
    } else {
      lightPosTarget.set(s * 0.28, s * 0.42, s * 0.88);
    }
    lightPosCurrent.lerp(lightPosTarget, mq.matches ? followAlpha : mobileAlpha);
    dirLight.position.copy(lightPosCurrent);
    dirLight.target.position.copy(lightAim);
    dirLight.target.updateMatrixWorld();
    renderer.render(scene, camera);
  }

  tick(performance.now());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
