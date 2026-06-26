import {
  Scene, PerspectiveCamera, WebGLRenderer,
  AmbientLight, DirectionalLight, HemisphereLight, PointLight,
  Color, Fog, ACESFilmicToneMapping, PCFSoftShadowMap, type Camera,
  type Object3D, Vector2,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

export class SceneManager {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private saoPass: SAOPass;

  constructor(container: HTMLElement) {
    this.scene = new Scene();
    this.scene.background = new Color(0x2a3040);
    this.scene.fog = new Fog(0x2a3040, 15, 40);

    this.camera = new PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 100);

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('WebGL context lost — reloading...');
      setTimeout(() => location.reload(), 500);
    });
    container.appendChild(this.renderer.domElement);

    // Post-processing pipeline
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // SAO (ambient occlusion) — adds depth to corners and edges
    this.saoPass = new SAOPass(this.scene, this.camera, new Vector2(isMobile ? 512 : 1024));
    this.saoPass.params = {
      output: 0,
      saoBias: 0.2,
      saoIntensity: isMobile ? 0.08 : 0.12,
      saoScale: 1.2,
      saoKernelRadius: isMobile ? 60 : 120,
      saoMinResolution: 0,
      saoBlur: true,
      saoBlurRadius: 4,
      saoBlurStdDev: 2,
      saoBlurDepthCutoff: 0.01,
    };
    this.composer.addPass(this.saoPass);

    // Bloom — makes lights/emissive surfaces glow
    this.bloomPass = new UnrealBloomPass(
      new Vector2(container.clientWidth, container.clientHeight),
      isMobile ? 0.08 : 0.12,  // strength
      isMobile ? 0.2 : 0.3,   // radius
      isMobile ? 0.9 : 0.85,  // threshold
    );
    this.composer.addPass(this.bloomPass);

    // Output pass — handles color space conversion
    this.composer.addPass(new OutputPass());

    this.setupLights();
    this.setupResize(container);
  }

  private setupLights() {
    const ambient = new AmbientLight(0x8899bb, 0.5);
    this.scene.add(ambient);

    const hemi = new HemisphereLight(0x87ceeb, 0x888866, 1.0);
    this.scene.add(hemi);

    const sun = new DirectionalLight(0xffffeedd, 3.0);
    sun.position.set(12, 15, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    sun.shadow.bias = -0.001;
    sun.shadow.radius = 4;
    sun.shadow.intensity = 0.7;
    this.scene.add(sun);

    const fill = new DirectionalLight(0x8888ff, 0.4);
    fill.position.set(-8, 4, -8);
    this.scene.add(fill);

    const rim = new DirectionalLight(0x88ccff, 0.3);
    rim.position.set(0, 4, -12);
    this.scene.add(rim);

    // Interior accent lights — warm pools of light in each room
    const accentPositions: [number, number, number, number, number][] = [
      [0, 2.5, 0, 0xff8844, 0.7],
      [1.5, 2.5, 2.5, 0xffaa55, 0.5],
      [-2, 2.5, 3, 0xff8844, 0.5],
      [3.5, 2.5, -1, 0xffaa77, 0.4],
      [-3.5, 2.5, -1, 0xffaa77, 0.4],
      [2, 2.5, -3, 0xffaa77, 0.4],
      [-2, 2.5, -3, 0x88bbff, 0.5],
      [0, 2.5, -3.5, 0xff6644, 0.5],
      [-3.5, 2.5, 0, 0xffaa66, 0.3],
      [0.5, 2.5, -3, 0xffdd88, 0.3],
      [-0.5, 2.5, 3.5, 0xffcc88, 0.3],
    ];

    for (const [px, py, pz, color, intensity] of accentPositions) {
      const light = new PointLight(color, intensity, 5, 2);
      light.position.set(px, py, pz);
      this.scene.add(light);
    }
  }

  private onResize: (() => void) | null = null;

  private setupResize(container: HTMLElement) {
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
    };
    this.onResize = resize;
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resize);
    }
  }

  add(obj: Object3D) { this.scene.add(obj); }
  remove(obj: Object3D) { this.scene.remove(obj); }

  /** Main game render — uses post-processing (bloom + SAO) */
  render() {
    this.composer.render();
  }

  /** CCTV/TV mode render — direct render, no post-processing overhead */
  renderWithCamera(cam: Camera) {
    this.renderer.render(this.scene, cam);
  }

  dispose() {
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    this.composer.dispose();
    this.renderer.dispose();
  }
}
