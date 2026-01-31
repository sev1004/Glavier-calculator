export function mountEquipmentTab(rootEl, globalStatusEl) {
  rootEl.innerHTML = `
    <p class="help">장비 탭은 준비중입니다.</p>
    <div class="cardInner">
      <div class="pill">안내</div>
      <div class="mono">여기에 장비 API/시뮬레이터 UI를 붙일 예정</div>
    </div>
  `;
  globalStatusEl.textContent = "장비 탭 준비중";
}
