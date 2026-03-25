import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "../hooks/useUser";

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
  // 레이드 단일 조회
  getRaid: (id) =>
    fetch(`/api/raids/${id}`).then((r) => {
      if (!r.ok) throw new Error("레이드를 찾을 수 없습니다.");
      return r.json();
    }),

  // 슬롯 목록 조회
  getSlots: (raidId) =>
    fetch(`/api/raids/${raidId}/slots`).then((r) => r.json()),

  // 내 캐릭터 목록 조회
  getMyCharacters: (fingerprint) =>
    fetch(`/api/characters/${fingerprint}`).then((r) => r.json()),

  // 슬롯에 캐릭터 배치
  addSlot: (raidId, payload) =>
    fetch(`/api/raids/${raidId}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => {
      if (!r.ok) return r.json().then((e) => { throw new Error(e.detail); });
      return r.json();
    }),

  // 슬롯에서 캐릭터 제거
  removeSlot: (slotId) =>
    fetch(`/api/raids/slots/${slotId}`, { method: "DELETE" }),
};

/* ─────────────────────────────────────────────
   파티 슬롯 계산 유틸
   ───────────────────────────────────────────── */
// max_slots 기준으로 파티 구조 생성
// 예) max_slots=5 → [{partyIdx:0, slotIdx:0~3}, {partyIdx:1, slotIdx:0}]
function buildPartyStructure(maxSlots) {
  const partySize = 4;
  const totalParties = Math.ceil(maxSlots / partySize);
  const parties = [];

  for (let p = 0; p < totalParties; p++) {
    const slotsInThisParty = Math.min(partySize, maxSlots - p * partySize);
    parties.push({
      partyIndex: p,
      slots: Array.from({ length: slotsInThisParty }, (_, i) => ({
        slotOrder: p * partySize + i, // 전체 슬롯 순서 (0부터)
      })),
    });
  }
  return parties;
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */
export default function RaidDetailPage() {
  const { id: raidId } = useParams();
  const navigate = useNavigate();
  const { fingerprint } = useUser();

  const [raid, setRaid] = useState(null);
  const [slots, setSlots] = useState([]); // [{id, character_id, slot_order, role}]
  const [myCharacters, setMyCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragCharId, setDragCharId] = useState(null); // 드래그 중인 캐릭터 id
  const [dragSlotId, setDragSlotId] = useState(null); // 드래그 중인 슬롯 id (슬롯→슬롯 이동용)
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);

  /* ── 초기 데이터 로드 ──────────────────────── */
  useEffect(() => {
    if (!raidId || !fingerprint) return;

    const load = async () => {
      try {
        const [raidData, slotsData, charsData] = await Promise.all([
          API.getRaid(raidId),
          API.getSlots(raidId),
          API.getMyCharacters(fingerprint),
        ]);
        setRaid(raidData);
        setSlots(slotsData);
        setMyCharacters(charsData);
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

  /* ── 드래그 앤 드롭 핸들러 ─────────────────── */

  // 캐릭터 패널에서 드래그 시작
  const onCharDragStart = (e, charId) => {
    setDragCharId(charId);
    setDragSlotId(null);
    e.dataTransfer.effectAllowed = "move";
  };

  // 슬롯에서 드래그 시작 (이미 배치된 캐릭터를 다른 슬롯으로 이동)
  const onSlotDragStart = (e, slotId, charId) => {
    setDragSlotId(slotId);
    setDragCharId(charId);
    e.dataTransfer.effectAllowed = "move";
  };

  // 슬롯에 드롭
  const onSlotDrop = async (e, targetSlotOrder) => {
    e.preventDefault();

    if (!dragCharId) return;

    // 이미 해당 슬롯에 캐릭터가 있으면 먼저 제거
    const existingInTarget = slots.find((s) => s.slot_order === targetSlotOrder);

    // 같은 슬롯에 드롭하면 무시
    if (dragSlotId && existingInTarget?.id === dragSlotId) return;

    try {
      // 1. 드래그 소스가 슬롯이면 기존 슬롯 제거
      if (dragSlotId) {
        await API.removeSlot(dragSlotId);
        setSlots((prev) => prev.filter((s) => s.id !== dragSlotId));
      }

      // 2. 타겟 슬롯에 이미 캐릭터가 있으면 제거
      if (existingInTarget) {
        await API.removeSlot(existingInTarget.id);
        setSlots((prev) => prev.filter((s) => s.id !== existingInTarget.id));
      }

      // 3. 새 슬롯 배치
      const newSlot = await API.addSlot(raidId, {
        character_id: dragCharId,
        slot_order: targetSlotOrder,
        role: null,
      });
      setSlots((prev) => [...prev, newSlot]);
    } catch (e) {
      showToast(e.message);
    } finally {
      setDragCharId(null);
      setDragSlotId(null);
    }
  };

  // 슬롯에서 캐릭터 제거 (더블클릭)
  const onRemoveFromSlot = async (slotId) => {
    try {
      await API.removeSlot(slotId);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch {
      showToast("슬롯 제거에 실패했습니다.");
    }
  };

  /* ── 유틸 ──────────────────────────────────── */
  const getCharById = (charId) => myCharacters.find((c) => c.id === charId);
  const getSlotAt = (slotOrder) => slots.find((s) => s.slot_order === slotOrder);
  const isCharPlaced = (charId) => slots.some((s) => s.character_id === charId);

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

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toast  { 0%{opacity:0;transform:translateY(8px)} 15%{opacity:1;transform:translateY(0)} 85%{opacity:1} 100%{opacity:0} }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(100,116,139,0.3); border-radius:2px; }
        .slot-drop:hover { border-color: rgba(245,158,11,0.4) !important; }
      `}</style>

      <div style={styles.page}>

        {/* ── 헤더 ──────────────────────────────── */}
        <div style={styles.header}>
          <div style={styles.backBtn} onClick={() => navigate("/")}>← 뒤로</div>
          <div style={styles.headerCenter}>
            <div style={styles.raidTitle}>{raid.raid_name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ ...styles.diffBadge, borderColor: diffColor, color: diffColor }}>
                {raid.difficulty}
              </span>
              <span style={styles.headerMeta}>{raid.max_slots}인 모집</span>
            </div>
          </div>
          <div style={styles.deleteBtnWrap}>
            <div
              style={styles.deleteBtn}
              onClick={async () => {
                if (!confirm("레이드를 삭제할까요?")) return;
                await fetch(`/api/raids/${raidId}`, { method: "DELETE" });
                navigate("/");
              }}
            >
              삭제
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
                      const char = slot ? getCharById(slot.character_id) : null;

                      return (
                        <div
                          key={slotOrder}
                          className="slot-drop"
                          style={styles.slotCard(!!slot)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onSlotDrop(e, slotOrder)}
                          onDoubleClick={() => slot && onRemoveFromSlot(slot.id)}
                          title={slot ? "더블클릭으로 제거" : "캐릭터를 드래그해서 배치"}
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

          {/* ── 내 캐릭터 패널 ───────────────────── */}
          <div style={styles.charPanel}>
            <div style={styles.sectionLabel}>내 캐릭터</div>
            <div style={styles.charHint}>드래그해서 슬롯에 배치 · 더블클릭으로 제거</div>
            <div style={styles.charList}>
              {myCharacters.length === 0 ? (
                <div style={styles.emptyChars}>등록된 캐릭터가 없습니다</div>
              ) : (
                myCharacters.map((char) => {
                  const placed = isCharPlaced(char.id);
                  return (
                    <div
                      key={char.id}
                      draggable={!placed}
                      onDragStart={(e) => !placed && onCharDragStart(e, char.id)}
                      style={styles.charCard(placed)}
                      title={placed ? "이미 배치됨" : "드래그해서 배치"}
                    >
                      <div style={styles.charCardLeft}>
                        <div style={styles.charName}>{char.name}</div>
                        <div style={styles.charClass}>{char.class_name}</div>
                      </div>
                      <div style={styles.charLevel}>
                        {char.item_level?.toLocaleString() ?? "-"}
                      </div>
                      {placed && <div style={styles.placedBadge}>배치됨</div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

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
  // 헤더
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 28px",
    borderBottom: "1px solid rgba(248,250,252,0.06)",
    background: "rgba(15,23,42,0.8)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
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
    textAlign: "center",
    flex: 1,
    padding: "0 16px",
  },
  raidTitle: {
    fontSize: 22,
    fontWeight: 800,
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
    color: "#475569",
  },
  deleteBtnWrap: { display: "flex", justifyContent: "flex-end", minWidth: 60 },
  deleteBtn: {
    fontSize: 12,
    color: "#ef4444",
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid rgba(239,68,68,0.2)",
    transition: "all 0.2s",
  },
  // 레이아웃
  layout: {
    display: "flex",
    gap: 20,
    padding: "24px 28px",
    maxWidth: 1100,
    margin: "0 auto",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  // 파티 보드
  boardWrap: {
    flex: "1 1 560px",
    minWidth: 0,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
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
    color: "#64748b",
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
  // 캐릭터 패널
  charPanel: {
    width: 220,
    flexShrink: 0,
    position: "sticky",
    top: 80,
  },
  charHint: {
    fontSize: 11,
    color: "#334155",
    marginBottom: 12,
    lineHeight: 1.5,
  },
  charList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: "calc(100vh - 200px)",
    overflowY: "auto",
    paddingRight: 2,
  },
  emptyChars: {
    fontSize: 13,
    color: "#334155",
    padding: "20px 0",
    textAlign: "center",
  },
  charCard: (placed) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: placed
      ? "1px solid rgba(100,116,139,0.1)"
      : "1px solid rgba(248,250,252,0.08)",
    background: placed
      ? "rgba(15,23,42,0.3)"
      : "rgba(30,41,59,0.5)",
    cursor: placed ? "default" : "grab",
    opacity: placed ? 0.45 : 1,
    transition: "all 0.2s ease",
    userSelect: "none",
    position: "relative",
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
  // 토스트
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
};