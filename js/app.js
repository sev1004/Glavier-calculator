import { loadPat, savePat, clearPat } from "./core/storage.js";
import { mountSkillsTab } from "./tabs/skills.js";
import { mountEquipmentTab } from "./tabs/equipment.js";
import { mountArkPassiveTab } from "./tabs/arkpassive.js";
import { mountArkGridTab } from "./tabs/arkgrid.js";

(function init() {
  const appVersion = document.querySelector("#appVersion");

  const patInput = document.querySelector("#patInput");
  const rememberPat = document.querySelector("#rememberPat");
  const togglePatBtn = document.querySelector("#togglePatBtn");
  const clearPatBtn = document.querySelector("#clearPatBtn");
  const patStatus = document.querySelector("#patStatus");

  const characterName = document.querySelector("#characterName");
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

  if (appVersion) {
    const now = new Date();
    appVersion.textContent = `v-tab • ${now.toLocaleString("ko-KR")}`;
  }

  // ✅ 전역 상태(간단하게)
  window.AppState = {
    token: "",
    characterName: "",
  };

  // PAT 초기 로드
  const saved = loadPat();
  if (saved) {
    patInput.value = saved;
    rememberPat.checked = true;
    patStatus.textContent = "저장된 토큰 불러옴 ✅";
    window.AppState.token = saved;
  }

  togglePatBtn.addEventListener("click", () => {
    const hidden = patInput.type === "password";
    patInput.type = hidden ? "text" : "password";
    togglePatBtn.textContent = hidden ? "숨김" : "표시";
  });

  patInput.addEventListener("input", () => {
    const v = patInput.value.trim();
    window.AppState.token = v;
    if (rememberPat.checked) savePat(v);
  });

  rememberPat.addEventListener("change", () => {
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

  clearPatBtn.addEventListener("click", () => {
    patInput.value = "";
    window.AppState.token = "";
    rememberPat.checked = false;
    clearPat();
    patStatus.textContent = "토큰 삭제 완료";
  });

  characterName.addEventListener("input", () => {
    window.AppState.characterName = characterName.value.trim();
  });

  // 탭 mount (최초 1회)
  mountEquipmentTab(roots.equipment, globalStatus);
  mountSkillsTab(roots.skills, globalStatus);
  mountArkPassiveTab(roots.arkpassive, globalStatus);
  mountArkGridTab(roots.arkgrid, globalStatus);

  function setActiveTab(tabKey) {
    // 버튼
    tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabKey));
    // 패널
    Object.entries(panels).forEach(([k, el]) => {
      el.classList.toggle("active", k === tabKey);
    });

    globalStatus.textContent = `탭 전환: ${tabKey}`;
  }

  // 기본 탭
  setActiveTab("equipment");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
})();
