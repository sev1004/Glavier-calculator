// js/features/equipment/equipment.api.js

import { fetchJson, makeAuthHeader } from "../../core/api.js";

const API_BASE_URL = "https://developer-lostark.game.onstove.com";

/**
 * 캐릭터의 장비 정보를 로스트아크 API를 통해 가져옵니다.
 * @param {string} characterName - 검색할 캐릭터 이름
 * @param {string} token - 로스트아크 개발자 API 토큰 (JWT)
 * @returns {Promise<Object>} API 응답 객체
 */
export async function fetchCharacterEquipment(characterName, token) {
  if (!characterName) {
    throw new Error("캐릭터 이름이 필요합니다.");
  }
  if (!token) {
    throw new Error("API 토큰이 필요합니다.");
  }

  const url = `${API_BASE_URL}/armories/characters/${encodeURIComponent(
    characterName
  )}/equipment`;

  const headers = {
    accept: "application/json",
    authorization: makeAuthHeader(token),
  };

  return fetchJson(url, headers);
}
