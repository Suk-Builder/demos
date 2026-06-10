# Sukačev 视频平台 · 全栈 Monorepo

<div align="center">

**[🇨🇳 中文](#)** | **[🇬🇧 English](#english)** | **[🇩🇪 Deutsch](#deutsch)** | **[🇫🇷 Français](#francais)**

</div>

---

<details open>
<summary><b>🇨🇳 中文</b></summary>

## 项目结构

```
sukaczev-platform/
├── docker-compose.yml        # 全栈一键启动
├── ecosystem.config.js       # PM2进程管理
├── services/                 # 后端 (原sukaczev)
│   ├── api/                  # API网关
│   ├── transcoder/           # FFmpeg转码
│   ├── stream/               # 流媒体
│   ├── p2p/                  # P2P分发
│   └── storage/              # 存储服务
├── web/                      # Web前端 (原sukaczev-web)
│   ├── src/
│   ├── vite.config.ts
│   └── tailwind.config.js
└── mobile/                   # 移动端 (原sukaczev-app)
    ├── src/
    ├── android/
    └── ios/
```

## 快速开始

```bash
docker-compose up -d
cd web && npm i && npm run dev
cd mobile && npm i && npx react-native run-android
```

## 技术栈

| 模块 | 技术 |
|------|------|
| 后端 | Node.js · Express · FFmpeg · WebRTC · P2P |
| Web前端 | TypeScript · React · Vite · TailwindCSS |
| 移动端 | TypeScript · React Native |
| 部署 | Docker · PM2 · docker-compose |

</details>

---n

<details>
<summary><b>🇬🇧 English</b></summary>

<a name="english"></a>

## Project Structure

```
sukaczev-platform/
├── docker-compose.yml        # One-click fullstack start
├── ecosystem.config.js       # PM2 process manager
├── services/                 # Backend (from sukaczev)
│   ├── api/                  # API Gateway
│   ├── transcoder/           # FFmpeg transcoder
│   ├── stream/               # Streaming
│   ├── p2p/                  # P2P distribution
│   └── storage/              # Storage service
├── web/                      # Web Frontend (from sukaczev-web)
│   ├── src/
│   ├── vite.config.ts
│   └── tailwind.config.js
└── mobile/                   # Mobile (from sukaczev-app)
    ├── src/
    ├── android/
    └── ios/
```

## Quick Start

```bash
docker-compose up -d
cd web && npm i && npm run dev
cd mobile && npm i && npx react-native run-android
```

## Tech Stack

| Module | Technology |
|--------|------------|
| Backend | Node.js · Express · FFmpeg · WebRTC · P2P |
| Web Frontend | TypeScript · React · Vite · TailwindCSS |
| Mobile | TypeScript · React Native |
| Deploy | Docker · PM2 · docker-compose |

</details>

---

<details>
<summary><b>🇩🇪 Deutsch</b></summary>

<a name="deutsch"></a>

## Projektstruktur

```
sukaczev-platform/
├── docker-compose.yml        # Ein-Klick-Vollstart
├── ecosystem.config.js       # PM2-Prozessmanager
├── services/                 # Backend (aus sukaczev)
│   ├── api/                  # API-Gateway
│   ├── transcoder/           # FFmpeg-Transcoder
│   ├── stream/               # Streaming
│   ├── p2p/                  # P2P-Verteilung
│   └── storage/              # Speicherdienst
├── web/                      # Web-Frontend (aus sukaczev-web)
│   ├── src/
│   ├── vite.config.ts
│   └── tailwind.config.js
└── mobile/                   # Mobil (aus sukaczev-app)
    ├── src/
    ├── android/
    └── ios/
```

## Schnellstart

```bash
docker-compose up -d
cd web && npm i && npm run dev
cd mobile && npm i && npx react-native run-android
```

## Technologie-Stack

| Modul | Technologie |
|-------|-------------|
| Backend | Node.js · Express · FFmpeg · WebRTC · P2P |
| Web-Frontend | TypeScript · React · Vite · TailwindCSS |
| Mobil | TypeScript · React Native |
| Bereitstellung | Docker · PM2 · docker-compose |

</details>

---

<details>
<summary><b>🇫🇷 Français</b></summary>

<a name="francais"></a>

## Structure du Projet

```
sukaczev-platform/
├── docker-compose.yml        # Démarrage fullstack en un clic
├── ecosystem.config.js       # Gestionnaire de processus PM2
├── services/                 # Backend (de sukaczev)
│   ├── api/                  # Passerelle API
│   ├── transcoder/           # Transcodeur FFmpeg
│   ├── stream/               # Streaming
│   ├── p2p/                  # Distribution P2P
│   └── storage/              # Service de stockage
├── web/                      # Frontend Web (de sukaczev-web)
│   ├── src/
│   ├── vite.config.ts
│   └── tailwind.config.js
└── mobile/                   # Mobile (de sukaczev-app)
    ├── src/
    ├── android/
    └── ios/
```

## Démarrage Rapide

```bash
docker-compose up -d
cd web && npm i && npm run dev
cd mobile && npm i && npx react-native run-android
```

## Stack Technologique

| Module | Technologie |
|--------|-------------|
| Backend | Node.js · Express · FFmpeg · WebRTC · P2P |
| Frontend Web | TypeScript · React · Vite · TailwindCSS |
| Mobile | TypeScript · React Native |
| Déploiement | Docker · PM2 · docker-compose |

</details>
