import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ══════════════════════════════════════════════════════════
   AvatarFace3D — renders the user's own Avaturn avatar as
   Aarav's face. Looks for frontend/public/model.glb first,
   then avathar.glb as a legacy fallback.

   Avaturn exports are rigged humanoids with ARKit-style
   blendshapes, so we drive them directly:
     speaking  → jawOpen / mouthOpen oscillation (lip flap)
     idle      → breathing sway + eye blinks
     listening → attentive head tilt
     thinking  → eyes drift up, slight head turn

   If the file is missing (not exported from avaturn.me yet)
   we call onMissing() so the parent can show the SVG face.
   ══════════════════════════════════════════════════════════ */

const MOUTH_KEYS = ['jawOpen', 'mouthOpen', 'viseme_aa', 'viseme_O', 'JawOpen'];
const BLINK_KEYS = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed', 'EyeBlinkLeft', 'EyeBlinkRight'];
const SMILE_KEYS = ['mouthSmileLeft', 'mouthSmileRight', 'mouthSmile'];

export default function AvatarFace3D({ state = 'idle', height = 190, onMissing, onReady }) {
  const hostRef = useRef(null);
  const stateRef = useRef(state);
  const [failed, setFailed] = useState(false);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const resize = () => {
      const w = host.clientWidth || 300;
      const h = host.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // soft studio lighting that flatters skin tones
    scene.add(new THREE.HemisphereLight(0xffffff, 0x585276, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.6, 1.4, 1.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9d7bff, 0.9);
    rim.position.set(-1, 0.6, -1);
    scene.add(rim);

    let disposed = false;
    let raf = 0;
    let model = null;
    let headBone = null;
    const mouth = [];   // {mesh, index}
    const blinks = [];
    const smiles = [];
    let blinkAt = performance.now() + 2500;

    const loader = new GLTFLoader();
    const onLoaded = (gltf) => {
        if (disposed) return;
        model = gltf.scene;
        scene.add(model);

        let armL = null, armR = null;
        model.traverse((obj) => {
          if (obj.isBone) {
            if (!headBone && /head/i.test(obj.name)) headBone = obj;
            if (/left.?arm$/i.test(obj.name) && !/fore/i.test(obj.name)) armL = obj;
            if (/right.?arm$/i.test(obj.name) && !/fore/i.test(obj.name)) armR = obj;
          }
          if (obj.morphTargetDictionary && obj.morphTargetInfluences) {
            for (const k of MOUTH_KEYS) if (k in obj.morphTargetDictionary) mouth.push({ m: obj, i: obj.morphTargetDictionary[k] });
            for (const k of BLINK_KEYS) if (k in obj.morphTargetDictionary) blinks.push({ m: obj, i: obj.morphTargetDictionary[k] });
            for (const k of SMILE_KEYS) if (k in obj.morphTargetDictionary) smiles.push({ m: obj, i: obj.morphTargetDictionary[k] });
          }
        });

        // Talking-head bust: collapse the arms so the T-pose never shows.
        // (Standard trick for close-up avatars — shoulders stay, arms vanish.)
        if (armL) armL.scale.setScalar(0.001);
        if (armR) armR.scale.setScalar(0.001);
        model.updateMatrixWorld(true);

        // frame a head-and-shoulders portrait regardless of full-body vs bust export
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const headY = headBone
          ? headBone.getWorldPosition(new THREE.Vector3()).y
          : box.min.y + size.y * 0.87;
        const dist = size.y * 0.30;
        camera.position.set(0, headY + size.y * 0.03, dist);
        camera.lookAt(0, headY + size.y * 0.02, 0);

        // gentle default smile so it doesn't look stern on camera
        smiles.forEach(({ m, i }) => { m.morphTargetInfluences[i] = 0.25; });
        onReady?.({ mouth: mouth.length, blinks: blinks.length, head: !!headBone });
    };
    // model.glb (user's Avaturn export) → avathar.glb (legacy name) → fallback face
    loader.load('/model.glb', onLoaded, undefined, () => {
      if (disposed) return;
      loader.load('/avathar.glb', onLoaded, undefined, () => {
        if (!disposed) { setFailed(true); onMissing?.(); }
      });
    });

    const baseRot = { x: 0, y: 0 };
    const animate = (now) => {
      raf = requestAnimationFrame(animate);
      const t = now / 1000;
      const st = stateRef.current;

      if (model) {
        // breathing sway
        model.position.y = Math.sin(t * 1.4) * 0.004;

        if (headBone) {
          let tx = Math.sin(t * 0.9) * 0.03;
          let ty = Math.sin(t * 0.6) * 0.04;
          if (st === 'listening') { tx += 0.06; ty += 0.09; }        // attentive tilt
          if (st === 'thinking') { tx -= 0.10; ty -= 0.14; }        // glance away
          baseRot.x += (tx - baseRot.x) * 0.04;
          baseRot.y += (ty - baseRot.y) * 0.04;
          headBone.rotation.x += (baseRot.x - headBone.rotation.x) * 0.3;
          headBone.rotation.y += (baseRot.y - headBone.rotation.y) * 0.3;
        }

        // lip flap while speaking — organic, not metronomic
        const target = st === 'speaking'
          ? 0.12 + Math.abs(Math.sin(t * 8.3) * Math.sin(t * 5.1)) * 0.55
          : 0;
        mouth.forEach(({ m, i }) => {
          m.morphTargetInfluences[i] += (target - m.morphTargetInfluences[i]) * 0.35;
        });

        // blinks
        if (now > blinkAt) {
          const phase = (now - blinkAt) / 140; // 140ms blink
          const v = phase < 1 ? Math.sin(phase * Math.PI) : 0;
          blinks.forEach(({ m, i }) => { m.morphTargetInfluences[i] = v; });
          if (phase >= 1) blinkAt = now + 2200 + Math.random() * 2800;
        }
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((mat) => {
            Object.values(mat).forEach((v) => v?.isTexture && v.dispose());
            mat.dispose();
          });
        }
      });
    };
  }, []); // mount once — state flows through stateRef

  if (failed) return null;
  return <div ref={hostRef} style={{ width: '100%', height, minHeight: height }} />;
}
