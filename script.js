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
    btnReserve.disabled = count === 0;
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

  // ===== Concurrency banner (auto-create if missing) =====
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
    document.body.style.paddingTop = (parseInt(getComputedStyle(document.body).paddingTop || 0,10) + 56) + 'px';
  }

  // ===== High-fail difficulty (no cooldown, no rate-limit) =====
  let concurrency = Math.floor(80000 + Math.random()*40000);
  function stepConcurrency(){
    const pct = 0.005 + Math.random()*0.01;
    const dir = Math.random() < 0.5 ? -1 : 1;
    concurrency = clamp(Math.floor(concurrency*(1+dir*pct)), 30000, 220000);
    banner.textContent = `Concurrent users: ${concurrency.toLocaleString()} waiting`;
  }
  setInterval(stepConcurrency, 1000); stepConcurrency();

  const BASE_FAIL = 0.90;             // 기본 90% 실패
  const CONC_FACTOR = 0.6 / 40000;    // 동접 가중
  const MAX_FAIL = 0.995;             // 상한
  let failStreak = 0;                  // 메시지·연출용 누적만 사용

  // 간헐 과부하(+10%) 가끔
  let surgeBoost = 0;
  (function scheduleSurge(){
    setTimeout(()=>{
      surgeBoost = 0.10;
      setTimeout(()=>{ surgeBoost = 0; scheduleSurge(); }, rand(5000,10000));
    }, rand(15000,30000));
  })();

  function getFailProb(){
    const concPart = concurrency * CONC_FACTOR;
    const seatPart = Math.min(selectedSeatIds.size * 0.02, 0.10); // 좌석 많이 잡을수록 더 어려움
    return clamp(BASE_FAIL + concPart + surgeBoost + seatPart, BASE_FAIL, MAX_FAIL);
  }

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

    // 실패 확률 계산
    const failChance = getFailProb();
    const didFail = Math.random() < failChance;

    // 경합으로 이미 선점된 좌석이 있으면 강제 실패
    let raceTaken = false;
    selectedSeatIds.forEach((id) => { if (takenSet.has(id)) raceTaken = true; });

    if (didFail || raceTaken) {
      failStreak++;
      // 일부 좌석을 남에게 뺏기도록
      const selected = Array.from(selectedSeatIds);
      const toTakeCount = Math.max(1, Math.floor(selected.length * (0.4 + Math.random() * 0.4))); // 40~80%
      shuffleArray(selected);
      for (let i = 0; i < toTakeCount; i++) {
        takenSet.add(selected[i]);
        selectedSeatIds.delete(selected[i]);
      }
      renderSeatMap(); updateSelectionUI();

      // 고정 실패 문구
      showModal('Someone else has reserved those seats. Please review your selection and try again');
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
