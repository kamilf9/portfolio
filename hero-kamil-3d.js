/**
 * Hero 3D: loads only kamil.obj from ./portfolio/obj/kamil.obj (no other filenames).
 * Lettering: base #00FFD9 with env + clearcoat for roundness; low emissive so directional light reads as shade.
 * All meshes when OBJ has 6 parts; 7th mesh = “.obj” uses same blue. Light follows pointer when width ≥ 768px.
 * Viewport ≤767px: smaller mesh scale + wider FOV so lettering fits; desktop scale/FOV unchanged.
 */
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const KAMIL_OBJ_PATH = './portfolio/obj/kamil.obj';
const KAMIL_LETTER_COLOR = 0x00ffd9;
const OBJ_SUFFIX_COLOR = 0x00ffd9;
/** When mesh count exceeds this, the rightmost-by-X mesh alone uses OBJ_SUFFIX_COLOR. */
const OBJ_SUFFIX_MIN_MESHES = 7;
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

const MOBILE_MAX_WIDTH_PX = 767;
/** Multiply MODEL_SCALE on narrow viewports (~48% size vs desktop). */
const MOBILE_MODEL_SCALE_FACTOR = 0.52;
const DESKTOP_CAMERA_FOV = 42;
const MOBILE_CAMERA_FOV = 50;
/** Slight camera pull-back on mobile after scale (extra margin vs clip). */
const MOBILE_CAMERA_DIST_MULT = 1.1;
/** Share of total progress attributed to OBJ download (rest = parse + first render). */
const HERO_LOAD_DOWNLOAD_WEIGHT = 0.92;

function dispatchHeroLoadProgress(progress) {
  document.dispatchEvent(
    new CustomEvent('hero-asset-progress', {
      detail: { progress: Math.min(1, Math.max(0, progress)) },
    })
  );
}

function dispatchHeroLoadReady() {
  document.dispatchEvent(new CustomEvent('hero-asset-ready'));
}

function isMobileHeroViewport() {
  return window.matchMedia(
    '(max-width: ' + MOBILE_MAX_WIDTH_PX + 'px)'
  ).matches;
}

function getHeroResponsiveScaleFactor() {
  return isMobileHeroViewport() ? MOBILE_MODEL_SCALE_FACTOR : 1;
}

function getHeroCameraFov() {
  return isMobileHeroViewport() ? MOBILE_CAMERA_FOV : DESKTOP_CAMERA_FOV;
}

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
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  const ambient = new THREE.AmbientLight(0xfff6d0, 0.18);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xfffaf0, 2.65);
  dirLight.castShadow = true;
  dirLight.shadow.bias = -0.0002;
  dirLight.shadow.normalBias = 0.02;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 200;
  scene.add(dirLight);
  scene.add(dirLight.target);

  function makeLetterMat(hex) {
    var base = new THREE.Color(hex);
    return new THREE.MeshPhysicalMaterial({
      color: base,
      roughness: 0.2,
      metalness: 0,
      envMapIntensity: 0.82,
      clearcoat: 0.48,
      clearcoatRoughness: 0.12,
      emissive: base.clone(),
      emissiveIntensity: 0.07,
    });
  }
  const glossyMatKamil = makeLetterMat(KAMIL_LETTER_COLOR);
  const glossyMatObjSuffix = makeLetterMat(OBJ_SUFFIX_COLOR);
  const letterMaterials = [glossyMatKamil, glossyMatObjSuffix];
  let lastLetterColorHex = KAMIL_LETTER_COLOR;

  function applyLetterColor(hex) {
    lastLetterColorHex = hex;
    for (var i = 0; i < letterMaterials.length; i++) {
      var mat = letterMaterials[i];
      mat.color.setHex(hex);
      mat.emissive.setHex(hex);
    }
  }

  function randomVibrantHex() {
    var color = new THREE.Color();
    color.setHSL(Math.random(), 1, 0.5);
    return color.getHex();
  }

  function pickRandomLetterColor() {
    var hex = randomVibrantHex();
    var tries = 0;
    while (hex === lastLetterColorHex && tries < 8) {
      hex = randomVibrantHex();
      tries++;
    }
    applyLetterColor(hex);
  }

  var recolorBtn = document.getElementById('heroRecolorBtn');
  if (recolorBtn) {
    recolorBtn.addEventListener('click', pickRandomLetterColor);
  }

  const lightPosCurrent = new THREE.Vector3(4, 6, 14);
  const lightPosTarget = new THREE.Vector3(4, 6, 14);
  /** Aim point for directional light (model center after scale + baseline shift). */
  const lightAim = new THREE.Vector3(0, 0, 0);
  dirLight.position.copy(lightPosCurrent);
  dirLight.target.position.copy(lightAim);

  let heroMeshRoot = null;
  let baselineShift = 0;
  let rawMaxUnscaled = 1;
  let sceneLightScale = 14;

  function applyHeroResponsiveLayout() {
    if (!heroMeshRoot) return;

    heroMeshRoot.position.y -= baselineShift;
    baselineShift = 0;

    var factor = getHeroResponsiveScaleFactor();
    var s = MODEL_SCALE * factor;
    heroMeshRoot.scale.set(s, s, s);
    heroMeshRoot.updateMatrixWorld(true);

    var box = new THREE.Box3().setFromObject(heroMeshRoot);
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z, 1);
    baselineShift = maxDim * BASELINE_ALIGN_Y;
    heroMeshRoot.position.y += baselineShift;
    heroMeshRoot.updateMatrixWorld(true);

    var boxFit = new THREE.Box3().setFromObject(heroMeshRoot);
    var fitSize = boxFit.getSize(new THREE.Vector3());
    var maxFit = Math.max(fitSize.x, fitSize.y, fitSize.z, 1);
    boxFit.getCenter(lightAim);
    sceneLightScale = maxFit;

    var pad = maxFit * 0.35;
    dirLight.shadow.camera.left = -(maxFit + pad);
    dirLight.shadow.camera.right = maxFit + pad;
    dirLight.shadow.camera.top = maxFit + pad;
    dirLight.shadow.camera.bottom = -(maxFit + pad);
    dirLight.shadow.camera.far = maxFit * 12 + 20;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.updateProjectionMatrix();

    camera.fov = getHeroCameraFov();
    camera.updateProjectionMatrix();

    var dist = rawMaxUnscaled * CAMERA_FRAMING;
    if (isMobileHeroViewport()) dist *= MOBILE_CAMERA_DIST_MULT;
    if (dist < 0.4) dist = 0.4;
    camera.position.set(0, 0, dist);
    camera.near = Math.max(0.01, dist * 0.001);
    camera.far = dist * 100;
    camera.lookAt(lightAim);
    dirLight.target.position.copy(lightAim);

    var s0 = sceneLightScale;
    lightPosCurrent.set(s0 * 0.12, s0 * 0.32, s0 * 0.95);
    lightPosTarget.copy(lightPosCurrent);
  }

  const heroLoadingManager = new THREE.LoadingManager();
  heroLoadingManager.onProgress = function (_url, loaded, total) {
    if (total > 0) {
      dispatchHeroLoadProgress((loaded / total) * HERO_LOAD_DOWNLOAD_WEIGHT);
    }
  };
  heroLoadingManager.onLoad = function () {
    dispatchHeroLoadProgress(0.96);
  };

  const loader = new OBJLoader(heroLoadingManager);
  loader.load(
    KAMIL_OBJ_PATH,
    function (obj) {
      const box0 = new THREE.Box3().setFromObject(obj);
      const center = box0.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      obj.updateMatrixWorld(true);

      const boxUnscaled = new THREE.Box3().setFromObject(obj);
      const rawSize = boxUnscaled.getSize(new THREE.Vector3());
      rawMaxUnscaled = Math.max(rawSize.x, rawSize.y, rawSize.z, 1e-6);

      heroMeshRoot = obj;

      const letterMeshes = [];
      obj.traverse(function (child) {
        if (child.isMesh) letterMeshes.push(child);
      });
      const meshCenter = new THREE.Vector3();
      const byX = letterMeshes.map(function (mesh) {
        new THREE.Box3().setFromObject(mesh).getCenter(meshCenter);
        return { mesh: mesh, x: meshCenter.x };
      });
      byX.sort(function (a, b) {
        return a.x - b.x;
      });
      var useObjSuffix =
        byX.length >= OBJ_SUFFIX_MIN_MESHES;
      for (var si = 0; si < byX.length; si++) {
        var ch = byX[si].mesh;
        var isObjSuffix =
          useObjSuffix && si === byX.length - 1;
        ch.material = isObjSuffix ? glossyMatObjSuffix : glossyMatKamil;
        ch.material.vertexColors = false;
        if (ch.geometry && ch.geometry.hasAttribute('color')) {
          ch.geometry.deleteAttribute('color');
        }
        ch.castShadow = true;
        ch.receiveShadow = true;
      }
      scene.add(obj);
      applyHeroResponsiveLayout();
      resize();
      renderer.render(scene, camera);
      dispatchHeroLoadProgress(1);
      dispatchHeroLoadReady();
    },
    function (xhr) {
      if (xhr.lengthComputable && xhr.total > 0) {
        dispatchHeroLoadProgress(
          (xhr.loaded / xhr.total) * HERO_LOAD_DOWNLOAD_WEIGHT
        );
      }
    },
    function (err) {
      console.error('OBJLoader failed for', KAMIL_OBJ_PATH, err);
      dispatchHeroLoadReady();
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

  const mqHeroMobile = window.matchMedia(
    '(max-width: ' + MOBILE_MAX_WIDTH_PX + 'px)'
  );
  function onHeroMobileBpChange() {
    applyHeroResponsiveLayout();
    resize();
  }
  if (typeof mqHeroMobile.addEventListener === 'function') {
    mqHeroMobile.addEventListener('change', onHeroMobileBpChange);
  } else if (typeof mqHeroMobile.addListener === 'function') {
    mqHeroMobile.addListener(onHeroMobileBpChange);
  }

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
