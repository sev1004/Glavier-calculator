console.log("main.js 연결 완료 ✅");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM 로드 완료 ✅");

  /* ===============================
     DOM ELEMENTS
  =============================== */

  const appVersion = document.querySelector("#appVersion");

  const patInput = document.querySelector("#patInput");
  const rememberPat = document.querySelector("#rememberPat");
  const togglePatBtn = document.querySelector("#togglePatBtn");
  const clearPatBtn = document.querySelector("#clearPatBtn");
  const patStatus = document.querySelector("#patStatus");

  const characterName = document.querySelector("#characterName");

  const loadArmoryBtn = document.querySelector("#loadArmoryBtn");
  const loadMockBtn = document.querySelector("#loadMockBtn");

  const saveRawSkillsBtn = document.querySelector("#saveRawSkillsBtn");
  const saveRawGemsBtn = document.querySelector("#saveRawGemsBtn");

  const skillListEl = document.querySelector("#skillList");
  const simStatus = document.querySelector("#simStatus");

  /* ===============================
     VERSION
  =============================== */

  if (appVersion) {
    const now = new Date();
    appVersion.textContent = `v0.7 • ${now.toLocaleString("ko-KR")}`;
  }

  /* ===============================
     LOCAL STORAGE (PAT)
  =============================== */

  const STORAGE_KEY = "loa_pat";
  const savedPat = localStorage.getItem(STORAGE_KEY);

  if (savedPat && patInput) {
    patInput.value = savedPat;
    if (rememberPat) rememberPat.checked = true;
    patStatus.textContent = "저장된 토큰을 불러왔어요 ✅";
  }

  togglePatBtn?.addEventListener("click", () => {
    if (!patInput) return;
    const hidden = patInput.type === "password";
    patInput.type = hidden ? "text" : "password";
    togglePatBtn.textContent = hidden ? "숨김" : "표시";
  });

  rememberPat?.addEventListener("change", () => {
    if (!patInput) return;

    if (rememberPat.checked) {
      const token = patInput.value.trim();
      if (!token) {
        rememberPat.checked = false;
        patStatus.textContent = "토큰을 먼저 입력하세요.";
        return;
      }
      localStorage.setItem(STORAGE_KEY, token);
      patStatus.textContent = "이 기기에서 토큰을 기억합니다 ✅";
    } else {
      localStorage.removeItem(STORAGE_KEY);
      patStatus.textContent = "로컬 저장 해제";
    }
  });

  patInput?.addEventListener("input", () => {
    if (rememberPat?.checked) {
      localStorage.setItem(STORAGE_KEY, patInput.value.trim());
    }
  });

  clearPatBtn?.addEventListener("click", () => {
    if (!patInput) return;
    patInput.value = "";
    localStorage.removeItem(STORAGE_KEY);
    if (rememberPat) rememberPat.checked = false;
    patStatus.textContent = "토큰 삭제 완료";
  });

  /* ===============================
     UTILITIES
  =============================== */

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function fetchJson(url, headers = {}) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function downloadJson(filename, obj) {
    const text = JSON.stringify(obj, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function safeFilePart(str) {
    return String(str || "")
      .trim()
      .replaceAll(/[\\/:*?"<>|]/g, "_")
      .slice(0, 40);
  }

  function timeStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(
      d.getHours()
    )}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  // 🔑 문자열 매칭 튼튼하게: 앞뒤공백 제거 + 내부 연속 공백 정리
  function normName(s) {
    return String(s ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ===============================
     RAW DATA (DEBUG)
  =============================== */

  let lastRawSkills = null;
  let lastRawGems = null;
  let lastCharName = "";

  /* ===============================
     SKILL NORMALIZE
  =============================== */

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
    return result.map((t) =>
      t
        ? { tier: Number(t.Tier), slot: Number(t.Slot ?? 0), name: t.Name ?? "(tripod)" }
        : null
    );
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
        name: normName(s?.Name ?? "(unknown)"),
        icon: s?.Icon ?? "",
        level: Number(s?.Level ?? 0),
        selectedTripodsByTier: pickSelectedTripodsByTier(s?.Tripods ?? []),
      }))
      .filter((s) => s.level >= 7);
  }

  /* ===============================
     GEM NORMALIZE (보석 슬롯 매핑 + 디버그)
     - Gems[]: Slot, Name(보석명), Icon
     - Effects[]: Name(스킬명), GemSlot(슬롯번호)
  =============================== */

  function gemKindFromName(gemName = "") {
    const n = String(gemName);
    if (n.includes("겁화")) return "겁화";
    if (n.includes("작열")) return "작열";
    return "기타";
  }

 function gemKindFromName(gemName = "") {
  const n = String(gemName);
  if (n.includes("겁화")) return "겁화";
  if (n.includes("작열")) return "작열";
  return "기타";
}

/**
 * A안: apiGems.Effects[]: { Name(스킬명), GemSlot }
 * B안: apiGems.Gems[].Effects[]: { Name(스킬명) }  (GemSlot 없음)
 *
 * 반환: Map(skillName -> [{slot,name,icon,kind}...])
 */
function normalizeGems(apiGems, skillsForDebug = []) {
  const gemsArr = Array.isArray(apiGems?.Gems) ? apiGems.Gems : [];

  // 디버그용(원하면 남겨두기)
  console.log("GEMS root keys:", apiGems ? Object.keys(apiGems) : null);
  console.log("GEMS[0] keys:", gemsArr?.[0] ? Object.keys(gemsArr[0]) : null);

  // 1) Slot -> Gem 정보 맵
  const gemBySlot = new Map();
  for (const g of gemsArr) {
    const slot = Number(g?.Slot ?? g?.slot);
    if (!Number.isFinite(slot)) continue;

    const name = g?.Name ?? g?.name ?? "";
    const icon = g?.Icon ?? g?.icon ?? "";
    const kind = gemKindFromName(name);

    gemBySlot.set(slot, { slot, name, icon, kind });
  }

  // 스킬명 정규화(공백/개행 차이 방지)
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const skillNameSet = new Set((skillsForDebug ?? []).map((s) => norm(s.name)));

  // 2) A안: root Effects 시도
  let effectsArr =
    Array.isArray(apiGems?.Effects) ? apiGems.Effects :
    Array.isArray(apiGems?.effects) ? apiGems.effects :
    [];

  const bySkill = new Map();

  const add = (skillName, gemInfo) => {
    const key = norm(skillName);
    if (!key) return;
    // 스킬 리스트와 매칭 안 되면(혹시 스킬이 안 불러와진 케이스)도 일단 넣을 수 있지만,
    // 디버그 안정성을 위해 스킬셋 있으면 그 안에서만 넣기
    if (skillNameSet.size > 0 && !skillNameSet.has(key)) return;

    if (!bySkill.has(key)) bySkill.set(key, []);
    bySkill.get(key).push(gemInfo);
  };

  if (effectsArr.length > 0) {
    // === A안 매핑 ===
    for (const ef of effectsArr) {
      const skillName = ef?.Name ?? ef?.name;
      const gemSlotRaw =
        ef?.GemSlot ?? ef?.gemSlot ?? ef?.GemSlotIndex ?? ef?.Slot ?? ef?.slot;
      const gemSlot = Number(gemSlotRaw);
      if (!skillName || !Number.isFinite(gemSlot)) continue;

      const gemInfo = gemBySlot.get(gemSlot);
      if (!gemInfo) continue;

      add(skillName, gemInfo);
    }
  } else {
    // === B안 매핑 (Gems[] 안에 Effects[]가 들어있는 경우) ===
    for (const g of gemsArr) {
      const slot = Number(g?.Slot ?? g?.slot);
      if (!Number.isFinite(slot)) continue;

      const gemInfo = gemBySlot.get(slot);
      if (!gemInfo) continue;

      const innerEffects = Array.isArray(g?.Effects) ? g.Effects : [];
      for (const ef of innerEffects) {
        const skillName = ef?.Name ?? ef?.name; // 여기서 Name이 스킬명
        if (!skillName) continue;
        add(skillName, gemInfo);
      }
    }
  }

  // 디버그: 실제 매핑된 스킬 수 확인
  console.log("GEM MAP size:", bySkill.size);
  console.log(
    "GEM MAP sample:",
    [...bySkill.entries()].slice(0, 5).map(([k, v]) => ({
      skill: k,
      gems: v.map((x) => `${x.slot}:${x.name}`),
    }))
  );

  return bySkill; // Map<skillName, Gem[]>
}


  /* ===============================
     RENDER
  =============================== */

  function renderSkills(skills, gemMapBySkill = new Map()) {
    if (!skillListEl) return;

    skillListEl.innerHTML = "";

    const kindOrder = { 겁화: 0, 작열: 1, 기타: 2 };

    function pickGems(skillName) {
      const list = gemMapBySkill.get(skillName) ?? [];
      const sorted = [...list].sort((a, b) => {
        const ka = kindOrder[a.kind] ?? 99;
        const kb = kindOrder[b.kind] ?? 99;
        if (ka !== kb) return ka - kb;
        return (a.slot ?? 999) - (b.slot ?? 999);
      });

      const picked = [];
      const seen = new Set();
      for (const g of sorted) {
        if (g.kind === "기타") continue;
        if (seen.has(g.kind)) continue;
        picked.push(g);
        seen.add(g.kind);
        if (picked.length >= 2) break; // 최대 2개(겁화/작열)
      }
      return picked;
    }

    for (const s of skills) {
      const el = document.createElement("div");
      el.className = "item";

      const [t1, t2, t3] = s.selectedTripodsByTier;
      const tText = (t) => (t ? t.name : "-");

      const gems = pickGems(s.name);
      const gemsHtml = gems.length
        ? `<div class="gemWrap">
            ${gems
              .map(
                (g) => `
              <div class="gem">
                <img class="gemIcon" src="${escapeHtml(g.icon)}" alt="${escapeHtml(g.name)}" loading="lazy" />
                <div class="gemName">${escapeHtml(g.name)}</div>
              </div>`
              )
              .join("")}
          </div>`
        : "";

      el.innerHTML = `
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
          ${gemsHtml}
        </div>
      `;

      skillListEl.appendChild(el);
    }

    simStatus.textContent = `표시 스킬 ${skills.length}개 (Lv.7+)`;
  }

  /* ===============================
     LOAD FROM API
  =============================== */

  loadArmoryBtn?.addEventListener("click", async () => {
    const token = patInput?.value.trim();
    const name = characterName?.value.trim();

    if (!token) return (patStatus.textContent = "PAT를 입력하세요.");
    if (!name) return (patStatus.textContent = "캐릭터명을 입력하세요.");

    const authValue = token.toLowerCase().startsWith("bearer ")
      ? token
      : `bearer ${token}`;

    patStatus.textContent = "불러오는 중...";
    simStatus.textContent = "불러오는 중...";

    try {
      const skillsUrl = `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(
        name
      )}/combat-skills`;

      const gemsUrl = `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(
        name
      )}/gems`;

      const headers = { accept: "application/json", authorization: authValue };

      const [apiSkills, apiGems] = await Promise.all([
        fetchJson(skillsUrl, headers),
        fetchJson(gemsUrl, headers),
      ]);

      lastRawSkills = apiSkills;
      lastRawGems = apiGems;
      lastCharName = name;

      console.log("RAW skills:", apiSkills);
      console.log("RAW gems:", apiGems);

      const skills = normalizeSkills(apiSkills);
      const gemMap = normalizeGems(apiGems, skills);

      // 디버그: 실제로 스킬에 보석이 붙었는지 샘플 출력
      console.log(
        "sample skill->gems:",
        skills.slice(0, 5).map((s) => ({ skill: s.name, gems: (gemMap.get(s.name) ?? []).map((g) => g.name) }))
      );

      renderSkills(skills, gemMap);

      patStatus.textContent = "스킬/보석 로드 성공 ✅";
    } catch (e) {
      console.error(e);
      patStatus.textContent = "불러오기 실패 (토큰/CORS/요청 제한)";
      simStatus.textContent = "실패";
    }
  });

  /* ===============================
     LOAD MOCK
  =============================== */

  loadMockBtn?.addEventListener("click", async () => {
    try {
      patStatus.textContent = "목업 로드 중...";
      const [apiSkills, apiGems] = await Promise.all([
        fetchJson("./data/mock_combat_skills.json"),
        fetchJson("./data/mock_gems.json"),
      ]);

      const skills = normalizeSkills(apiSkills);
      const gemMap = normalizeGems(apiGems, skills);

      renderSkills(skills, gemMap);

      patStatus.textContent = "목업 로드 완료 ✅";
    } catch (e) {
      console.error(e);
      patStatus.textContent = "목업 로드 실패";
    }
  });

  /* ===============================
     SAVE RAW (DEBUG)
  =============================== */

  saveRawSkillsBtn?.addEventListener("click", () => {
    if (!lastRawSkills) return;
    downloadJson(
      `raw_combat_skills_${safeFilePart(lastCharName)}_${timeStamp()}.json`,
      lastRawSkills
    );
    patStatus.textContent = "RAW 스킬 저장 완료";
  });

  saveRawGemsBtn?.addEventListener("click", () => {
    if (!lastRawGems) return;
    downloadJson(
      `raw_gems_${safeFilePart(lastCharName)}_${timeStamp()}.json`,
      lastRawGems
    );
    patStatus.textContent = "RAW 보석 저장 완료";
  });
});
