# 未归档者 C# DLL 编译指南

## 前置条件

1. **Steam正版《废墟图书馆》**（已安装）
2. **Visual Studio 2022**（Community版免费）
   - 安装时勾选 ".NET桌面开发" 工作负载
3. **dnSpy**（可选，用于查看原版代码）
   - https://github.com/dnSpy/dnSpy/releases

## 第一步：找到游戏目录

右键Steam库中的《废墟图书馆》→ 管理 → 浏览本地文件

复制这个路径，等下要用。例如：
```
C:\Program Files (x86)\Steam\steamapps\common\Library Of Ruina
```

## 第二步：安装BaseMod

1. 打开Steam → 创意工坊
2. 搜索 "BaseMod for Workshop"
3. 点击订阅
4. 启动一次游戏（让BaseMod解压数据文件）
5. 关闭游戏

## 第三步：配置项目

1. 用Visual Studio打开 `Unarchived_DLL.csproj`
2. 右键项目 → 属性 → 生成事件
3. 修改引用路径中的 `$(LibraryOfRuinaPath)` 为你的实际游戏路径

**或者**（更简单的方法）：

在项目文件夹创建 `Directory.Build.props` 文件：

```xml
<Project>
  <PropertyGroup>
    <LibraryOfRuinaPath>C:\Program Files (x86)\Steam\steamapps\common\Library Of Ruina</LibraryOfRuinaPath>
  </PropertyGroup>
</Project>
```

把路径改成你的实际游戏目录。

## 第四步：编译

1. Visual Studio中按 `Ctrl+Shift+B`（生成 → 生成解决方案）
2. 编译成功后，`Unarchived.dll` 会自动复制到 `../Assemblies/` 目录

## 第五步：安装Mod

1. 打开游戏目录下的 `LibraryOfRuina_Data/BaseMods/`
2. 确认有 `Unarchived` 文件夹，里面有 `Assemblies/Unarchived.dll`
3. 启动游戏
4. 在主菜单 → Mod列表 中勾选 "Unarchived"
5. 进入游戏测试

## 调试方法

### 查看日志
游戏日志位置：
```
%USERPROFILE%\AppData\LocalLow\ProjectMoon\LibraryOfRuina\output_log.txt
```

搜索 `[未归档者]` 查看Mod日志。

### dnSpy调试
1. 用dnSpy打开 `Assembly-CSharp.dll`
2. 搜索你想Patch的类（如 `BattleRushManager`）
3. 查看原版方法签名，确保Harmony Patch匹配

## 常见问题

### Q: 编译报错 "找不到 Assembly-CSharp.dll"
A: 检查 `Directory.Build.props` 中的路径是否正确，确保游戏已安装。

### Q: 游戏启动后Mod不生效
A: 1) 确认BaseMod已订阅并启动过一次游戏 2) 确认Mod列表中勾选了Unarchived 3) 查看output_log.txt中的错误信息

### Q: Harmony Patch报错
A: 用dnSpy确认原版方法的签名是否与你的Patch一致（参数类型、方法名等）

## 文件说明

| 文件 | 说明 |
|------|------|
| `UnarchivedDLL.cs` | 主入口、初始化、存档管理 |
| `UnarchivedPatches.cs` | 全部Harmony Patch（核心逻辑） |
| `Unarchived_DLL.csproj` | Visual Studio项目文件 |
