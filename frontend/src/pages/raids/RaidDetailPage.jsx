import { useState, useEffect, useRef, useMemo, useTransition } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../hooks/useUser";
import { supabase } from "../../lib/supabase";
import { getMyGroups } from '../../api/groups'
import { getUser } from '../../api/users'
import client from '../../api/client'
import { getSlots as _getSlots, addSlot as _addSlot, removeSlot as _removeSlot, deleteRaid as _deleteRaid } from '../../api/raids'

/* ─────────────────────────────────────────────
   난이도 색상 (RaidNewPage와 동일)
   ───────────────────────────────────────────── */
const DIFF_COLORS = {
  노말:       "#22c55e",
  하드:       "#ef4444",
  나이트메어: "#a855f7",
  "1단계":   "#e2e8f0",
  "2단계":   "#f59e0b",
  "3단계":   "#ef4444",
};

/* ─────────────────────────────────────────────
   API 함수
   ───────────────────────────────────────────── */
const API = {
  getRaid: (id) =>
    client.get(`/api/raids/${id}`).then((r) => r.data),
  getSlots: (raidId) =>
    _getSlots(raidId),
  getMyCharacters: (fingerprint) =>
    client.get(`/api/characters/${fingerprint}`).then((r) => r.data),
  addSlot: (raidId, payload) =>
    _addSlot(raidId, payload),
  removeSlot: (slotId) =>
    _removeSlot(slotId),
  deleteRaid: (raidId) =>
    _deleteRaid(raidId),
  updateRaid: (raidId, payload) =>
    client.patch(`/api/raids/${raidId}`, payload)
      .then((r) => r.data)
      .catch((e) => { throw new Error(e.response?.data?.detail || e.message); }),
  getWeeklyUsedSlots: (raidType, weekStart) =>
    client.get(`/api/raids/weekly-used-slots?raid_type=${raidType}&week_start=${encodeURIComponent(weekStart)}`)
      .then((r) => r.data),
  // ── 옵션 B: 로컬 전용 멤버 관리 ──
  // 대표 캐릭터명으로 유저 해석 (LoA API 호출 포함, 검색창 전용)
  resolveUser: (characterName) =>
    client.get('/api/users/resolve', { params: { character_name: characterName } })
      .then((r) => r.data)
      .catch((e) => { throw new Error(e.response?.data?.detail || e.message); }),
  // 대표 캐릭터명 목록으로 캐릭터 일괄 조회 (DB only, 빠름)
  getCharactersByReps: (reps) =>
    client.get('/api/users/characters-by-representatives', { params: { reps: reps.join(',') } })
      .then((r) => r.data),
};

/* ─────────────────────────────────────────────
   주간 초기화 시각 계산 (수요일 오전 6시 KST = 화요일 21:00 UTC)
   ───────────────────────────────────────────── */
function getWeekStart() {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  let daysBack = (day - 2 + 7) % 7;
  if (daysBack === 0 && hour < 21) daysBack = 7;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysBack);
  weekStart.setUTCHours(21, 0, 0, 0);
  return weekStart.toISOString();
}

/* ─────────────────────────────────────────────
   파티 슬롯 계산 유틸
   ───────────────────────────────────────────── */
function buildPartyStructure(maxSlots) {
  const partySize = 4;
  const totalParties = Math.ceil(maxSlots / partySize);
  const parties = [];
  for (let p = 0; p < totalParties; p++) {
    const slotsInThisParty = Math.min(partySize, maxSlots - p * partySize);
    parties.push({
      partyIndex: p,
      slots: Array.from({ length: slotsInThisParty }, (_, i) => ({
        slotOrder: p * partySize + i,
      })),
    });
  }
  return parties;
}

/* ─────────────────────────────────────────────
   레이드별 난이도/최대인원 메타
   ───────────────────────────────────────────── */
const RAID_META = {
  argos:              { difficulties: ["노말"],                        maxSlots: 8,  entryLevel: { 노말: 1370 } },
  valtan:             { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1415, 하드: 1445 } },
  biackiss:           { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1430, 하드: 1460 } },
  koukusaton:         { difficulties: ["노말"],                        maxSlots: 4,  entryLevel: { 노말: 1475 } },
  abrelshud_legion:   { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1490, 하드: 1540 } },
  illiakan:           { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1580, 하드: 1600 } },
  kamen:              { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1610, 하드: 1630 } },
  echidna:            { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1620, 하드: 1640 } },
  egir:               { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1660, 하드: 1680 } },
  abrelshud_kazeroth: { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1670, 하드: 1690 } },
  mordoom:            { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1680, 하드: 1700 } },
  armorche:           { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1700, 하드: 1720 } },
  kazeroth_boss:      { difficulties: ["노말","하드"],                  maxSlots: 8,  entryLevel: { 노말: 1710, 하드: 1730 } },
  behemoth:           { difficulties: ["노말"],                        maxSlots: 16, entryLevel: { 노말: 1640 } },
  serca:              { difficulties: ["노말","하드","나이트메어"],      maxSlots: 4,  entryLevel: { 노말: 1710, 하드: 1730, 나이트메어: 1740 } },
  elvalria:           { difficulties: ["노말"],                        maxSlots: 4,  entryLevel: { 노말: 500 } },
  dream_palace:       { difficulties: ["노말"],                        maxSlots: 4,  entryLevel: { 노말: 635 } },
  ark_arrogance:      { difficulties: ["노말"],                        maxSlots: 4,  entryLevel: { 노말: 805 } },
  gate_paradise:      { difficulties: ["노말"],                        maxSlots: 4,  entryLevel: { 노말: 960 } },
  oreha:              { difficulties: ["노말","하드"],                  maxSlots: 4,  entryLevel: { 노말: 1340, 하드: 1370 } },
  kayangel:           { difficulties: ["노말","하드"],                  maxSlots: 4,  entryLevel: { 노말: 1540, 하드: 1580 } },
  tower_chaos:        { difficulties: ["노말","하드"],                  maxSlots: 4,  entryLevel: { 노말: 1600, 하드: 1620 } },
  cathedral:          { difficulties: ["1단계","2단계","3단계"],         maxSlots: 4,  entryLevel: { "1단계": 1700, "2단계": 1720, "3단계": 1750 } },
};

// raid_id → 표시 이름 매핑
const RAID_NAMES = {
  cathedral: "지평의 성당", serca: "세르카", kazeroth_boss: "종막 : 카제로스",
  armorche: "4막 : 아르모체", mordoom: "3막 : 모르둠",abrelshud_kazeroth: "2막 : 아브렐슈드", 
  egir: "1막 : 에기르", echidna: "서막 : 에키드나", behemoth: "베히모스",
  kamen: "카멘", tower_chaos: "혼돈의 상아탑", illiakan: "일리아칸", 
  kayangel: "카양겔", abrelshud_legion: "아브렐슈드", koukusaton: "쿠크세이튼",
  biackiss: "비아키스", valtan: "발탄", argos: "아르고스",
  oreha: "오레하의 우물", gate_paradise: "낙원의 문",
  ark_arrogance: "오만의 방주", dream_palace: "몽환의 궁전", elvalria: "고대유적 엘베리아",
};

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */
export default function RaidDetailPage() {
  const { id: raidId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { fingerprint } = useUser();

  const [raid, setRaid] = useState(null);

  // ── 슬롯 상태: savedSlots(서버 기준) / pendingSlots(편집 중) ──
  const [savedSlots, setSavedSlots] = useState([]);
  const [pendingSlots, setPendingSlots] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // 저장 안 된 변경사항 여부
  const isDirty = useMemo(() => {
    if (pendingSlots.length !== savedSlots.length) return true;
    return pendingSlots.some(p =>
      !savedSlots.some(s => s.character_id === p.character_id && s.slot_order === p.slot_order)
    );
  }, [pendingSlots, savedSlots]);

  // Realtime 콜백 안에서 stale closure 방지용 ref
  const isDirtyRef = useRef(false);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const [myCharacters, setMyCharacters] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragCharId, setDragCharId] = useState(null);
  const [dragSlotId, setDragSlotId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const columnsRef = useRef(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchState, setSearchState] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [recentMemberReps, setRecentMemberReps] = useState(new Set());
  const [selectedRep, setSelectedRep] = useState(null); // 현재 선택된 원정대
  const [myGroups, setMyGroups] = useState([]);
  const [myRepresentative, setMyRepresentative] = useState(null);
  const [weeklyUsedCharIds, setWeeklyUsedCharIds] = useState(new Set());
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ raid_id: "", difficulty: "", max_slots: 8 });
  const [editSaving, setEditSaving] = useState(false);

  const RECENT_MEMBERS_KEY = 'raid_recent_members_global';
  const RECENT_MEMBERS_MAX = 20; // 최대 보관 수

  // 최근 검색 저장 — 중복 시 맨 앞으로 이동 (LRU 방식)
  const saveRecentMember = (representative) => {
    if (!representative) return;
    try {
      const prev = JSON.parse(localStorage.getItem(RECENT_MEMBERS_KEY) || "[]");
      const updated = [representative, ...prev.filter(r => r !== representative)]
        .slice(0, RECENT_MEMBERS_MAX);
      localStorage.setItem(RECENT_MEMBERS_KEY, JSON.stringify(updated));
    } catch {}
  };

  // 최근 검색 목록 로드
  const loadRecentMembers = () => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_MEMBERS_KEY) || "[]");
    } catch { return []; }
  };

  // 최근 검색에서 제거 (멤버를 명시적으로 삭제할 때)
  const removeRecentMember = (representative) => {
    if (!representative) return;
    try {
      const prev = JSON.parse(localStorage.getItem(RECENT_MEMBERS_KEY) || "[]");
      localStorage.setItem(RECENT_MEMBERS_KEY, JSON.stringify(prev.filter(r => r !== representative)));
    } catch {}
  };

  // isSaving Ref 추가 (상단 state 선언부 근처)
  const isSavingRef = useRef(false);

  /* ── Realtime 구독 ──────────────────────────── */
  useEffect(() => {
    if (!raidId) return;

    // 리얼타임 구독에서 내가 저장 중일 때는 무시
    const slotsChannel = supabase
      .channel(`raid_slots:${raidId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raid_slots", filter: `raid_id=eq.${raidId}` },
        async () => {
          if (isSavingRef.current) return;  // ← 추가: 내가 저장 중이면 무시
          const updatedSlots = await API.getSlots(raidId);
          setSavedSlots(updatedSlots);
          if (!isDirtyRef.current) {
            setPendingSlots(updatedSlots);
          }
        }
      )
      .subscribe();

    const membersChannel = supabase
      .channel(`raid_members:${raidId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raid_members", filter: `raid_id=eq.${raidId}` },
        async () => {
          const updated = await API.getMembers(raidId);
          setMembers(updated);
        }
      )
      .subscribe();

    // raids 테이블 구독: is_completed 등 레이드 정보 변경 시 실시간 반영
    const raidInfoChannel = supabase
      .channel(`raid_info:${raidId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "raids", filter: `id=eq.${raidId}` },
        (payload) => {
          if (payload.new) {
            setRaid((prev) => prev ? { ...prev, ...payload.new } : payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(slotsChannel);
      // supabase.removeChannel(membersChannel);
      supabase.removeChannel(raidInfoChannel);
    };
  }, [raidId]);

  /* ── 초기 데이터 로드 ──────────────────────── */
  useEffect(() => {
    if (!raidId || !fingerprint) return;

    const load = async () => {
      try {
        // navigate state에 freshRaid가 있으면 서버 재조회 생략
        const freshRaid = location.state?.freshRaid;

        const [raidData, slotsData, charsData, groupsData, myUserData] = await Promise.all([
          // freshRaid: getRaid API 생략 (방금 만든 데이터를 다시 가져올 필요 없음)
          freshRaid ? Promise.resolve(freshRaid) : API.getRaid(raidId),
          // freshRaid: 새 레이드는 슬롯이 항상 빈 배열 (API 생략)
          freshRaid ? Promise.resolve([]) : API.getSlots(raidId),
          // fetchQuery: 프리페치 캐시가 있으면 즉시 반환, 없으면 실제 fetch
          queryClient.fetchQuery({
            queryKey: ['characters', fingerprint],
            queryFn: () => API.getMyCharacters(fingerprint),
            staleTime: 1000 * 30,
          }),
          queryClient.fetchQuery({
            queryKey: ['groups', fingerprint],
            queryFn: () => getMyGroups(fingerprint),
            staleTime: 1000 * 60,
          }).catch(() => []),
          queryClient.fetchQuery({
            queryKey: ['user', fingerprint],
            queryFn: () => getUser(fingerprint),
            staleTime: 1000 * 30,
          }).catch(() => null),
        ]);

        setRaid(raidData);
        setSavedSlots(slotsData);
        setPendingSlots(slotsData);
        setMyCharacters(charsData);
        setMyGroups(groupsData);

        const myRep = myUserData?.representative ?? null;
        setMyRepresentative(myRep);

        // ── 규칙3: 그룹 멤버 수집 (내 원정대 제외) ──
        const groupMemberReps = [];
        groupsData.forEach(group => {
          group.members.forEach(m => {
            if (
              m.representative !== myRep &&
              !groupMemberReps.includes(m.representative)
            ) {
              groupMemberReps.push(m.representative);
            }
          });
        });
        
        // ── 규칙2, 3: 최근 검색 (내 원정대 제외) ──
        const recentReps = loadRecentMembers().filter(r => r !== myRep);
        setRecentMemberReps(new Set(recentReps));
        
        // ── 규칙1: 최근 + 그룹 합치기 (중복 제거, 최근 우선) ──
        const allRepsToLoad = [
          ...recentReps,
          ...groupMemberReps.filter(r => !recentReps.includes(r)),
        ];
        
        // ── DB 배치 조회 1번으로 모든 캐릭터 가져오기 ──
        if (allRepsToLoad.length > 0) {
          try {
            const loadedMembers = await API.getCharactersByReps(allRepsToLoad);
            
            // allRepsToLoad 순서 유지 (최근 → 그룹 순)
            const repOrder = new Map(allRepsToLoad.map((r, i) => [r, i]));
            const sorted = [...loadedMembers].sort((a, b) =>
              (repOrder.get(a.representative) ?? 999) - (repOrder.get(b.representative) ?? 999)
          );
          
          setMembers(sorted);
          // 내 원정대 기본 선택, 없으면 첫 번째 멤버
          setSelectedRep(myRep ?? sorted[0]?.representative ?? null);
        } catch {
          setSelectedRep(myRep);
        }
      } else {
        setSelectedRep(myRep);
      }
      
      // 주간 사용 슬롯
      try {
        const weeklySlots = await API.getWeeklyUsedSlots(raidData.raid_id, getWeekStart());
        const usedIds = new Set(
          weeklySlots
          .filter((s) => s.raid_instance_id !== raidId)
          .map((s) => s.character_id)
        );
        setWeeklyUsedCharIds(usedIds);
      } catch {}
      
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    };

    load();
  }, [raidId, fingerprint]);
  
  /* ── 토스트 메시지 ─────────────────────────── */
  const showToast = (msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2500);
  };
  
  /* ── 레이드 정보 수정 저장 ──────────────────── */
  const handleEditSave = async () => {
    setEditSaving(true);
    try {
      const newMeta = RAID_META[editForm.raid_id];
      const updated = await API.updateRaid(raidId, {
        raid_id: editForm.raid_id,
        raid_name: RAID_NAMES[editForm.raid_id] ?? raid.raid_name,
        difficulty: editForm.difficulty,
        max_slots: editForm.max_slots,
      });
    setRaid(updated);
    setEditModal(false);
  } catch (e) {
    showToast(e.message || "수정에 실패했습니다.");
  } finally {
    setEditSaving(false);
  }
};

/* ── 드래그 앤 드롭 핸들러 ─────────────────── */
const onCharDragStart = (e, charId) => {
  setDragCharId(charId);
  setDragSlotId(null);
  e.dataTransfer.effectAllowed = "move";
};

const onSlotDragStart = (e, slotId, charId) => {
  setDragSlotId(slotId);
  setDragCharId(charId);
  e.dataTransfer.effectAllowed = "move";
};

// ── 슬롯 드롭: 빈 슬롯이면 이동, 채워진 슬롯이면 swap ──
const onSlotDrop = (e, targetSlotOrder) => {
  e.preventDefault();
  if (!dragCharId) return;
  
  const existingInTarget = pendingSlots.find((s) => s.slot_order === targetSlotOrder);
  if (dragSlotId && existingInTarget?.id === dragSlotId) return;
  
  const char = allCharacters.find((c) => c.id === dragCharId);
  const now = Date.now();
  
  setPendingSlots((prev) => {
    let next = [...prev];
    
    // 슬롯 → 채워진 슬롯: swap
    if (dragSlotId && existingInTarget) {
      const sourceSlot = next.find((s) => s.id === dragSlotId);
      const sourceOrder = sourceSlot?.slot_order ?? 0;
      next = next.map((s) => {
        if (s.id === dragSlotId)          return { ...s, slot_order: targetSlotOrder, id: `temp-${now}-a` };
        if (s.id === existingInTarget.id) return { ...s, slot_order: sourceOrder,     id: `temp-${now}-b` };
        return s;
      });
    } else {
      // 슬롯 → 빈 슬롯 이동 또는 캐릭터 패널 → 슬롯
      if (dragSlotId)       next = next.filter((s) => s.id !== dragSlotId);
      if (existingInTarget) next = next.filter((s) => s.id !== existingInTarget.id);
      next.push({
        id: `temp-${now}`,
        character_id: dragCharId,
        slot_order: targetSlotOrder,
        character_name: char?.name ?? null,
        class_name: char?.class_name ?? null,
        is_support: char?.is_support ?? null,
        role: null,
        });
      }
      
      return next;
    });
    
    setDragCharId(null);
    setDragSlotId(null);
  };
  
  // ── 슬롯 클릭 제거: API 없이 pendingSlots만 즉시 업데이트 ──
  const onRemoveFromSlot = (slotId) => {
    setPendingSlots((prev) => prev.filter((s) => s.id !== slotId));
  };
  
  /* ── 파티 저장 ──────────────────────────────── */
  const handleSaveSlots = async () => {
    setIsSaving(true);
    isSavingRef.current = true;
    try {
      // 제거할 슬롯: savedSlots에 있지만 pendingSlots에 없는 것
      const toRemove = savedSlots.filter((s) =>
        !pendingSlots.some((p) => p.character_id === s.character_id && p.slot_order === s.slot_order)
      );
      // 추가할 슬롯: pendingSlots에 있지만 savedSlots에 없는 것
      const toAdd = pendingSlots.filter((p) =>
        !savedSlots.some((s) => s.character_id === p.character_id && s.slot_order === p.slot_order)
    );
    
    // 제거 병렬 처리 (temp ID는 서버에 없으므로 실제 ID만)
    await Promise.all(
      toRemove
      .filter((s) => !String(s.id).startsWith("temp-"))
      .map((s) => API.removeSlot(s.id))
    );
    
    // 추가 병렬 처리
    const addedSlots = await Promise.all(
      toAdd.map((p) =>
        API.addSlot(raidId, {
          character_id: p.character_id,
          slot_order: p.slot_order,
          role: p.role ?? null,
          })
        )
      );
      
      // savedSlots 갱신: 제거된 것 빼고 추가된 것 넣기
      const newSaved = [
        ...savedSlots.filter((s) => !toRemove.some((r) => r.id === s.id)),
        ...addedSlots,
      ];
      setSavedSlots(newSaved);
      
      // pendingSlots의 temp ID를 실제 서버 ID로 교체
      setPendingSlots((prev) => {
        const result = [...prev];
        addedSlots.forEach((real) => {
          const idx = result.findIndex(
            (p) => p.character_id === real.character_id && p.slot_order === real.slot_order
          );
          if (idx !== -1) result[idx] = real;
        });
        return result;
      });
      
      navigate("/");
      
    } catch (err) {
      showToast(err.message || "저장에 실패했습니다.");
      // 실패 시 savedSlots로 롤백
      setPendingSlots(savedSlots);
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };
  
  // ── 되돌리기: pendingSlots를 savedSlots로 리셋 ──
  const handleRevertSlots = () => {
    setPendingSlots(savedSlots);
  };
  
  const [, startTransition] = useTransition();

  /* ── 유저 추가 / 제거 ───────────────────────── */
  const handleAddMember = async () => {
    const name = searchInput.trim();
    if (!name) return;
    
    setSearchState("loading");
    setSearchError("");
    
    try {
      // 1. LoA API로 대표 캐릭터명 해석 (어떤 캐릭터명을 입력해도 대표명으로 통일)
      const resolved = await API.resolveUser(name);
      const rep = resolved.representative;
      
      // 2. 본인 확인 (규칙3)
      if (rep === myRepresentative) {
        setSearchError("본인은 추가할 수 없습니다.");
        setSearchState("error");
        return;
      }
      
      // 3. 중복 확인
      if (members.some(m => m.representative === rep)) {
        setSearchError("이미 추가된 원정대입니다.");
        setSearchState("error");
        return;
      }
      
      // 4. DB에서 캐릭터 정보만 가져오기 (DB only, 빠름)
      const results = await API.getCharactersByReps([rep]);
      const newMember = results[0];
      
      if (!newMember) {
        setSearchError("캐릭터 정보를 찾을 수 없습니다.");
        setSearchState("error");
        return;
      }
      
      // 5. 로컬 상태 업데이트 + localStorage 저장
      saveRecentMember(rep);
      setRecentMemberReps(prev => new Set([...prev, rep]));

      // handleAddMember 내부
      setSearchInput("");
      setSearchState("done");
      // 멤버 목록 렌더링은 낮은 우선순위로 처리
      startTransition(() => {
        setMembers(prev => [...prev, newMember]);
        setSelectedRep(rep);
      });
      setTimeout(() => setSearchState(null), 1500);
    } catch (e) {
      setSearchError(e.message || "원정대를 찾을 수 없습니다.");
      setSearchState("error");
    }
  };

  const handleRemoveMember = (userId) => {
    const removedMember = members.find(m => m.user_id === userId);
    if (!removedMember) return;

    // 로컬 상태에서만 제거 (DB 호출 없음)
    setMembers(prev => prev.filter(m => m.user_id !== userId));

    // localStorage에서도 제거 — 다음 접속 시 자동 로드 안 함
    removeRecentMember(removedMember.representative);
    setRecentMemberReps(prev => {
      const next = new Set(prev);
      next.delete(removedMember.representative);
      return next;
    });

    // 제거된 원정대가 선택 중이었으면 내 원정대로 전환
    if (selectedRep === removedMember.representative) {
      const remaining = members.filter(m => m.user_id !== userId);
      setSelectedRep(myRepresentative ?? remaining[0]?.representative ?? null);
    }
  };

  /* ── 유틸 ──────────────────────────────────────
     pendingSlots 기준으로 현재 화면 상태를 계산
  ────────────────────────────────────────────── */
  const allCharacters = [...myCharacters, ...members.flatMap((m) => m.characters)];
  const getCharById  = (charId)    => allCharacters.find((c) => c.id === charId);
  const getSlotAt    = (slotOrder) => pendingSlots.find((s) => s.slot_order === slotOrder);
  const isCharPlaced = (charId)    => pendingSlots.some((s) => s.character_id === charId);

  const isUserAlreadyPlaced = (charId) => {
    const isMyChar = myCharacters.some((c) => c.id === charId);
    if (isMyChar) {
      return myCharacters.some((c) => c.id !== charId && isCharPlaced(c.id));
    }
    for (const member of members) {
      const isMemberChar = member.characters.some((c) => c.id === charId);
      if (isMemberChar) {
        return member.characters.some((c) => c.id !== charId && isCharPlaced(c.id));
      }
    }
    return false;
  };

  const isLevelInsufficient = (charId) => {
    if (!raid) return false;
    const meta = RAID_META[raid.raid_id];
    if (!meta?.entryLevel) return false;
    const required = meta.entryLevel[raid.difficulty];
    if (!required) return false;
    const char = allCharacters.find((c) => c.id === charId);
    if (!char?.item_level) return false;
    return char.item_level < required;
  };

  const isWeeklyUsed = (charId) => weeklyUsedCharIds.has(charId);

  const isDraggable = (charId) =>
    !isCharPlaced(charId) && !isUserAlreadyPlaced(charId) && !isLevelInsufficient(charId) && !isWeeklyUsed(charId);

  /* ── 클릭으로 배치: API 없이 pendingSlots만 업데이트 ── */
  const onCharClick = (charId) => {
    if (isUserAlreadyPlaced(charId)) return;
    if (isLevelInsufficient(charId)) return;
    if (isWeeklyUsed(charId)) return;

    // 제거
    const existingSlot = pendingSlots.find((s) => s.character_id === charId);
    if (existingSlot) {
      setPendingSlots((prev) => prev.filter((s) => s.id !== existingSlot.id));
      return;
    }

    // 배치
    const occupiedOrders = new Set(pendingSlots.map((s) => s.slot_order));
    const totalSlots = raid?.max_slots ?? 0;
    let targetOrder = null;
    for (let i = 0; i < totalSlots; i++) {
      if (!occupiedOrders.has(i)) { targetOrder = i; break; }
    }
    if (targetOrder === null) { showToast("빈 슬롯이 없습니다."); return; }

    const char = allCharacters.find((c) => c.id === charId);
    const tempId = `temp-${Date.now()}`;
    setPendingSlots((prev) => [
      ...prev,
      {
        id: tempId,
        character_id: charId,
        slot_order: targetOrder,
        character_name: char?.name ?? null,
        class_name: char?.class_name ?? null,
        is_support: char?.is_support ?? null,
        role: null,
      },
    ]);
  };

  /* ── 로딩 / 에러 ───────────────────────────── */
  if (loading) {
    return (
      <div style={styles.centerBox}>
        <div style={styles.loadingSpinner} />
        <p style={{ color: "#64748b", marginTop: 16 }}>불러오는 중...</p>
      </div>
    );
  }

  if (error || !raid) {
    return (
      <div style={styles.centerBox}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: "#ef4444", fontWeight: 600 }}>{error || "레이드를 찾을 수 없습니다."}</p>
        <div style={styles.btnBack} onClick={() => navigate("/")}>← 메인으로</div>
      </div>
    );
  }

  const parties = buildPartyStructure(raid.max_slots);
  const diffColor = DIFF_COLORS[raid.difficulty] || "#94a3b8";

  const getGroupNamesForMember = (representative) => {
    return myGroups
      .filter(g => g.members.some(m => m.representative === representative))
      .map(g => g.name);
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toast  { 0%{opacity:0;transform:translateY(8px)} 15%{opacity:1;transform:translateY(0)} 85%{opacity:1} 100%{opacity:0} }
        @keyframes spin   { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(100,116,139,0.3); border-radius:2px; }
        .slot-drop:hover { border-color: rgba(245,158,11,0.4) !important; }
        .member-search-input::placeholder { color: #64748b; }
        .member-search-input:focus { border-color: rgba(245,158,11,0.4) !important; outline: none; }
      `}</style>

      <div style={styles.page}>

        {/* ── 헤더 ──────────────────────────────── */}
        <div style={styles.header}>
          <div style={styles.backBtnWrap}>
            <div style={styles.backBtn} onClick={() => navigate("/")}>← 뒤로</div>
          </div>

          <div style={styles.headerCenter}>
            <div style={styles.raidTitle}>{raid.raid_name}</div>

            <div style={styles.headerBottomRow}>
              <div style={styles.headerInfoRow}>
                <span style={{ ...styles.diffBadge, borderColor: diffColor, color: diffColor }}>
                  {raid.difficulty}
                </span>
                <span style={styles.headerMeta}>·</span>
                <span style={styles.headerMeta}>{raid.max_slots}인 모집</span>
              </div>

              <div style={styles.headerActionRow}>
                {/* 변경사항이 있을 때만 저장/되돌리기 표시, 없으면 아무것도 표시 안 함 */}
                {isDirty && (
                  <>
                    <div
                      style={{ ...styles.saveBtn, opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer" }}
                      onClick={!isSaving ? handleSaveSlots : undefined}
                    >
                      {isSaving ? "저장 중..." : "✓ 저장"}
                    </div>
                    <div
                      style={{ ...styles.editBtn, cursor: "pointer" }}
                      onClick={handleRevertSlots}
                    >
                      되돌리기
                    </div>
                  </>
                )}
                <div
                  style={styles.editBtn}
                  onClick={() => {
                    setEditForm({ raid_id: raid.raid_id, difficulty: raid.difficulty, max_slots: raid.max_slots });
                    setEditModal(true);
                  }}
                >
                  ✏ 수정
                </div>
                <div
                  style={styles.deleteBtn}
                  onClick={async () => {
                    if (!confirm("레이드를 삭제할까요?")) return;
                    await API.deleteRaid(raidId);
                    navigate("/");
                  }}
                >
                  삭제
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 메인 레이아웃 ──────────────────────── */}
        <div style={styles.layout}>

          {/* ── 파티 보드 ────────────────────────── */}
          <div style={styles.boardWrap}>
            <div style={styles.sectionLabel}>파티 구성</div>
            <div style={styles.partiesCol}>
              {parties.map((party) => (
                <div key={party.partyIndex} style={styles.partyBlock}>
                  <div style={styles.partyTitle}>{party.partyIndex + 1}파티</div>
                  <div style={styles.slotsRow}>
                    {party.slots.map(({ slotOrder }) => {
                      const slot = getSlotAt(slotOrder);
                      const char = slot
                        ? (getCharById(slot.character_id) ?? {
                            id: slot.character_id,
                            name: slot.character_name,
                            class_name: slot.class_name,
                            is_support: slot.is_support,
                            item_level: slot.item_level ?? null,
                          })
                        : null;

                      return (
                        <div
                          key={slotOrder}
                          className="slot-drop"
                          style={styles.slotCard(!!slot)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onSlotDrop(e, slotOrder)}
                          onClick={() => slot && onRemoveFromSlot(slot.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            slot && onRemoveFromSlot(slot.id);
                          }}
                          title={slot ? "클릭 또는 우클릭으로 제거" : "캐릭터를 클릭하거나 드래그해서 배치"}
                        >
                          {char ? (
                            <div
                              draggable
                              onDragStart={(e) => onSlotDragStart(e, slot.id, slot.character_id)}
                              style={styles.slotCharInner}
                            >
                              <div style={styles.slotCharName}>{char.name}</div>
                              <div style={styles.slotCharClass}>{char.class_name}</div>
                              <div style={styles.slotCharLevel}>
                                {char.item_level?.toLocaleString()}
                              </div>
                            </div>
                          ) : (
                            <div style={styles.slotEmpty}>
                              <div style={styles.slotEmptyIcon}>+</div>
                              <div style={styles.slotEmptyText}>비어있음</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 캐릭터 패널 ──────────────────────── */}
          <div style={styles.charPanel}>

            {/* 유저 추가 */}
            <div style={styles.addMemberBox}>
              <div style={styles.sectionLabel}>유저 추가</div>
              <div style={styles.searchRow}>
                <input
                  className="member-search-input"
                  style={styles.searchInput}
                  type="text"
                  placeholder="대표 캐릭터명 입력"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setSearchState(null);
                    setSearchError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
                />
                <div
                  style={styles.searchBtn(searchState === "loading")}
                  onClick={handleAddMember}
                >
                  {searchState === "loading" ? "…" : "+"}
                </div>
              </div>
              {searchState === "error" && (
                <div style={styles.searchFeedback("error")}>{searchError}</div>
              )}
              {searchState === "done" && (
                <div style={styles.searchFeedback("done")}>✓ 추가됐습니다</div>
              )}
            </div>

            {/* 힌트 */}
            <div style={styles.charHint}>클릭으로 배치 · 우클릭으로 제거 · 드래그로 위치 조절</div>

            {/* 좌우 패널 레이아웃 */}
            <div style={styles.panelLayout}>

              {/* ── 왼쪽: 원정대 목록 패널 ── */}
              <div style={styles.repListPanel}>
                {/* 내 원정대 */}
                <div
                  style={styles.repItem(selectedRep === myRepresentative)}
                  onClick={() => setSelectedRep(myRepresentative)}
                >
                  <span style={styles.repItemLabel}>내 원정대</span>
                  {myRepresentative && (
                    <span style={styles.repItemSub}>{myRepresentative}</span>
                  )}
                </div>

                {/* 구분선 */}
                {members.filter(m => m.representative !== myRepresentative).length > 0 && (
                  <div style={styles.repDivider} />
                )}

                {/* 멤버 원정대 목록 */}
                {members
                  .filter((m) => m.representative !== myRepresentative)
                  .map((member) => {
                    const groupNames = getGroupNamesForMember(member.representative);
                    const isRecent = recentMemberReps.has(member.representative);
                    const isSelected = selectedRep === member.representative;
                    return (
                      <div
                        key={member.user_id}
                        style={styles.repItem(isSelected)}
                        onClick={() => setSelectedRep(member.representative)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={styles.repItemLabel}>{member.representative}</span>
                          <div
                            style={styles.repRemoveBtn}
                            onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.user_id); }}
                            title="멤버 제거"
                          >✕</div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                          {isRecent && <span style={styles.autoLoadedBadge}>최근</span>}
                          {groupNames.map((name) => (
                            <span key={name} style={styles.groupNameBadge}>{name}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* ── 오른쪽: 선택된 원정대 캐릭터 패널 ── */}
              <div style={styles.charDetailPanel}>
                {(() => {
                  // 선택된 원정대의 캐릭터 목록 결정
                  const isMe = selectedRep === myRepresentative;
                  const chars = isMe
                    ? myCharacters
                    : members.find((m) => m.representative === selectedRep)?.characters ?? [];

                  if (!selectedRep) {
                    return <div style={styles.emptyChars}>원정대를 선택하세요</div>;
                  }

                  return (
                    <>
                      <div style={styles.charDetailHeader}>
                        <span style={styles.charDetailTitle}>
                          {isMe ? "내 원정대" : selectedRep}
                        </span>
                        <span style={styles.charDetailCount}>{chars.length}개 캐릭터</span>
                      </div>
                      <div style={styles.charDetailGrid}>
                        {chars.length === 0 ? (
                          <div style={styles.emptyChars}>캐릭터 없음</div>
                        ) : (
                          chars.map((char) => {
                            const placed = isCharPlaced(char.id);
                            const userPlaced = isUserAlreadyPlaced(char.id);
                            const levelInsufficient = isLevelInsufficient(char.id);
                            const weeklyUsed = isWeeklyUsed(char.id);
                            const draggable = isDraggable(char.id);
                            const disabled = placed || userPlaced || levelInsufficient || weeklyUsed;
                            const titleMsg = placed ? "이미 배치됨"
                              : weeklyUsed ? "이번 주 동일 레이드 다른 난이도에 배치됨"
                              : levelInsufficient
                                ? `입장 레벨 부족 (${RAID_META[raid.raid_id]?.entryLevel?.[raid.difficulty] ?? "?"})`
                              : userPlaced ? "이미 다른 슬롯에 배치됨"
                              : "";
                            return (
                              <div
                                key={char.id}
                                style={styles.charCard(disabled, placed)}
                                title={titleMsg}
                                draggable={draggable}
                                onDragStart={draggable ? () => setDragCharId(char.id) : undefined}
                                onDragEnd={draggable ? () => setDragCharId(null) : undefined}
                                onClick={!disabled ? () => onCharClick(char.id) : undefined}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  // 배치된 캐릭터 우클릭 → 슬롯에서 제거
                                  const slot = pendingSlots.find((s) => s.character_id === char.id);
                                  if (slot) onRemoveFromSlot(slot.id);
                                }}
                              >
                                <div style={styles.charName}>{char.name}</div>
                                <div style={styles.charClass}>{char.class_name ?? "-"}</div>
                                <div style={styles.charLevel}>
                                  {char.item_level ? Number(char.item_level).toLocaleString() : "-"}
                                </div>
                                {placed && <div style={styles.placedBadge}>배치됨</div>}
                                {weeklyUsed && !placed && (
                                  <div style={{ ...styles.placedBadge, color: "#ef4444" }}>주간 사용</div>
                                )}
                                {levelInsufficient && !placed && !weeklyUsed && (
                                  <div style={{ ...styles.placedBadge, color: "#64748b" }}>레벨 부족</div>
                                )}
                                {!placed && !levelInsufficient && !weeklyUsed && userPlaced && (
                                  <div style={{ ...styles.placedBadge, color: "#ef4444" }}>배치 불가</div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* ── 레이드 정보 수정 모달 ────────────── */}
        {editModal && (() => {
          // raid.raid_id(원본) 대신 editForm.raid_id(현재 선택된 레이드) 기준으로 meta 계산
          const meta = RAID_META[editForm.raid_id] || RAID_META[raid.raid_id] || { difficulties: [raid.difficulty], maxSlots: raid.max_slots };
          const diffColor2 = DIFF_COLORS[editForm.difficulty] || "#94a3b8";
          const presets = [];
          for (let n = 4; n <= meta.maxSlots; n += 4) presets.push(n);
          return (
            <div style={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setEditModal(false)}>
              <div style={styles.modalBox}>
                <div style={styles.modalHeader}>
                  <span style={styles.modalTitle}>레이드 정보 수정</span>
                  <span style={styles.modalClose} onClick={() => setEditModal(false)}>✕</span>
                </div>

                <div style={styles.modalSection}>
                  {/* 레이드 종류 선택 섹션 — 난이도 섹션 바로 앞에 삽입 */}
                  <div style={styles.modalSection}>
                    <div style={styles.modalLabel}>레이드 종류</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {Object.entries(RAID_NAMES).map(([id, name]) => (
                        <div
                          key={id}
                          style={{
                            ...styles.modalDiffBtn,
                            fontSize: 11,
                            padding: "5px 12px",
                            borderColor: editForm.raid_id === id ? "#f59e0b" : "rgba(248,250,252,0.1)",
                            color: editForm.raid_id === id ? "#f59e0b" : "#64748b",
                            background: editForm.raid_id === id ? "rgba(245,158,11,0.1)" : "transparent",
                          }}
                          onClick={() => {
                            const newMeta = RAID_META[id] ?? meta;
                            const defaultDiff = newMeta.difficulties[0];
                            const defaultSlots = Math.min(editForm.max_slots, newMeta.maxSlots);
                            setEditForm(f => ({
                              ...f,
                              raid_id: id,
                              difficulty: defaultDiff,
                              max_slots: defaultSlots % 4 === 0 ? defaultSlots : newMeta.maxSlots,
                            }));
                          }}
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={styles.modalLabel}>난이도</div>
                  <div style={styles.modalDiffRow}>
                    {meta.difficulties.map((d) => (
                      <div
                        key={d}
                        style={{
                          ...styles.modalDiffBtn,
                          borderColor: editForm.difficulty === d ? (DIFF_COLORS[d] || "#f59e0b") : "rgba(248,250,252,0.1)",
                          color: editForm.difficulty === d ? (DIFF_COLORS[d] || "#f59e0b") : "#64748b",
                          background: editForm.difficulty === d ? `${DIFF_COLORS[d] || "#f59e0b"}18` : "transparent",
                        }}
                        onClick={() => setEditForm((f) => ({ ...f, difficulty: d }))}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.modalSection}>
                  <div style={styles.modalLabel}>모집 인원</div>
                  <div style={styles.modalSlotRow}>
                    {presets.map((n) => (
                      <div
                        key={n}
                        style={{
                          ...styles.modalSlotBtn,
                          borderColor: editForm.max_slots === n ? "#f59e0b" : "rgba(248,250,252,0.1)",
                          color: editForm.max_slots === n ? "#f59e0b" : "#64748b",
                          background: editForm.max_slots === n ? "rgba(245,158,11,0.1)" : "transparent",
                        }}
                        onClick={() => setEditForm((f) => ({ ...f, max_slots: n }))}
                      >
                        {n}인
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.modalFooter}>
                  <div style={styles.modalCancelBtn} onClick={() => setEditModal(false)}>취소</div>
                  <div
                    style={{ ...styles.modalSaveBtn, opacity: editSaving ? 0.6 : 1, cursor: editSaving ? "not-allowed" : "pointer" }}
                    onClick={!editSaving ? handleEditSave : undefined}
                  >
                    {editSaving ? "저장 중..." : "저장"}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── 토스트 ────────────────────────────── */}
        {toastMsg && (
          <div style={styles.toast}>{toastMsg}</div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   Styles
   ───────────────────────────────────────────── */
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(165deg, #0a0c14 0%, #111827 40%, #0f172a 100%)",
    fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif",
    color: "#e2e8f0",
    padding: "0 0 80px",
  },
  centerBox: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0c14",
    color: "#e2e8f0",
    fontFamily: "'Pretendard', sans-serif",
  },
  loadingSpinner: {
    width: 36,
    height: 36,
    border: "3px solid rgba(245,158,11,0.2)",
    borderTop: "3px solid #f59e0b",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  btnBack: {
    marginTop: 20,
    padding: "10px 24px",
    borderRadius: 10,
    background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(248,250,252,0.1)",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 14,
  },
  header: {
    padding: "20px 0",
    borderBottom: "1px solid rgba(248,250,252,0.06)",
    background: "rgba(15,23,42,0.8)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  backBtnWrap: {
    position: "absolute",
    left: 20,
    top: "50%",
    transform: "translateY(-50%)",
  },
  backBtn: {
    fontSize: 13,
    color: "#64748b",
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(248,250,252,0.06)",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  headerCenter: {
    width: "100%",
    maxWidth: 1400,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "0 32px",
    boxSizing: "border-box",
    minWidth: 0,
  },
  raidTitle: {
    fontSize: 22,
    fontWeight: 800,
    textAlign: "center",
    background: "linear-gradient(135deg, #f59e0b, #f97316)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.02em",
  },
  diffBadge: {
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 20,
    border: "1.5px solid",
    background: "transparent",
  },
  headerMeta: {
    fontSize: 12,
    color: "#94a3b8",
  },
  headerBottomRow: {
    position: "relative",
    width: "100%",
    minHeight: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 0,
  },
  headerActionRow: {
    position: "absolute",
    right: 0,
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  doneBtn: {
    fontSize: 12,
    color: "#0f172a",
    cursor: "pointer",
    padding: "6px 14px",
    borderRadius: 8,
    background: "linear-gradient(135deg, #f59e0b, #f97316)",
    fontWeight: 700,
    transition: "all 0.2s",
  },
  // 파티 저장 버튼 (isDirty일 때 doneBtn 대신 표시)
  saveBtn: {
    fontSize: 12,
    color: "#0f172a",
    cursor: "pointer",
    padding: "6px 14px",
    borderRadius: 8,
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    fontWeight: 700,
    transition: "all 0.2s",
  },
  deleteBtn: {
    fontSize: 12,
    color: "#ef4444",
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(239,68,68,0.2)",
    transition: "all 0.2s",
  },
  layout: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    padding: "24px 32px",
    width: "100%",
    maxWidth: 1400,
    margin: "0 auto",
    boxSizing: "border-box",
  },
  boardWrap: {
    width: "100%",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 14,
  },
  partiesCol: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  partyBlock: {
    background: "rgba(15,23,42,0.6)",
    border: "1px solid rgba(248,250,252,0.06)",
    borderRadius: 14,
    padding: "16px 18px",
    animation: "fadeIn 0.3s ease-out",
  },
  partyTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  slotsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
  },
  slotCard: (filled) => ({
    minHeight: 88,
    borderRadius: 10,
    border: filled
      ? "1.5px solid rgba(245,158,11,0.35)"
      : "1.5px dashed rgba(100,116,139,0.2)",
    background: filled
      ? "rgba(245,158,11,0.06)"
      : "rgba(30,41,59,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: filled ? "grab" : "default",
    transition: "all 0.2s ease",
    position: "relative",
    overflow: "hidden",
  }),
  slotCharInner: {
    width: "100%",
    padding: "10px 10px",
    textAlign: "center",
    userSelect: "none",
  },
  slotCharName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  slotCharClass: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 4,
  },
  slotCharLevel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#f59e0b",
  },
  slotEmpty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    pointerEvents: "none",
  },
  slotEmptyIcon: {
    fontSize: 20,
    color: "rgba(100,116,139,0.3)",
    lineHeight: 1,
  },
  slotEmptyText: {
    fontSize: 10,
    color: "rgba(100,116,139,0.3)",
  },
  charPanel: {
    width: "100%",
  },
  charHint: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 1.5,
  },
  scrollBtn: (side) => ({
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: -22,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.35)",
    color: "#f59e0b",
    fontSize: 22,
    fontWeight: 400,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    cursor: "pointer",
    userSelect: "none",
    transition: "all 0.2s ease",
  }),
  charColumnsRow: {
    display: "flex",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 8,
  },
  // 기존 스타일들 유지하고 아래 추가
  panelLayout: {
    display: "flex",
    gap: 12,
    minHeight: 320,
    maxHeight: 480,
  },
  repListPanel: {
    width: 220,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
    // 스크롤바와 콘텐츠 사이 간격 확보
    paddingRight: 10,
    paddingLeft: 2,
    paddingTop: 4,
    paddingBottom: 4,
  },
  repItem: (selected) => ({
    padding: "10px 12px",
    borderRadius: 10,
    border: selected
      ? "1.5px solid #f59e0b"
      : "1px solid rgba(248,250,252,0.06)",
    background: selected
      ? "rgba(245,158,11,0.08)"
      : "rgba(30,41,59,0.35)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    flexShrink: 0,
  }),
  repItemLabel: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#f1f5f9",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  repItemSub: {
    display: "block",
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  repDivider: {
    height: 1,
    background: "rgba(248,250,252,0.06)",
    margin: "4px 0",
    flexShrink: 0,
  },
  repRemoveBtn: {
    fontSize: 11,
    color: "#64748b",
    cursor: "pointer",
    padding: "1px 4px",
    borderRadius: 4,
    marginLeft: "auto",
    flexShrink: 0,
    transition: "color 0.15s",
  },
  charDetailPanel: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    border: "1px solid rgba(248,250,252,0.08)",
    borderRadius: 14,
    padding: "14px 16px",
    background: "rgba(15,23,42,0.4)",
    overflowY: "auto",
  },
  charDetailHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  charDetailTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  charDetailCount: {
    fontSize: 12,
    color: "#64748b",
  },
  charDetailGrid: {
    display: "grid",
    // 고정 2열 — 이름이 긴 캐릭터도 잘리지 않도록 충분한 너비 확보
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    overflowY: "auto",
  },
  charColumn: {
    width: 220,
    minWidth: 220,
    maxWidth: 220,
    flexShrink: 0,
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(248,250,252,0.06)",
    borderRadius: 12,
    padding: "12px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 680,
    overflowY: "auto",
  },
  charColumnHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(248,250,252,0.06)",
    flexShrink: 0,
    minHeight: 44,
  },
  charCard: (placed, levelInsufficient = false) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: levelInsufficient
      ? "1px solid rgba(100,116,139,0.06)"
      : placed
        ? "1px solid rgba(100,116,139,0.1)"
        : "1px solid rgba(248,250,252,0.08)",
    background: levelInsufficient
      ? "rgba(10,12,20,0.6)"
      : placed
        ? "rgba(15,23,42,0.3)"
        : "rgba(30,41,59,0.5)",
    cursor: (placed || levelInsufficient) ? "default" : "grab",
    opacity: levelInsufficient ? 0.35 : placed ? 0.45 : 1,
    transition: "all 0.2s ease",
    userSelect: "none",
    position: "relative",
    filter: levelInsufficient ? "grayscale(0.6)" : "none",
  }),
  charCardLeft: { flex: 1, minWidth: 0 },
  charName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e2e8f0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  charClass: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  charLevel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#f59e0b",
    flexShrink: 0,
  },
  placedBadge: {
    position: "absolute",
    top: 4,
    right: 6,
    fontSize: 9,
    fontWeight: 700,
    color: "#22c55e",
    letterSpacing: "0.04em",
  },
  addMemberBox: {
    marginBottom: 8,
    padding: "14px 16px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.6)",
    border: "1px solid rgba(248,250,252,0.06)",
    maxWidth: 400,
    minHeight: 90,
  },
  searchRow: { display: "flex", gap: 6 },
  searchInput: {
    flex: 1,
    padding: "8px 10px",
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid rgba(248,250,252,0.08)",
    background: "rgba(30,41,59,0.6)",
    color: "#e2e8f0",
    outline: "none",
    minWidth: 0,
    transition: "border-color 0.2s",
  },
  searchBtn: (isLoading) => ({
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    borderRadius: 8,
    background: isLoading
      ? "rgba(100,116,139,0.2)"
      : "linear-gradient(135deg, #f59e0b, #f97316)",
    color: isLoading ? "#475569" : "#0f172a",
    fontSize: 18,
    fontWeight: 700,
    cursor: isLoading ? "not-allowed" : "pointer",
    flexShrink: 0,
    transition: "all 0.2s",
  }),
  searchFeedback: (type) => ({
    marginTop: 8,
    fontSize: 11,
    fontWeight: 600,
    color: type === "error" ? "#ef4444" : "#22c55e",
  }),
  emptyChars: {
    fontSize: 11,
    color: "#334155",
    padding: "8px 0",
    textAlign: "center",
  },
  autoLoadedBadge: {
    display: "inline-block",
    fontSize: 9,
    fontWeight: 700,
    color: "#22c55e",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.25)",
    borderRadius: 4,
    padding: "1px 5px",
    letterSpacing: "0.03em",
  },
  charGroupLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#f1f5f9",
    letterSpacing: "0.02em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  memberHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  removeMemberBtn: {
    fontSize: 10,
    color: "#475569",
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: 4,
    border: "1px solid rgba(248,250,252,0.06)",
    marginBottom: 6,
    transition: "all 0.2s",
  },
  editBtn: {
    fontSize: 12,
    color: "#94a3b8",
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(248,250,252,0.1)",
    transition: "all 0.2s",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  modalBox: {
    background: "rgba(15,23,42,0.98)",
    border: "1px solid rgba(248,250,252,0.08)",
    borderRadius: 16,
    padding: "28px 28px 24px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  modalClose: {
    fontSize: 18,
    color: "#475569",
    cursor: "pointer",
    lineHeight: 1,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  modalDiffRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  modalDiffBtn: {
    padding: "7px 18px",
    borderRadius: 20,
    border: "1.5px solid",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.18s",
  },
  modalSlotRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  modalSlotBtn: {
    padding: "7px 18px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.18s",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 28,
  },
  modalCancelBtn: {
    padding: "9px 20px",
    borderRadius: 8,
    border: "1px solid rgba(248,250,252,0.1)",
    background: "rgba(30,41,59,0.6)",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  modalSaveBtn: {
    padding: "9px 24px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(135deg, #f59e0b, #f97316)",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 700,
    boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
  },
  toast: {
    position: "fixed",
    bottom: 32,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#ef4444",
    padding: "12px 24px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    animation: "toast 2.5s ease forwards",
    zIndex: 100,
    whiteSpace: "nowrap",
  },
  groupNameBadge: {
    display: "inline-block",
    fontSize: 9,
    fontWeight: 700,
    color: "#818cf8",
    background: "rgba(129,140,248,0.12)",
    border: "1px solid rgba(129,140,248,0.25)",
    borderRadius: 4,
    padding: "1px 5px",
    letterSpacing: "0.03em",
    marginTop: 2,
  },
};