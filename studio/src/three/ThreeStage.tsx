// Live GLB stage: lazy three, accent recolor, pooled context, pause offscreen, clip or turntable motion.
// Falls back to the baked thumb when WebGL is missing or the pool is full.
import { useEffect, useRef, useState } from 'react';
import type * as THREE_NS from 'three';
import { isMotionPaused, usePauseMotion } from '../theme';
import { accentMaterials, dressScene, frameModel, loadThree, tokenColor } from './kit';
import { acquireSlot, hasWebGL, onSlotFree } from './pool';
import './three.css';

export interface ThreeStageProps { src: string; label: string; loop?: boolean; thumb?: string; className?: string }

const cx = (...p: Array<string | false | undefined>) => p.filter(Boolean).join(' ');

/** Keyed by src so a new model always gets a fresh scene and slot cycle. */
export function ThreeStage(props: ThreeStageProps) {
  return <Stage key={props.src} {...props} />;
}

function Stage({ src, label, thumb, className }: ThreeStageProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [slot, setSlot] = useState<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);
  const [localPaused, setLocalPaused] = useState(false);
  const globalPaused = usePauseMotion();
  const localRef = useRef(localPaused);
  localRef.current = localPaused;

  // Slot: held while on screen, released offscreen so another stage can use it.
  useEffect(() => {
    if (failed || !hasWebGL()) return;
    let rel: (() => void) | null = null;
    let unwait: (() => void) | null = null;
    let visible = true;
    const want = () => {
      unwait = null;
      if (rel || !visible) return;
      rel = acquireSlot();
      if (rel) { const r = rel; setSlot(() => r); } else unwait = onSlotFree(want);
    };
    const drop = () => {
      unwait?.(); unwait = null;
      if (rel) { rel = null; setSlot(null); }
    };
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && host.current) {
      io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) want(); else drop();
      }, { rootMargin: '160px' });
      io.observe(host.current);
    } else want();
    return () => {
      io?.disconnect();
      unwait?.();
      rel?.(); // idempotent; the scene cleanup normally released it already
    };
  }, [failed]);

  // Scene: built once a slot is held; disposed (context lost, slot freed) when it is dropped.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!slot || !canvas) return;
    let cancelled = false;
    let raf = 0;
    let renderer: THREE_NS.WebGLRenderer | null = null;
    let offTheme: (() => void) | null = null;

    loadThree().then(async (kit) => {
      if (cancelled) return;
      const { THREE } = kit;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const { scene, camera } = dressScene(kit, renderer);
      const gltf = await new kit.GLTFLoader().loadAsync(src);
      if (cancelled) return;
      const model = gltf.scene;
      const fit = frameModel(kit, model, camera);
      scene.add(model);
      const accent = accentMaterials(model);
      let dirty = true;
      const recolor = () => {
        const c = new THREE.Color(tokenColor('--accent'));
        accent.forEach((m) => m.color?.copy(c as never));
        dirty = true;
      };
      recolor();
      const onTheme = () => recolor();
      window.addEventListener('vsv-theme', onTheme);
      offTheme = () => window.removeEventListener('vsv-theme', onTheme);

      let mixer: THREE_NS.AnimationMixer | null = null;
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((a) => mixer!.clipAction(a).play());
      }
      const clock = new THREE.Clock();
      let w = 0, h = 0;
      const frame = () => {
        raf = requestAnimationFrame(frame);
        const dt = clock.getDelta();
        const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
        if (cw !== w || ch !== h) {
          w = cw; h = ch;
          renderer!.setSize(cw, ch, false);
          camera.aspect = cw / ch;
          fit();
          dirty = true;
        }
        const moving = !isMotionPaused() && !localRef.current;
        if (moving) {
          if (mixer) mixer.update(dt); else model.rotation.y += dt * 0.25;
          dirty = true;
        }
        if (dirty) { renderer!.render(scene, camera); dirty = false; }
      };
      frame();
    }).catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      offTheme?.();
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
      slot();
    };
    // src is fixed for this instance (keyed above)
  }, [slot]);

  // Failure (no WebGL at runtime, bad file): give the slot back and show the thumb.
  useEffect(() => { if (failed) setSlot(null); }, [failed]);

  const live = !!slot && !failed;
  return (
    <div ref={host} className={cx('vsv-stage', className)}>
      {live ? (
        <>
          <canvas ref={canvasRef} role="img" aria-label={label} />
          <button
            type="button"
            className="btn btn-secondary icon vsv-stage-pause"
            aria-pressed={localPaused}
            aria-label={`Pause ${label}`}
            disabled={globalPaused}
            onClick={() => setLocalPaused((v) => !v)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {localPaused || globalPaused
                ? <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
                : <path d="M5 3h2v10H5zM9 3h2v10H9z" fill="currentColor" />}
            </svg>
          </button>
        </>
      ) : thumb ? (
        <img src={thumb} alt={label} loading="lazy" decoding="async" />
      ) : (
        <div className="vsv-stage-empty" role="img" aria-label={label} />
      )}
    </div>
  );
}
