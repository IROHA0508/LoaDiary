import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"
import { useUser } from "../../hooks/useUser";
import { createRaid } from "../../api/raids";

/* ─────────────────────────────────────────────
   카테고리
   ───────────────────────────────────────────── */
const RAID_CATEGORIES = [
  { id: "all",           label: "전체" },
  { id: "legion",        label: "군단장" },
  { id: "kazeroth",      label: "카제로스" },
  { id: "epic",          label: "에픽" },
  { id: "shadow",        label: "그림자" },
  { id: "abyss_raid",    label: "어비스 레이드" },
  { id: "abyss_dungeon", label: "어비스 던전" },
];

const CATEGORY_LABELS = {
  abyss_raid:    "어비스 레이드",
  legion:        "군단장 레이드",
  kazeroth:      "카제로스 레이드",
  epic:          "에픽 레이드",
  shadow:        "그림자 레이드",
  abyss_dungeon: "어비스 던전",
};

/* ─────────────────────────────────────────────
  레이드 데이터 (엑셀 기반)
───────────────────────────────────────────── */
const RAIDS = [
  // ── 최신 레이드부터 오래된 레이드 순으로 정렬 ─────────
  // 카테고리 필터를 적용해도 아래 배열 순서를 그대로 유지한다.

  // ── 어비스 던전 ─────────────────────────────
  // 지평의 성당: 노말/하드가 아닌 1단계/2단계/3단계로 구분
  {
    id: "cathedral", category: "abyss_dungeon",
    name: "지평의 성당", gates: 2, image: "⛪",
    difficulties: ["1단계", "2단계", "3단계"], maxSlots: 4,
    entryLevel: { "1단계": 1700, "2단계": 1720, "3단계": 1750 },
  },

  // ── 그림자 레이드 ───────────────────────────
  // 세르카: 노말 / 하드 / 나이트메어 3단계 난이도
  {
    id: "serca", category: "shadow",
    name: "세르카", gates: 2, image: "🌙",
    difficulties: ["노말", "하드", "나이트메어"], maxSlots: 4,
    entryLevel: { 노말: 1710, 하드: 1730, 나이트메어: 1740 },
  },

  // ── 카제로스 레이드 ─────────────────────────
  {
    id: "kazeroth_boss", category: "kazeroth",
    name: "종막 : 카제로스", gates: 2, image: "🌀",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1710, 하드: 1730 },
  },
  {
    id: "armorche", category: "kazeroth",
    name: "4막 : 아르모체", gates: 2, image: "⚡",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1700, 하드: 1720 },
  },
  {
    id: "mordoom", category: "kazeroth",
    name: "3막 : 모르둠", gates: 3, image: "🕳️",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1680, 하드: 1700 },
  },
  {
    id: "abrelshud_kazeroth", category: "kazeroth",
    name: "2막 : 아브렐슈드", gates: 2, image: "👁️‍🗨️",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1670, 하드: 1690 },
  },
  {
    id: "egir", category: "kazeroth",
    name: "1막 : 에기르", gates: 2, image: "🌊",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1660, 하드: 1680 },
  },
  {
    id: "echidna", category: "kazeroth",
    name: "서막 : 에키드나", gates: 2, image: "🐲",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1620, 하드: 1640 },
  },
  
  // ── 에픽 레이드 ─────────────────────────────
  {
    id: "behemoth", category: "epic",
    name: "베히모스", gates: 2, image: "🦣",
    difficulties: ["노말"], maxSlots: 16,
    entryLevel: { 노말: 1640 },
  },

  // ── 군단장 레이드 ───────────────────────────
  {
    id: "kamen", category: "legion",
    name: "카멘", gates: 4, image: "💀",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1610, 하드: 1630 },
  },

  // ── 어비스 던전 ─────────────────────────────
  {
    id: "tower_chaos", category: "abyss_dungeon",
    name: "혼돈의 상아탑", gates: 2, image: "🗼",
    difficulties: ["노말", "하드"], maxSlots: 4,
    entryLevel: { 노말: 1600, 하드: 1620 },
  },

  // ── 군단장 레이드 ───────────────────────────
  {
    id: "illiakan", category: "legion",
    name: "일리아칸", gates: 3, image: "🌑",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1580, 하드: 1600 },
  },

  // ── 어비스 던전 ─────────────────────────────
  {
    id: "kayangel", category: "abyss_dungeon",
    name: "카양겔", gates: 2, image: "💎",
    difficulties: ["노말", "하드"], maxSlots: 4,
    entryLevel: { 노말: 1540, 하드: 1580 },
  },

  // ── 군단장 레이드 ───────────────────────────
  {
    id: "abrelshud_legion", category: "legion",
    name: "아브렐슈드", gates: 4, image: "👁️",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1490, 하드: 1540 },
    // 관문별 입장 레벨: 노말 1,2관문 1490 / 3관문 1500 / 4관문 1520
    //                   하드 1,2관문 1540 / 3관문 1550 / 4관문 1560
    gateEntryLevels: {
      노말: [1490, 1490, 1500, 1520],
      하드: [1540, 1540, 1550, 1560],
    },
  },
  {
    id: "koukusaton", category: "legion",
    name: "쿠크세이튼", gates: 3, image: "🎭",
    difficulties: ["노말"], maxSlots: 4,
    entryLevel: { 노말: 1475 },
  },
  {
    id: "biackiss", category: "legion",
    name: "비아키스", gates: 2, image: "🐍",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1430, 하드: 1460 },
  },
  {
    id: "valtan", category: "legion",
    name: "발탄", gates: 2, image: "⚔️",
    difficulties: ["노말", "하드"], maxSlots: 8,
    entryLevel: { 노말: 1415, 하드: 1445 },
  },

  // ── 어비스 레이드 ───────────────────────────
  {
    id: "argos", category: "abyss_raid",
    name: "아르고스", gates: 3, image: "🏛️",
    difficulties: ["노말"], maxSlots: 8,
    entryLevel: { 노말: 1370 },
  },

  // ── 어비스 던전 ─────────────────────────────
  {
    id: "oreha", category: "abyss_dungeon",
    name: "오레하의 우물", gates: 2, image: "🔮",
    difficulties: ["노말", "하드"], maxSlots: 4,
    entryLevel: { 노말: 1340, 하드: 1370 },
  },
  {
    id: "gate_paradise", category: "abyss_dungeon",
    name: "낙원의 문", gates: 2, image: "🚪",
    difficulties: ["노말"], maxSlots: 4,
    entryLevel: { 노말: 960 },
  },
  {
    id: "ark_arrogance", category: "abyss_dungeon",
    name: "오만의 방주", gates: 2, image: "⛵",
    difficulties: ["노말"], maxSlots: 4,
    entryLevel: { 노말: 805 },
  },
  {
    id: "dream_palace", category: "abyss_dungeon",
    name: "몽환의 궁전", gates: 2, image: "🏯",
    difficulties: ["노말"], maxSlots: 4,
    entryLevel: { 노말: 635 },
  },
  {
    id: "elvalria", category: "abyss_dungeon",
    name: "고대 유적 엘베리아", gates: 2, image: "🏺",
    difficulties: ["노말"], maxSlots: 4,
    entryLevel: { 노말: 500 },
  },
];

const STEPS = [
  { id: 1, label: "레이드 선택" },
  { id: 2, label: "난이도" },
  { id: 3, label: "인원 설정" },
  { id: 4, label: "확인" },
];

const DIFF_COLORS = {
  노말:        "#22c55e",
  하드:        "#ef4444",
  나이트메어:  "#a855f7",
  "1단계":    "#e2e8f0",
  "2단계":    "#f59e0b",
  "3단계":    "#ef4444",
};

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */
export default function RaidNewPage() {
  const navigate = useNavigate();
  const { fingerprint } = useUser();
  const [step, setStep] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [form, setForm] = useState({
    raidId: "",
    difficulty: "",
    max_slots: 8,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [fadeKey, setFadeKey] = useState(0);

  const selectedRaid = RAIDS.find((r) => r.id === form.raidId);

  useEffect(() => {
    setFadeKey((k) => k + 1);
  }, [step]);

  const canNext = () => {
    if (step === 1) return !!form.raidId;
    if (step === 2) return !!form.difficulty;
    if (step === 3) {
      const max = selectedRaid?.maxSlots ?? 16;
      return form.max_slots >= 1 && form.max_slots <= max;
    }
    return true;
  };

  const next = () => {
    if (!canNext() || step >= 4) return;
    setStep((s) => s + 1);
  };

  const prev = () => {
    if (step <= 1) return;
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const data = await createRaid({
        raid_id: form.raidId,
        raid_name: selectedRaid?.name,
        difficulty: form.difficulty,
        max_slots: form.max_slots,
        created_by: fingerprint,
      });

      navigate(`/raids/${data.id}`);
    } catch (e) {
      const message =
        e.response?.data?.detail ||
        e.message ||
        "레이드 생성 실패";

      setSubmitResult({ ok: false, error: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Styles ──────────────────────────────── */
  const styles = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(165deg, #0a0c14 0%, #111827 40%, #0f172a 100%)",
      fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif",
      color: "#e2e8f0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "40px 16px 80px",
    },
    header: { textAlign: "center", marginBottom: 40 },
    title: {
      fontSize: 28,
      fontWeight: 800,
      background: "linear-gradient(135deg, #f59e0b, #f97316, #ef4444)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      letterSpacing: "-0.02em",
      marginBottom: 6,
    },
    subtitle: { fontSize: 14, color: "#64748b", fontWeight: 400 },
    card: {
      width: "100%",
      maxWidth: 520,
      background: "rgba(15, 23, 42, 0.7)",
      border: "1px solid rgba(248, 250, 252, 0.06)",
      borderRadius: 16,
      backdropFilter: "blur(20px)",
      overflow: "hidden",
    },
    stepper: {
      display: "flex",
      padding: "20px 24px",
      gap: 4,
      borderBottom: "1px solid rgba(248, 250, 252, 0.06)",
    },
    stepDot: (active, done) => ({
      flex: 1,
      height: 3,
      borderRadius: 2,
      background: done
        ? "linear-gradient(90deg, #f59e0b, #f97316)"
        : active
        ? "#f59e0b"
        : "rgba(100, 116, 139, 0.3)",
      transition: "all 0.4s ease",
    }),
    stepLabels: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      padding: "0 24px 16px",
    },
    stepLabel: (active) => ({
      fontSize: 11,
      fontWeight: active ? 600 : 400,
      color: active ? "#f59e0b" : "#475569",
      transition: "all 0.3s ease",
      textAlign: "center",
    }),
    body: { padding: "28px 24px", minHeight: 320 },
    fadeIn: { animation: "fadeSlideIn 0.35s ease-out" },
    sectionTitle: { fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#f1f5f9" },
    sectionDesc: { fontSize: 13, color: "#64748b", marginBottom: 20 },
    footer: {
      display: "flex",
      justifyContent: "space-between",
      padding: "16px 24px 24px",
      gap: 12,
    },
    btnSecondary: {
      padding: "10px 20px",
      fontSize: 13,
      fontWeight: 600,
      borderRadius: 10,
      border: "1px solid rgba(248, 250, 252, 0.1)",
      background: "rgba(30, 41, 59, 0.6)",
      color: "#94a3b8",
      cursor: "pointer",
      transition: "all 0.2s ease",
    },
    btnPrimary: (disabled) => ({
      padding: "10px 20px",
      fontSize: 13,
      fontWeight: 700,
      borderRadius: 10,
      border: "none",
      background: disabled
        ? "rgba(100, 116, 139, 0.2)"
        : "linear-gradient(135deg, #f59e0b, #f97316)",
      color: disabled ? "#475569" : "#0f172a",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.2s ease",
      boxShadow: disabled ? "none" : "0 4px 20px rgba(245, 158, 11, 0.25)",
    }),
    // 카테고리 필터
    categoryBar: {
      display: "flex",
      gap: 6,
      marginBottom: 16,
      overflowX: "auto",
      paddingBottom: 4,
    },
    categoryTab: (active) => ({
      flexShrink: 0,
      padding: "5px 12px",
      fontSize: 12,
      fontWeight: active ? 700 : 500,
      borderRadius: 20,
      border: active ? "1.5px solid #f59e0b" : "1px solid rgba(248,250,252,0.08)",
      background: active ? "rgba(245,158,11,0.1)" : "rgba(30,41,59,0.4)",
      color: active ? "#f59e0b" : "#64748b",
      cursor: "pointer",
      transition: "all 0.2s ease",
      whiteSpace: "nowrap",
    }),
    // 레이드 그리드
    raidGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 8,
      maxHeight: 340,
      overflowY: "auto",
      paddingRight: 2,
    },
    raidCard: (selected) => ({
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 14px",
      borderRadius: 12,
      border: selected ? "1.5px solid #f59e0b" : "1px solid rgba(248,250,252,0.06)",
      background: selected ? "rgba(245,158,11,0.08)" : "rgba(30,41,59,0.4)",
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: selected ? "0 0 20px rgba(245,158,11,0.1)" : "none",
    }),
    raidEmoji: {
      fontSize: 22,
      width: 38,
      height: 38,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(15,23,42,0.6)",
      borderRadius: 8,
      flexShrink: 0,
    },
    raidName: { fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.3 },
    raidMeta: { fontSize: 11, color: "#64748b", marginTop: 3 },
    raidTag: {
      display: "inline-block",
      fontSize: 10,
      fontWeight: 600,
      padding: "1px 6px",
      borderRadius: 4,
      background: "rgba(99,102,241,0.15)",
      color: "#818cf8",
      marginTop: 3,
    },
    // 난이도
    diffGrid: { display: "flex", flexDirection: "column", gap: 10 },
    diffCard: (selected, color) => ({
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "16px 20px",
      borderRadius: 12,
      border: selected ? `1.5px solid ${color}` : "1px solid rgba(248,250,252,0.06)",
      background: selected ? `${color}12` : "rgba(30,41,59,0.4)",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }),
    diffDot: (color) => ({
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 12px ${color}60`,
      flexShrink: 0,
    }),
    diffLabel: { fontSize: 16, fontWeight: 700 },
    diffEntryLevel: { marginLeft: "auto", fontSize: 12, color: "#64748b", fontWeight: 500 },
    // 관문별 입장레벨 박스
    gateBox: {
      marginTop: 16,
      padding: "14px 16px",
      borderRadius: 10,
      background: "rgba(245,158,11,0.06)",
      border: "1px solid rgba(245,158,11,0.15)",
    },
    gateBoxTitle: { fontSize: 11, color: "#f59e0b", fontWeight: 600, marginBottom: 10 },
    gateGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 6,
    },
    gateItem: {
      textAlign: "center",
      padding: "8px 4px",
      borderRadius: 8,
      background: "rgba(15,23,42,0.6)",
    },
    gateNum: { fontSize: 11, color: "#64748b", marginBottom: 4 },
    gateLevel: { fontSize: 13, fontWeight: 700, color: "#f1f5f9" },
    // 인원 설정
    slotContainer: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 24,
    },
    slotDisplay: {
      fontSize: 64,
      fontWeight: 800,
      background: "linear-gradient(135deg, #f59e0b, #f97316)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      lineHeight: 1,
    },
    slotUnit: { fontSize: 14, color: "#64748b", marginTop: 4 },
    slotBtns: { display: "flex", gap: 8 },
    slotBtn: (active) => ({
      padding: "10px 24px",
      fontSize: 14,
      fontWeight: 600,
      borderRadius: 10,
      border: active ? "1.5px solid #f59e0b" : "1px solid rgba(248,250,252,0.1)",
      background: active ? "rgba(245,158,11,0.1)" : "rgba(30,41,59,0.4)",
      color: active ? "#f59e0b" : "#94a3b8",
      cursor: "pointer",
      transition: "all 0.2s ease",
    }),
    // 파티 미리보기
    partyPreview: {
      marginTop: 24,
      padding: "14px 16px",
      borderRadius: 12,
      background: "rgba(15,23,42,0.5)",
      border: "1px solid rgba(248,250,252,0.06)",
    },
    partyPreviewTitle: {
      fontSize: 11,
      fontWeight: 600,
      color: "#475569",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      marginBottom: 12,
    },
    partyList: { display: "flex", flexDirection: "column", gap: 8 },
    partyRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    partyLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: "#64748b",
      width: 36,
      flexShrink: 0,
    },
    partySlots: { display: "flex", gap: 4, flex: 1 },
    partySlot: (filled) => ({
      width: 32,
      height: 32,
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 14,
      background: filled ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.5)",
      border: filled
        ? "1px solid rgba(245,158,11,0.3)"
        : "1px dashed rgba(100,116,139,0.2)",
      transition: "all 0.2s ease",
    }),
    partyCount: { fontSize: 12, color: "#94a3b8", width: 42, textAlign: "right", flexShrink: 0 },
    // 리뷰
    reviewList: { display: "flex", flexDirection: "column", gap: 10 },
    reviewRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 18px",
      borderRadius: 12,
      background: "rgba(30,41,59,0.5)",
      border: "1px solid rgba(248,250,252,0.04)",
    },
    reviewLabel: { fontSize: 13, color: "#64748b", fontWeight: 500 },
    reviewValue: { fontSize: 15, fontWeight: 700, color: "#f1f5f9" },
    // 관문 레벨 리뷰
    reviewGateGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 6,
      marginTop: 10,
    },
    reviewGateItem: {
      textAlign: "center",
      padding: "8px 4px",
      borderRadius: 8,
      background: "rgba(15,23,42,0.5)",
      border: "1px solid rgba(248,250,252,0.04)",
    },
    // 결과
    resultBox: {
      textAlign: "center",
      padding: "40px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
    },
    resultIcon: { fontSize: 48, marginBottom: 8 },
    resultTitle: { fontSize: 20, fontWeight: 700, color: "#f1f5f9" },
    resultDesc: { fontSize: 14, color: "#64748b" },
  };

  /* ── Step 1: 레이드 선택 ─────────────────── */
  const renderStep1 = () => {
    // 카테고리 필터를 적용해도 RAIDS 배열의 최신순 정렬을 그대로 유지
    const filtered = categoryFilter === "all"
      ? RAIDS
      : RAIDS.filter((r) => r.category === categoryFilter);

    return (
      <div key={fadeKey} style={styles.fadeIn}>
        <div style={styles.sectionTitle}>레이드 선택</div>
        <div style={styles.sectionDesc}>공략할 레이드를 선택하세요</div>

        {/* 카테고리 필터 */}
        <div style={styles.categoryBar}>
          {RAID_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              style={styles.categoryTab(categoryFilter === cat.id)}
              onClick={() => setCategoryFilter(cat.id)}
            >
              {cat.label}
            </div>
          ))}
        </div>

        {/* 레이드 카드 그리드 */}
        <div style={styles.raidGrid}>
          {filtered.map((raid) => (
            <div
              key={raid.id}
              style={styles.raidCard(form.raidId === raid.id)}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  raidId: raid.id,
                  difficulty: "",
                  max_slots: raid.maxSlots,
                }))
              }
              onMouseEnter={(e) => {
                if (form.raidId !== raid.id) {
                  e.currentTarget.style.borderColor = "rgba(248,250,252,0.15)";
                  e.currentTarget.style.background = "rgba(30,41,59,0.6)";
                }
              }}
              onMouseLeave={(e) => {
                if (form.raidId !== raid.id) {
                  e.currentTarget.style.borderColor = "rgba(248,250,252,0.06)";
                  e.currentTarget.style.background = "rgba(30,41,59,0.4)";
                }
              }}
            >
              <div style={styles.raidEmoji}>{raid.image}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <div style={styles.raidName}>{raid.name}</div>
                  {raid.tag && <div style={styles.raidTag}>{raid.tag}</div>}
                </div>
                <div style={styles.raidMeta}>{raid.gates}관문 · {raid.maxSlots}인</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ── Step 2: 난이도 선택 ─────────────────── */
  const renderStep2 = () => {
    const gateInfo = selectedRaid?.gateEntryLevels?.[form.difficulty];

    return (
      <div key={fadeKey} style={styles.fadeIn}>
        <div style={styles.sectionTitle}>난이도 선택</div>
        <div style={styles.sectionDesc}>
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>{selectedRaid?.name}</span>
          {selectedRaid?.tag && (
            <span style={{ color: "#818cf8", fontSize: 12, marginLeft: 4 }}>
              ({selectedRaid.tag})
            </span>
          )}
          의 난이도를 선택하세요
        </div>

        <div style={styles.diffGrid}>
          {(selectedRaid?.difficulties || []).map((diff) => {
            const color = DIFF_COLORS[diff] || "#94a3b8";
            const level = selectedRaid?.entryLevel?.[diff];
            return (
              <div
                key={diff}
                style={styles.diffCard(form.difficulty === diff, color)}
                onClick={() => setForm((f) => ({ ...f, difficulty: diff }))}
                onMouseEnter={(e) => {
                  if (form.difficulty !== diff)
                    e.currentTarget.style.background = "rgba(30,41,59,0.6)";
                }}
                onMouseLeave={(e) => {
                  if (form.difficulty !== diff)
                    e.currentTarget.style.background = "rgba(30,41,59,0.4)";
                }}
              >
                <div style={styles.diffDot(color)} />
                <div style={{ ...styles.diffLabel, color }}>{diff}</div>
                {level && (
                  <div style={styles.diffEntryLevel}>
                    Lv. {level.toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 아브렐슈드(군단장): 관문별 입장레벨 안내 */}
        {gateInfo && (
          <div style={styles.gateBox}>
            <div style={styles.gateBoxTitle}>⚠️ 관문별 입장 레벨이 다릅니다</div>
            <div style={styles.gateGrid}>
              {gateInfo.map((lvl, i) => (
                <div key={i} style={styles.gateItem}>
                  <div style={styles.gateNum}>{i + 1}관문</div>
                  <div style={styles.gateLevel}>{lvl.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── Step 3: 인원 설정 ───────────────────── */
  const renderStep3 = () => {
    const raidMax = selectedRaid?.maxSlots ?? 8;
    // 로스트아크 파티 구성: 4인 1파티 기준
    const partySize = 4;
    const totalParties = raidMax / partySize;

    // 파티별 슬롯 배분 계산
    // 예) max_slots=5, raidMax=8 → 1파티: 4명, 2파티: 1명
    const buildParties = (count) => {
      const parties = [];
      let remaining = count;
      for (let p = 0; p < totalParties; p++) {
        const filled = Math.min(remaining, partySize);
        parties.push({ filled, total: partySize });
        remaining -= filled;
      }
      return parties;
    };

    const parties = buildParties(form.max_slots);

    // 프리셋: 레이드 최대 인원 기준으로 동적 생성
    const presets = raidMax === 4
      ? [1, 2, 3, 4]
      : raidMax === 8
      ? [4, 8]
      : [4, 8, 16]; // 16인 베히모스

    return (
      <div key={fadeKey} style={styles.fadeIn}>
        <div style={styles.sectionTitle}>인원 설정</div>
        <div style={{ ...styles.sectionDesc, marginBottom: 16 }}>
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>{raidMax}인 레이드</span>
          {"  "}— 공대에 모집할 인원 수를 설정하세요
        </div>

        {/* 인원 수 + 슬라이더 */}
        <div style={styles.slotContainer}>
          {/* 숫자 표시 */}
          <div style={{ textAlign: "center" }}>
            <div style={styles.slotDisplay}>{form.max_slots}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
              / {raidMax}명
            </div>
          </div>

          {/* 프리셋 버튼 */}
          <div style={styles.slotBtns}>
            {presets.map((n) => (
              <div
                key={n}
                style={styles.slotBtn(form.max_slots === n)}
                onClick={() => setForm((f) => ({ ...f, max_slots: n }))}
              >
                {n}인
              </div>
            ))}
          </div>

          {/* 슬라이더 */}
          <input
            type="range"
            min={1}
            max={raidMax}
            value={form.max_slots}
            onChange={(e) =>
              setForm((f) => ({ ...f, max_slots: Number(e.target.value) }))
            }
            style={{ width: "85%", accentColor: "#f59e0b", cursor: "pointer" }}
          />
        </div>

        {/* 파티 구성 미리보기 */}
        <div style={styles.partyPreview}>
          <div style={styles.partyPreviewTitle}>파티 구성 미리보기</div>
          <div style={styles.partyList}>
            {parties.map((party, pi) => (
              <div key={pi} style={styles.partyRow}>
                <div style={styles.partyLabel}>{pi + 1}파티</div>
                <div style={styles.partySlots}>
                  {Array.from({ length: party.total }).map((_, si) => (
                    <div
                      key={si}
                      style={styles.partySlot(si < party.filled)}
                    >
                      {si < party.filled ? "👤" : ""}
                    </div>
                  ))}
                </div>
                <div style={styles.partyCount}>
                  {party.filled > 0
                    ? `${party.filled}명`
                    : <span style={{ color: "#334155" ,whiteSpace: "nowrap"}}>비어있음</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ── Step 4: 최종 확인 ───────────────────── */
  const renderStep4 = () => {
    const diffColor = DIFF_COLORS[form.difficulty] || "#f1f5f9";
    const entryLevel = selectedRaid?.entryLevel?.[form.difficulty];
    const gateInfo = selectedRaid?.gateEntryLevels?.[form.difficulty];
    const categoryLabel = CATEGORY_LABELS[selectedRaid?.category] || "";

    return (
      <div key={fadeKey} style={styles.fadeIn}>
        {submitResult && !submitResult.ok ? (
          <div style={styles.resultBox}>
            <div style={styles.resultIcon}>⚠️</div>
            <div style={styles.resultTitle}>생성에 실패했습니다</div>
            <div style={styles.resultDesc}>{submitResult.error}</div>
          </div>
        ) : (
          <>
            <div style={styles.sectionTitle}>최종 확인</div>
            <div style={styles.sectionDesc}>설정을 확인하고 레이드를 생성하세요</div>
            <div style={styles.reviewList}>
              <div style={styles.reviewRow}>
                <span style={styles.reviewLabel}>종류</span>
                <span style={{ ...styles.reviewValue, fontSize: 13, color: "#94a3b8" }}>
                  {categoryLabel}
                </span>
              </div>
              <div style={styles.reviewRow}>
                <span style={styles.reviewLabel}>레이드</span>
                <span style={styles.reviewValue}>
                  {selectedRaid?.image}{" "}
                  {selectedRaid?.name}
                  {selectedRaid?.tag && (
                    <span style={{ fontSize: 12, color: "#818cf8", marginLeft: 6 }}>
                      ({selectedRaid.tag})
                    </span>
                  )}
                </span>
              </div>
              <div style={styles.reviewRow}>
                <span style={styles.reviewLabel}>관문</span>
                <span style={styles.reviewValue}>{selectedRaid?.gates}관문</span>
              </div>
              <div style={styles.reviewRow}>
                <span style={styles.reviewLabel}>난이도</span>
                <span style={{ ...styles.reviewValue, color: diffColor }}>
                  {form.difficulty}
                </span>
              </div>
              {entryLevel && (
                <div style={styles.reviewRow}>
                  <span style={styles.reviewLabel}>입장 레벨</span>
                  <span style={styles.reviewValue}>{entryLevel.toLocaleString()}</span>
                </div>
              )}
              {gateInfo && (
                <div style={{ ...styles.reviewRow, flexDirection: "column", alignItems: "flex-start" }}>
                  <span style={styles.reviewLabel}>관문별 입장 레벨</span>
                  <div style={styles.reviewGateGrid}>
                    {gateInfo.map((lvl, i) => (
                      <div key={i} style={styles.reviewGateItem}>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                          {i + 1}관문
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                          {lvl.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={styles.reviewRow}>
                <span style={styles.reviewLabel}>모집 인원</span>
                <span style={styles.reviewValue}>
                  {form.max_slots}명
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400, marginLeft: 6 }}>
                    / {selectedRaid?.maxSlots}명 레이드
                  </span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const stepContent = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4 };

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 2px; }
      `}</style>
      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>레이드 생성</div>
          <div style={styles.subtitle}>새로운 레이드 공대를 만들어보세요</div>
        </div>

        {/* Card */}
        <div style={styles.card}>
          {/* Progress */}
          <div style={styles.stepper}>
            {STEPS.map((s) => (
              <div key={s.id} style={styles.stepDot(s.id === step, s.id < step)} />
            ))}
          </div>
          <div style={styles.stepLabels}>
            {STEPS.map((s) => (
              <span key={s.id} style={styles.stepLabel(s.id === step)}>
                {s.label}
              </span>
            ))}
          </div>

          {/* Body */}
          <div style={styles.body}>{stepContent[step]()}</div>

          {/* Footer */}
          {/* Footer — 에러 상태에도 재시도 가능하도록 항상 표시 */}
          {(!submitResult || !submitResult.ok) && (
            <div style={styles.footer}>
              {step > 1 ? (
                <div style={styles.btnSecondary} onClick={prev}>
                  ← 이전
                </div>
              ) : (
                <div style={{ flex: 1 }} />
              )}
              {step < 4 ? (
                <div style={styles.btnPrimary(!canNext())} onClick={next}>
                  다음 →
                </div>
              ) : (
                <div
                  style={styles.btnPrimary(isSubmitting)}
                  onClick={!isSubmitting ? handleSubmit : undefined}
                >
                  {isSubmitting ? "생성 중..." : "🚀 레이드 생성"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}