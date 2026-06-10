using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Collections.Generic;
using UnityEngine;
using HarmonyLib;
using BaseMod;

namespace Unarchived
{
    /// <summary>
    /// 未归档者 Mod 主入口
    /// 负责初始化、Harmony注入、存档管理
    /// </summary>
    public class UnarchivedDLL : MonoBehaviour
    {
        public static UnarchivedDLL Instance;
        public static Harmony harmony;
        
        /// <summary>Mod是否已初始化</summary>
        public static bool Initialized = false;
        
        /// <summary>当前连续接待进度（0=未开始，1-7=第几场）</summary>
        public static int CurrentStageIndex = 0;
        
        /// <summary>已锁定的楼层ID列表</summary>
        public static List<LorId> LockedFloors = new List<LorId>();
        
        /// <summary>已锁定的书页ID列表</summary>
        public static List<LorId> LockedCards = new List<LorId>();
        
        /// <summary>是否处于未归档者连续接待中</summary>
        public static bool IsInUnarchivedRush = false;
        
        /// <summary>7场接待的楼层顺序</summary>
        public static readonly LorId[] StageFloors = new LorId[]
        {
            new LorId(1),   // 历史层 (FloorHistory)
            new LorId(2),   // 科技层 (FloorTechnology)
            new LorId(3),   // 文学层 (FloorLiterature)
            new LorId(4),   // 艺术层 (FloorArt)
            new LorId(5),   // 自然层 (FloorNatural)
            new LorId(6),   // 语言层 (FloorLanguage)
            new LorId(7),   // 社会层 (FloorSocial)
        };
        
        /// <summary>7场接待的Stage ID</summary>
        public static readonly string[] StageIds = new string[]
        {
            "Unarchived_01",
            "Unarchived_02",
            "Unarchived_03",
            "Unarchived_04",
            "Unarchived_05",
            "Unarchived_06",
            "Unarchived_07",
        };
        
        /// <summary>解锁条件：通关社会层后，在哲学层书库触发</summary>
        public static bool IsUnlocked()
        {
            // 检查是否已通关社会层
            var socialFloor = FloorModel.GetFloor(new LorId(7));
            return socialFloor != null && socialFloor.IsCleared;
        }

        void Awake()
        {
            if (Instance != null)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            
            if (!Initialized)
            {
                Initialize();
            }
        }

        /// <summary>初始化Harmony Patch</summary>
        void Initialize()
        {
            try
            {
                harmony = new Harmony("Unarchived.Mod");
                harmony.PatchAll(Assembly.GetExecutingAssembly());
                
                // 加载存档
                LoadSaveData();
                
                Initialized = true;
                Debug.Log("[未归档者] Mod初始化完成");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[未归档者] 初始化失败: {ex}");
            }
        }

        /// <summary>开始未归档者连续接待</summary>
        public static void StartUnarchivedRush()
        {
            if (!IsUnlocked())
            {
                Debug.Log("[未归档者] 未满足解锁条件");
                return;
            }
            
            IsInUnarchivedRush = true;
            CurrentStageIndex = 1;
            LockedFloors.Clear();
            LockedCards.Clear();
            
            // 保存初始状态（用于失败后重置）
            SaveSnapshot();
            
            Debug.Log($"[未归档者] 连续接待开始！第1场：省心孩子");
            
            // 进入第一场
            EnterStage(1);
        }

        /// <summary>进入指定场次</summary>
        public static void EnterStage(int stageIndex)
        {
            if (stageIndex < 1 || stageIndex > 7)
            {
                Debug.LogError($"[未归档者] 无效场次: {stageIndex}");
                return;
            }
            
            CurrentStageIndex = stageIndex;
            
            // 获取可用的楼层（未锁定的）
            var availableFloor = GetAvailableFloorForStage(stageIndex);
            if (availableFloor == null)
            {
                Debug.LogError($"[未归档者] 第{stageIndex}场无可用楼层！");
                return;
            }
            
            // 设置只使用该楼层
            StageController.Instance.SetAvailableFloor(availableFloor);
            
            Debug.Log($"[未归档者] 进入第{stageIndex}场，使用楼层: {availableFloor.Name}");
        }

        /// <summary>获取某场可用的楼层</summary>
        static FloorModel GetAvailableFloorForStage(int stageIndex)
        {
            if (stageIndex < 1 || stageIndex > StageFloors.Length)
                return null;
            
            var floorId = StageFloors[stageIndex - 1];
            var floor = FloorModel.GetFloor(floorId);
            
            // 如果指定楼层已被锁定，这是异常情况
            if (LockedFloors.Contains(floorId))
            {
                Debug.LogError($"[未归档者] 警告：第{stageIndex}场对应楼层 {floorId} 已被锁定！");
            }
            
            return floor;
        }

        /// <summary>当前场次结束后，锁定本场的楼层和书页</summary>
        public static void LockCurrentStage()
        {
            if (CurrentStageIndex < 1 || CurrentStageIndex > 7)
                return;
            
            // 锁定本场的楼层
            var floorId = StageFloors[CurrentStageIndex - 1];
            if (!LockedFloors.Contains(floorId))
            {
                LockedFloors.Add(floorId);
                Debug.Log($"[未归档者] 楼层已锁定: {floorId}");
            }
            
            // 锁定本场使用过的书页
            var battleTeam = BattleRushManager.Instance.GetCurrentBattleTeamModel();
            if (battleTeam != null)
            {
                foreach (var unit in battleTeam.GetUnits())
                {
                    var deck = unit.GetDeck();
                    if (deck != null)
                    {
                        foreach (var card in deck.GetCardList())
                        {
                            if (!LockedCards.Contains(card.GetID()))
                            {
                                LockedCards.Add(card.GetID());
                            }
                        }
                    }
                }
            }
            
            SaveSaveData();
        }

        /// <summary>进入下一场</summary>
        public static void NextStage()
        {
            LockCurrentStage();
            
            if (CurrentStageIndex >= 7)
            {
                // 全部完成
                OnUnarchivedComplete();
                return;
            }
            
            CurrentStageIndex++;
            Debug.Log($"[未归档者] 进入第{CurrentStageIndex}场");
            EnterStage(CurrentStageIndex);
        }

        /// <summary>连续接待全部完成</summary>
        static void OnUnarchivedComplete()
        {
            IsInUnarchivedRush = false;
            Debug.Log("[未归档者] 全部7场接待完成！奖励发放中...");
            
            // 解锁最终奖励：E.G.O「零号书页」
            UnlockReward("Unarchived_Reward_ZeroPage");
            
            // 清除存档
            ClearSaveData();
        }

        /// <summary>连续接待失败（团灭）</summary>
        public static void OnRushFailed()
        {
            IsInUnarchivedRush = false;
            Debug.Log("[未归档者] 连续接待失败。已归档。");
            
            // 恢复初始卡组快照
            RestoreSnapshot();
            
            // 清除进度存档（但不影响已解锁的奖励）
            ClearProgressSave();
        }

        /// <summary>解锁奖励</summary>
        static void UnlockReward(string rewardId)
        {
            // 使用游戏内奖励系统发放
            var book = BookInventoryModel.Instance.GetBookListAll()
                .FirstOrDefault(b => b.BookId == rewardId);
            if (book != null)
            {
                BookInventoryModel.Instance.CreateBook(book.ClassInfo);
                Debug.Log($"[未归档者] 奖励已解锁: {rewardId}");
            }
        }

        #region 存档管理
        
        static string SavePath => Path.Combine(
            Application.persistentDataPath, 
            "Unarchived_Save.json"
        );
        
        static string SnapshotPath => Path.Combine(
            Application.persistentDataPath,
            "Unarchived_Snapshot.json"
        );

        /// <summary>保存当前进度</summary>
        public static void SaveSaveData()
        {
            var data = new UnarchivedSaveData
            {
                CurrentStageIndex = CurrentStageIndex,
                LockedFloorIds = LockedFloors.Select(f => f.ToString()).ToList(),
                LockedCardIds = LockedCards.Select(c => c.ToString()).ToList(),
                IsInProgress = IsInUnarchivedRush
            };
            
            string json = JsonUtility.ToJson(data);
            File.WriteAllText(SavePath, json);
        }

        /// <summary>加载存档</summary>
        static void LoadSaveData()
        {
            if (!File.Exists(SavePath)) return;
            
            try
            {
                string json = File.ReadAllText(SavePath);
                var data = JsonUtility.FromJson<UnarchivedSaveData>(json);
                
                CurrentStageIndex = data.CurrentStageIndex;
                LockedFloors = data.LockedFloorIds
                    .Select(id => new LorId(id))
                    .ToList();
                LockedCards = data.LockedCardIds
                    .Select(id => new LorId(id))
                    .ToList();
                IsInUnarchivedRush = data.IsInProgress;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[未归档者] 读档失败: {ex}");
            }
        }

        /// <summary>清除进度存档</summary>
        static void ClearProgressSave()
        {
            CurrentStageIndex = 0;
            LockedFloors.Clear();
            LockedCards.Clear();
            IsInUnarchivedRush = false;
            
            if (File.Exists(SavePath))
                File.Delete(SavePath);
        }

        /// <summary>清除全部存档</summary>
        static void ClearSaveData()
        {
            ClearProgressSave();
            if (File.Exists(SnapshotPath))
                File.Delete(SnapshotPath);
        }

        /// <summary>保存卡组快照（用于失败后恢复）</summary>
        static void SaveSnapshot()
        {
            var snapshot = new DeckSnapshot();
            // 遍历所有楼层，记录每个司书的卡组
            foreach (var floor in FloorModel.GetFloorList())
            {
                foreach (var unit in floor.GetUnitList())
                {
                    var deck = unit.GetDeck();
                    if (deck != null)
                    {
                        var unitSnapshot = new UnitDeckSnapshot
                        {
                            FloorId = floor.Sephirah.ToString(),
                            UnitId = unit.GetUnitData().id,
                            CardIds = deck.GetCardList()
                                .Select(c => c.GetID().ToString())
                                .ToList()
                        };
                        snapshot.Units.Add(unitSnapshot);
                    }
                }
            }
            
            string json = JsonUtility.ToJson(snapshot);
            File.WriteAllText(SnapshotPath, json);
            Debug.Log("[未归档者] 卡组快照已保存");
        }

        /// <summary>恢复卡组快照</summary>
        static void RestoreSnapshot()
        {
            if (!File.Exists(SnapshotPath))
            {
                Debug.LogWarning("[未归档者] 无快照可恢复");
                return;
            }
            
            try
            {
                string json = File.ReadAllText(SnapshotPath);
                var snapshot = JsonUtility.FromJson<DeckSnapshot>(json);
                
                // 恢复每个司书的卡组
                foreach (var unitSnap in snapshot.Units)
                {
                    var floor = FloorModel.GetFloor(new LorId(unitSnap.FloorId));
                    if (floor == null) continue;
                    
                    var unit = floor.GetUnitList()
                        .FirstOrDefault(u => u.GetUnitData().id == unitSnap.UnitId);
                    if (unit == null) continue;
                    
                    // 清空当前卡组，恢复原始卡组
                    var deck = unit.GetDeck();
                    deck.ClearDeck();
                    
                    foreach (var cardIdStr in unitSnap.CardIds)
                    {
                        var cardId = new LorId(cardIdStr);
                        var cardInfo = ItemXmlDataList.instance.GetCardItem(cardId, false);
                        if (cardInfo != null)
                        {
                            deck.AddCard(cardInfo);
                        }
                    }
                }
                
                Debug.Log("[未归档者] 卡组快照已恢复");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[未归档者] 恢复快照失败: {ex}");
            }
        }

        #endregion
    }

    /// <summary>存档数据结构</summary>
    [Serializable]
    public class UnarchivedSaveData
    {
        public int CurrentStageIndex;
        public List<string> LockedFloorIds = new List<string>();
        public List<string> LockedCardIds = new List<string>();
        public bool IsInProgress;
    }

    /// <summary>卡组快照</summary>
    [Serializable]
    public class DeckSnapshot
    {
        public List<UnitDeckSnapshot> Units = new List<UnitDeckSnapshot>();
    }

    [Serializable]
    public class UnitDeckSnapshot
    {
        public string FloorId;
        public int UnitId;
        public List<string> CardIds = new List<string>();
    }
}
