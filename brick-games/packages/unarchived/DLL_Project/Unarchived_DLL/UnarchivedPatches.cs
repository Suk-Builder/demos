using System;
using System.Linq;
using System.Collections.Generic;
using HarmonyLib;
using UnityEngine;
using BaseMod;

namespace Unarchived
{
    /// <summary>
    /// Harmony Patch 集合
    /// 负责：连续接待控制、层阶锁定、禁止返回、书页禁用
    /// </summary>
    public static class UnarchivedPatches
    {
        #region === 1. 连续接待入口 ===

        /// <summary>
        /// 在哲学层书库调查封面为「0」的书时触发未归档者接待
        /// Patch目标: UISephirahFloor.OnClickInventoryBook
        /// </summary>
        [HarmonyPatch(typeof(UISephirahFloor), "OnClickInventoryBook")]
        public static class Patch_InventoryBookClick
        {
            public static bool Prefix(BookModel book)
            {
                // 检查是否是封面为0的特殊书（哲学层触发条件）
                if (book == null || book.ClassInfo == null)
                    return true; // 让原版逻辑执行
                
                // 检查是否是哲学层
                var currentFloor = SephirahInventoryPanel.Instance.SelectedSephirah;
                if (currentFloor != new LorId(8)) // 哲学层 = Floor 8
                    return true;
                
                // 检查是否满足解锁条件
                if (!UnarchivedDLL.IsUnlocked())
                    return true;
                
                // 检查是否已经通关（不可重复进入）
                if (UnarchivedSaveManager.Instance != null 
                    && UnarchivedSaveManager.Instance.HasCompleted)
                    return true;
                
                // 检查是否是封面为0的书（特殊标记）
                // 注意：这里需要在数据文件中设置一本特殊书作为触发物
                if (book.BookId.ToString() == "Unarchived_TriggerBook")
                {
                    Debug.Log("[未归档者] 哲学层封面为0的书被调查，启动连续接待");
                    
                    // 弹出确认对话框
                    UIAlarmPopup.instance.SetAlarmText(
                        "调查封面为「0」的书",
                        "一张来历不明的接待函。" +
                        "\n使用后启动连续接待「未归档者」——" +
                        "\n7场战斗不可中断，不可返回图书馆。" +
                        "\n每一场只能使用指定楼层，使用过的楼层和书页后续将被锁定。" +
                        "\n\n确定要调查吗？",
                        () => {
                            UnarchivedDLL.StartUnarchivedRush();
                        },
                        null,
                        true
                    );
                    
                    return false; // 阻止原版逻辑
                }
                
                return true; // 其他书正常处理
            }
        }

        #endregion

        #region === 2. 连续接待控制 ===

        /// <summary>
        /// Patch: 连续接待结束时（胜/负）决定下一步
        /// Patch目标: BattleRushManager.OnBattleEnd
        /// </summary>
        [HarmonyPatch(typeof(BattleRushManager), "OnBattleEnd")]
        public static class Patch_BattleRushEnd
        {
            public static void Postfix(BattleRushManager __instance, bool isWin)
            {
                // 只在未归档者连续接待中生效
                if (!UnarchivedDLL.IsInUnarchivedRush)
                    return;
                
                if (isWin)
                {
                    Debug.Log($"[未归档者] 第{UnarchivedDLL.CurrentStageIndex}场胜利！");
                    
                    if (UnarchivedDLL.CurrentStageIndex >= 7)
                    {
                        // 全部完成
                        Debug.Log("[未归档者] 全部7场完成！");
                    }
                    else
                    {
                        // 锁定当前场次，准备下一场
                        UnarchivedDLL.LockCurrentStage();
                        
                        // 显示过场提示
                        ShowStageTransition(UnarchivedDLL.CurrentStageIndex + 1);
                    }
                }
                else
                {
                    // 团灭失败
                    Debug.Log("[未归档者] 团灭。已归档。");
                    UnarchivedDLL.OnRushFailed();
                    
                    // 显示失败提示
                    UIAlarmPopup.instance.SetAlarmText(
                        "已归档",
                        "「图书馆并非不存在失败者——」\n" +
                        "「只是失败者的名字，不会出现在任何记录中。」\n\n" +
                        "未归档者连续接待失败。\n" +
                        "已恢复的楼层和书页可以再次使用。",
                        null,
                        null,
                        false
                    );
                }
            }
        }

        /// <summary>显示场次过渡提示</summary>
        static void ShowStageTransition(int nextStage)
        {
            string[] stageNames = {
                "", "省心孩子", "翼的学徒", "董事会",
                "退役实验体", "废墟清道夫", "郊区游荡者", "零的显影"
            };
            
            string[] floorNames = {
                "", "历史层", "科技层", "文学层",
                "艺术层", "自然层", "语言层", "社会层"
            };
            
            string lockedList = string.Join("、", 
                UnarchivedDLL.LockedFloors.Select(f => GetFloorName(f)));
            
            UIAlarmPopup.instance.SetAlarmText(
                $"第{nextStage}场：{stageNames[nextStage]}",
                $"使用楼层：{floorNames[nextStage]}\n" +
                $"已锁定楼层：{lockedList}\n" +
                $"被锁定的书页无法在后续战斗中使用。\n\n" +
                $"下一场无法使用已锁定楼层的司书。",
                null,
                null,
                false
            );
        }

        static string GetFloorName(LorId floorId)
        {
            var floor = FloorModel.GetFloor(floorId);
            return floor?.Name ?? floorId.ToString();
        }

        /// <summary>
        /// Patch: 连续接待中禁止返回图书馆按钮
        /// Patch目标: UIInvenFunctionButton.OnReturnLibrary
        /// </summary>
        [HarmonyPatch(typeof(UIInvenFunctionButton), "OnReturnLibrary")]
        public static class Patch_ReturnLibrary
        {
            public static bool Prefix()
            {
                if (UnarchivedDLL.IsInUnarchivedRush)
                {
                    UIAlarmPopup.instance.SetAlarmText(
                        "无法返回",
                        "「连续接待中，不能返回图书馆。」\n\n" +
                        "要么完成全部7场，要么团灭。",
                        null,
                        null,
                        false
                    );
                    return false; // 阻止返回
                }
                return true;
            }
        }

        /// <summary>
        /// Patch: 连续接待中禁止打开菜单（ESC菜单）
        /// Patch目标: UIControlManager.OnPressESC
        /// </summary>
        [HarmonyPatch(typeof(UIControlManager), "OnPressESC")]
        public static class Patch_ESCPress
        {
            public static bool Prefix()
            {
                if (UnarchivedDLL.IsInUnarchivedRush)
                {
                    // 只允许暂停（P），不允许打开ESC菜单
                    // 这里只拦截ESC，不拦截P
                    return false;
                }
                return true;
            }
        }

        #endregion

        #region === 3. 层阶锁定 — 楼层 ===

        /// <summary>
        /// Patch: 限制可选楼层（只显示当前场次允许的楼层）
        /// Patch目标: UISephirahFloorList.SetAvailableFloors
        /// </summary>
        [HarmonyPatch(typeof(UISephirahFloorList), "SetAvailableFloors")]
        public static class Patch_AvailableFloors
        {
            public static void Postfix(List<SephirahType> floors)
            {
                if (!UnarchivedDLL.IsInUnarchivedRush)
                    return;
                
                // 清除所有可选楼层，只保留当前场次需要的
                floors.Clear();
                
                var currentFloorId = UnarchivedDLL.StageFloors[
                    UnarchivedDLL.CurrentStageIndex - 1
                ];
                
                // 只有当前场次对应的楼层可选
                floors.Add((SephirahType)currentFloorId.id);
                
                Debug.Log($"[未归档者] 锁定楼层：仅允许 {currentFloorId}");
            }
        }

        /// <summary>
        /// Patch: 连续接待中，禁止显示已锁定的楼层UI
        /// Patch目标: UISephirahFloor.SetActive
        /// </summary>
        [HarmonyPatch(typeof(UISephirahFloor), "SetActive")]
        public static class Patch_FloorActive
        {
            public static bool Prefix(UISephirahFloor __instance, bool active)
            {
                if (!UnarchivedDLL.IsInUnarchivedRush)
                    return true;
                
                var floorId = new LorId((int)__instance.Sephirah);
                
                // 已锁定的楼层不可选（置灰）
                if (UnarchivedDLL.LockedFloors.Contains(floorId))
                {
                    __instance.SetGrayOut(true);
                    return false; // 不激活
                }
                
                return true;
            }
        }

        #endregion

        #region === 4. 层阶锁定 — 书页 ===

        /// <summary>
        /// Patch: 禁止将已锁定的书页放入卡组
        /// Patch目标: UICustomizeDeckSlot.OnClickCard
        /// </summary>
        [HarmonyPatch(typeof(UICustomizeDeckSlot), "OnClickCard")]
        public static class Patch_DeckCardClick
        {
            public static bool Prefix(DiceCardItemModel card)
            {
                if (!UnarchivedDLL.IsInUnarchivedRush)
                    return true;
                
                if (card == null)
                    return true;
                
                // 检查书页是否被锁定
                if (UnarchivedDLL.LockedCards.Contains(card.GetID()))
                {
                    UIAlarmPopup.instance.SetAlarmText(
                        "书页已锁定",
                        $"「{card.GetName()}」\n" +
                        "已被先前的楼层使用，无法在当前楼层使用。",
                        null,
                        null,
                        false
                    );
                    return false; // 禁止点击
                }
                
                return true;
            }
        }

        /// <summary>
        /// Patch: 禁用已锁定书页的拖拽
        /// Patch目标: UIOriginCardSlot.OnBeginDrag
        /// </summary>
        [HarmonyPatch(typeof(UIOriginCardSlot), "OnBeginDrag")]
        public static class Patch_CardDrag
        {
            public static bool Prefix(DiceCardItemModel cardModel)
            {
                if (!UnarchivedDLL.IsInUnarchivedRush)
                    return true;
                
                if (cardModel != null 
                    && UnarchivedDLL.LockedCards.Contains(cardModel.GetID()))
                {
                    // 已锁定的书页不可拖拽
                    return false;
                }
                
                return true;
            }
        }

        /// <summary>
        /// Patch: 在UI上显示书页锁定状态（红色边框）
        /// Patch目标: UIOriginCardSlot.SetCard
        /// </summary>
        [HarmonyPatch(typeof(UIOriginCardSlot), "SetCard")]
        public static class Patch_CardSet
        {
            public static void Postfix(UIOriginCardSlot __instance, DiceCardItemModel card)
            {
                if (!UnarchivedDLL.IsInUnarchivedRush)
                    return;
                
                if (card != null 
                    && UnarchivedDLL.LockedCards.Contains(card.GetID()))
                {
                    // 设置红色边框表示锁定
                    __instance.SetColor(Color.red * 0.7f);
                }
            }
        }

        /// <summary>
        /// Patch: 战斗开始时记录本场使用的书页（用于后续锁定）
        /// Patch目标: StageController.StartBattle
        /// </summary>
        [HarmonyPatch(typeof(StageController), "StartBattle")]
        public static class Patch_BattleStart
        {
            public static void Postfix()
            {
                if (!UnarchivedDLL.IsInUnarchivedRush)
                    return;
                
                // 记录本场初始卡组
                RecordCurrentDeck();
            }
        }

        /// <summary>记录当前卡组</summary>
        static void RecordCurrentDeck()
        {
            var battleTeam = BattleRushManager.Instance.GetCurrentBattleTeamModel();
            if (battleTeam == null) return;
            
            foreach (var unit in battleTeam.GetUnits())
            {
                var deck = unit.GetDeck();
                if (deck == null) continue;
                
                foreach (var card in deck.GetCardList())
                {
                    var cardId = card.GetID();
                    if (!UnarchivedDLL.LockedCards.Contains(cardId))
                    {
                        // 记录但不立即锁定——等本场结束才锁定
                        Debug.Log($"[未归档者] 记录书页: {card.GetName()} ({cardId})");
                    }
                }
            }
        }

        #endregion

        #region === 5. 敌方AI增强 ===

        /// <summary>
        /// Patch: 优等生的「劣等」标记（被攻击的司书受到伤害+20%，持续2回合）
        /// Patch目标: BattleUnitModel.OnTakeDamage
        /// </summary>
        [HarmonyPatch(typeof(BattleUnitModel), "OnTakeDamage")]
        public static class Patch_TakeDamage
        {
            public static void Prefix(BattleUnitModel __instance, ref int dmg)
            {
                // 检查是否有"劣等"Buff
                if (__instance.bufListDetail.HasBuf<Unarchived_Buf_StigmaInferior>())
                {
                    // 伤害+20%
                    dmg = Mathf.RoundToInt(dmg * 1.2f);
                }
                
                // 焦躁效果：每死一个队友+15%
                var ownerTeam = __instance.allyTeam ?? __instance.currentDiceAction?.owner?.allyTeam;
                if (ownerTeam != null)
                {
                    int deadCount = ownerTeam.GetDeadUnitsCount();
                    if (deadCount > 0)
                    {
                        float anxietyBonus = 1f + (deadCount * 0.15f);
                        dmg = Mathf.RoundToInt(dmg * anxietyBonus);
                    }
                }
            }
        }

        /// <summary>
        /// Patch: 优等生优先攻击体力最低的司书（优绩筛选AI）
        /// Patch目标: EnemyTeamStageManager.GetTargetUnit
        /// </summary>
        [HarmonyPatch(typeof(EnemyTeamStageManager), "GetTargetUnit")]
        public static class Patch_EnemyTargetAI
        {
            public static bool Prefix(ref BattleUnitModel __result)
            {
                if (!UnarchivedDLL.IsInUnarchivedRush)
                    return true;
                
                // 只在未归档者连续接待中生效
                var currentStage = StageController.Instance.GetCurrentStageClassInfo();
                if (currentStage == null || !currentStage.id.ToString().StartsWith("Unarchived"))
                    return true;
                
                // 检查当前攻击者是否有"优绩筛选"被动
                // 简化实现：一律优先攻击最低体力司书
                var aliveUnits = BattleObjectManager.instance.GetAliveList(true); // true = 友方（司书）
                if (aliveUnits.Count > 0)
                {
                    var lowestHpUnit = aliveUnits
                        .OrderBy(u => u.hp / (float)u.GetMaxHp())
                        .FirstOrDefault();
                    
                    if (lowestHpUnit != null)
                    {
                        __result = lowestHpUnit;
                        return false; // 使用我们的目标
                    }
                }
                
                return true;
            }
        }

        #endregion

        #region === 6. 存档整合 ===

        /// <summary>
        /// Patch: 游戏保存时同时保存未归档者进度
        /// Patch目标: SaveManager.SavePlayData
        /// </summary>
        [HarmonyPatch(typeof(SaveManager), "SavePlayData")]
        public static class Patch_GameSave
        {
            public static void Postfix()
            {
                if (UnarchivedDLL.IsInUnarchivedRush)
                {
                    UnarchivedDLL.SaveSaveData();
                }
            }
        }

        /// <summary>
        /// Patch: 游戏加载时同时加载未归档者进度
        /// Patch目标: SaveManager.LoadPlayData
        /// </summary>
        [HarmonyPatch(typeof(SaveManager), "LoadPlayData")]
        public static class Patch_GameLoad
        {
            public static void Postfix()
            {
                UnarchivedDLL.LoadSaveData();
            }
        }

        #endregion
    }

    /// <summary>
    /// 自定义Buff：劣等（被优绩筛选标记的司书受到伤害+20%，持续2回合）
    /// </summary>
    public class Unarchived_Buf_StigmaInferior : BattleUnitBuf
    {
        protected override string keywordId => "Unarchived_StigmaInferior";
        
        public override void OnRoundEnd()
        {
            base.OnRoundEnd();
            
            // 回合结束减1层
            stack--;
            if (stack <= 0)
            {
                Destroy();
            }
        }
        
        public override void Init(BattleUnitModel owner)
        {
            base.Init(owner);
            stack = 2; // 初始2层（持续2回合）
        }
    }

    /// <summary>
    /// 存档管理器（单例）
    /// </summary>
    public class UnarchivedSaveManager : MonoBehaviour
    {
        public static UnarchivedSaveManager Instance;
        public bool HasCompleted = false;
        
        void Awake()
        {
            if (Instance != null)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
    }
}
