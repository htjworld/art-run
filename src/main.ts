import { initApp } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('#app element not found');

initApp(root).catch(err => {
  console.error('ArtRun 초기화 실패:', err);
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;padding:20px;text-align:center;">
      <div>
        <h1 style="font-size:20px;margin-bottom:8px;color:#242424">ArtRun을 불러올 수 없어요</h1>
        <p style="color:#6B7280;font-size:14px;">페이지를 새로 고침해 주세요.</p>
      </div>
    </div>
  `;
});
