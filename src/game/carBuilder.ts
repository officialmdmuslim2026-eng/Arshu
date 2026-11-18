import * as THREE from 'three';

export interface PlayerCarRig {
  root: THREE.Group;
  chassisPivot: THREE.Group;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  taillightMaterial: THREE.MeshStandardMaterial;
  frontWheelKnuckles: THREE.Group[];
  wheels: THREE.Group[];
  flames: THREE.Mesh[];
  headlightGlows: THREE.Mesh[];
  headlightBeam: THREE.SpotLight | null;
}

export type TrafficVariant = 'sedan' | 'suv' | 'truck';

export interface TrafficCarRig {
  root: THREE.Group;
  wheels: THREE.Group[];
  halfWidth: number;
  halfLength: number;
}

function createWheelAssembly(radius: number, width: number, caliperColor: number): THREE.Group {
  const wheelGroup = new THREE.Group();

  // Tire rubber
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 20);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.05,
  });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheelGroup.add(tire);

  // Machined alloy rim barrel
  const rimGeo = new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, width + 0.02, 16);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.22,
    metalness: 0.92,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheelGroup.add(rim);

  // 5-spoke dark graphite insert
  const spokeMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.35,
    metalness: 0.8,
  });
  for (let i = 0; i < 5; i++) {
    const spokeGeo = new THREE.BoxGeometry(width + 0.035, radius * 1.15, 0.045);
    const spoke = new THREE.Mesh(spokeGeo, spokeMat);
    spoke.rotation.x = (i * Math.PI) / 5;
    wheelGroup.add(spoke);
  }

  // Center lug cap with subtle accent
  const capGeo = new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width + 0.05, 12);
  capGeo.rotateZ(Math.PI / 2);
  const capMat = new THREE.MeshStandardMaterial({
    color: caliperColor,
    roughness: 0.3,
    metalness: 0.7,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  wheelGroup.add(cap);

  return wheelGroup;
}

export function createPlayerCar(
  paintHex: string,
  shadowTexture: THREE.Texture,
  isSoftwareGl: boolean
): PlayerCarRig {
  const root = new THREE.Group();
  const chassisPivot = new THREE.Group();
  root.add(chassisPivot);

  // Contact shadow grounded at y = 0.015
  const shadowGeo = new THREE.PlaneGeometry(2.65, 5.1);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.015;
  root.add(shadowPlane);

  // Primary metallic clearcoat car paint
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    metalness: 0.82,
    roughness: 0.24,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.65,
    metalness: 0.2,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d16,
    metalness: 0.15,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe4e4e7,
    roughness: 0.14,
    metalness: 0.95,
  });

  // 1. Sculpted beveled GT coupe silhouette extruded along width (X)
  const profile = new THREE.Shape();
  profile.moveTo(-2.15, 0.28); // front nose bottom
  profile.lineTo(-2.22, 0.44); // front bumper tip
  profile.lineTo(-1.85, 0.64); // hood front
  profile.lineTo(-0.85, 0.78); // windshield base
  profile.lineTo(-0.15, 1.18); // roof peak
  profile.lineTo(0.95, 1.14); // fastback roof rear
  profile.lineTo(1.88, 0.84); // rear decklid
  profile.lineTo(2.18, 0.76); // rear tail
  profile.lineTo(2.14, 0.30); // rear diffuser bottom
  profile.lineTo(-2.15, 0.28);

  const bodyGeo = new THREE.ExtrudeGeometry(profile, {
    depth: 1.72,
    bevelEnabled: true,
    bevelThickness: 0.11,
    bevelSize: 0.08,
    bevelSegments: 3,
    curveSegments: 8,
  });
  // Rotate so profile X is length along Z, extrude depth is X
  bodyGeo.rotateY(Math.PI / 2);
  bodyGeo.translate(-0.86, 0, 0);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  chassisPivot.add(bodyMesh);

  // 2. Lower aerodynamic carbon splitter & side skirts
  const skirtGeo = new THREE.BoxGeometry(1.98, 0.13, 4.46);
  const skirt = new THREE.Mesh(skirtGeo, carbonMat);
  skirt.position.set(0, 0.25, 0.01);
  skirt.castShadow = true;
  chassisPivot.add(skirt);

  // Front aggressive splitter lip (-Z is forward!)
  const splitterGeo = new THREE.BoxGeometry(2.04, 0.07, 0.34);
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.21, -2.18);
  chassisPivot.add(splitter);

  // 3. Recessed cockpit glass canopy
  const canopyProfile = new THREE.Shape();
  canopyProfile.moveTo(-0.82, 0.78);
  canopyProfile.lineTo(-0.15, 1.21);
  canopyProfile.lineTo(0.88, 1.16);
  canopyProfile.lineTo(1.55, 0.86);
  canopyProfile.lineTo(-0.82, 0.78);

  const canopyGeo = new THREE.ExtrudeGeometry(canopyProfile, {
    depth: 1.38,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  canopyGeo.rotateY(Math.PI / 2);
  canopyGeo.translate(-0.69, 0, 0);
  const canopy = new THREE.Mesh(canopyGeo, glassMat);
  chassisPivot.add(canopy);

  // 4. Side aero mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.2, 0.09, 0.14);
  const mirrorL = new THREE.Mesh(mirrorGeo, bodyMaterial);
  mirrorL.position.set(-0.98, 0.85, -0.58);
  const mirrorR = new THREE.Mesh(mirrorGeo, bodyMaterial);
  mirrorR.position.set(0.98, 0.85, -0.58);
  chassisPivot.add(mirrorL, mirrorR);

  // 5. Rear GT wing + twin struts
  const strutGeo = new THREE.BoxGeometry(0.06, 0.32, 0.22);
  const strutL = new THREE.Mesh(strutGeo, carbonMat);
  strutL.position.set(-0.56, 0.98, 1.9);
  const strutR = new THREE.Mesh(strutGeo, carbonMat);
  strutR.position.set(0.56, 0.98, 1.9);
  chassisPivot.add(strutL, strutR);

  const wingGeo = new THREE.BoxGeometry(1.94, 0.06, 0.34);
  const wing = new THREE.Mesh(wingGeo, carbonMat);
  wing.position.set(0, 1.16, 1.96);
  wing.rotation.x = 0.08;
  wing.castShadow = true;
  chassisPivot.add(wing);

  const endplateGeo = new THREE.BoxGeometry(0.05, 0.22, 0.38);
  const endplateL = new THREE.Mesh(endplateGeo, bodyMaterial);
  endplateL.position.set(-0.97, 1.15, 1.96);
  const endplateR = new THREE.Mesh(endplateGeo, bodyMaterial);
  endplateR.position.set(0.97, 1.15, 1.96);
  chassisPivot.add(endplateL, endplateR);

  // 6. Front grille & glowing LED headlights (at -Z)
  const grilleGeo = new THREE.BoxGeometry(1.16, 0.18, 0.12);
  const grille = new THREE.Mesh(grilleGeo, carbonMat);
  grille.position.set(0, 0.38, -2.26);
  chassisPivot.add(grille);

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const hlGeo = new THREE.BoxGeometry(0.38, 0.08, 0.12);
  const hlL = new THREE.Mesh(hlGeo, headlightMat);
  hlL.position.set(-0.68, 0.54, -2.18);
  hlL.rotation.y = 0.18;
  const hlR = new THREE.Mesh(hlGeo, headlightMat);
  hlR.position.set(0.68, 0.54, -2.18);
  hlR.rotation.y = -0.18;
  chassisPivot.add(hlL, hlR);

  // Optional SpotLight beam forward for night mode
  let headlightBeam: THREE.SpotLight | null = null;
  if (!isSoftwareGl) {
    headlightBeam = new THREE.SpotLight(0xe0f2fe, 18, 55, Math.PI / 5, 0.45, 1.4);
    headlightBeam.position.set(0, 0.75, -2.2);
    headlightBeam.target.position.set(0, 0.1, -24);
    chassisPivot.add(headlightBeam);
    chassisPivot.add(headlightBeam.target);
  }

  // 7. Rear LED taillights (at +Z)
  const taillightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff1e1e,
    emissive: 0xef4444,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const tlBarGeo = new THREE.BoxGeometry(1.62, 0.08, 0.1);
  const tlBar = new THREE.Mesh(tlBarGeo, taillightMaterial);
  tlBar.position.set(0, 0.66, 2.22);
  chassisPivot.add(tlBar);

  // 8. Dual chrome exhausts & animated Nitro flame cones
  const exhaustGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.24, 12);
  exhaustGeo.rotateX(Math.PI / 2);
  const exL = new THREE.Mesh(exhaustGeo, chromeMat);
  exL.position.set(-0.46, 0.28, 2.22);
  const exR = new THREE.Mesh(exhaustGeo, chromeMat);
  exR.position.set(0.46, 0.28, 2.22);
  chassisPivot.add(exL, exR);

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameGeo = new THREE.ConeGeometry(0.11, 0.95, 10);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.45);
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.46, 0.28, 2.3);
  flameL.visible = false;
  const flameR = new THREE.Mesh(flameGeo, flameMat);
  flameR.position.set(0.46, 0.28, 2.3);
  flameR.visible = false;
  chassisPivot.add(flameL, flameR);

  // 9. Four detailed wheel assemblies grounded at y = wheelRadius (0.37)
  const wheelRadius = 0.37;
  const wheelWidth = 0.28;
  const wheelCoords: [number, number, number, boolean][] = [
    [-0.96, wheelRadius, -1.38, true],
    [0.96, wheelRadius, -1.38, true],
    [-0.98, wheelRadius, 1.36, false],
    [0.98, wheelRadius, 1.36, false],
  ];

  const wheels: THREE.Group[] = [];
  const frontWheelKnuckles: THREE.Group[] = [];

  for (const [wx, wy, wz, isFront] of wheelCoords) {
    const wheel = createWheelAssembly(wheelRadius, wheelWidth, 0xef4444);
    wheels.push(wheel);
    if (isFront) {
      const knuckle = new THREE.Group();
      knuckle.position.set(wx, wy, wz);
      knuckle.add(wheel);
      root.add(knuckle);
      frontWheelKnuckles.push(knuckle);
    } else {
      wheel.position.set(wx, wy, wz);
      root.add(wheel);
    }
  }

  return {
    root,
    chassisPivot,
    bodyMaterial,
    taillightMaterial,
    frontWheelKnuckles,
    wheels,
    flames: [flameL, flameR],
    headlightGlows: [hlL, hlR],
    headlightBeam,
  };
}

export function createTrafficCar(
  variant: TrafficVariant,
  colorHex: number,
  shadowTexture: THREE.Texture
): TrafficCarRig {
  const root = new THREE.Group();
  const wheels: THREE.Group[] = [];

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    metalness: 0.45,
    roughness: 0.35,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.75,
    metalness: 0.15,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
    roughness: 0.25,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  let halfWidth = 0.96;
  let halfLength = 2.15;
  let wheelPositions: [number, number, number][] = [];
  let wheelRadius = 0.36;

  if (variant === 'sedan') {
    halfWidth = 0.95;
    halfLength = 2.18;
    wheelRadius = 0.35;

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.56, 4.3), bodyMat);
    lower.position.y = 0.52;
    lower.castShadow = true;
    lower.receiveShadow = true;
    root.add(lower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.52, 2.25), bodyMat);
    cabin.position.set(0, 1.03, 0.15);
    cabin.castShadow = true;
    root.add(cabin);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.42, 2.02), glassMat);
    glass.position.set(0, 1.02, 0.15);
    root.add(glass);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 0.18), trimMat);
    bumperF.position.set(0, 0.34, -2.14);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 0.18), trimMat);
    bumperR.position.set(0, 0.34, 2.14);
    root.add(bumperF, bumperR);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.08), taillightMat);
    tl.position.set(0, 0.62, 2.15);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.08), headlightMat);
    hl.position.set(0, 0.58, -2.15);
    root.add(tl, hl);

    wheelPositions = [
      [-0.92, wheelRadius, -1.32],
      [0.92, wheelRadius, -1.32],
      [-0.92, wheelRadius, 1.32],
      [0.92, wheelRadius, 1.32],
    ];
  } else if (variant === 'suv') {
    halfWidth = 1.05;
    halfLength = 2.35;
    wheelRadius = 0.42;

    const lower = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.68, 4.65), bodyMat);
    lower.position.y = 0.64;
    lower.castShadow = true;
    lower.receiveShadow = true;
    root.add(lower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.62, 3.05), bodyMat);
    cabin.position.set(0, 1.26, 0.38);
    cabin.castShadow = true;
    root.add(cabin);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.48, 2.82), glassMat);
    glass.position.set(0, 1.26, 0.38);
    root.add(glass);

    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 2.3), trimMat);
    rack.position.set(0, 1.61, 0.4);
    root.add(rack);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.15, 0.08), taillightMat);
    tl.position.set(0, 0.78, 2.33);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.15, 0.08), headlightMat);
    hl.position.set(0, 0.72, -2.33);
    root.add(tl, hl);

    wheelPositions = [
      [-1.0, wheelRadius, -1.42],
      [1.0, wheelRadius, -1.42],
      [-1.0, wheelRadius, 1.42],
      [1.0, wheelRadius, 1.42],
    ];
  } else {
    // Cargo Box Truck
    halfWidth = 1.18;
    halfLength = 3.25;
    wheelRadius = 0.46;

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.16, 1.55, 1.95), bodyMat);
    cab.position.set(0, 1.18, -2.18);
    cab.castShadow = true;
    root.add(cab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.65, 0.12), glassMat);
    windshield.position.set(0, 1.52, -3.14);
    root.add(windshield);

    const cargoMat = new THREE.MeshStandardMaterial({
      color: 0xe4e4e7,
      roughness: 0.65,
      metalness: 0.1,
    });
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.32, 2.15, 4.35), cargoMat);
    cargo.position.set(0, 1.62, 1.05);
    cargo.castShadow = true;
    cargo.receiveShadow = true;
    root.add(cargo);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.35, 6.2), trimMat);
    chassis.position.set(0, 0.52, 0.0);
    root.add(chassis);

    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.08), taillightMat);
    tlL.position.set(-0.78, 0.55, 3.22);
    const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.08), taillightMat);
    tlR.position.set(0.78, 0.55, 3.22);
    root.add(tlL, tlR);

    wheelPositions = [
      [-1.08, wheelRadius, -2.15],
      [1.08, wheelRadius, -2.15],
      [-1.08, wheelRadius, 0.75],
      [1.08, wheelRadius, 0.75],
      [-1.08, wheelRadius, 2.15],
      [1.08, wheelRadius, 2.15],
    ];
  }

  for (const [wx, wy, wz] of wheelPositions) {
    const w = createWheelAssembly(wheelRadius, 0.28, 0x71717a);
    w.position.set(wx, wy, wz);
    root.add(w);
    wheels.push(w);
  }

  // Contact shadow grounded at y = 0.014
  const shadowGeo = new THREE.PlaneGeometry(halfWidth * 2.45, halfLength * 2.25);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.014;
  root.add(shadow);

  return {
    root,
    wheels,
    halfWidth,
    halfLength,
  };
}

export type PickupKind = 'coin' | 'nitro' | 'repair';

export function createPickupMesh(kind: PickupKind): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'coin') {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0x92400e,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.2,
    });
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 20), goldMat);
    outer.rotation.x = Math.PI / 2;
    group.add(outer);

    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      metalness: 0.95,
      roughness: 0.12,
    });
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 16), innerMat);
    inner.rotation.x = Math.PI / 2;
    group.add(inner);
  } else if (kind === 'nitro') {
    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 1.4,
      metalness: 0.5,
      roughness: 0.18,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xe4e4e7,
      metalness: 0.92,
      roughness: 0.2,
    });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 14), cyanMat);
    group.add(tank);
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.18, 14), capMat);
    capTop.position.y = 0.54;
    const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, 0.14, 14), capMat);
    capBot.position.y = -0.52;
    group.add(capTop, capBot);
  } else {
    // Repair shield crystal
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 1.2,
      metalness: 0.4,
      roughness: 0.15,
    });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), emeraldMat);
    group.add(crystal);
  }

  return group;
}
