// main.js
console.log("main.js 연결 완료 ✅");

// 페이지가 다 로드된 뒤에 실행되게 안전장치
document.addEventListener("DOMContentLoaded", () => {
  const testBtn = document.querySelector("#testBtn");
  const testResult = document.querySelector("#testResult");

  if (testBtn && testResult) {
    testBtn.addEventListener("click", () => {
      const now = new Date();
      testResult.textContent = `클릭됨! ${now.toLocaleTimeString("ko-KR")}`;
      console.log("테스트 버튼 클릭 ✅");
    });
  }

  console.log("DOM 로드 완료 ✅");

  // 테스트용: 화면에 현재 시간 표시
  const versionBox = document.querySelector("header div");
  if (versionBox) {
    const now = new Date();
    versionBox.textContent = `v0.1 • ${now.toLocaleString("ko-KR")}`;
  }
});
