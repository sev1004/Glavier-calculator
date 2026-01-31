export function mountArkPassiveTab(rootEl, globalStatusEl) {
  rootEl.innerHTML = `
    <p class="help">아크 패시브 탭은 준비중입니다.</p>
    <div class="cardInner">
      <div class="pill">안내</div>
      <div class="mono">아크 패시브 UI/계산 로직 예정</div>
    </div>
  `;
  globalStatusEl.textContent = "아크 패시브 탭 준비중";
}
