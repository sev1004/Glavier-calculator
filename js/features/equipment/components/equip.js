import { fetchJson, makeAuthHeader } from "../../core/api.js";

/**
 * [equip.section.js]
 * - 장비 탭에서 "장비(무기/투구/어깨/상의/하의/장갑)" 영역을 렌더하고,
 * - 캐릭터명 입력 시(app.js에서 호출) 장비 API를 조회하여
 *   1) 화면에 장비 리스트(세로 카드) 표시
 *   2) Tooltip에서 계산용 수치(방어구 Stat, 무기 공격력, 추가 피해) 추출
 *   3) AppState에 저장
 *
 * ※ 이 파일은 버튼 클릭 방식이 아니라,
 *    export된 loadEquipment(equipRootEl, globalStatusEl)를 외부(app.js)에서 호출하는 구조.
 */

/** 화면에 표시할 타입 순서(요구사항) */
const ORDER = ["무기", "투구", "어깨", "상의", "하의", "장갑"];
/** 빠른 필터링용 Set */
const VALID_TYPES = new Set(ORDER);

/* =========================================================
 * 공통 유틸 함수들
 * ========================================================= */

/**
 * escapeHtml
 * - API 데이터(아이템명 등)를 innerHTML로 넣을 때 XSS/태그 깨짐 방지용 이스케이프
 */
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * toInt
 * - "203,054" 같은 문자열에서 콤마 제거 후 정수로 변환
 * - 변환 실패 시 null 반환
 */
function toInt(numStr) {
  if (numStr == null) return null;
  const n = Number(String(numStr).replaceAll(",", "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * toFloat
 * - "30.00" 같은 문자열을 실수로 변환
 * - 변환 실패 시 null 반환
 */
function toFloat(numStr) {
  if (numStr == null) return null;
  const n = Number(String(numStr).replaceAll(",", "").trim());
  return Number.isFinite(n) ? n : null;
}

/* =========================================================
 * Tooltip 처리 유틸
 * ========================================================= */

/**
 * flattenTooltipText
 * - Tooltip이 "JSON 문자열"로 오는 경우가 많아서, JSON.parse 후 내부 모든 문자열을 합쳐 하나의 텍스트로 만든다.
 * - JSON이 아니면 원문 문자열 그대로 반환
 *
 * 목적:
 * - 방어구 Stat(힘/지능/민첩), 무기 공격력, 추가 피해 같은 텍스트를 정규식으로 뽑기 위함
 */
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

/**
 * stripTags
 * - Tooltip 안의 <BR>, <FONT> 같은 HTML 태그들을 제거하고 공백 정리
 */
function stripTags(text) {
  return String(text)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * extractQualityFromTooltip
 * - Tooltip JSON 내부에 들어있는 품질 값을 추출한다.
 * - 네 샘플 구조: Element_001.value.qualityValue (숫자)
 *
 * 왜 필요?
 * - API 응답 최상위에 QualityValue가 없는/비정형인 케이스가 있어 Tooltip에서 직접 뽑아야 함.
 */
function extractQualityFromTooltip(tooltip) {
  if (!tooltip) return null;

  try {
    const obj = JSON.parse(String(tooltip));
    const q = obj?.Element_001?.value?.qualityValue ?? null;
    const n = Number(q);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/* =========================================================
 * Tooltip에서 "계산식용 수치" 추출
 * ========================================================= */

/**
 * extractArmorStat
 * - 방어구(투구~어깨) Tooltip에서 힘/지능/민첩 +숫자 값을 찾아 숫자만 반환
 *   예) "<BR>힘 +98524<BR>" => 98524
 */
function extractArmorStat(tooltipText) {
  const m = tooltipText.match(/(?:힘|지능|민첩)\s*\+([\d,]+)/);
  return m ? toInt(m[1]) : null;
}

/**
 * extractWeaponDamage
 * - 무기 Tooltip에서 "무기 공격력 +숫자" 추출
 *   예) "무기 공격력 +203054" => 203054
 */
function extractWeaponDamage(tooltipText) {
  const m = tooltipText.match(/무기\s*공격력\s*\+([\d,]+)/);
  return m ? toInt(m[1]) : null;
}

/**
 * extractExtraDamage
 * - 무기 Tooltip에서 "추가 피해 +30.00%" 추출 후 숫자만 반환(30.00 => 30)
 */
function extractExtraDamage(tooltipText) {
  const m = tooltipText.match(/추가\s*피해\s*\+([\d.,]+)\s*%/);
  return m ? toFloat(m[1]) : null;
}

/* =========================================================
 * API 응답 Normalization / AppState 저장
 * ========================================================= */

/**
 * normalizeEquipmentItem
 * - API 응답 한 아이템 객체에서 우리가 쓰는 필드만 방어적으로 뽑아서 표준 형태로 만든다.
 * - 특히 "품질"은:
 *   1) 최상위 QualityValue/qualityValue 등을 우선 시도
 *   2) 없으면 Tooltip JSON의 Element_001.value.qualityValue에서 fallback
 */
function normalizeEquipmentItem(item) {
  const type = item?.Type ?? item?.type ?? "";
  const name = item?.Name ?? item?.name ?? "";
  const icon = item?.Icon ?? item?.icon ?? "";
  const tooltip = item?.Tooltip ?? item?.tooltip ?? "";

  // 1) 최상위에 품질이 있는 경우
  const topLevelQ =
    item?.QualityValue ??
    item?.qualityValue ??
    item?.Quality ??
    item?.quality ??
    null;

  // 2) Tooltip에 품질이 있는 경우
  const tooltipQ = extractQualityFromTooltip(tooltip);

  // 3) 최종 품질 결정
  const qualityValue = topLevelQ ?? tooltipQ;

  return { type, name, icon, qualityValue, tooltip, raw: item };
}

/**
 * ensureAppStateBucket
 * - 장비 관련 계산용 변수를 AppState에 저장하기 위한 버킷을 보장한다.
 *
 * 저장 형태:
 * window.AppState.equipment = {
 *   itemsByType: { 무기: {...}, 투구: {...} ... },
 *   armorStatByType: { 투구: 98524, ... },
 *   weaponDamage: 203054,
 *   extraDamage: 30,
 *   lastRaw: <원본 응답>
 * }
 */
function ensureAppStateBucket() {
  if (!window.AppState) window.AppState = {};
  if (!window.AppState.equipment) {
    window.AppState.equipment = {
      itemsByType: {},
      armorStatByType: {},
      weaponDamage: null,
      extraDamage: null,
      lastRaw: null,
    };
  }
  return window.AppState.equipment;
}

/* =========================================================
 * UI 렌더 함수들
 * ========================================================= */

/**
 * renderEquipSection
 * - 장비 섹션의 "틀"을 화면에 그린다.
 * - 버튼은 없고, loadEquipment() 호출로 데이터가 들어오면 그리드가 채워진다.
 */
export function renderEquipSection(rootEl) {
  rootEl.innerHTML = `
    <div class="cardInner">
      <div class="pill">장비</div>

      <p class="help" style="margin:8px 0 0;">
        캐릭터 이름 입력 시 자동으로 장비를 불러옵니다.
      </p>

      <div class="mono" data-equip-status style="margin-top:8px;">캐릭터를 입력하세요</div>

      <div class="equipGrid" data-equip-grid style="margin-top:12px;"></div>
    </div>
  `;
}

/**
 * renderEquipmentGrid
 * - 타입 순서(무기→투구→어깨→상의→하의→장갑)대로 세로 카드 목록을 렌더한다.
 * - 표시 내용:
 *   - Icon 이미지
 *   - Name
 *   - 품질(qualityValue) : 아이콘 하단 오버레이로 표시
 */
function renderEquipmentGrid(gridEl, itemsByType) {
  gridEl.innerHTML = "";

  for (const type of ORDER) {
    const it = itemsByType[type];
    if (!it) continue;

    const q = it.qualityValue ?? "-";

    const row = document.createElement("div");
    row.className = "equipItem";
    row.innerHTML = `
      <div class="equipIconWrap">
        <img class="equipIcon" src="${escapeHtml(it.icon)}" alt="${escapeHtml(it.name)}" loading="lazy" />
        <div class="equipQuality">${escapeHtml(q)}</div>
        <div class="equipTypeTag">${escapeHtml(type)}</div>
      </div>

      <div class="equipInfo">
        <div class="equipName">${escapeHtml(it.name)}</div>
      </div>
    `;

    gridEl.appendChild(row);
  }
}

/* =========================================================
 * 외부에서 호출되는 "자동 로드" 함수
 * ========================================================= */

/**
 * loadEquipment (export)
 * - app.js에서 캐릭터명이 입력/변경될 때 호출되는 함수
 * - 장비 API를 호출하여:
 *   1) 장비 아이템을 타입별로 정리(itemsByType)
 *   2) Tooltip에서 계산용 수치 추출(방어구 stat / 무기 공격력 / 추가 피해)
 *   3) AppState에 저장
 *   4) 화면 렌더
 *
 * @param {HTMLElement} equipRootEl - renderEquipSection()이 적용된 DOM root
 * @param {HTMLElement} globalStatusEl - 상단 상태 표시 영역
 */
export async function loadEquipment(equipRootEl, globalStatusEl) {
  const token = window.AppState?.token || "";
  const charName = (window.AppState?.characterName || "").trim();

  // 토큰/캐릭터명이 없으면 로드하지 않음
  if (!token || !charName) return;

  const localStatus = equipRootEl.querySelector("[data-equip-status]");
  const gridEl = equipRootEl.querySelector("[data-equip-grid]");

  // 로딩 UI
  if (localStatus) localStatus.textContent = "장비 불러오는 중...";
  if (globalStatusEl) globalStatusEl.textContent = "장비 불러오는 중...";

  try {
    // ✅ 장비 엔드포인트 (확정)
    const url = `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(
      charName
    )}/equipment`;

    const raw = await fetchJson(url, {
      accept: "application/json",
      authorization: makeAuthHeader(token),
    });

    // AppState 버킷 확보 + 원본 저장
    const bucket = ensureAppStateBucket();
    bucket.lastRaw = raw;

    // 응답이 배열일 수도, { Equipment: [...] } 형태일 수도 있어 방어적으로 처리
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.Equipment)
        ? raw.Equipment
        : [];

    // 필요한 필드 표준화
    const items = list.map(normalizeEquipmentItem);

    // 결과 저장용
    const itemsByType = {};
    const armorStatByType = {};
    let weaponDamage = null;
    let extraDamage = null;

    // 타입별로 정리 + Tooltip에서 수치 추출
    for (const it of items) {
      const type = it.type;
      if (!VALID_TYPES.has(type)) continue;

      // Tooltip을 text로 펼치고 태그 제거(정규식용)
      const tooltipText = stripTags(flattenTooltipText(it.tooltip));

      // 화면 표시에 필요한 것 + 디버그용 tooltipText를 itemsByType에 저장
      itemsByType[type] = {
        type,
        name: it.name,
        icon: it.icon,
        qualityValue: it.qualityValue, // ✅ Tooltip 기반 품질까지 반영됨
        tooltipText,
        raw: it.raw,
      };

      // 계산식용 변수 추출
      if (type !== "무기") {
        // 방어구 stat
        const stat = extractArmorStat(tooltipText);
        if (stat != null) armorStatByType[type] = stat;
      } else {
        // 무기 공격력 / 추가 피해
        weaponDamage = extractWeaponDamage(tooltipText) ?? weaponDamage;
        extraDamage = extractExtraDamage(tooltipText) ?? extraDamage;
      }
    }

    // AppState 저장(계산식에서 사용할 변수들)
    bucket.itemsByType = itemsByType;
    bucket.armorStatByType = armorStatByType;
    bucket.weaponDamage = weaponDamage;
    bucket.extraDamage = extraDamage;

    // UI 렌더
    if (gridEl) renderEquipmentGrid(gridEl, itemsByType);

    // 상태 표시
    if (localStatus) {
      localStatus.textContent =
        `완료 ✅ (무기공격력: ${weaponDamage ?? "-"}, 추가피해: ${extraDamage ?? "-"}%)`;
    }
    if (globalStatusEl) globalStatusEl.textContent = "장비 로드 완료 ✅";

    // 디버그 로그
    console.log("[equipment] itemsByType:", itemsByType);
    console.log("[equipment] armorStatByType:", armorStatByType);
    console.log("[equipment] weaponDamage:", weaponDamage);
    console.log("[equipment] extraDamage:", extraDamage);
  } catch (err) {
    console.error(err);
    if (localStatus) localStatus.textContent = "장비 로드 실패 (콘솔 확인)";
    if (globalStatusEl) globalStatusEl.textContent = "장비 불러오기 실패";
  }
}
