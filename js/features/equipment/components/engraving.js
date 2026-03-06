export function renderEngravingSection(rootEl) {
  rootEl.innerHTML = `
    <div class="cardInner">
      <div class="pill">각인</div>

      <div class="row" style="margin-top:10px;">
        <button type="button" data-action="load-engraving">각인 불러오기</button>
      </div>

      <div class="mono" style="margin-top:8px;">
        (준비중) 각인 리스트/활성도/돌/서폿각인 표시 영역
      </div>

      <div class="list" data-engraving-list style="margin-top:10px;"></div>
    </div>
  `;
}

export function bindEngravingEvents(rootEl, globalStatusEl) {
  rootEl.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="load-engraving"]');
    if (!btn) return;

    const token = window.AppState?.token || "";
    const charName = (window.AppState?.characterName || "").trim();

    if (!token) return (globalStatusEl.textContent = "PAT를 입력하세요.");
    if (!charName) return (globalStatusEl.textContent = "캐릭터명을 입력하세요.");

    btn.disabled = true;
    btn.textContent = "불러오는 중...";
    globalStatusEl.textContent = "각인 불러오는 중...";

    try {
      // TODO: 각인 API 연결
      const listEl = rootEl.querySelector("[data-engraving-list]");
      listEl.innerHTML = `<div class="item">각인 API 연결 예정</div>`;

      globalStatusEl.textContent = "각인 섹션 로드 완료(임시)";
    } catch (err) {
      console.error(err);
      globalStatusEl.textContent = "각인 불러오기 실패 (콘솔 확인)";
    } finally {
      btn.disabled = false;
      btn.textContent = "각인 불러오기";
    }
  });
}
