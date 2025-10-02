(function () {
  // ===== Seats & UI base =====
  const ROWS = 10;
  const COLS = 12;
  const DATES = [
    { id: '2025-03-01', label: 'March 1' },
    { id: '2025-03-02', label: 'March 2' },
    { id: '2025-03-03', label: 'March 3' }
  ];

  const screens = {
    start: document.getElementById('start-screen'),
    date: document.getElementById('date-screen'),
    seat: document.getElementById('seat-screen'),
    confirmation: document.getElementById('confirmation-screen')
  };
  const btnOpen = document.getElementById('btn-open');
  const dateList = document.getElementById('date-list');
  const seatMap = document.getElementById('seat-map');
  const btnReserve = document.getElementById('btn-reserve');
  const selectedCountEl = document.getElementById('selected-count');
  const confirmedSeatsEl = document.getElementById('confirmed-seats');

  // Modal
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modal-message');
  const modalCloseEls = modal.querySelectorAll('[data-modal-close]');

  // State
  let selectedDateId = null;
  const dateIdToTakenSet = new Map(); // dateId -> Set<seatId>
  let selectedSeatIds = new Set();

  // Helpers
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const rand = (a, b) => Math.floor(a + Math.random() * (b - a));
  const alphaForRow = (i) => String.fromCharCode('A'.charCodeAt(0) + i);
  const seatId = (r, c) => `${alphaForRow(r)}${c + 1}`;

  function pickRandomTakenSeats(totalSeats) {
    // 18% - 32% initially taken
    const takenRatio = 0.18 + Math.random() * 0.14;
    const target = Math.floor(totalSeats * takenRatio);
    const taken = new Set();
    while (taken.size < target) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      taken.add(seatId(r, c));
    }
    return taken;
  }
  function ensureDateTakenSet(dateId) {
    if (!dateIdToTakenSet.has(dateId)) {
      dateIdToTakenSet.set(dateId, pickRandomTakenSeats(ROWS * COLS));
    }
    return dateIdToTakenSet.get(dateId);
  }
  function switchScreen(next) {
    Object.values(screens).forEach((el) => el && el.classList.remove('screen--active'));
    next.classList.add('screen--active');
  }
  function renderDateButtons() {
    dateList.innerHTML = '';
    DATES.forEach((d) => {
      const btn = document.createElement('button');
      btn.className = 'date-btn';
      btn.type = 'button';
      btn.dataset.dateId = d.id;
      btn.innerHTML = `<div style="font-size:14px;color:#a3a4c0">2025 • 7:00 PM</div><div style="font-size:20px;font-weight:800;">${d.label}</div>`;
      btn.addEventListener('click', () => {
        selectedDateId = d.id;
        selectedSeatIds = new Set();
        renderSeatMap();
        updateSelectionUI();
        switchScreen(screens.seat);
      });
      dateList.appendChild(btn);
    });
  }
  function renderSeatMap() {
    const takenSet = ensureDateTakenSet(selectedDateId);
    seatMap.innerHTML = '';
    seatMap.setAttribute('role', 'grid');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = seatId(r, c);
        const isTaken = takenSet.has(id);
        const isSelected = selectedSeatIds.has(id);

        const seat = document.createElement('button');
        seat.className = 'seat ' + (isTaken ? 'seat--taken' : isSelected ? 'seat--selected' : 'seat--available');
        seat.type = 'button';
        seat.dataset.seatId = id;
        seat.setAttribute('aria-label', `Seat ${id}`);
        seat.setAttribute('role', 'gridcell');
        seat.textContent = id;
        if (isTaken) {
          seat.setAttribute('aria-disabled', 'true');
          seat.disabled = true;
        }
        seat.addEventListener('click', () => onSeatClick(id));
        seatMap.appendChild(seat);
      }
    }
  }
  function onSeatClick(id) {
    const takenSet = ensureDateTakenSet(selectedDateId);
    if (takenSet.has(id)) return;

    if (selectedSeatIds.has(id)) selectedSeatIds.delete(id);
    else selectedSeatIds.add(id);

    updateSelectionUI();
    const el = seatMap.querySelector(`[data-seat-id="${id}"]`);
    if (!el) return;
    el.classList.toggle('seat--selected');
    el.classList.toggle('seat--available');
  }
  function updateSelectionUI() {
    const count = selectedSeatIds.size;
    selectedCountEl.textContent = String(count);
    btnReserve.disabled = count === 0 || cooling;
  }
  function showModal(message) {
    modalMessage.textContent = message;
    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');
  }

  // ===== Hard mode: concurrency + surge + rate limit + streak penalty =====

  // 0) 배너가 없으면 생성
  let banner = document.getElementById('concurrency-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'concurrency-banner';
    banner.setAttribute('aria-live', 'polite');
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.right = '0';
    banner.style.padding = '12px 16px';
    banner.style.textAlign = 'center';
    banner.style.zIndex = '9999';
    banner.style.background = '#2a2f36';
    banner.style.color = '#ffd166';
    banner.style.borderBottom = '8px solid #101317';
    document.body.prepend(banner);
    // 본문 내려줌
    document.body.style.paddingTop = (parseInt(getComputedStyle(document.body).paddingTop || 0,10) + 56) + 'px';
  }

  // 1) 동시 접속자 시뮬레이션
  let concurrency = Math.floor(80000 + Math.random()*40000);
  function stepConcurrency(){
    const pct = 0.005 + Math.random()*0.01;
    const dir = Math.random() < 0.5 ? -1 : 1;
    concurrency = clamp(Math.floor(concurrency*(1+dir*pct)), 30000, 220000);
    banner.textContent = `Concurrent users: ${concurrency.toLocaleString()} waiting`;
  }
  setInterval(stepConcurrency, 1000); stepConcurrency();

  // 2) 간헐적 과부하 서지
  let surgeBoost = 0;
  (function scheduleSurge(){
    setTimeout(()=>{
      surgeBoost = 0.10; // +10%
      setTimeout(()=>{ surgeBoost = 0; scheduleSurge(); }, rand(5000,10000)); // 5~10s
    }, rand(15000,30000)); // 15~30s
  })();

  // 3) 분당 시도 제한
  const ATTEMPTS_PER_MIN = 6;
  const attempts = [];
  function canAttempt(){
    const now = Date.now();
    while(attempts.length && now - attempts[0] > 60000) attempts.shift();
    return attempts.length < ATTEMPTS_PER_MIN;
  }
  function markAttempt(){ attempts.push(Date.now()); }

  // 4) 실패확률 구성요소
  const BASE_FAIL = 0.85;             // 기본 85%
  const CONC_FACTOR = 0.6 / 40000;    // 동접 가중
  const MAX_FAIL = 0.995;             // 상한
  let failStreak = 0;
  let cooling = false;
  let cooldownTimer = null;

  function getFailProb(){
    const concPart = concurrency * CONC_FACTOR;
    const streakPart = Math.min(failStreak, 4) * 0.05; // 최대 +0.20
    // 선택 좌석이 많으면 추가 패널티(+0~0.10)
    const seatPart = Math.min(selectedSeatIds.size * 0.02, 0.10);
    return clamp(BASE_FAIL + concPart + surgeBoost + streakPart + seatPart, BASE_FAIL, MAX_FAIL);
  }

  function applyCooldown(ms){
    cooling = true;
    let left = Math.ceil(ms/1000);
    btnReserve.disabled = true;
    btnReserve.classList.add('is-cooling');
    const original = btnReserve.textContent;
    btnReserve.textContent = `Cooling ${left}s`;
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(()=>{
      left--;
      btnReserve.textContent = `Cooling ${left}s`;
      if(left<=0){
        clearInterval(cooldownTimer);
        btnReserve.disabled = selectedSeatIds.size===0;
        btnReserve.classList.remove('is-cooling');
        btnReserve.textContent = original;
        cooling = false;
      }
    },1000);
  }

  // 5) 가짜 대기열 토큰(10% 실패)
  function acquireToken(){
    return new Promise((resolve)=>{
      const delay = rand(70,1500);
      setTimeout(()=> resolve(Math.random() >= 0.10), delay);
    });
  }

  // ===== 예약 시도 =====
  function formatDateLabel(dateId) {
    const d = DATES.find((x) => x.id === dateId);
    return d ? d.label : dateId;
  }
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function attemptReserve() {
    if (!selectedDateId || selectedSeatIds.size === 0) return;
    const takenSet = ensureDateTakenSet(selectedDateId);

    if (cooling) return;
    if (!canAttempt()){
      applyCooldown(10000); // 분당 제한 초과
      showModal('Too many attempts. Please wait a moment.');
      return;
    }
    markAttempt();

    // 토큰 획득 실패 시 즉시 실패
    const tokenOK = await acquireToken();
    if (!tokenOK) {
      failStreak++;
      // 일부 좌석을 남에게 뺏기도록
      const selected = Array.from(selectedSeatIds);
      const toTakeCount = Math.max(1, Math.floor(selected.length * (0.4 + Math.random() * 0.4)));
      shuffleArray(selected);
      for (let i = 0; i < toTakeCount; i++) {
        takenSet.add(selected[i]);
        selectedSeatIds.delete(selected[i]);
      }
      renderSeatMap(); updateSelectionUI();
      applyCooldown(rand(2000,4000));
      showModal('Queue token failed. High traffic. Try again.');
      return;
    }

    // 동시접속 기반 실패
    const failChance = getFailProb();
    const didFail = Math.random() < failChance;

    // 경합으로 인해 좌석이 이미 선점된 경우 강제 실패
    let raceTaken = false;
    selectedSeatIds.forEach((id) => { if (takenSet.has(id)) raceTaken = true; });

    if (didFail || raceTaken) {
      failStreak++;
      const selected = Array.from(selectedSeatIds);
      const toTakeCount = Math.max(1, Math.floor(selected.length * (0.4 + Math.random() * 0.4)));
      shuffleArray(selected);
      for (let i = 0; i < toTakeCount; i++) {
        takenSet.add(selected[i]);
        selectedSeatIds.delete(selected[i]);
      }
      renderSeatMap(); updateSelectionUI();

      // 연속 실패 수에 따라 쿨다운 강화
      if (failStreak >= 3) applyCooldown(rand(12000,20000));
      else if (failStreak === 2) applyCooldown(rand(6000,10000));
      else applyCooldown(rand(2000,4000));

      showModal('Someone else has reserved those seats. Please review your selection and try again.');
      return;
    }

    // 성공
    failStreak = 0;
    const reserved = Array.from(selectedSeatIds);
    reserved.forEach((id) => takenSet.add(id));
    confirmedSeatsEl.textContent = `Reserved seats for ${formatDateLabel(selectedDateId)}: ${reserved.join(', ')}`;
    selectedSeatIds.clear();
    renderSeatMap(); updateSelectionUI();
    switchScreen(screens.confirmation);
  }

  // ===== Wiring =====
  btnOpen.addEventListener('click', () => {
    renderDateButtons();
    switchScreen(screens.date);
  });
  btnReserve.addEventListener('click', () => { attemptReserve(); });
  modalCloseEls.forEach((el) => el.addEventListener('click', closeModal));
  modal.addEventListener('click', (e) => { if (e.target && e.target.hasAttribute('data-modal-close')) closeModal(); });
  document.getElementById('btn-restart').addEventListener('click', () => {
    selectedDateId = null;
    selectedSeatIds = new Set();
    switchScreen(screens.start);
  });
})();
