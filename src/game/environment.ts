import * as THREE from 'three';
import { createRoadTexture, createShoulderTexture, createSkyGradientTexture } from './textures';
import { TRACK_THEMES, TrackThemeId } from './types';

export const ROAD_WIDTH = 15.0;
export const LANE_CENTERS = [-5.1, -1.7, 1.7, 5.1];
const ROAD_LENGTH = 360;
const PROP_SPAN = 320;
const LAMP_COUNT = 26;
const TREE_ROCK_COUNT = 64;
const BUILDING_COUNT = 44;

export class HighwayEnvironment {
  public readonly group = new THREE.Group();
  private roadTex: THREE.CanvasTexture;
  private shoulderTex: THREE.CanvasTexture;
  private roadMat: THREE.MeshStandardMaterial;
  private groundMat: THREE.MeshStandardMaterial;
  private skyDomeMat: THREE.MeshBasicMaterial;
  private skyTex: THREE.CanvasTexture | null = null;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  // Scrolling roadside instanced props
  private lampPoles: THREE.InstancedMesh;
  private lampBulbs: THREE.InstancedMesh;
  private lampZOffsets: number[] = [];
  private lampBulbMat: THREE.MeshStandardMaterial;

  private foliageOrRock: THREE.InstancedMesh;
  private foliageTrunk: THREE.InstancedMesh;
  private foliageData: { x: number; z: number; scale: number; rotY: number }[] = [];
  private foliageMat: THREE.MeshStandardMaterial;

  private skylineMesh: THREE.InstancedMesh;
  private skylineData: { x: number; z: number; w: number; h: number; d: number }[] = [];
  private skylineMat: THREE.MeshStandardMaterial;

  private postMesh: THREE.InstancedMesh;
  private postZOffsets: number[] = [];

  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, maxAnisotropy: number, isSoftwareGl: boolean) {
    // 1. Lighting rig (warm/cool contrast + rim)
    this.hemiLight = new THREE.HemisphereLight(0xfdba74, 0x431407, 0.9);
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffedd5, 2.3);
    this.sunLight.position.set(28, 42, 18);
    if (!isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 1024;
      this.sunLight.shadow.mapSize.height = 1024;
      this.sunLight.shadow.camera.near = 5;
      this.sunLight.shadow.camera.far = 140;
      const d = 28;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.02;
    }
    scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    this.rimLight.position.set(-22, 16, -45);
    scene.add(this.rimLight);

    // 2. Sky dome
    const skyGeo = new THREE.SphereGeometry(260, 24, 16);
    this.skyDomeMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, this.skyDomeMat);
    this.group.add(skyDome);

    // 3. Endless wide terrain floor (eliminates floating void!)
    this.shoulderTex = createShoulderTexture(maxAnisotropy);
    this.groundMat = new THREE.MeshStandardMaterial({
      map: this.shoulderTex,
      color: 0x8c4b2d,
      roughness: 0.92,
      metalness: 0.02,
    });
    const groundGeo = new THREE.PlaneGeometry(460, ROAD_LENGTH);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.position.set(0, -0.04, -ROAD_LENGTH * 0.32);
    ground.receiveShadow = true;
    this.group.add(ground);

    // 4. Asphalt 4-lane highway at y = 0 (offset by +0.04 from ground to avoid z-fighting)
    this.roadTex = createRoadTexture(maxAnisotropy);
    this.roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTex,
      roughness: 0.72,
      metalness: 0.08,
    });
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
    roadGeo.rotateX(-Math.PI / 2);
    const road = new THREE.Mesh(roadGeo, this.roadMat);
    road.position.set(0, 0, -ROAD_LENGTH * 0.32);
    road.receiveShadow = true;
    this.group.add(road);

    // 5. Continuous metallic guardrails on left and right edges
    const railGeo = new THREE.BoxGeometry(0.18, 0.28, ROAD_LENGTH);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xa1a1aa,
      roughness: 0.35,
      metalness: 0.8,
    });
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(-ROAD_WIDTH / 2 - 0.55, 0.62, -ROAD_LENGTH * 0.32);
    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(ROAD_WIDTH / 2 + 0.55, 0.62, -ROAD_LENGTH * 0.32);
    this.group.add(railL, railR);

    // Guardrail support posts (InstancedMesh)
    const postCount = 72;
    const postGeo = new THREE.BoxGeometry(0.14, 0.78, 0.14);
    this.postMesh = new THREE.InstancedMesh(postGeo, railMat, postCount);
    this.postMesh.frustumCulled = false;
    for (let i = 0; i < postCount; i++) {
      const z = 25 - (Math.floor(i / 2) / (postCount / 2)) * PROP_SPAN;
      this.postZOffsets.push(z);
    }
    this.group.add(this.postMesh);

    // 6. Highway Streetlamps (InstancedMesh poles + emissive bulbs)
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 7.2, 8);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.45,
      metalness: 0.75,
    });
    this.lampPoles = new THREE.InstancedMesh(poleGeo, poleMat, LAMP_COUNT);
    this.lampPoles.frustumCulled = false;

    const bulbGeo = new THREE.BoxGeometry(0.95, 0.16, 0.36);
    this.lampBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    this.lampBulbs = new THREE.InstancedMesh(bulbGeo, this.lampBulbMat, LAMP_COUNT);
    this.lampBulbs.frustumCulled = false;

    for (let i = 0; i < LAMP_COUNT; i++) {
      const z = 30 - (Math.floor(i / 2) / (LAMP_COUNT / 2)) * PROP_SPAN;
      this.lampZOffsets.push(z);
    }
    this.group.add(this.lampPoles, this.lampBulbs);

    // 7. Roadside organic props (trees/mesas/rocks)
    const crownGeo = new THREE.ConeGeometry(1.75, 4.8, 7);
    this.foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2f6f3e,
      roughness: 0.85,
      metalness: 0.02,
    });
    this.foliageOrRock = new THREE.InstancedMesh(crownGeo, this.foliageMat, TREE_ROCK_COUNT);
    this.foliageOrRock.frustumCulled = false;

    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 1.8, 7);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a3525,
      roughness: 0.9,
    });
    this.foliageTrunk = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_ROCK_COUNT);
    this.foliageTrunk.frustumCulled = false;

    for (let i = 0; i < TREE_ROCK_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const distFromRoad = 12 + Math.random() * 34;
      this.foliageData.push({
        x: side * distFromRoad,
        z: 30 - Math.random() * PROP_SPAN,
        scale: 0.75 + Math.random() * 0.85,
        rotY: Math.random() * Math.PI * 2,
      });
    }
    this.group.add(this.foliageOrRock, this.foliageTrunk);

    // 8. Distant horizon monoliths / city silhouettes / canyon mesas
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    this.skylineMat = new THREE.MeshStandardMaterial({
      color: 0x3f2e2b,
      roughness: 0.75,
      metalness: 0.15,
    });
    this.skylineMesh = new THREE.InstancedMesh(bGeo, this.skylineMat, BUILDING_COUNT);
    this.skylineMesh.frustumCulled = false;
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.skylineData.push({
        x: side * (52 + Math.random() * 58),
        z: 40 - (i / BUILDING_COUNT) * PROP_SPAN,
        w: 10 + Math.random() * 14,
        h: 12 + Math.random() * 34,
        d: 12 + Math.random() * 16,
      });
    }
    this.group.add(this.skylineMesh);

    scene.add(this.group);
    this.applyTheme(scene, 'sunset');
    this.update(0, 0);
  }

  public applyTheme(scene: THREE.Scene, themeId: TrackThemeId): void {
    const preset = TRACK_THEMES[themeId];
    scene.fog = new THREE.FogExp2(preset.fogColor, themeId === 'night' ? 0.0085 : 0.0068);
    scene.background = new THREE.Color(preset.fogColor);

    this.skyTex?.dispose();
    this.skyTex = createSkyGradientTexture(preset.skyTop, preset.skyHorizon);
    this.skyDomeMat.map = this.skyTex;
    this.skyDomeMat.needsUpdate = true;

    this.groundMat.color.set(preset.groundColor);
    this.roadMat.color.set(preset.roadTint);

    this.sunLight.color.set(preset.sunColor);
    this.sunLight.intensity = preset.sunIntensity;
    this.hemiLight.color.set(preset.hemiSky);
    this.hemiLight.groundColor.set(preset.hemiGround);
    this.hemiLight.intensity = preset.hemiIntensity;

    if (themeId === 'night') {
      this.lampBulbMat.emissive.setHex(0x38bdf8);
      this.lampBulbMat.emissiveIntensity = 2.6;
      this.foliageMat.color.setHex(0x1e293b);
      this.skylineMat.color.setHex(0x0f172a);
      this.skylineMat.emissive.setHex(0x0ea5e9);
      this.skylineMat.emissiveIntensity = 0.22;
    } else if (themeId === 'sunset') {
      this.lampBulbMat.emissive.setHex(0xfdba74);
      this.lampBulbMat.emissiveIntensity = 1.4;
      this.foliageMat.color.setHex(0x6b3e26);
      this.skylineMat.color.setHex(0x7c3f2c);
      this.skylineMat.emissive.setHex(0x000000);
      this.skylineMat.emissiveIntensity = 0;
    } else {
      this.lampBulbMat.emissive.setHex(0xfef9c3);
      this.lampBulbMat.emissiveIntensity = 0.4;
      this.foliageMat.color.setHex(0x15803d);
      this.skylineMat.color.setHex(0x64748b);
      this.skylineMat.emissive.setHex(0x000000);
      this.skylineMat.emissiveIntensity = 0;
    }
  }

  public update(speedMps: number, dt: number): void {
    const moveZ = speedMps * dt;

    // Scroll asphalt & shoulder textures seamlessly
    // Road length = 360, repeat.y = 22 -> 1 repeat = 360 / 22 = 16.3636 meters
    this.roadTex.offset.y = (this.roadTex.offset.y + moveZ / (ROAD_LENGTH / 22)) % 1;
    this.shoulderTex.offset.y = (this.shoulderTex.offset.y + moveZ / (ROAD_LENGTH / 24)) % 1;

    // Guardrail posts
    for (let i = 0; i < this.postZOffsets.length; i++) {
      let z = this.postZOffsets[i] + moveZ;
      if (z > 30) z -= PROP_SPAN;
      this.postZOffsets[i] = z;
      const side = i % 2 === 0 ? -1 : 1;
      this.dummy.position.set(side * (ROAD_WIDTH / 2 + 0.62), 0.39, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.postMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.postMesh.instanceMatrix.needsUpdate = true;

    // Streetlamps
    for (let i = 0; i < LAMP_COUNT; i++) {
      let z = this.lampZOffsets[i] + moveZ;
      if (z > 35) z -= PROP_SPAN;
      this.lampZOffsets[i] = z;

      const side = i % 2 === 0 ? -1 : 1;
      const poleX = side * (ROAD_WIDTH / 2 + 1.35);

      this.dummy.position.set(poleX, 3.6, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.lampPoles.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(poleX - side * 0.6, 7.1, z);
      this.dummy.updateMatrix();
      this.lampBulbs.setMatrixAt(i, this.dummy.matrix);
    }
    this.lampPoles.instanceMatrix.needsUpdate = true;
    this.lampBulbs.instanceMatrix.needsUpdate = true;

    // Roadside trees / canyon formations
    for (let i = 0; i < TREE_ROCK_COUNT; i++) {
      const item = this.foliageData[i];
      item.z += moveZ;
      if (item.z > 35) {
        item.z -= PROP_SPAN;
      }
      this.dummy.position.set(item.x, 0.9 * item.scale, item.z);
      this.dummy.rotation.set(0, item.rotY, 0);
      this.dummy.scale.setScalar(item.scale);
      this.dummy.updateMatrix();
      this.foliageTrunk.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(item.x, 3.3 * item.scale, item.z);
      this.dummy.updateMatrix();
      this.foliageOrRock.setMatrixAt(i, this.dummy.matrix);
    }
    this.foliageTrunk.instanceMatrix.needsUpdate = true;
    this.foliageOrRock.instanceMatrix.needsUpdate = true;

    // Distant horizon monoliths / city towers
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const b = this.skylineData[i];
      b.z += moveZ * 0.85; // Subtle parallax on distant horizon
      if (b.z > 45) b.z -= PROP_SPAN;

      this.dummy.position.set(b.x, b.h * 0.5 - 0.1, b.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(b.w, b.h, b.d);
      this.dummy.updateMatrix();
      this.skylineMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.skylineMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.roadTex.dispose();
    this.shoulderTex.dispose();
    this.skyTex?.dispose();
  }
}
