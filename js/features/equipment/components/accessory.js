import { fetchJson, makeAuthHeader } from "../../core/api.js";

/**
 * [accessory.section.js]
 * - /armories/characters/{name}/equipment 응답에서 악세(목걸이/귀걸이/반지)를 렌더
 * - 악세를 못 찾는 경우: 응답에 들어있는 실제 Type 목록을 status에 출력 (원인 파악용)
 * - AppState 저장:
 *   window.AppState.equipment.accessories = { items, statSum, statByAttr, lastRaw }
 */

const ACCESSORY_TYPE_NAMES = ["목걸이", "귀걸이", "반지"]; // 기본 기대값

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toInt(numStr) {
  if (numStr == null) return null;
  const n = Number(String(numStr).replaceAll(",", "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function flattenTooltipText(tooltip) {
  if (!tooltip) return "";
  const raw = String(tooltip);

  try {
    const obj = JSON.parse(raw);
    const parts = [];
    const stack = [obj];

    while (stack.length) {
      const cur = stack.pop();
      if (cur == null) continue;

      if (typeof cur === "string") {
        parts.push(cur);
        continue;
      }
      if (Array.isArray(cur)) {
        for (let i = 0; i < cur.length; i++) stack.push(cur[i]);
        continue;
      }
      if (typeof cur === "object") {
        for (const v of Object.values(cur)) stack.push(v);
      }
    }
    return parts.join(" ");
  } catch {
    return raw;
  }
}

function stripTags(text) {
  return String(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function extractQualityFromTooltip(tooltip) {
  if (!tooltip) return null;
  try {
    const obj = JSON.parse(String(tooltip));
    const q = obj?.Element_001?.value?.qualityValue ?? null;
    const n = Number(q);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  } catch {
    return null;
  }
}

/**
 * Tooltip에서 초록점(emoticon_sign_greenDot) 뒤 옵션 텍스트 3개 추출
 */
function extractAccessoryOptions(tooltip) {
  if (!tooltip) return [];

  const raw = String(tooltip);
  const re =
    /emoticon_sign_greenDot[\s\S]*?<\/img>([\s\S]*?)(?:<br\s*\/?>|\\r\\n|\\n|<\/p>|"Element_\d{3}"|$)/gi;

  const results = [];
  let m;

  while ((m = re.exec(raw)) !== null) {
    const chunk = m[1] || "";
    const cleaned = stripTags(chunk)
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .join(" ");

    const oneLine = cleaned.replace(/\s+/g, " ").trim();
    if (!oneLine || oneLine.length < 3) continue;

    if (!results.includes(oneLine)) results.push(oneLine);
    if (results.length >= 3) break;
  }

  return results.slice(0, 3);
}

/**
 * Tooltip에서 힘/지능/민첩 +숫자 추출
 * - 표시는 "힘 +13140" 형태
 * - 합산 저장은 value 숫자만
 */
function extractAccessoryStat(tooltipText) {
  const m = tooltipText.match(/(힘|지능|민첩)\s*\+([\d,]+)/);
  if (!m) return null;

  const attr = m[1];
  const value = toInt(m[2]);
  if (value == null) return null;

  return {
    attr,
    value,
    label: `${attr} +${m[2].replaceAll(",", "")}`,
  };
}

/**
 * AppState에 악세 버킷 확보
 */
function ensureAccessoryBucket() {
  if (!window.AppState) window.AppState = {};
  if (!window.AppState.equipment) window.AppState.equipment = {};
  if (!window.AppState.equipment.accessories) {
    window.AppState.equipment.accessories = {
      items: [],
      statSum: 0,
      statByAttr: { 힘: 0, 지능: 0, 민첩: 0 },
      lastRaw: null,
    };
  }
  return window.AppState.equipment.accessories;
}

/**
 * 악세 아이템 표준화
 */
function normalizeAccessoryItem(item) {
  const type = item?.Type ?? item?.type ?? "";
  const name = item?.Name ?? item?.name ?? "";
  const icon = item?.Icon ?? item?.icon ?? "";
  const tooltip = item?.Tooltip ?? item?.tooltip ?? "";

  const qualityPercent = extractQualityFromTooltip(tooltip);
  const tooltipText = stripTags(flattenTooltipText(tooltip));
  const options = extractAccessoryOptions(tooltip);
  const stat = extractAccessoryStat(tooltipText);

  return {
    type,
    name,
    icon,
    qualityPercent,
    options,
    statLabel: stat?.label ?? null,
    statAttr: stat?.attr ?? null,
    statValue: stat?.value ?? 0,
    tooltipText,
    raw: item,
  };
}

/**
 * 악세 섹션 UI 틀 렌더 (버튼 없음)
 */
export function renderAccessorySection(rootEl) {
  rootEl.innerHTML = `
    <div class="cardInner">
      <div class="pill">악세</div>

      <p class="help" style="margin:8px 0 0;">
        캐릭터 이름 입력 시 자동으로 악세를 불러옵니다.
      </p>

      <div class="mono" data-accessory-status style="margin-top:8px;">캐릭터를 입력하세요</div>

      <div class="accGrid" data-accessory-grid style="margin-top:12px;"></div>
    </div>
  `;
}

/**
 * 악세 렌더 (첨부 이미지 스타일)
 */
function renderAccessoryGrid(gridEl, items) {
  gridEl.innerHTML = "";

  const order = ["목걸이", "귀걸이", "반지"];
  const rank = new Map(order.map((t, i) => [t, i]));
  const sorted = [...items].sort((a, b) => (rank.get(a.type) ?? 99) - (rank.get(b.type) ?? 99));

  for (const it of sorted) {
    const q = it.qualityPercent != null ? `${it.qualityPercent}%` : "-";

    const row = document.createElement("div");
    row.className = "accItem";
    row.innerHTML = `
      <div class="accLeft">
        <div class="accIconWrap">
          <img class="accIcon" src="${escapeHtml(it.icon)}" alt="${escapeHtml(it.name)}" loading="lazy" />
          <div class="accQuality">${escapeHtml(q)}</div>
        </div>
      </div>

      <div class="accRight">
        <div class="accTypeLine">
          <span class="accTypeTag">${escapeHtml(it.type || "악세")}</span>
          <span class="accName">${escapeHtml(it.name)}</span>
        </div>

        <div class="accOptions">
          ${it.options?.[0] ? `<div class="accOpt">• ${escapeHtml(it.options[0])}</div>` : ""}
          ${it.options?.[1] ? `<div class="accOpt">• ${escapeHtml(it.options[1])}</div>` : ""}
          ${it.options?.[2] ? `<div class="accOpt">• ${escapeHtml(it.options[2])}</div>` : ""}
          ${it.statLabel ? `<div class="accStat">• ${escapeHtml(it.statLabel)}</div>` : ""}
        </div>
      </div>
    `;
    gridEl.appendChild(row);
  }
}

/**
 * ✅ 외부(app.js)에서 호출되는 자동 로드 함수
 * - /equipment 응답에서 악세만 필터링해서 표기 + stat 합산 저장
 * - 악세가 0개면: 응답에 들어있는 Type 목록을 status에 출력해줌(원인 파악)
 */
export async function loadAccessories(accessoryRootEl, globalStatusEl) {
  console.log("[accessory] loadAccessories called");

  const token = window.AppState?.token || "";
  const charName = (window.AppState?.characterName || "").trim();
  if (!token || !charName) return;

  const localStatus = accessoryRootEl.querySelector("[data-accessory-status]");
  const gridEl = accessoryRootEl.querySelector("[data-accessory-grid]");

  if (!localStatus || !gridEl) {
    console.error("[accessory] DOM not found: status or grid");
    return;
  }

  localStatus.textContent = "악세 불러오는 중...";
  if (globalStatusEl) globalStatusEl.textContent = "악세 불러오는 중...";

  try {
    const url = `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(
      charName
    )}/equipment`;

    const raw = await fetchJson(url, {
      accept: "application/json",
      authorization: makeAuthHeader(token),
    });

    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.Equipment)
        ? raw.Equipment
        : [];

    // ✅ 1) 응답에 들어있는 Type 목록을 먼저 확인(디버그)
    const typeList = list
      .map((x) => x?.Type ?? x?.type ?? "")
      .filter(Boolean);

    const uniqueTypes = Array.from(new Set(typeList));
    console.log("[accessory] unique types:", uniqueTypes);

    // ✅ 2) 악세 필터 (가장 기본)
    let accessoriesRaw = list.filter((x) => ACCESSORY_TYPE_NAMES.includes(x?.Type ?? x?.type ?? ""));

    // ✅ 3) 혹시 Type이 "반지(1)" 같이 변형될 경우 대비 (부분 매칭 보강)
    if (accessoriesRaw.length === 0) {
      accessoriesRaw = list.filter((x) => {
        const t = String(x?.Type ?? x?.type ?? "");
        return ACCESSORY_TYPE_NAMES.some((base) => t.includes(base));
      });
    }

    const accessories = accessoriesRaw.map(normalizeAccessoryItem);

    if (accessories.length === 0) {
      gridEl.innerHTML = "";
      localStatus.textContent =
        `악세 0개로 감지됨. 응답 Type 목록: ${uniqueTypes.join(", ")}`;
      if (globalStatusEl) globalStatusEl.textContent = "악세 없음/필터 불일치";
      return;
    }

    // stat 합산
    let statSum = 0;
    const statByAttr = { 힘: 0, 지능: 0, 민첩: 0 };
    for (const it of accessories) {
      const v = Number(it.statValue || 0);
      statSum += v;
      if (it.statAttr && statByAttr[it.statAttr] != null) statByAttr[it.statAttr] += v;
    }

    // AppState 저장
    const bucket = ensureAccessoryBucket();
    bucket.lastRaw = raw;
    bucket.items = accessories;
    bucket.statSum = statSum;
    bucket.statByAttr = statByAttr;

    renderAccessoryGrid(gridEl, accessories);

    localStatus.textContent = `완료 ✅ (악세 ${accessories.length}개, stat 합: ${statSum})`;
    if (globalStatusEl) globalStatusEl.textContent = "악세 로드 완료 ✅";

    console.log("[accessory] items:", accessories);
  } catch (err) {
    console.error(err);
    localStatus.textContent = "악세 로드 실패 (콘솔 확인)";
    if (globalStatusEl) globalStatusEl.textContent = "악세 불러오기 실패";
  }
}
