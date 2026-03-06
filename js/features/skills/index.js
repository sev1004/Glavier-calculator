import { fetchJson, makeAuthHeader } from "../core/api.js";

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function pickSelectedTripodsByTier(tripodsRaw = []) {
  const result = [null, null, null]; // tier0~2
  for (const t of tripodsRaw) {
    const tier = Number(t?.Tier);
    if (tier < 0 || tier > 2) continue;
    if (!t?.IsSelected) continue;

    const cur = result[tier];
    if (!cur) result[tier] = t;
    else {
      const curSlot = Number(cur?.Slot ?? 999);
      const newSlot = Number(t?.Slot ?? 999);
      if (newSlot < curSlot) result[tier] = t;
    }
  }
  return result.map((t) => (t ? { name: t.Name ?? "(tripod)" } : null));
}

function normalizeSkills(apiSkills) {
  const list = Array.isArray(apiSkills)
    ? apiSkills
    : Array.isArray(apiSkills?.Skills)
      ? apiSkills.Skills
      : Array.isArray(apiSkills?.CombatSkills)
        ? apiSkills.CombatSkills
        : [];

  return list
    .map((s) => ({
      name: norm(s?.Name ?? "(unknown)"),
      icon: s?.Icon ?? "",
      level: Number(s?.Level ?? 0),
      tripods: pickSelectedTripodsByTier(s?.Tripods ?? []),
    }))
    .filter((s) => s.level >= 7);
}

function renderSkills(rootEl, skills, statusEl) {
  rootEl.innerHTML = `
    <div class="row" style="margin-bottom: 10px;">
      <button id="skillsLoadBtn" type="button">스킬 불러오기</button>
    </div>
    <div class="list" id="skillsList"></div>
  `;

  const listEl = rootEl.querySelector("#skillsList");
  const loadBtn = rootEl.querySelector("#skillsLoadBtn");

  loadBtn.addEventListener("click", async () => {
    const token = window.AppState.token || "";
    const charName = (window.AppState.characterName || "").trim();

    if (!token) return statusEl.textContent = "PAT를 입력하세요.";
    if (!charName) return statusEl.textContent = "캐릭터명을 입력하세요.";

    statusEl.textContent = "스킬 불러오는 중...";

    try {
      const url = `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(
        charName
      )}/combat-skills`;

      const apiSkills = await fetchJson(url, {
        accept: "application/json",
        authorization: makeAuthHeader(token),
      });

      const skillsData = normalizeSkills(apiSkills);

      listEl.innerHTML = "";
      for (const s of skillsData) {
        const [t1, t2, t3] = s.tripods;
        const tText = (t) => (t ? t.name : "-");

        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <div class="skillRow">
            <img src="${escapeHtml(s.icon)}" class="skillIcon" alt="${escapeHtml(s.name)}" loading="lazy" />
            <div class="skillMid">
              <div class="skillTopLine">
                <span class="tag">Lv.${s.level}</span>
                <span class="itemTitle skillName">${escapeHtml(s.name)}</span>
              </div>
              <div class="tripods">
                <span class="tripod">트포1: ${escapeHtml(tText(t1))}</span>
                <span class="tripod">트포2: ${escapeHtml(tText(t2))}</span>
                <span class="tripod">트포3: ${escapeHtml(tText(t3))}</span>
              </div>
            </div>
          </div>
        `;
        listEl.appendChild(item);
      }

      statusEl.textContent = `스킬 ${skillsData.length}개 로드 완료 (Lv.7+) ✅`;
    } catch (e) {
      console.error(e);
      statusEl.textContent = "실패: 토큰/CORS/요청 제한 확인 (F12 콘솔)";
    }
  });
}

export function mountSkillsTab(rootEl, globalStatusEl) {
  renderSkills(rootEl, [], globalStatusEl);
}
