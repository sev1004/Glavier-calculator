import { renderEquipSection } from "./components/equip.js";
import { renderAccessorySection} from "./components/accessory.js";
import { renderEngravingSection, bindEngravingEvents } from "./components/engraving.js";

export function mountEquipmentTab(rootEl, globalStatusEl) {
  rootEl.innerHTML = `
    <div id="equipSection"></div>
    <div style="height:12px;"></div>
    <div id="accessorySection"></div>
    <div style="height:12px;"></div>
    <div id="engravingSection"></div>
  `;

  const equipRoot = rootEl.querySelector("#equipSection");
  const accessoryRoot = rootEl.querySelector("#accessorySection");
  const engravingRoot = rootEl.querySelector("#engravingSection");

  // 1) 섹션 렌더(HTML만)
  renderEquipSection(equipRoot);
  renderAccessorySection(accessoryRoot);
  renderEngravingSection(engravingRoot);

  // ✅ 4️⃣ 🔥 여기에 반드시 넣어야 함 (핵심)
  window.AppState = window.AppState || {};
  window.AppState._equipRootEl = equipRoot;
  window.AppState._accessoryRootEl = accessoryRoot;
  window.AppState._engravingRootEl = engravingRoot;

  // (선택) 상태 표시
  if (globalStatusEl) {
    globalStatusEl.textContent = "장비 탭 로드 완료";
  }

  // 2) 섹션 이벤트 바인딩(클릭/입력 등)
  bindEngravingEvents(engravingRoot, globalStatusEl);

}
