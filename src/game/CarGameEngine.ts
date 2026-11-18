import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createPickupMesh,
  createPlayerCar,
  createTrafficCar,
  PickupKind,
  PlayerCarRig,
  TrafficCarRig,
  TrafficVariant,
} from './carBuilder';
import { HighwayEnvironment, LANE_CENTERS, ROAD_WIDTH } from './environment';
import { ProceduralSoundEngine } from './sound';
import { createContactShadowTexture } from './textures';
import {
  CameraMode,
  GamePhase,
  HudTelemetry,
  PAINT_PRESETS,
  TouchInputState,
  TrackThemeId,
} from './types';

interface ActiveTraffic {
  rig: TrafficCarRig;
  lane: number;
  speedMps: number;
  passedNearMiss: boolean;
  hitRecently: boolean;
}

interface ActivePickup {
  mesh: THREE.Group;
  kind: PickupKind;
  lane: number;
  z: number;
  phaseOffset: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

const BEST_SCORE_KEY = 'apex_rush_3d_best_score';
const TRAFFIC_COLORS = [0x3b82f6, 0x10b981, 0xf59e0b, 0x6366f1, 0xe11d48, 0x94a3b8, 0xf8fafc];
const TRAFFIC_VARIANTS: TrafficVariant[] = ['sedan', 'sedan', 'suv', 'truck'];

// Pre-allocated math helpers outside animation loop (Zero GC)
const _camTargetPos = new THREE.Vector3();
const _camLookAtPos = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0.8, -12);

export class CarGameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private env: HighwayEnvironment;
  private playerCar: PlayerCarRig;
  private shadowTex: THREE.CanvasTexture;
  private pmremRT: THREE.WebGLRenderTarget;
  public readonly sound = new ProceduralSoundEngine();

  private phase: GamePhase = 'menu';
  private cameraMode: CameraMode = 'chase';
  private currentTheme: TrackThemeId = 'sunset';

  // Vehicle physics state
  private playerX = 0;
  private playerVelX = 0;
  private speedMps = 22; // idle showcase cruise in menu
  private nitro = 100;
  private isBoosting = false;
  private isBraking = false;
  private steerInput = 0;
  private wheelSpin = 0;
  private invulnTimer = 0;
  private shakeTimer = 0;

  // Score & progression
  private score = 0;
  private bestScore = 0;
  private distanceM = 0;
  private coins = 0;
  private nearMisses = 0;
  private combo = 1;
  private comboTimer = 0;
  private hull = 3;
  private readonly maxHull = 3;
  private eventBanner: HudTelemetry['eventBanner'] = null;
  private bannerId = 0;
  private bannerTimer = 0;

  // Dynamic entities
  private traffic: ActiveTraffic[] = [];
  private pickups: ActivePickup[] = [];
  private sparks: SparkParticle[] = [];
  private sparkGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  private trafficSpawnTimer = 0.8;
  private pickupSpawnTimer = 1.2;

  // Input state
  private keys = new Set<string>();
  private touchState: TouchInputState = {
    left: false,
    right: false,
    accelerate: false,
    brake: false,
    nitro: false,
  };

  // Loop & lifecycle
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private hudEmitAccum = 0;
  private onHudUpdate: (telemetry: HudTelemetry) => void;
  private onContextLostChange: (lost: boolean) => void;
  private onCameraCycle?: (mode: CameraMode) => void;

  constructor(
    container: HTMLElement,
    onHudUpdate: (telemetry: HudTelemetry) => void,
    onContextLostChange: (lost: boolean) => void,
    onCameraCycle?: (mode: CameraMode) => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onContextLostChange = onContextLostChange;
    this.onCameraCycle = onCameraCycle;

    try {
      const saved = localStorage.getItem(BEST_SCORE_KEY);
      if (saved) this.bestScore = parseInt(saved, 10) || 0;
    } catch {
      // ignore storage access issues
    }

    // Software WebGL guard
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene = new THREE.Scene();
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.2, 340);
    this.camera.position.set(0, 3.8, 8.8);

    // Studio environment reflection via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.pmremRT = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.pmremRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.shadowTex = createContactShadowTexture();
    this.env = new HighwayEnvironment(this.scene, maxAniso, this.isSoftwareGl);

    this.playerCar = createPlayerCar(PAINT_PRESETS[0].hex, this.shadowTex, this.isSoftwareGl);
    this.playerCar.root.position.set(0, 0, 0);
    this.scene.add(this.playerCar.root);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.emitHud();
    this.tick();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLostChange(true);
  };

  private handleContextRestored = () => {
    this.onContextLostChange(false);
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.sound.unlock();
    const code = e.code;
    this.keys.add(code);

    if (code === 'KeyC') {
      this.cycleCameraMode();
    } else if (code === 'KeyP' || code === 'Escape') {
      if (this.phase === 'playing') this.setPaused(true);
      else if (this.phase === 'paused') this.setPaused(false);
    } else if (code === 'Enter' && (this.phase === 'menu' || this.phase === 'gameover')) {
      this.startRace();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  public setTouchInput(patch: Partial<TouchInputState>): void {
    this.sound.unlock();
    Object.assign(this.touchState, patch);
  }

  public setPaintColor(hex: string): void {
    this.playerCar.bodyMaterial.color.set(hex);
  }

  public setTheme(themeId: TrackThemeId): void {
    this.currentTheme = themeId;
    this.env.applyTheme(this.scene, themeId);
    if (this.playerCar.headlightBeam) {
      this.playerCar.headlightBeam.intensity = themeId === 'night' ? 32 : 8;
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public cycleCameraMode(): CameraMode {
    const order: CameraMode[] = ['chase', 'hood', 'aerial'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.cameraMode = next;
    this.onCameraCycle?.(next);
    return next;
  }

  public startRace(): void {
    this.sound.unlock();
    this.clearEntities();
    this.playerX = 0;
    this.playerVelX = 0;
    this.speedMps = 28;
    this.nitro = 100;
    this.isBoosting = false;
    this.isBraking = false;
    this.invulnTimer = 0;
    this.shakeTimer = 0;
    this.score = 0;
    this.distanceM = 0;
    this.coins = 0;
    this.nearMisses = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.hull = this.maxHull;
    this.eventBanner = null;
    this.trafficSpawnTimer = 0.7;
    this.pickupSpawnTimer = 1.0;
    this.playerCar.root.visible = true;
    this.playerCar.root.position.set(0, 0, 0);
    this.phase = 'playing';
    this.emitHud();
  }

  public setPaused(paused: boolean): void {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this.phase = paused ? 'paused' : 'playing';
    if (!paused) {
      this.clock.getDelta(); // reset delta spike
    }
    this.emitHud();
  }

  private clearEntities(): void {
    for (const t of this.traffic) {
      this.scene.remove(t.rig.root);
    }
    this.traffic = [];
    for (const p of this.pickups) {
      this.scene.remove(p.mesh);
    }
    this.pickups = [];
  }

  private triggerBanner(text: string, tone: 'gold' | 'cyan' | 'emerald' | 'red'): void {
    this.bannerId += 1;
    this.eventBanner = { text, tone, id: this.bannerId };
    this.bannerTimer = 1.35;
  }

  private spawnSparks(x: number, y: number, z: number): void {
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          3 + Math.random() * 7,
          (Math.random() - 0.5) * 12
        ),
        life: 0.55 + Math.random() * 0.25,
      });
    }
  }

  private spawnTrafficWave(): void {
    // Choose 1 or 2 lanes, always leaving at least 2 lanes clear or passable
    const difficulty = Math.min(1, this.distanceM / 4500);
    const count = Math.random() < 0.35 + difficulty * 0.35 ? 2 : 1;
    const availableLanes = [0, 1, 2, 3];

    for (let i = 0; i < count; i++) {
      if (availableLanes.length === 0) break;
      const pickIdx = Math.floor(Math.random() * availableLanes.length);
      const laneIdx = availableLanes.splice(pickIdx, 1)[0];

      // Prevent spawning right on top of existing traffic near z = -135
      const tooClose = this.traffic.some((t) => t.lane === laneIdx && t.rig.root.position.z < -95);
      if (tooClose) continue;

      const variant = TRAFFIC_VARIANTS[Math.floor(Math.random() * TRAFFIC_VARIANTS.length)];
      const color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
      const rig = createTrafficCar(variant, color, this.shadowTex);

      rig.root.position.set(LANE_CENTERS[laneIdx], 0, -145 - Math.random() * 18);
      this.scene.add(rig.root);

      const baseTrafficSpeed = 14 + Math.random() * 11 + difficulty * 6;
      this.traffic.push({
        rig,
        lane: laneIdx,
        speedMps: baseTrafficSpeed,
        passedNearMiss: false,
        hitRecently: false,
      });
    }
  }

  private spawnPickup(): void {
    const lane = Math.floor(Math.random() * 4);
    const z = -140;
    // Avoid spawning directly inside a traffic vehicle
    const blocked = this.traffic.some(
      (t) => t.lane === lane && Math.abs(t.rig.root.position.z - z) < 12
    );
    if (blocked) return;

    const r = Math.random();
    let kind: PickupKind = 'coin';
    if (this.hull < this.maxHull && r < 0.16) {
      kind = 'repair';
    } else if (r < 0.38) {
      kind = 'nitro';
    }

    const mesh = createPickupMesh(kind);
    mesh.position.set(LANE_CENTERS[lane], 0.85, z);
    this.scene.add(mesh);

    this.pickups.push({
      mesh,
      kind,
      lane,
      z,
      phaseOffset: Math.random() * Math.PI * 2,
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (this.phase === 'menu') {
      // Dynamic showcase cruising in menu
      this.speedMps = 22;
      this.playerX = Math.sin(this.clock.elapsedTime * 0.55) * 1.4;
      this.playerCar.root.position.x = this.playerX;
      this.playerCar.chassisPivot.rotation.z = -Math.cos(this.clock.elapsedTime * 0.55) * 0.035;
      this.wheelSpin += this.speedMps * dt * 2.2;
      for (const w of this.playerCar.wheels) w.rotation.x = -this.wheelSpin;
      this.env.update(this.speedMps, dt);
      this.updateMenuCamera(dt);
      this.sound.updateEngine(0, false, false);
    } else if (this.phase === 'playing') {
      this.stepSimulation(dt);
      this.updatePlayCamera(dt);
    } else if (this.phase === 'paused' || this.phase === 'gameover') {
      this.sound.updateEngine(0, false, false);
      this.updatePlayCamera(dt * 0.4);
    }

    this.updateSparks(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepSimulation(dt: number): void {
    const leftPressed = this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touchState.left;
    const rightPressed = this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touchState.right;
    const accelPressed = this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.touchState.accelerate;
    const brakePressed = this.keys.has('ArrowDown') || this.keys.has('KeyS') || this.touchState.brake;
    const nitroPressed =
      this.keys.has('Space') ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.touchState.nitro;

    // Speed & Nitro
    this.isBoosting = nitroPressed && this.nitro > 4 && !brakePressed;
    this.isBraking = brakePressed;

    if (this.isBoosting) {
      this.nitro = Math.max(0, this.nitro - 28 * dt);
    } else {
      this.nitro = Math.min(100, this.nitro + 6.5 * dt);
    }

    const baseCruise = 28 + Math.min(18, this.distanceM * 0.004);
    const maxAllowedSpeed = this.isBoosting ? 76 : accelPressed ? 56 : baseCruise;
    const minSpeed = 12;

    if (brakePressed) {
      this.speedMps = THREE.MathUtils.damp(this.speedMps, minSpeed, 5.5, dt);
    } else if (this.isBoosting) {
      this.speedMps = THREE.MathUtils.damp(this.speedMps, maxAllowedSpeed, 4.2, dt);
    } else if (accelPressed) {
      this.speedMps = THREE.MathUtils.damp(this.speedMps, maxAllowedSpeed, 2.4, dt);
    } else {
      this.speedMps = THREE.MathUtils.damp(this.speedMps, baseCruise, 1.5, dt);
    }

    // Steering physics
    const targetSteer = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
    this.steerInput = THREE.MathUtils.damp(this.steerInput, targetSteer, 12, dt);

    const lateralGrip = 13.5 + (this.speedMps / 76) * 4.5;
    this.playerVelX = THREE.MathUtils.damp(this.playerVelX, this.steerInput * lateralGrip, 10, dt);
    this.playerX += this.playerVelX * dt;

    const maxRoadX = ROAD_WIDTH / 2 - 1.35;
    if (this.playerX < -maxRoadX) {
      this.playerX = -maxRoadX;
      this.playerVelX = Math.max(0, this.playerVelX);
    } else if (this.playerX > maxRoadX) {
      this.playerX = maxRoadX;
      this.playerVelX = Math.min(0, this.playerVelX);
    }

    // Apply transforms & suspension pitch/roll to player car
    this.playerCar.root.position.x = this.playerX;
    this.playerCar.root.rotation.y = -this.steerInput * 0.095;
    const targetRoll = -this.steerInput * 0.065;
    const targetPitch = brakePressed ? 0.042 : this.isBoosting ? -0.036 : accelPressed ? -0.018 : 0;
    this.playerCar.chassisPivot.rotation.z = THREE.MathUtils.damp(
      this.playerCar.chassisPivot.rotation.z,
      targetRoll,
      10,
      dt
    );
    this.playerCar.chassisPivot.rotation.x = THREE.MathUtils.damp(
      this.playerCar.chassisPivot.rotation.x,
      targetPitch,
      8,
      dt
    );

    // Wheel spin & front wheel steering angle
    this.wheelSpin += this.speedMps * dt * 2.5;
    for (const w of this.playerCar.wheels) {
      w.rotation.x = -this.wheelSpin;
    }
    for (const knuckle of this.playerCar.frontWheelKnuckles) {
      knuckle.rotation.y = -this.steerInput * 0.34;
    }

    // Taillight brightness & Nitro exhaust flames
    this.playerCar.taillightMaterial.emissiveIntensity = brakePressed ? 4.8 : 1.4;
    const flamePulse = 0.85 + Math.sin(this.clock.elapsedTime * 48) * 0.25;
    for (const flame of this.playerCar.flames) {
      flame.visible = this.isBoosting;
      if (this.isBoosting) {
        flame.scale.set(1, 1, flamePulse);
      }
    }

    // Invulnerability blink & timers
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.playerCar.root.visible = Math.floor(this.invulnTimer * 14) % 2 === 0;
      if (this.invulnTimer <= 0) {
        this.playerCar.root.visible = true;
      }
    }
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.eventBanner = null;
      }
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    // Distance & score accumulation
    const deltaDist = this.speedMps * dt;
    this.distanceM += deltaDist;
    this.score += Math.round(deltaDist * (this.isBoosting ? 2.5 : 1.2) * this.combo);

    // Environment scroll
    this.env.update(this.speedMps, dt);

    // Spawn traffic & pickups
    this.trafficSpawnTimer -= dt * (0.85 + this.speedMps / 50);
    if (this.trafficSpawnTimer <= 0) {
      this.spawnTrafficWave();
      this.trafficSpawnTimer = Math.max(0.58, 1.35 - Math.min(0.6, this.distanceM / 6000));
    }

    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0) {
      this.spawnPickup();
      this.pickupSpawnTimer = 1.45 + Math.random() * 1.1;
    }

    // Update traffic cars & collisions
    const playerHalfW = 0.94;
    const playerHalfL = 2.15;

    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const t = this.traffic[i];
      const relSpeed = this.speedMps - t.speedMps;
      t.rig.root.position.z += relSpeed * dt;

      // Spin traffic wheels
      for (const w of t.rig.wheels) {
        w.rotation.x -= t.speedMps * dt * 2.1;
      }

      const tx = t.rig.root.position.x;
      const tz = t.rig.root.position.z;
      const dx = Math.abs(this.playerX - tx);
      const dz = Math.abs(tz);

      // Collision check
      if (dx < playerHalfW + t.rig.halfWidth - 0.12 && dz < playerHalfL + t.rig.halfLength - 0.16) {
        if (!t.hitRecently && this.invulnTimer <= 0) {
          t.hitRecently = true;
          this.handleCollision(t);
        }
      } else if (
        !t.passedNearMiss &&
        !t.hitRecently &&
        tz > 1.8 &&
        tz < 5.5 &&
        dx < playerHalfW + t.rig.halfWidth + 1.35
      ) {
        // Near Miss bonus!
        t.passedNearMiss = true;
        this.nearMisses += 1;
        this.combo = Math.min(8, this.combo + 1);
        this.comboTimer = 4.0;
        const pts = 200 * this.combo;
        this.score += pts;
        this.nitro = Math.min(100, this.nitro + 14);
        this.sound.playNearMiss();
        this.triggerBanner(`Near Miss +${pts} · ${this.combo}x`, 'cyan');
      }

      if (tz > 28 || tz < -210) {
        this.scene.remove(t.rig.root);
        this.traffic.splice(i, 1);
      }
    }

    // Update pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.z += this.speedMps * dt;
      p.mesh.position.z = p.z;
      p.mesh.rotation.y += dt * 3.0;
      p.mesh.position.y = 0.85 + Math.sin(this.clock.elapsedTime * 4 + p.phaseOffset) * 0.16;

      const dx = Math.abs(this.playerX - p.mesh.position.x);
      const dz = Math.abs(p.z);
      if (dx < 1.55 && dz < 2.35) {
        this.collectPickup(p);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
        continue;
      }

      if (p.z > 20) {
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }

    // Engine audio
    this.sound.updateEngine((this.speedMps - 10) / 55, this.isBoosting, true);

    // Emit HUD at ~24Hz
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.04) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private handleCollision(t: ActiveTraffic): void {
    this.hull -= 1;
    this.combo = 1;
    this.comboTimer = 0;
    this.speedMps = Math.max(14, this.speedMps * 0.48);
    this.invulnTimer = 1.6;
    this.shakeTimer = 0.42;
    this.sound.playCrash();
    this.spawnSparks((this.playerX + t.rig.root.position.x) * 0.5, 0.9, -1.2);
    this.triggerBanner(this.hull > 0 ? 'Impact! Hull Damaged' : 'Engine Critical!', 'red');

    // Push traffic vehicle forward slightly so player doesn't stay stuck inside it
    t.rig.root.position.z -= 4.5;

    if (this.hull <= 0) {
      this.phase = 'gameover';
      this.playerCar.root.visible = true;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        try {
          localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
        } catch {
          // ignore storage write errors
        }
      }
    }
    this.emitHud();
  }

  private collectPickup(p: ActivePickup): void {
    if (p.kind === 'coin') {
      this.coins += 1;
      const pts = 150 * this.combo;
      this.score += pts;
      this.sound.playCoin();
      this.triggerBanner(`Coin +${pts}`, 'gold');
    } else if (p.kind === 'nitro') {
      this.nitro = Math.min(100, this.nitro + 38);
      this.score += 100;
      this.sound.playPowerup();
      this.triggerBanner('Nitro Charged +38%', 'cyan');
    } else {
      this.hull = Math.min(this.maxHull, this.hull + 1);
      this.score += 200;
      this.sound.playPowerup();
      this.triggerBanner('Hull Repaired', 'emerald');
    }
    this.emitHud();
  }

  private updateSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.vel.y -= 18 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.scale.setScalar(Math.max(0.01, s.life * 1.6));
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
      }
    }
  }

  private updateMenuCamera(dt: number): void {
    const t = this.clock.elapsedTime * 0.35;
    _camTargetPos.set(Math.sin(t) * 4.5, 2.8, 7.6 + Math.cos(t) * 1.2);
    this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-3 * dt));
    _camLookAtPos.set(this.playerX * 0.6, 0.85, -3.5);
    _currentLookAt.lerp(_camLookAtPos, 1 - Math.exp(-5 * dt));
    this.camera.lookAt(_currentLookAt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 54, 4, dt);
    this.camera.updateProjectionMatrix();
  }

  private updatePlayCamera(dt: number): void {
    const speedRatio = Math.max(0, (this.speedMps - 20) / 56);
    const targetFov =
      this.cameraMode === 'hood'
        ? 68 + speedRatio * 14 + (this.isBoosting ? 7 : 0)
        : 58 + speedRatio * 14 + (this.isBoosting ? 8 : 0);

    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === 'chase') {
      _camTargetPos.set(
        this.playerX * 0.86,
        3.25 + (this.isBoosting ? -0.25 : 0),
        7.8 + speedRatio * 1.1
      );
      _camLookAtPos.set(this.playerX * 0.92, 1.05, -14);
    } else if (this.cameraMode === 'hood') {
      _camTargetPos.set(this.playerX, 1.38, -0.45);
      _camLookAtPos.set(this.playerX + this.steerInput * 1.8, 1.1, -24);
    } else {
      // Aerial tactical view
      _camTargetPos.set(this.playerX * 0.65, 11.5, 11.5);
      _camLookAtPos.set(this.playerX * 0.75, 0.4, -12);
    }

    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 0.85;
      _camTargetPos.x += (Math.random() - 0.5) * mag;
      _camTargetPos.y += (Math.random() - 0.5) * mag;
    }

    const followLambda = this.cameraMode === 'hood' ? 24 : 9.5;
    this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-followLambda * dt));
    _currentLookAt.lerp(_camLookAtPos, 1 - Math.exp(-14 * dt));
    this.camera.lookAt(_currentLookAt);
  }

  private emitHud(): void {
    this.onHudUpdate({
      phase: this.phase,
      speedKmh: Math.round(this.speedMps * 3.8),
      maxSpeedKmh: 290,
      nitro: Math.round(this.nitro),
      isBoosting: this.isBoosting,
      isBraking: this.isBraking,
      score: this.score,
      bestScore: Math.max(this.bestScore, this.score),
      distanceKm: Number((this.distanceM / 1000).toFixed(2)),
      coins: this.coins,
      nearMisses: this.nearMisses,
      combo: this.combo,
      comboTimer: Math.max(0, Math.min(1, this.comboTimer / 4.0)),
      hull: this.hull,
      maxHull: this.maxHull,
      eventBanner: this.eventBanner,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.sound.dispose();
    this.env.dispose();
    this.shadowTex.dispose();
    this.pmremRT.dispose();
    this.sparkGeo.dispose();
    this.sparkMat.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
