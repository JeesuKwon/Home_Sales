(function () {
  // Basic configuration
  const ROWS = 10;
  const COLS = 12;
  const DATES = [
    { id: '2025-03-01', label: 'March 1' },
    { id: '2025-03-02', label: 'March 2' },
    { id: '2025-03-03', label: 'March 3' }
  ];

  // Elements
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

  // Modal elements
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modal-message');
  const modalCloseEls = modal.querySelectorAll('[data-modal-close]');

  // State
  let selectedDateId = null;
  const dateIdToTakenSet = new Map(); // dateId -> Set of seatIds
  let selectedSeatIds = new Set();

  // Helpers
  function alphaForRow(rowIndex) {
    return String.fromCharCode('A'.charCodeAt(0) + rowIndex);
  }

  function seatId(rowIndex, colIndex) {
    return `${alphaForRow(rowIndex)}${colIndex + 1}`;
  }

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
    for (const key of Object.keys(screens)) {
      const el = screens[key];
      if (el) el.classList.remove('screen--active');
    }
    next.classList.add('screen--active');
  }

  function renderDateButtons() {
    dateList.innerHTML = '';
    DATES.forEach((d) => {
      const btn = document.createElement('button');
      btn.className = 'date-btn';
      btn.type = 'button';
      btn.setAttribute('data-date-id', d.id);
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
        seat.setAttribute('data-seat-id', id);
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
    if (takenSet.has(id)) return; // guard

    if (selectedSeatIds.has(id)) {
      selectedSeatIds.delete(id);
    } else {
      selectedSeatIds.add(id);
    }
    updateSelectionUI();
    // Update a single seat element class for micro performance
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

  function attemptReserve() {
    if (!selectedDateId || selectedSeatIds.size === 0) return;
    const takenSet = ensureDateTakenSet(selectedDateId);

    // Simulate competition: base failure chance
    // Slightly higher failure chance if selecting many seats
    const baseFail = 0.35;
    const extraFail = Math.min(0.25, selectedSeatIds.size * 0.03);
    const failChance = baseFail + extraFail;
    const didFail = Math.random() < failChance;

    // Additionally, if any selected seat just got taken (race), force fail
    let raceTaken = false;
    selectedSeatIds.forEach((id) => {
      if (takenSet.has(id)) raceTaken = true;
    });

    if (didFail || raceTaken) {
      // Convert some of the selected seats into taken to simulate losing the race
      const selected = Array.from(selectedSeatIds);
      const toTakeCount = Math.max(1, Math.floor(selected.length * (0.4 + Math.random() * 0.4))); // 40%-80%
      shuffleArray(selected);
      for (let i = 0; i < toTakeCount; i++) {
        takenSet.add(selected[i]);
        selectedSeatIds.delete(selected[i]);
      }
      renderSeatMap();
      updateSelectionUI();
      showModal('Someone else has reserved those seats. Please review your selection and try again.');
      return;
    }

    // Success
    const reserved = Array.from(selectedSeatIds);
    reserved.forEach((id) => takenSet.add(id));
    confirmedSeatsEl.textContent = `Reserved seats for ${formatDateLabel(selectedDateId)}: ${reserved.join(', ')}`;
    selectedSeatIds.clear();
    renderSeatMap();
    updateSelectionUI();
    switchScreen(screens.confirmation);
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

  // Event wiring
  btnOpen.addEventListener('click', () => {
    renderDateButtons();
    switchScreen(screens.date);
  });

  btnReserve.addEventListener('click', attemptReserve);

  modalCloseEls.forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target && e.target.hasAttribute('data-modal-close')) {
      closeModal();
    }
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    selectedDateId = null;
    selectedSeatIds = new Set();
    // Keep taken seats per date to simulate persistent world across sessions
    switchScreen(screens.start);
  });
})();

