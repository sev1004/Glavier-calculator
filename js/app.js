// js/app.js
import { loadPat, savePat, clearPat } from "./core/storage.js";

// 탭들
import { mountSkillsTab } from "./features/skills/index.js";
import { mountEquipmentTab } from "./features/equipment/index.js";
import { mountArkPassiveTab } from "./features/arkpassive/index.js";
import { mountArkGridTab } from "./features/arkgrid/index.js";

// 장비 자동 로드 함수(버튼 제거한 equip.section.js에서 export한 함수)
import { loadEquipment } from "./features/equipment/components/equip.js";

(function init() {
  console.log("[app] loaded");

  // ===== DOM =====
  const appVersion = document.querySelector("#appVersion");

  const patInput = document.querySelector("#patInput");
  const rememberPat = document.querySelector("#rememberPat");
  const togglePatBtn = document.querySelector("#togglePatBtn");
  const clearPatBtn = document.querySelector("#clearPatBtn");
  const patStatus = document.querySelector("#patStatus");

  const characterNameInput = document.querySelector("#characterName");
  const globalStatus = document.querySelector("#globalStatus");

  const tabButtons = Array.from(document.querySelectorAll(".tab"));
  const panels = {
    equipment: document.querySelector("#panel-equipment"),
    skills: document.querySelector("#panel-skills"),
    arkpassive: document.querySelector("#panel-arkpassive"),
    arkgrid: document.querySelector("#panel-arkgrid"),
  };

  const roots = {
    equipment: document.querySelector("#equipmentRoot"),
    skills: document.querySelector("#skillsRoot"),
    arkpassive: document.querySelector("#arkpassiveRoot"),
    arkgrid: document.querySelector("#arkgridRoot"),
  };

  // 필수 DOM 체크(없으면 조용히 중단)
  if (!patInput || !characterNameInput || !globalStatus) {
    console.error("[app] required DOM missing. Check index.html IDs.");
    return;
  }

  // ===== AppState =====
  // 전역 상태(다른 모듈이 접근)
  window.AppState = window.AppState || {
    token: "",
    characterName: "",
    activeTab: "equipment",
    _equipRootEl: null, // 장비 섹션 root element를 저장(자동 로드에 필요)
  };

  // 버전 표시
  if (appVersion) {
    const now = new Date();
    appVersion.textContent = `v-auto • ${now.toLocaleString("ko-KR")}`;
  }

  // ===== PAT 초기 로드 =====
  const saved = loadPat();
  if (saved) {
    patInput.value = saved;
    rememberPat.checked = true;
    patStatus.textContent = "저장된 토큰 불러옴 ✅";
    window.AppState.token = saved;
  } else {
    patStatus.textContent = "";
  }

  // PAT 표시/숨김
  togglePatBtn?.addEventListener("click", () => {
    const hidden = patInput.type === "password";
    patInput.type = hidden ? "text" : "password";
    togglePatBtn.textContent = hidden ? "숨김" : "표시";
  });

  // PAT 입력
  patInput.addEventListener("input", () => {
    const v = patInput.value.trim();
    window.AppState.token = v;
    if (rememberPat.checked) savePat(v);
  });

  // PAT 저장 체크
  rememberPat?.addEventListener("change", () => {
    if (rememberPat.checked) {
      const v = patInput.value.trim();
      if (!v) {
        rememberPat.checked = false;
        patStatus.textContent = "토큰을 먼저 입력하세요.";
        return;
      }
      savePat(v);
      patStatus.textContent = "이 기기에서 토큰 기억 ✅";
    } else {
      clearPat();
      patStatus.textContent = "로컬 저장 해제";
    }
  });

  // PAT 삭제
  clearPatBtn?.addEventListener("click", () => {
    patInput.value = "";
    window.AppState.token = "";
    rememberPat.checked = false;
    clearPat();
    patStatus.textContent = "토큰 삭제 완료";
  });

  // ===== 탭 mount (1회) =====
  // mountEquipmentTab에서 renderEquipSection을 호출하며,
  // equip.section.js에서 loadEquipment(equipRootEl, globalStatusEl)를 외부에서 호출하는 구조.
  mountEquipmentTab(roots.equipment, globalStatus);
  mountSkillsTab(roots.skills, globalStatus);
  mountArkPassiveTab(roots.arkpassive, globalStatus);
  mountArkGridTab(roots.arkgrid, globalStatus);

  // ✅ mount 후 장비 섹션 root element 찾기 (equipment/index.js에서 id="equipSection"을 만들었음)
  // 혹시 index.js에서 wrapper를 바꿨더라도 최대한 안전하게 찾기
  const equipRootEl =
    roots.equipment?.querySelector("#equipSection") || // equipment/index.js가 만든 섹션
    roots.equipment; // fallback

  window.AppState._equipRootEl = equipRootEl;

  // ===== 탭 전환 =====
  function setActiveTab(tabKey) {
    window.AppState.activeTab = tabKey;

    // 버튼 active
    tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabKey));

    // 패널 active
    Object.entries(panels).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("active", k === tabKey);
    });

    globalStatus.textContent = `탭 전환: ${tabKey}`;

    // ✅ 장비 탭으로 이동했을 때 자동 로드(입력이 있으면)
    if (tabKey === "equipment") {
      triggerEquipmentAutoLoad();
      if (accessoryRoot) loadAccessories(accessoryRoot, globalStatus);
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  // ===== 장비 자동 로드 (디바운스 포함) =====
  let equipLoadTimer = null;
  function triggerEquipmentAutoLoad() {
    // 장비 탭이 아닐 때는 호출하지 않음(불필요 요청 방지)
    if (window.AppState.activeTab !== "equipment") return;

    const token = window.AppState.token || "";
    const charName = (window.AppState.characterName || "").trim();
    if (!token || !charName) return;

    const rootEl = window.AppState._equipRootEl;
    if (!rootEl) return;

    // 디바운스: 타이핑 도중 연속 호출 방지
    if (equipLoadTimer) clearTimeout(equipLoadTimer);
    equipLoadTimer = setTimeout(() => {
      loadEquipment(rootEl, globalStatus);
    }, 400);
  }

  // 캐릭터명 입력
  characterNameInput.addEventListener("input", () => {
    window.AppState.characterName = characterNameInput.value.trim();
    triggerEquipmentAutoLoad();
  });

  // 페이지 로드시 이미 캐릭터명이 채워져 있다면(브라우저 자동완성 등) 한 번 시도
  if (characterNameInput.value.trim()) {
    window.AppState.characterName = characterNameInput.value.trim();
    triggerEquipmentAutoLoad();
  }

  // PAT가 바뀌면 장비 다시 로드할 수도 있으니(원하면) 자동 호출
  patInput.addEventListener("change", () => {
    triggerEquipmentAutoLoad();
  });
})();
