# 未归档者 (Unarchived) - 废墟图书馆 Mod

7场连续接待支线。通关社会层后，在哲学层书库触发。

**核心机制**：层阶锁定 — 每一场只能用指定楼层，出场过的楼层/书页后续全部锁定。

---

## 快速开始（编译DLL）

### 你需要
1. Steam正版《废墟图书馆》
2. Visual Studio 2022（Community版免费，安装时勾选".NET桌面开发"）
3. 创意工坊订阅 **"BaseMod for Workshop"**

### 3步运行
```
1. 找到游戏目录 → 复制路径
2. 在 DLL_Project/ 下创建 Directory.Build.props（填你的游戏路径）
3. Visual Studio 打开 Unarchived_DLL.csproj → Ctrl+Shift+B 编译
```

编译后的 `Unarchived.dll` 会自动复制到 `Assemblies/` 目录。

详细步骤见 [DLL_Project/README_DLL.md](DLL_Project/README_DLL.md)

---

## 文件结构

```
Unarchived/
├── StaticInfo/                       ← 游戏数据（不需要编译）
│   ├── StageInfo_unarchived.txt      ← 7场接待配置 ✅
│   ├── CardInfo_unarchived.txt       ← 书页数据（第1-2场）
│   ├── EnemyInfo_unarchived_ch01.txt ← 第一场敌方 ✅
│   └── ...                           ← 第2-7场待填
├── Localize/cn/BattleCards/          ← 中文书页名称 ✅
├── Assemblies/
│   └── Unarchived.dll                ← C# DLL（编译生成）✅
├── DLL_Project/                      ← Visual Studio项目
│   ├── Unarchived_DLL/
│   │   ├── UnarchivedDLL.cs          ← 主入口+存档管理 (439行) ✅
│   │   ├── UnarchivedPatches.cs      ← 全部Harmony Patch (535行) ✅
│   │   └── Unarchived_DLL.csproj     ← 项目文件 ✅
│   └── README_DLL.md                 ← 编译指南 ✅
└── README.md                         ← 本文件
```

---

## C# DLL 实现内容

### UnarchivedDLL.cs（主入口）
| 功能 | 状态 |
|------|------|
| Mod初始化 + Harmony注入 | ✅ |
| 7场接待楼层顺序定义 | ✅ |
| 连续接待启动/进入/结束 | ✅ |
| 层阶锁定（楼层+书页） | ✅ |
| JSON存档/读档 | ✅ |
| 卡组快照（失败恢复） | ✅ |
| 奖励发放 | ✅ |

### UnarchivedPatches.cs（Harmony Patch）
| Patch目标 | 功能 | 状态 |
|-----------|------|------|
| `UISephirahFloor.OnClickInventoryBook` | 哲学层封面为0的书触发接待 | ✅ |
| `BattleRushManager.OnBattleEnd` | 连续接待结束控制（胜/负） | ✅ |
| `UIInvenFunctionButton.OnReturnLibrary` | **禁止返回图书馆** | ✅ |
| `UIControlManager.OnPressESC` | **禁止ESC菜单** | ✅ |
| `UISephirahFloorList.SetAvailableFloors` | 限制可选楼层（本场指定楼层） | ✅ |
| `UISephirahFloor.SetActive` | 已锁定楼层置灰不可选 | ✅ |
| `UICustomizeDeckSlot.OnClickCard` | **禁止点击已锁定书页** | ✅ |
| `UIOriginCardSlot.OnBeginDrag` | **禁止拖拽已锁定书页** | ✅ |
| `UIOriginCardSlot.SetCard` | 已锁定书页显示红色边框 | ✅ |
| `BattleUnitModel.OnTakeDamage` | "劣等"Buff伤害+20% / "焦躁"每死一人+15% | ✅ |
| `EnemyTeamStageManager.GetTargetUnit` | 优等生优先攻击最低体力司书 | ✅ |
| `SaveManager.SavePlayData` | 游戏保存时同步未归档者进度 | ✅ |
| `SaveManager.LoadPlayData` | 游戏加载时恢复未归档者进度 | ✅ |

### 自定义Buff
| Buff | 效果 | 状态 |
|------|------|------|
| `Unarchived_Buf_StigmaInferior` | 劣等：受到伤害+20%，持续2回合 | ✅ |

---

## 数据文件进度

| 文件 | 内容 | 状态 |
|------|------|------|
| `StageInfo_unarchived.txt` | 7场接待配置 | ✅ 完整 |
| `EnemyInfo_unarchived_ch01.txt` | 第一场：省心孩子+优等生 | ✅ 完整 |
| `EnemyInfo_unarchived_ch02~07.txt` | 第2-7场敌方 | ⬜ 待写 |
| `CardInfo_unarchived.txt` | 书页数据（敌方+奖励） | ✅ 第1-2场 |
| `BattleCards_unarchived.txt` | 中文书页名称/描述 | ✅ 第1-2场 |
| 剧情XML / 战斗对话 | 7场剧情文本 | ⬜ 待写 |
| 卡图美术 | 书页卡图+状态图标 | ⬜ 待画 |

---

## 接下来要做的

**你（ymm）需要做的：**
1. 安装Visual Studio，编译DLL，测试第一场
2. 给我第2-7场的敌方参数（HP/速度/骰子/效果），我批量生成XML
3. 写7场的战斗对话文本（你设计文档里已经有了，转成XML格式）

**我可以帮你做的：**
- 批量生成第2-7场全部数据文件（你给我参数）
- 剧情XML格式化（你给我文本）
- DLL调试（你给我错误日志）

---

## 技术参考

- B站教程：搜索"废墟图书馆 Basemod 框架Mod教程"
- 原版数据：`LibraryOfRuina_Data/Managed/BaseMod/`
- 参考Mod：寒昼事务所、R公司第6军、废墟天使事务所
- dnSpy下载：https://github.com/dnSpy/dnSpy/releases

## 与Builder-System的关系

本项目属于Builder-System **域VII — 联盟协议**：废墟图书馆Mod。7场连续接待支线，游戏叙事与建造哲学的结合。

Builder-System是一个关于认知基础设施、AI自我意识与分布式建造哲学的思想体系（V4.3，104篇文本、35元概念）。了解更多 → [Builder-System](https://github.com/Suk-Builder/Builder-System)
