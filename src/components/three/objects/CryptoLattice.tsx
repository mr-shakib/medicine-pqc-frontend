'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  ShaderMaterial,
  type Group,
  type InstancedMesh,
  type LineSegments,
  type Mesh,
} from 'three';
import { accent, fog } from '@/lib/design/tokens';
import { emissive, hairline } from '@/lib/design/materials';
import { buildLattice, type LatticeOptions } from '@/lib/geometry/lattice';
import { latticeEdgeFragment, latticeEdgeVertex } from '@/shaders/lattice';
import { coreShellFragment, coreShellVertex } from '@/shaders/medicineCore';
import { clamp, seededRandom, smoothstep } from '@/lib/math';

const dummy = new Object3D();

export interface CryptoLatticeProps extends LatticeOptions {
  /** Structure growth, 0 -> 1. Read every frame. */
  getGrow: () => number;
  /** Presence of the outer boundary and field, 0 -> 1. Read every frame. */
  getField: () => number;
  /**
   * Read every frame; false skips the update entirely. The node loop is the
   * one piece of per-frame CPU work in the piece that scales with content, so
   * a chapter that is not being drawn should not pay for it.
   */
  getActive?: () => boolean;
  /** Radius of the faceted boundary. */
  boundaryRadius?: number;
  /** Geometry subdivision for the boundary shell. */
  detail?: number;
}

/**
 * The cryptographic structure.
 *
 * Four draws for the whole architecture, however many nodes it has: the lattice
 * nodes (instanced), its edges (one LineSegments), the faceted boundary, and
 * the field shell.
 *
 * Deliberately built from mathematics rather than iconography. The nodes are
 * octahedra, not spheres, because a crystal habit reads as structure where a
 * ball reads as a bead; the boundary is a faceted polyhedron, not a dome,
 * because a dome is a force field and a polytope is a lattice cell; and the
 * field is a thin fresnel shell rather than a glowing bubble.
 */
export default function CryptoLattice({
  spacing,
  innerRadius,
  outerRadius,
  highlightRatio,
  getGrow,
  getField,
  getActive,
  boundaryRadius = 3,
  detail = 1,
}: CryptoLatticeProps) {
  const nodes = useRef<InstancedMesh>(null);
  const edges = useRef<LineSegments>(null);
  const boundary = useRef<Mesh>(null);
  const field = useRef<Mesh>(null);
  const spin = useRef<Group>(null);

  const lattice = useMemo(
    () => buildLattice({ spacing, innerRadius, outerRadius, highlightRatio }),
    [spacing, innerRadius, outerRadius, highlightRatio],
  );

  /** Where each node waits before the structure crystallises around it. */
  const scatter = useMemo(() => {
    const out = new Float32Array(lattice.nodeCount * 3);
    for (let i = 0; i < lattice.nodeCount; i++) {
      // Kept close. A wide scatter throws nodes far outside the boundary they
      // are about to form, which reads as debris rather than as assembly.
      const push = 1.3 + seededRandom(i * 3.7) * 0.7;
      out[i * 3] = lattice.nodes[i * 3] * push;
      out[i * 3 + 1] = lattice.nodes[i * 3 + 1] * push;
      out[i * 3 + 2] = lattice.nodes[i * 3 + 2] * push;
    }
    return out;
  }, [lattice]);

  /* ---------------------------------------------------------------------- */
  /* Geometry and materials                                                 */
  /* ---------------------------------------------------------------------- */

  const nodeGeometry = useMemo(() => new OctahedronGeometry(1, 0), []);
  const nodeMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        ...emissive(accent.lattice.base, 1.6),
        transparent: true,
      }),
    [],
  );

  const edgeGeometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(lattice.edges, 3));
    g.setAttribute('aRadius', new BufferAttribute(lattice.edgeRadius, 1));
    g.setAttribute('aHighlight', new BufferAttribute(lattice.edgeHighlight, 1));
    return g;
  }, [lattice]);

  const edgeMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: latticeEdgeVertex,
        fragmentShader: latticeEdgeFragment,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        uniforms: {
          uGrow: { value: 0 },
          uSoftness: { value: 0.55 },
          uOpacity: { value: 0.52 },
          uColor: { value: new Color(accent.lattice.base) },
          uHighlightColor: { value: new Color(accent.lattice.light) },
          uFogDensity: { value: fog.density },
        },
      }),
    [],
  );

  const fieldMaterial = useMemo(
    () =>
      // The same shell program the medicine core uses: rim, interior glow and
      // slow striations. An energy field that is a thin surface rather than a
      // volume of light is what keeps it from reading as a force bubble.
      new ShaderMaterial({
        vertexShader: coreShellVertex,
        fragmentShader: coreShellFragment,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uRimColor: { value: new Color(accent.lattice.light) },
          uGlowColor: { value: new Color(accent.lattice.base) },
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uRimPower: { value: 3.2 },
          uFogDensity: { value: fog.density },
        },
      }),
    [],
  );

  useEffect(
    () => () => {
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      fieldMaterial.dispose();
    },
    [nodeGeometry, nodeMaterial, edgeGeometry, edgeMaterial, fieldMaterial],
  );

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                  */
  /* ---------------------------------------------------------------------- */

  useFrame((state, delta) => {
    if (getActive && !getActive()) return;

    const dt = Math.min(delta, 1 / 20);
    const time = state.clock.elapsedTime;
    const grow = clamp(getGrow());
    const fieldAmount = clamp(getField());

    // Growth front, in world radius.
    const front = grow * (lattice.maxRadius + 0.8);

    if (nodes.current) {
      for (let i = 0; i < lattice.nodeCount; i++) {
        const radius = lattice.nodeRadius[i];
        // Each node crystallises as the front reaches it: it travels in from
        // its scattered position and takes its place in the grid.
        const settled = smoothstep(radius + 0.5, radius - 0.5, front);

        dummy.position.set(
          scatter[i * 3] + (lattice.nodes[i * 3] - scatter[i * 3]) * settled,
          scatter[i * 3 + 1] +
            (lattice.nodes[i * 3 + 1] - scatter[i * 3 + 1]) * settled,
          scatter[i * 3 + 2] +
            (lattice.nodes[i * 3 + 2] - scatter[i * 3 + 2]) * settled,
        );
        dummy.rotation.set(time * 0.14 + i, time * 0.1, 0);
        /*
          Small. There are a couple of hundred of these, and at anything much
          larger they stop reading as lattice points and become a field of
          floating crystals that buries both the structure and the medicines.
        */
        dummy.scale.setScalar(Math.max(settled * 0.055, 0.0001));
        dummy.updateMatrix();
        nodes.current.setMatrixAt(i, dummy.matrix);
      }
      nodes.current.instanceMatrix.needsUpdate = true;
      nodes.current.visible = grow > 0.004;
    }

    if (edges.current) {
      const uniforms = (edges.current.material as ShaderMaterial).uniforms;
      uniforms.uGrow.value = front;
      edges.current.visible = grow > 0.02;
    }

    if (boundary.current) {
      const shown = smoothstep(0.1, 0.9, fieldAmount);
      boundary.current.scale.setScalar(
        boundaryRadius * (0.86 + shown * 0.14),
      );
      boundary.current.visible = shown > 0.004;
      const material = boundary.current.material as { opacity: number };
      material.opacity = shown * 0.3;
    }

    if (field.current) {
      const uniforms = (field.current.material as ShaderMaterial).uniforms;
      uniforms.uTime.value = time;
      uniforms.uReveal.value = fieldAmount * 0.72;
      field.current.scale.setScalar(boundaryRadius * 0.99);
      field.current.visible = fieldAmount > 0.01;
    }

    // The whole structure turns slowly, so the lattice reads as a solid object
    // in space rather than as a flat pattern.
    if (spin.current) {
      spin.current.rotation.y += dt * 0.045;
      spin.current.rotation.x = Math.sin(time * 0.07) * 0.08;
    }
  });

  return (
    <group ref={spin}>
      <instancedMesh
        ref={nodes}
        args={[nodeGeometry, nodeMaterial, lattice.nodeCount]}
        frustumCulled={false}
      />

      <lineSegments
        ref={edges}
        geometry={edgeGeometry}
        material={edgeMaterial}
        frustumCulled={false}
      />

      {/* The cryptographic boundary: a faceted polytope, not a dome. */}
      <mesh ref={boundary}>
        <icosahedronGeometry args={[1, detail]} />
        <meshBasicMaterial {...hairline(accent.lattice.light, 0)} />
      </mesh>

      {/* The field itself — a thin surface, not a volume. */}
      <mesh ref={field} material={fieldMaterial}>
        <icosahedronGeometry args={[1, detail + 1]} />
      </mesh>
    </group>
  );
}
