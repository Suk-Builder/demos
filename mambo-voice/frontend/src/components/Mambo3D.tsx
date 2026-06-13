/**
 * ============================================================
 * 曼波语音助手 - 3D曼波形象组件
 * ============================================================
 * 核心3D角色组件，功能包括：
 * - 程序化生成的可爱3D角色（球体头部 + 身体 + 四肢）
 * - 6种情绪对应的表情切换（眉毛、眼睛、嘴巴变形）
 * - 3种语音状态的动作切换（idle/listening/speaking）
 * - 鼠标交互：头部跟随鼠标方向转动
 * - 二次元卡通渲染（Cel-shading 风格）
 *
 * 设计特点：
 * - 使用基础几何体组合成Q版角色
 * - ToonMaterial 实现卡通渲染效果
 * - 表情通过缩放和位移实时变形
 * - 所有动画基于数学函数，无需外部模型
 */

import { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { Mambo3DProps, ExpressionParams, Mood, VoiceState } from '../types';
import {
  getAnimationByState,
  getBlinkValue,
  blendAnimations,
  BoneTransform,
} from '../utils/animations';
import {
  getExpressionByMood,
  blendExpressions,
  getMouthOpenByVoiceState,
  getEyeOpenOffsetByVoiceState,
} from '../utils/expressions';

/** ============================================================
 *  卡通材质组件 - Cel-shading 效果
 *  使用梯度纹理实现二次元风格的明暗分界
 *  ============================================================ */
function ToonMaterial({
  color,
  gradientSteps = 3,
}: {
  color: string;
  gradientSteps?: number;
}): JSX.Element {
  // 创建卡通渲染的梯度纹理
  const gradientMap = useMemo(() => {
    const size = 4;
    const data = new Uint8Array(size * size * 4);
    const colorObj = new THREE.Color(color);

    for (let i = 0; i < size * size; i++) {
      // 创建阶梯式明暗变化
      const step = Math.floor((i / (size * size)) * gradientSteps);
      const brightness = 0.5 + (step / gradientSteps) * 0.5;
      data[i * 4] = Math.min(255, colorObj.r * brightness * 255);
      data[i * 4 + 1] = Math.min(255, colorObj.g * brightness * 255);
      data[i * 4 + 2] = Math.min(255, colorObj.b * brightness * 255);
      data[i * 4 + 3] = 255;
    }

    const texture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat
    );
    texture.needsUpdate = true;
    return texture;
  }, [color, gradientSteps]);

  return (
    <meshToonMaterial
      color={color}
      gradientMap={gradientMap}
      side={THREE.FrontSide}
    />
  );
}

/** ============================================================
 *  曼波头部组件 - 包含眼睛、眉毛、嘴巴
 *  支持实时表情变形
 *  ============================================================ */
function MamboHead({
  expression,
  voiceState,
  mouseDirection,
}: {
  expression: ExpressionParams;
  voiceState: VoiceState;
  mouseDirection: THREE.Vector3;
}): JSX.Element {
  const headGroupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const leftEyebrowRef = useRef<THREE.Mesh>(null);
  const rightEyebrowRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const leftCheekRef = useRef<THREE.Mesh>(null);
  const rightCheekRef = useRef<THREE.Mesh>(null);

  // 平滑过渡的表情参数
  const currentExpressionRef = useRef<ExpressionParams>({
    eyebrowLeft: 0,
    eyebrowRight: 0,
    eyeOpenLeft: 1,
    eyeOpenRight: 1,
    mouthOpen: 0,
    mouthSmile: 0.5,
    cheekColor: [1, 0.8, 0.8],
  });

  useFrame((state) => {
    const time = state.clock.elapsedTime * 1000;

    // ====== 1. 头部跟随鼠标（平滑插值） ======
    if (headGroupRef.current) {
      // 限制头部转动角度
      const targetYaw = Math.max(-0.6, Math.min(0.6, mouseDirection.x * 0.8));
      const targetPitch = Math.max(
        -0.4,
        Math.min(0.4, -mouseDirection.y * 0.5)
      );

      // 平滑过渡到目标角度
      headGroupRef.current.rotation.y +=
        (targetYaw - headGroupRef.current.rotation.y) * 0.08;
      headGroupRef.current.rotation.x +=
        (targetPitch - headGroupRef.current.rotation.x) * 0.08;
    }

    // ====== 2. 表情平滑过渡 ======
    const current = currentExpressionRef.current;
    const lerpSpeed = 0.06;

    current.eyebrowLeft += (expression.eyebrowLeft - current.eyebrowLeft) * lerpSpeed;
    current.eyebrowRight += (expression.eyebrowRight - current.eyebrowRight) * lerpSpeed;
    current.eyeOpenLeft += (expression.eyeOpenLeft - current.eyeOpenLeft) * lerpSpeed;
    current.eyeOpenRight += (expression.eyeOpenRight - current.eyeOpenRight) * lerpSpeed;
    current.mouthSmile += (expression.mouthSmile - current.mouthSmile) * lerpSpeed;
    current.cheekColor[0] += (expression.cheekColor[0] - current.cheekColor[0]) * lerpSpeed;
    current.cheekColor[1] += (expression.cheekColor[1] - current.cheekColor[1]) * lerpSpeed;
    current.cheekColor[2] += (expression.cheekColor[2] - current.cheekColor[2]) * lerpSpeed;

    // ====== 3. 嘴型根据语音状态动态变化 ======
    const mouthOpenFromVoice = getMouthOpenByVoiceState(voiceState, time);
    const targetMouthOpen = Math.max(expression.mouthOpen, mouthOpenFromVoice);
    current.mouthOpen += (targetMouthOpen - current.mouthOpen) * lerpSpeed;

    // ====== 4. 眨眼动画 ======
    const blinkValue = getBlinkValue(time);
    const eyeOpenOffset = getEyeOpenOffsetByVoiceState(voiceState);
    const leftEyeScale = Math.max(0.1, (current.eyeOpenLeft + eyeOpenOffset) * blinkValue);
    const rightEyeScale = Math.max(0.1, (current.eyeOpenRight + eyeOpenOffset) * blinkValue);

    // ====== 5. 应用变换 ======

    // 眼睛开合（通过Y轴缩放模拟）
    if (leftEyeRef.current) {
      leftEyeRef.current.scale.y = leftEyeScale;
    }
    if (rightEyeRef.current) {
      rightEyeRef.current.scale.y = rightEyeScale;
    }

    // 眉毛位置（根据表情上下移动 + 旋转）
    if (leftEyebrowRef.current) {
      leftEyebrowRef.current.position.y = 0.42 + current.eyebrowLeft * 0.06;
      leftEyebrowRef.current.rotation.z =
        current.eyebrowLeft * -0.3; // 眉毛倾斜
    }
    if (rightEyebrowRef.current) {
      rightEyebrowRef.current.position.y = 0.42 + current.eyebrowRight * 0.06;
      rightEyebrowRef.current.rotation.z =
        current.eyebrowRight * 0.3;
    }

    // 嘴巴变形（开合 + 微笑/下撇）
    if (mouthRef.current) {
      // 嘴巴开合通过Y轴缩放
      mouthRef.current.scale.y = 0.3 + current.mouthOpen * 0.7;
      // 微笑/下撇通过X轴缩放和Z轴旋转
      const smileScale = 1 + current.mouthSmile * 0.4;
      mouthRef.current.scale.x = smileScale;
      mouthRef.current.rotation.z = current.mouthSmile * 0.15;
    }

    // 腮红颜色
    const cheekColorHex = new THREE.Color(
      current.cheekColor[0],
      current.cheekColor[1],
      current.cheekColor[2]
    );
    if (leftCheekRef.current) {
      (leftCheekRef.current.material as THREE.MeshBasicMaterial).color =
        cheekColorHex;
    }
    if (rightCheekRef.current) {
      (rightCheekRef.current.material as THREE.MeshBasicMaterial).color =
        cheekColorHex;
    }
  });

  return (
    <group ref={headGroupRef} position={[0, 0.75, 0]}>
      {/* ====== 头部主体 - 圆润的球体 ====== */}
      <mesh castShadow>
        <sphereGeometry args={[0.55, 32, 32]} />
        <ToonMaterial color="#FFF8F0" gradientSteps={4} />
      </mesh>

      {/* ====== 头发 - 后发 ====== */}
      <mesh position={[0, 0.25, -0.15]} castShadow>
        <sphereGeometry args={[0.52, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <ToonMaterial color="#2D2D3A" gradientSteps={3} />
      </mesh>

      {/* ====== 头发 - 刘海 ====== */}
      <mesh position={[0, 0.35, 0.25]} rotation={[0.3, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <ToonMaterial color="#2D2D3A" gradientSteps={3} />
      </mesh>

      {/* ====== 头发 - 两侧呆毛 ====== */}
      <mesh position={[-0.3, 0.55, 0.1]} rotation={[0, 0, 0.4]}>
        <capsuleGeometry args={[0.06, 0.2, 8, 16]} />
        <ToonMaterial color="#2D2D3A" gradientSteps={3} />
      </mesh>
      <mesh position={[0.3, 0.55, 0.1]} rotation={[0, 0, -0.4]}>
        <capsuleGeometry args={[0.06, 0.2, 8, 16]} />
        <ToonMaterial color="#2D2D3A" gradientSteps={3} />
      </mesh>

      {/* ====== 呆毛天线 ====== */}
      <mesh position={[0, 0.65, 0]} rotation={[0, 0, Math.sin(0) * 0.1]}>
        <capsuleGeometry args={[0.03, 0.25, 8, 16]} />
        <ToonMaterial color="#FF8FAB" gradientSteps={2} />
      </mesh>

      {/* ====== 左眼 ====== */}
      <group position={[-0.2, 0.08, 0.45]}>
        {/* 眼白 */}
        <mesh ref={leftEyeRef}>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {/* 瞳孔 */}
        <mesh position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.09, 24, 24]} />
          <meshBasicMaterial color="#4A3728" />
        </mesh>
        {/* 高光 */}
        <mesh position={[0.03, 0.04, 0.13]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>

      {/* ====== 右眼 ====== */}
      <group position={[0.2, 0.08, 0.45]}>
        <mesh ref={rightEyeRef}>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <sphereGeometry args={[0.09, 24, 24]} />
          <meshBasicMaterial color="#4A3728" />
        </mesh>
        <mesh position={[0.03, 0.04, 0.13]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>

      {/* ====== 左眉毛 ====== */}
      <mesh
        ref={leftEyebrowRef}
        position={[-0.2, 0.42, 0.48]}
        rotation={[0.1, 0, 0]}
      >
        <capsuleGeometry args={[0.025, 0.14, 8, 16]} />
        <meshBasicMaterial color="#2D2D3A" />
      </mesh>

      {/* ====== 右眉毛 ====== */}
      <mesh
        ref={rightEyebrowRef}
        position={[0.2, 0.42, 0.48]}
        rotation={[0.1, 0, 0]}
      >
        <capsuleGeometry args={[0.025, 0.14, 8, 16]} />
        <meshBasicMaterial color="#2D2D3A" />
      </mesh>

      {/* ====== 嘴巴 ====== */}
      <mesh
        ref={mouthRef}
        position={[0, -0.15, 0.5]}
        rotation={[0.1, 0, 0]}
      >
        <capsuleGeometry args={[0.04, 0.1, 8, 16]} />
        <meshBasicMaterial color="#E8927C" />
      </mesh>

      {/* ====== 左腮红 ====== */}
      <mesh
        ref={leftCheekRef}
        position={[-0.35, -0.05, 0.4]}
      >
        <circleGeometry args={[0.1, 32]} />
        <meshBasicMaterial
          color="#FFAAAA"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ====== 右腮红 ====== */}
      <mesh
        ref={rightCheekRef}
        position={[0.35, -0.05, 0.4]}
      >
        <circleGeometry args={[0.1, 32]} />
        <meshBasicMaterial
          color="#FFAAAA"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** ============================================================
 *  曼波身体组件 - 身体 + 四肢
 *  支持动画骨骼变换
 *  ============================================================ */
function MamboBody({
  boneTransforms,
}: {
  boneTransforms: BoneTransform[];
}): JSX.Element {
  const bodyGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const chestRef = useRef<THREE.Group>(null);

  useFrame(() => {
    // 应用骨骼动画
    boneTransforms.forEach((transform) => {
      const { boneName, rotation, position } = transform;

      switch (boneName) {
        case 'body':
          if (bodyGroupRef.current) {
            bodyGroupRef.current.rotation.x = rotation[0];
            bodyGroupRef.current.rotation.y = rotation[1];
            bodyGroupRef.current.rotation.z = rotation[2];
            bodyGroupRef.current.position.x = position[0];
            bodyGroupRef.current.position.y = position[1];
            bodyGroupRef.current.position.z = position[2];
          }
          break;
        case 'chest':
          if (chestRef.current) {
            chestRef.current.rotation.x = rotation[0];
            chestRef.current.position.y = position[1];
          }
          break;
        case 'leftArm':
          if (leftArmRef.current) {
            leftArmRef.current.rotation.x = rotation[0];
            leftArmRef.current.rotation.y = rotation[1];
            leftArmRef.current.rotation.z = rotation[2];
            leftArmRef.current.position.x = position[0];
          }
          break;
        case 'rightArm':
          if (rightArmRef.current) {
            rightArmRef.current.rotation.x = rotation[0];
            rightArmRef.current.rotation.y = rotation[1];
            rightArmRef.current.rotation.z = rotation[2];
            rightArmRef.current.position.x = position[0];
          }
          break;
        default:
          break;
      }
    });
  });

  return (
    <group ref={bodyGroupRef}>
      {/* 身体主体 */}
      <group ref={chestRef}>
        <mesh position={[0, 0.15, 0]} castShadow>
          <capsuleGeometry args={[0.3, 0.35, 16, 32]} />
          <ToonMaterial color="#FFE4E1" gradientSteps={4} />
        </mesh>

        {/* 衣服领口 */}
        <mesh position={[0, 0.38, 0]}>
          <torusGeometry args={[0.18, 0.04, 16, 32]} />
          <ToonMaterial color="#FF8FAB" gradientSteps={2} />
        </mesh>

        {/* 衣服装饰 - 蝴蝶结 */}
        <mesh position={[0, 0.35, 0.25]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <ToonMaterial color="#FF6B9D" gradientSteps={2} />
        </mesh>
      </group>

      {/* 左手臂 */}
      <group ref={leftArmRef} position={[-0.38, 0.3, 0]}>
        <mesh position={[0, -0.15, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.2, 8, 16]} />
          <ToonMaterial color="#FFF8F0" gradientSteps={3} />
        </mesh>
        {/* 手掌 */}
        <mesh position={[0, -0.32, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <ToonMaterial color="#FFF8F0" gradientSteps={3} />
        </mesh>
      </group>

      {/* 右手臂 */}
      <group ref={rightArmRef} position={[0.38, 0.3, 0]}>
        <mesh position={[0, -0.15, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.2, 8, 16]} />
          <ToonMaterial color="#FFF8F0" gradientSteps={3} />
        </mesh>
        <mesh position={[0, -0.32, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <ToonMaterial color="#FFF8F0" gradientSteps={3} />
        </mesh>
      </group>

      {/* 腿部 */}
      <group position={[0, -0.3, 0]}>
        {/* 左腿 */}
        <mesh position={[-0.12, -0.15, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.2, 8, 16]} />
          <ToonMaterial color="#FFF8F0" gradientSteps={3} />
        </mesh>
        {/* 左鞋 */}
        <mesh position={[-0.12, -0.3, 0.03]}>
          <sphereGeometry args={[0.1, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <ToonMaterial color="#FF8FAB" gradientSteps={2} />
        </mesh>

        {/* 右腿 */}
        <mesh position={[0.12, -0.15, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.2, 8, 16]} />
          <ToonMaterial color="#FFF8F0" gradientSteps={3} />
        </mesh>
        {/* 右鞋 */}
        <mesh position={[0.12, -0.3, 0.03]}>
          <sphereGeometry args={[0.1, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <ToonMaterial color="#FF8FAB" gradientSteps={2} />
        </mesh>
      </group>
    </group>
  );
}

/** ============================================================
 *  曼波光环效果 - 情绪状态指示
 *  根据情绪显示不同颜色的光晕
 *  ============================================================ */
function MoodAura({ mood }: { mood: Mood }): JSX.Element {
  const meshRef = useRef<THREE.Mesh>(null);

  // 情绪对应的颜色
  const moodColors: Record<Mood, string> = {
    happy: '#FFD700',   // 金色
    confused: '#DDA0DD', // 梅红色
    worried: '#87CEEB',  // 天蓝色
    shy: '#FFB6C1',     // 浅粉色
    bored: '#B0C4DE',   // 淡钢蓝
    angry: '#FF6347',   // 番茄红
  };

  const color = moodColors[mood] || moodColors.happy;

  useFrame((state) => {
    if (!meshRef.current) return;
    // 光晕缓慢旋转
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    // 呼吸效果
    const scale = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.03;
    meshRef.current.scale.set(scale, scale, scale);
  });

  return (
    <mesh ref={meshRef} position={[0, 0.2, 0]}>
      <torusGeometry args={[0.8, 0.015, 16, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** ============================================================
 *  语音状态指示器
 *  在角色上方显示当前状态图标
 *  ============================================================ */
function VoiceStateIndicator({
  voiceState,
}: {
  voiceState: VoiceState;
}): JSX.Element | null {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    // 上下浮动
    groupRef.current.position.y =
      1.5 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
  });

  if (voiceState === 'idle') return null;

  return (
    <group ref={groupRef}>
      {voiceState === 'listening' && (
        <>
          {/* 倾听指示器 - 声波形状 */}
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[(i - 1) * 0.12, 0, 0]}
            >
              <capsuleGeometry args={[0.02, 0.06 + i * 0.03, 8, 16]} />
              <meshBasicMaterial
                color="#4ADE80"
                transparent
                opacity={0.8}
              />
            </mesh>
          ))}
        </>
      )}
      {voiceState === 'speaking' && (
        <>
          {/* 说话指示器 - 音符形状 */}
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color="#FBBF24" />
          </mesh>
          <mesh position={[0.02, -0.03, 0]}>
            <boxGeometry args={[0.02, 0.08, 0.02]} />
            <meshBasicMaterial color="#FBBF24" />
          </mesh>
        </>
      )}
    </group>
  );
}

/** ============================================================
 *  曼波3D主组件
 *  组合头部、身体、特效，处理状态逻辑
 *  ============================================================ */
export default function Mambo3D({
  mood,
  voiceState,
  onClick,
}: Mambo3DProps): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);

  // 鼠标方向（用于头部跟随）
  const mouseDirectionRef = useRef(new THREE.Vector3(0, 0, 0));
  // 平滑后的鼠标方向
  const smoothMouseRef = useRef(new THREE.Vector3(0, 0, 0));

  // 表情状态
  const [currentExpression, setCurrentExpression] = useState<ExpressionParams>(
    getExpressionByMood('happy')
  );

  // 动画状态
  const prevTransformsRef = useRef<BoneTransform[]>([]);
  const currentTransformsRef = useRef<BoneTransform[]>([]);
  const transitionRef = useRef({
    isTransitioning: false,
    progress: 0,
    from: [] as BoneTransform[],
    to: [] as BoneTransform[],
  });

  // 设置鼠标指针样式
  useCursor(isHovered);

  // 表情过渡定时器
  const expressionTransitionRef = useRef({
    from: getExpressionByMood('happy'),
    to: getExpressionByMood(mood),
    progress: 1,
    isTransitioning: false,
  });

  /** 处理鼠标移动 - 计算鼠标方向 */
  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    // 将鼠标位置归一化到 [-1, 1]
    mouseDirectionRef.current.set(
      (event.point.x / 4) * 2,
      (event.point.y / 4) * 2,
      0
    );
  }, []);

  /** 处理悬停 */
  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // 主循环
  useFrame((state) => {
    const time = state.clock.elapsedTime * 1000;

    // ====== 1. 平滑鼠标方向 ======
    smoothMouseRef.current.lerp(mouseDirectionRef.current, 0.05);

    // ====== 2. 表情过渡 ======
    const exprTrans = expressionTransitionRef.current;
    if (exprTrans.isTransitioning) {
      exprTrans.progress += 0.03; // 表情过渡速度
      if (exprTrans.progress >= 1) {
        exprTrans.progress = 1;
        exprTrans.isTransitioning = false;
      }
      const blended = blendExpressions(
        exprTrans.from,
        exprTrans.to,
        exprTrans.progress
      );
      setCurrentExpression(blended);
    }

    // ====== 3. 检测情绪变化并启动过渡 ======
    const targetExpression = getExpressionByMood(mood);
    if (
      mood !==
      (
        Object.entries(getExpressionByMood).find(
          ([, v]) => v === exprTrans.to
        ) || ['happy']
      )[0]
    ) {
      exprTrans.from = { ...currentExpression };
      exprTrans.to = targetExpression;
      exprTrans.progress = 0;
      exprTrans.isTransitioning = true;
    }

    // ====== 4. 获取当前动画数据 ======
    const animationConfig = {
      mood,
      voiceState,
      intensity: isHovered ? 1.3 : 1.0, // 悬停时动画更活泼
    };

    const newTransforms = getAnimationByState(animationConfig, time);

    // ====== 5. 检测语音状态变化并启动过渡 ======
    if (
      newTransforms.length > 0 &&
      currentTransformsRef.current.length > 0 &&
      // 简单检测：比较第一个骨骼的旋转
      (Math.abs(
        newTransforms[0].rotation[0] - currentTransformsRef.current[0].rotation[0]
      ) > 0.1 ||
        Math.abs(
          newTransforms[0].rotation[1] -
            currentTransformsRef.current[0].rotation[1]
        ) > 0.1)
    ) {
      transitionRef.current = {
        isTransitioning: true,
        progress: 0,
        from: [...currentTransformsRef.current],
        to: newTransforms,
      };
    }

    currentTransformsRef.current = newTransforms;

    // ====== 6. 动画状态过渡 ======
    const trans = transitionRef.current;
    if (trans.isTransitioning) {
      trans.progress += 0.04; // 动画状态过渡速度
      if (trans.progress >= 1) {
        trans.progress = 1;
        trans.isTransitioning = false;
      }
      prevTransformsRef.current = blendAnimations(
        trans.from,
        trans.to,
        trans.progress
      );
    } else {
      prevTransformsRef.current = newTransforms;
    }

    // ====== 7. 整体浮动效果 ======
    if (groupRef.current) {
      const floatY = Math.sin(time * 0.0015) * 0.015;
      groupRef.current.position.y = floatY;
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* 头部 */}
      <MamboHead
        expression={currentExpression}
        voiceState={voiceState}
        mouseDirection={smoothMouseRef.current}
      />

      {/* 身体 */}
      <MamboBody boneTransforms={prevTransformsRef.current} />

      {/* 情绪光环 */}
      <MoodAura mood={mood} />

      {/* 语音状态指示器 */}
      <VoiceStateIndicator voiceState={voiceState} />
    </group>
  );
}
