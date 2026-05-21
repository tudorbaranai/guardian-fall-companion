"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import type { Activity } from "@/lib/telemetry";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/**
 * Low-poly humanoid in CSS 3D for the motion dashboard.
 *
 * The figure itself is built from rounded "Box3D" primitives — capsule-like
 * limbs and a softly rounded torso, head and pelvis — so it reads as a
 * person without the cost of a real GLTF model.
 *
 * Animations are driven by a single `requestAnimationFrame` loop that
 * computes each joint's pose every frame and writes the CSS `transform`
 * imperatively via refs. No CSS keyframes — that lets every activity share
 * the same continuous-curve formulation (sinusoidal swing, smoothstep
 * tumble) and lets us animate knees and the body bob in sync with the gait.
 *
 * Props are unchanged from the original CSS-3D version so motion-dashboard
 * does not have to know which renderer is underneath.
 */

// ── Palette ────────────────────────────────────────────────────────────────
// Soft neutral grays, lit from above. Low contrast so the figure reads as
// "person" rather than "robot".
const BODY = {
  light: "#d2d7dc",
  main: "#b1b8bf",
  shade: "#959ca3",
  deep: "#7b8289",
};
// Sensor-module palette — the Guardian sage, so it reads as "the device".
const SENSOR = {
  light: "#5f8a6a",
  main: "#356548",
  shade: "#2a5139",
  deep: "#1f3c2b",
};

const ALERT = "#a6293c";
const ACCENT = "#356548";

// ── Cube primitive ────────────────────────────────────────────────────────
function Face({
  w,
  h,
  transform,
  color,
  radius = 0,
}: {
  w: number;
  h: number;
  transform: string;
  color: string;
  radius?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        width: w,
        height: h,
        left: -w / 2,
        top: -h / 2,
        background: color,
        transform,
        backfaceVisibility: "hidden",
        borderRadius: radius,
        boxShadow: "inset 0 0 0 0.4px rgba(0,0,0,0.10)",
      }}
    />
  );
}

/**
 * A 3D box composed of six faces. `radius` rounds each face's corners so a
 * limb with `w = d` and `radius = w / 2` reads as a capsule rather than a
 * cube — that's how every arm/leg in this mannequin gets its humanoid feel.
 */
function Box3D({
  w,
  h,
  d,
  x = 0,
  y = 0,
  z = 0,
  rotZ = 0,
  palette = BODY,
  radius = 0,
}: {
  w: number;
  h: number;
  d: number;
  x?: number;
  y?: number;
  z?: number;
  rotZ?: number;
  palette?: typeof BODY;
  radius?: number;
}) {
  const capRadius = Math.min(radius, Math.min(w, d) / 2);
  return (
    <div
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${-y}px, ${z}px) rotateZ(${rotZ}deg)`,
      }}
    >
      <Face
        w={w}
        h={h}
        color={palette.main}
        radius={radius}
        transform={`translateZ(${d / 2}px)`}
      />
      <Face
        w={w}
        h={h}
        color={palette.deep}
        radius={radius}
        transform={`rotateY(180deg) translateZ(${d / 2}px)`}
      />
      <Face
        w={d}
        h={h}
        color={palette.shade}
        radius={radius}
        transform={`rotateY(90deg) translateZ(${w / 2}px)`}
      />
      <Face
        w={d}
        h={h}
        color={palette.shade}
        radius={radius}
        transform={`rotateY(-90deg) translateZ(${w / 2}px)`}
      />
      <Face
        w={w}
        h={d}
        color={palette.light}
        radius={capRadius}
        transform={`rotateX(90deg) translateZ(${h / 2}px)`}
      />
      <Face
        w={w}
        h={d}
        color={palette.deep}
        radius={capRadius}
        transform={`rotateX(-90deg) translateZ(${h / 2}px)`}
      />
    </div>
  );
}

// ── Joint — a transformable pivot point ───────────────────────────────────
/**
 * A 0×0 transform container placed at a given pivot. Children render
 * relative to this pivot, so rotating the joint (the animation loop
 * does this imperatively via the ref) swings the whole sub-hierarchy
 * around the joint, not around the body origin.
 *
 * The initial inline transform plants the joint at its rest pose; the
 * animation loop overwrites it 60 times per second to inject the
 * activity-driven rotation.
 */
function Joint({
  pivotX,
  pivotY,
  jointRef,
  children,
}: {
  pivotX: number;
  pivotY: number;
  jointRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div
      ref={jointRef}
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate3d(${pivotX}px, ${-pivotY}px, 0)`,
      }}
    >
      {children}
    </div>
  );
}

// ── Body skeleton — the absolute pivot positions for every joint ──────────
// Everything is in the body coordinate frame (origin at mid-hip, Y-up).
// The nested joints' pivots are relative to their parent joint.
const JOINTS = {
  shoulderL: { x: -32, y: 73 },
  shoulderR: { x: 32, y: 73 },
  // The elbow lives 46 px below the shoulder — that's the bicep's length.
  elbow: { x: 0, y: -46 },
  hipL: { x: -12, y: -2 },
  hipR: { x: 12, y: -2 },
  // The knee lives 56 px below the hip — the thigh's length.
  knee: { x: 0, y: -56 },
} as const;

// ── Pose computation — Three.js-style continuous curves ────────────────
interface Pose {
  /** Body root: vertical bob + forward lean + side-to-side sway. */
  bodyY: number;
  bodyTiltX: number; // forward lean (X axis, degrees)
  bodyTiltZ: number; // side-to-side sway (Z axis, degrees)
  /** Shoulder / hip rotation around the X axis (degrees, forward swing). */
  armSwingL: number;
  armSwingR: number;
  legSwingL: number;
  legSwingR: number;
  /** Elbow + knee bend (degrees, positive folds the limb forward). */
  elbowL: number;
  elbowR: number;
  kneeL: number;
  kneeR: number;
}

const REST_POSE: Pose = {
  bodyY: 0,
  bodyTiltX: 0,
  bodyTiltZ: 0,
  armSwingL: 0,
  armSwingR: 0,
  legSwingL: 0,
  legSwingR: 0,
  elbowL: 0,
  elbowR: 0,
  kneeL: 0,
  kneeR: 0,
};

function poseForActivity(activity: Activity, t: number): Pose {
  switch (activity) {
    case "Stationary": {
      // Breathing — slow bob + tiny sway. The phase offset keeps the sway
      // out of perfect sync with the bob so it reads as organic.
      const breath = Math.sin(t * 1.6);
      return {
        ...REST_POSE,
        bodyY: breath * 2.5, // pixels
        bodyTiltZ: Math.sin(t * 1.2 + 0.6) * 0.7,
        bodyTiltX: breath * 0.35,
        // Arms drift a hair on the breath cycle so they don't look pinned.
        armSwingL: Math.sin(t * 1.6 + 1.1) * 1.4,
        armSwingR: -Math.sin(t * 1.6 + 1.1) * 1.4,
      };
    }
    case "Walking": {
      const freq = 2.0 * Math.PI * 1.1; // 1.1 Hz cadence
      const phase = t * freq;
      const arm = Math.sin(phase) * 35;
      const leg = Math.sin(phase) * 26;
      const bob = Math.abs(Math.cos(phase)) * 6; // two beats per stride
      return {
        bodyY: bob,
        bodyTiltX: 2.5,
        bodyTiltZ: Math.sin(phase * 0.5) * 2.4,
        armSwingL: arm,
        armSwingR: -arm,
        legSwingL: -leg,
        legSwingR: leg,
        elbowL: Math.max(0, Math.sin(phase)) * 18,
        elbowR: Math.max(0, -Math.sin(phase)) * 18,
        // Knees bend backward (negative rotateX in our convention) during
        // the swing's recovery half — the heel rises behind the figure.
        kneeL: Math.max(0, -Math.sin(phase)) * -40,
        kneeR: Math.max(0, Math.sin(phase)) * -40,
      };
    }
    case "Running": {
      const freq = 2.0 * Math.PI * 1.8; // 1.8 Hz cadence
      const phase = t * freq;
      const arm = Math.sin(phase) * 57;
      const leg = Math.sin(phase) * 43;
      const bob = Math.abs(Math.cos(phase)) * 12;
      return {
        bodyY: bob,
        bodyTiltX: 10,
        bodyTiltZ: Math.sin(phase * 0.5) * 3,
        armSwingL: arm,
        armSwingR: -arm,
        legSwingL: -leg,
        legSwingR: leg,
        elbowL: 35 + Math.max(0, Math.sin(phase)) * 25,
        elbowR: 35 + Math.max(0, -Math.sin(phase)) * 25,
        kneeL: Math.max(0, -Math.sin(phase)) * -65,
        kneeR: Math.max(0, Math.sin(phase)) * -65,
      };
    }
    case "Falling": {
      // One-shot smoothstep tumble (~1.4 s). After that the figure stays
      // at the final pose — on the ground.
      const k = Math.min(1, t / 1.4);
      const eased = k * k * (3 - 2 * k);
      return {
        bodyY: -eased * 50,
        bodyTiltX: eased * 82, // tilts forward to roughly horizontal
        bodyTiltZ: eased * 18,
        armSwingL: eased * -80,
        armSwingR: eased * -80,
        legSwingL: eased * 12,
        legSwingR: eased * -12,
        elbowL: eased * 30,
        elbowR: eased * 30,
        // Heels fold up behind on impact, not forward into the ground.
        kneeL: eased * -28,
        kneeR: eased * -22,
      };
    }
  }
}

// ── Per-joint transform composers ─────────────────────────────────────────
// The base transform places the joint at its pivot; the swing layer adds
// the activity-driven rotation around the X axis (forward swing). Both
// must live in the same `transform` string — that's why the loop builds
// it fresh every frame.
function jointTransform(pivotX: number, pivotY: number, rotXDeg: number) {
  return `translate3d(${pivotX}px, ${-pivotY}px, 0) rotateX(${rotXDeg}deg)`;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span style={{ opacity: 0.55 }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </>
  );
}

/** Short, uppercased label shown on the status tag for each activity. */
const ACTIVITY_LABEL: Record<Activity, string> = {
  Walking: "Walking",
  Running: "Running",
  Stationary: "Stationary",
  Falling: "Falling",
};

export function Mannequin3D({
  roll,
  pitch,
  fallen,
  activity,
  showGrid = true,
  tilt,
  impact,
  since,
}: {
  roll: number;
  pitch: number;
  fallen: boolean;
  /** Coarse motion state from the phone-side classifier. Drives the limb
   *  swing (Walking / Running) or the whole-body tumble (Falling). */
  activity: Activity;
  showGrid?: boolean;
  tilt: number;
  impact: number;
  since: string;
}) {
  // Orbit camera — left-drag rotates, the wheel zooms.
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState({ rx: -8, ry: 28, zoom: 1.2 });

  // Wheel zoom needs a non-passive listener to cancel page scroll.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => ({
        ...v,
        zoom: clamp(v.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.55, 2.8),
      }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = "grabbing";
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({
      ...v,
      ry: v.ry + dx * 0.35,
      rx: clamp(v.rx + dy * 0.3, -85, 85),
    }));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    e.currentTarget.style.cursor = "grab";
  };

  // ── Joint refs + animation loop ──────────────────────────────────────────
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const shoulderLRef = useRef<HTMLDivElement | null>(null);
  const shoulderRRef = useRef<HTMLDivElement | null>(null);
  const elbowLRef = useRef<HTMLDivElement | null>(null);
  const elbowRRef = useRef<HTMLDivElement | null>(null);
  const hipLRef = useRef<HTMLDivElement | null>(null);
  const hipRRef = useRef<HTMLDivElement | null>(null);
  const kneeLRef = useRef<HTMLDivElement | null>(null);
  const kneeRRef = useRef<HTMLDivElement | null>(null);

  // The activity-driven pose runs on a continuous rAF loop. Falling uses a
  // local clock so the tumble plays from t=0 each time it's entered (the
  // smoothstep would never advance with a shared global clock).
  const activityRef = useRef(activity);
  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  // The user-controlled orbit rotation needs to compose with the activity
  // pose. We read it via ref so the rAF callback always sees the latest.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Same for the wearable's reported orientation — applied to the body
  // group when the activity is not Falling.
  const orientationRef = useRef({ roll, pitch });
  useEffect(() => {
    orientationRef.current = { roll, pitch };
  }, [roll, pitch]);

  useEffect(() => {
    let raf = 0;
    let fallenStart: number | null = null;
    const epoch = performance.now();

    const tick = () => {
      const now = performance.now();
      const tGlobal = (now - epoch) / 1000;
      const act = activityRef.current;

      // Local clock for Falling — restarts whenever the activity transitions
      // into Falling so the smoothstep plays from zero.
      if (act === "Falling") {
        if (fallenStart === null) fallenStart = now;
      } else {
        fallenStart = null;
      }
      const tForPose =
        act === "Falling" && fallenStart !== null
          ? (now - fallenStart) / 1000
          : tGlobal;

      const pose = poseForActivity(act, tForPose);
      const o = orientationRef.current;

      // Body: bobs vertically and adds the activity's own X/Z tilt to the
      // live wearable orientation. We bypass the IMU tilt during a fall
      // so the tumble plays from a clean upright pose.
      if (bodyRef.current) {
        const tiltZ = act === "Falling" ? pose.bodyTiltZ : o.pitch + pose.bodyTiltZ;
        const tiltX = act === "Falling" ? pose.bodyTiltX : o.roll + pose.bodyTiltX;
        bodyRef.current.style.transform = `translate3d(0px, ${
          -pose.bodyY + 6
        }px, 0) rotateZ(${tiltZ}deg) rotateX(${tiltX}deg)`;
      }

      const set = (
        ref: React.RefObject<HTMLDivElement | null>,
        pivotX: number,
        pivotY: number,
        rotX: number,
      ) => {
        if (ref.current) {
          ref.current.style.transform = jointTransform(pivotX, pivotY, rotX);
        }
      };

      set(shoulderLRef, JOINTS.shoulderL.x, JOINTS.shoulderL.y, pose.armSwingL);
      set(shoulderRRef, JOINTS.shoulderR.x, JOINTS.shoulderR.y, pose.armSwingR);
      set(elbowLRef, JOINTS.elbow.x, JOINTS.elbow.y, pose.elbowL);
      set(elbowRRef, JOINTS.elbow.x, JOINTS.elbow.y, pose.elbowR);
      set(hipLRef, JOINTS.hipL.x, JOINTS.hipL.y, pose.legSwingL);
      set(hipRRef, JOINTS.hipR.x, JOINTS.hipR.y, pose.legSwingR);
      set(kneeLRef, JOINTS.knee.x, JOINTS.knee.y, pose.kneeL);
      set(kneeRRef, JOINTS.knee.x, JOINTS.knee.y, pose.kneeR);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const falling = activity === "Falling" || fallen;
  const monoFont = "var(--font-geist-mono), ui-monospace, monospace";
  const stageBg = falling ? "#f8ecef" : "#f5f7f4";
  const gridColor = falling ? "rgba(166,41,60,0.34)" : "rgba(27,58,92,0.3)";

  return (
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: stageBg,
        borderRadius: 18,
        overflow: "hidden",
        cursor: "grab",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        transition: "background 0.6s ease",
      }}
    >
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: falling
            ? "radial-gradient(ellipse at 50% 40%, rgba(166,41,60,0.10), transparent 65%)"
            : "radial-gradient(ellipse at 50% 30%, rgba(53,101,72,0.06), transparent 65%)",
          pointerEvents: "none",
          transition: "background 0.6s ease",
        }}
      />

      {/* Status tag — "Fall detected" while a fall is latched, otherwise the
          coarse activity label from the phone-side classifier. */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 11px 5px 9px",
          background: fallen ? ALERT : "rgba(255,255,255,0.88)",
          border: `1px solid ${fallen ? ALERT : "rgba(27,58,92,0.12)"}`,
          borderRadius: 999,
          font: `700 10.5px/1 ${monoFont}`,
          letterSpacing: "0.1em",
          color: fallen ? "#fff" : "#131826",
          textTransform: "uppercase",
        }}
      >
        <span
          className={falling ? "manne-pulse" : undefined}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: falling ? "#fff" : ACCENT,
            boxShadow: falling
              ? "0 0 0 3px rgba(255,255,255,0.35)"
              : `0 0 0 3px ${ACCENT}22`,
          }}
        />
        {fallen ? "Fall detected" : ACTIVITY_LABEL[activity]}
      </div>

      {/* Read-outs */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 4,
          padding: "7px 11px",
          background: "rgba(255,255,255,0.88)",
          border: "1px solid rgba(27,58,92,0.12)",
          borderRadius: 8,
          font: `500 10.5px/1.6 ${monoFont}`,
          color: "#131826",
          display: "grid",
          gridTemplateColumns: "auto auto",
          columnGap: 12,
        }}
      >
        <InfoCell label="tilt" value={`${tilt.toFixed(1)}°`} />
        <InfoCell label="impact" value={`${impact.toFixed(2)} g`} />
        <InfoCell label="since" value={since} />
      </div>

      {/* Audio-alarm indicator */}
      {fallen && (
        <div
          style={{
            position: "absolute",
            bottom: 14,
            right: 14,
            zIndex: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 11px 7px 10px",
            background: "#fff",
            border: `1px solid ${ALERT}`,
            borderRadius: 999,
            font: "700 10.5px/1 inherit",
            letterSpacing: "0.08em",
            color: ALERT,
            textTransform: "uppercase",
            boxShadow: "0 6px 18px rgba(166,41,60,0.18)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke={ALERT}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 5.5 H4 L7 3 V11 L4 8.5 H2 Z" />
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="manne-bars"
                style={{
                  width: 2,
                  height: 10,
                  background: ALERT,
                  borderRadius: 1,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
          <span>Alarm sounding</span>
        </div>
      )}

      {/* 3D scene */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1600,
          perspectiveOrigin: "50% 42%",
          transform: `scale(${view.zoom})`,
          transition: "transform 0.12s ease-out",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 0,
            height: 0,
            transformStyle: "preserve-3d",
            transform: `rotateX(${view.rx}deg) rotateY(${view.ry}deg)`,
          }}
        >
          {showGrid && (
            <div
              style={{
                position: "absolute",
                left: -360,
                top: -230,
                width: 720,
                height: 720,
                transform: "rotateX(90deg)",
                background: `repeating-linear-gradient(0deg, ${gridColor} 0 1.4px, transparent 1.4px 52px), repeating-linear-gradient(90deg, ${gridColor} 0 1.4px, transparent 1.4px 52px)`,
                maskImage:
                  "radial-gradient(ellipse at center, black 0%, black 52%, transparent 90%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse at center, black 0%, black 52%, transparent 90%)",
                transition: "background 0.6s ease",
              }}
            />
          )}

          {/* Ground shadow */}
          <div
            style={{
              position: "absolute",
              left: falling ? -90 : -50,
              top: falling ? 98 : 110,
              width: falling ? 220 : 110,
              height: falling ? 64 : 40,
              transform: "rotateX(90deg)",
              background:
                "radial-gradient(ellipse at center, rgba(20,30,40,0.24), transparent 68%)",
              transition: "all 0.7s cubic-bezier(.4,.2,.2,1)",
              pointerEvents: "none",
            }}
          />

          {/* Body group — the rAF loop overwrites this transform 60 fps.
              Limbs are inlined here so each joint's ref lives in the same
              component as the loop that drives it. */}
          <div
            ref={bodyRef}
            style={
              {
                position: "absolute",
                left: 0,
                top: 0,
                transformStyle: "preserve-3d",
                transform: `translate3d(0px, 6px, 0)`,
              } as CSSProperties
            }
          >
            {/* Head — near-spherical rounded cube. */}
            <Box3D w={28} h={32} d={28} y={108} radius={13} />
            {/* Neck — short capsule. */}
            <Box3D w={12} h={12} d={12} y={86} radius={6} />
            {/* Chest — wide but rounded; reads as ribcage. */}
            <Box3D w={58} h={30} d={30} y={62} radius={12} />
            {/* Waist — tapered between chest and pelvis. */}
            <Box3D w={44} h={26} d={26} y={32} radius={10} />
            {/* Pelvis. */}
            <Box3D w={46} h={16} d={28} y={6} radius={8} />

            {/* Left arm — shoulder → elbow → forearm + hand. */}
            <Joint
              pivotX={JOINTS.shoulderL.x}
              pivotY={JOINTS.shoulderL.y}
              jointRef={shoulderLRef}
            >
              <Box3D w={14} h={46} d={14} x={0} y={-23} rotZ={6} radius={7} />
              <Joint
                pivotX={JOINTS.elbow.x}
                pivotY={JOINTS.elbow.y}
                jointRef={elbowLRef}
              >
                <Box3D w={12} h={42} d={12} x={-5} y={-19} rotZ={6} radius={6} />
                <Box3D w={11} h={14} d={10} x={-9} y={-47} radius={5} />
              </Joint>
            </Joint>

            {/* Right arm — same as left, plus the sensor module on the bicep. */}
            <Joint
              pivotX={JOINTS.shoulderR.x}
              pivotY={JOINTS.shoulderR.y}
              jointRef={shoulderRRef}
            >
              <Box3D w={14} h={46} d={14} x={0} y={-23} rotZ={-6} radius={7} />
              <Box3D
                w={20}
                h={24}
                d={14}
                x={9}
                y={-21}
                rotZ={-6}
                palette={SENSOR}
                radius={4}
              />
              <div
                style={{
                  position: "absolute",
                  width: 0,
                  height: 0,
                  left: "50%",
                  top: "50%",
                  transformStyle: "preserve-3d",
                  transform: `translate3d(13px, 25px, 7.5px) rotateZ(-6deg)`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: -3,
                    top: -3,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: ACCENT,
                    boxShadow: `0 0 6px ${ACCENT}, 0 0 2px ${ACCENT}`,
                  }}
                />
              </div>
              <Joint
                pivotX={JOINTS.elbow.x}
                pivotY={JOINTS.elbow.y}
                jointRef={elbowRRef}
              >
                <Box3D w={12} h={42} d={12} x={5} y={-19} rotZ={-6} radius={6} />
                <Box3D w={11} h={14} d={10} x={9} y={-47} radius={5} />
              </Joint>
            </Joint>

            {/* Legs — hip → knee → shin + foot. */}
            <Joint
              pivotX={JOINTS.hipL.x}
              pivotY={JOINTS.hipL.y}
              jointRef={hipLRef}
            >
              <Box3D w={20} h={56} d={20} x={0} y={-28} radius={10} />
              <Joint
                pivotX={JOINTS.knee.x}
                pivotY={JOINTS.knee.y}
                jointRef={kneeLRef}
              >
                <Box3D w={17} h={52} d={17} x={0} y={-27} radius={8} />
                <Box3D w={20} h={10} d={28} x={0} y={-58} z={6} radius={5} />
              </Joint>
            </Joint>
            <Joint
              pivotX={JOINTS.hipR.x}
              pivotY={JOINTS.hipR.y}
              jointRef={hipRRef}
            >
              <Box3D w={20} h={56} d={20} x={0} y={-28} radius={10} />
              <Joint
                pivotX={JOINTS.knee.x}
                pivotY={JOINTS.knee.y}
                jointRef={kneeRRef}
              >
                <Box3D w={17} h={52} d={17} x={0} y={-27} radius={8} />
                <Box3D w={20} h={10} d={28} x={0} y={-58} z={6} radius={5} />
              </Joint>
            </Joint>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 16,
          font: `600 10px/1 ${monoFont}`,
          letterSpacing: "0.1em",
          color: "rgba(27,58,92,0.42)",
          textTransform: "uppercase",
        }}
      >
        drag to rotate · scroll to zoom
      </div>
    </div>
  );
}
