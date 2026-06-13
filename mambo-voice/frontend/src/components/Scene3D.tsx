/**
 * ============================================================
 * 曼波语音助手 - 3D场景组件
 * ============================================================
 * 提供完整的3D渲染环境：
 * - 背景：深色渐变 (#1a1a2e → #16213e)
 * - 灯光：暖色主光源 + 冷色补光 + 轮廓光
 * - 地面：微弱反射
 * - 粒子：漂浮光点营造梦幻氛围
 * - 响应式：自动适配不同屏幕尺寸
 */

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  ContactShadows,
} from '@react-three/drei';
import * as THREE from 'three';
import { Scene3DProps } from '../types';

/** 粒子数量 - 控制性能与效果的平衡 */
const PARTICLE_COUNT = 80;

/** 粒子颜色 - 梦幻的暖色光点 */
const PARTICLE_COLORS = ['#FFD6A5', '#FFAAA5', '#FF8FAB', '#CDB4DB', '#A2D2FF'];

/**
 * 背景渐变平面
 * 使用 ShaderMaterial 实现从底部到顶部的平滑渐变
 */
function GradientBackground(): JSX.Element {
  const meshRef = useRef<THREE.Mesh>(null);

  // 使用 useMemo 缓存材质，避免重复创建
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        // 底部颜色：深邃的紫黑色
        uBottomColor: { value: new THREE.Color('#1a1a2e') },
        // 顶部颜色：稍亮的深蓝
        uTopColor: { value: new THREE.Color('#16213e') },
        // 中间过渡颜色：微弱的紫色光晕
        uMidColor: { value: new THREE.Color('#0f3460') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uBottomColor;
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        varying vec2 vUv;
        
        void main() {
          float y = vUv.y;
          vec3 color;
          // 三段式渐变：底部暗 -> 中间微亮 -> 顶部暗
          if (y < 0.5) {
            color = mix(uBottomColor, uMidColor, y * 2.0);
          } else {
            color = mix(uMidColor, uTopColor, (y - 0.5) * 2.0);
          }
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      // 背景总是在最底层
      depthWrite: false,
      depthTest: false,
    });
  }, []);

  return (
    <mesh ref={meshRef} material={material} renderOrder={-999}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/**
 * 地面反射平面
 * 使用 ContactShadows 实现柔和的接触阴影 + 微弱反射效果
 */
function Ground(): JSX.Element {
  return (
    <group position={[0, -1.2, 0]}>
      {/* 接触阴影 - 让角色看起来真的站在地面上 */}
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.4}
        scale={8}
        blur={2.5}
        far={3}
        color="#1a1a3e"
        resolution={512}
      />
      {/* 地面网格 - 微妙的科技感 */}
      <gridHelper
        args={[20, 40, '#2a2a5e', '#1a1a3e']}
        position={[0, 0, 0]}
      />
    </group>
  );
}

/**
 * 漂浮粒子系统
 * 使用 InstancedMesh 高性能渲染大量光点
 */
function FloatingParticles(): JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      temp.push({
        // 随机位置：在角色周围分布
        position: [
          (Math.random() - 0.5) * 8,
          Math.random() * 5 - 0.5,
          (Math.random() - 0.5) * 6,
        ] as [number, number, number],
        // 随机大小
        scale: 0.02 + Math.random() * 0.04,
        // 随机速度
        speed: 0.2 + Math.random() * 0.8,
        // 随机相位
        phase: Math.random() * Math.PI * 2,
        // 随机颜色索引
        colorIndex: Math.floor(Math.random() * PARTICLE_COLORS.length),
      });
    }
    return temp;
  }, []);

  // 粒子颜色数组
  const colors = useMemo(() => {
    const colorArray = new Float32Array(PARTICLE_COUNT * 3);
    particles.forEach((p, i) => {
      const color = new THREE.Color(PARTICLE_COLORS[p.colorIndex]);
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    });
    return colorArray;
  }, [particles]);

  // 每帧更新粒子位置
  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();

    particles.forEach((particle, i) => {
      const { position, scale, speed, phase } = particle;
      // 缓慢上浮 + 左右飘动
      const y =
        ((position[1] + time * speed * 0.15 + phase) % 6) - 1;
      const x = position[0] + Math.sin(time * speed * 0.3 + phase) * 0.3;
      const z = position[2] + Math.cos(time * speed * 0.2 + phase) * 0.2;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale * (0.8 + 0.2 * Math.sin(time * 2 + phase)));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
    >
      <sphereGeometry args={[1, 8, 8]}>
        <instancedBufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </sphereGeometry>
      <meshBasicMaterial vertexColors transparent opacity={0.8} />
    </instancedMesh>
  );
}

/**
 * 场景灯光系统
 * 三光源布光法：主光源(暖色) + 补光(冷色) + 轮廓光
 */
function SceneLighting(): JSX.Element {
  return (
    <>
      {/* 环境光 - 提供基础亮度 */}
      <ambientLight intensity={0.3} color="#4a5568" />

      {/* 主光源 - 暖色方向光，模拟舞台聚光灯 */}
      <directionalLight
        position={[3, 5, 3]}
        intensity={1.2}
        color="#FFE4C4"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={20}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />

      {/* 补光 - 冷色，填充阴影区域 */}
      <directionalLight
        position={[-3, 2, -2]}
        intensity={0.4}
        color="#A2D2FF"
      />

      {/* 轮廓光 - 从背后打光，勾勒角色边缘 */}
      <pointLight
        position={[0, 2, -3]}
        intensity={0.6}
        color="#FF8FAB"
        distance={8}
      />

      {/* 底部微光 - 营造悬浮感 */}
      <pointLight
        position={[0, -1, 1]}
        intensity={0.3}
        color="#CDB4DB"
        distance={5}
      />
    </>
  );
}

/**
 * 光晕效果
 * 角色背后的柔和光晕，增加神圣/梦幻感
 */
function HaloEffect(): JSX.Element {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    // 光晕缓慢呼吸
    const scale = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} position={[0, 0.3, -1.5]}>
      <circleGeometry args={[1.5, 32]} />
      <meshBasicMaterial
        color="#FFD6A5"
        transparent
        opacity={0.08}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * 主场景组件
 * 组合所有场景元素，提供完整的3D渲染环境
 */
export default function Scene3D({ children }: Scene3DProps): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Canvas
        // 相机设置：稍俯视角度
        camera={{
          position: [0, 1.2, 4],
          fov: 45,
          near: 0.1,
          far: 100,
        }}
        // 启用阴影
        shadows
        // 性能优化：按需渲染
        dpr={[1, 2]}
        // 抗锯齿
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        {/* 背景渐变 */}
        <GradientBackground />

        {/* 灯光系统 */}
        <SceneLighting />

        {/* 地面 */}
        <Ground />

        {/* 光晕 */}
        <HaloEffect />

        {/* 漂浮粒子 */}
        <FloatingParticles />

        {/* 角色内容 */}
        {children}

        {/* 轨道控制器 - 允许用户旋转查看 */}
        <OrbitControls
          // 禁止平移
          enablePan={false}
          // 垂直角度限制
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.55}
          // 距离限制
          minDistance={2.5}
          maxDistance={6}
          // 阻尼效果（更平滑）
          enableDamping
          dampingFactor={0.05}
          // 自动旋转（缓慢）
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>
    </div>
  );
}
