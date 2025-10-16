(function () {
  /* =========================
   * Config
   * ========================= */
  const ROWS = 10;
  const COLS = 12;
  const DATES = [
    { id: "2025-12-23", label: "23, Dec" },
    { id: "2025-12-24", label: "24, Dec" },
    { id: "2025-12-25", label: "25, Dec" },
  ];

  const BASE_SUCCESS = 0.20;
  const SUCCESS_BONUS = 0.05;
  const MAX_SUCCESS = 0.85;
  const MIN_SUCCESS = 0.02;

  const PRETAKEN_MIN = 0.20;
  const PRETAKEN_MAX = 0.35;

  const CONC_MIN = 3000;
  const CONC_MAX = 60000;
  const CONC_STEP_MS = 1000;

  const STEAL_RATIO_MIN = 0.5;
  const STEAL_RATIO_MAX = 0.9;
  const RACE_STEAL_PROB = 0.8;

  const MAX_ATTEMPTS = 3;
  const RESERVE_TIME_LIMIT = 10; // 초 제한

  /* =========================
   * DOM
   * ========================= */
  const screens = {
    start: document.getElementById("start-screen"),
    date: document.getElementById("date-screen"),
    seat: document.getElementById("seat-screen"),
    confirmation: document.getElementById("confirmation-screen"),
  };
  const btnOpen = document.getElementById("btn-open");
  const dateList = document.getElementById("date-list");
  const seatMap = document.getElementById("seat-map");
  const btnReserve = document.getElementById("btn-reserve");
  const selectedCountEl = document.getElementById("selected-count");
  const confirmedSeatsEl = document.getElementById("confirmed-seats");

  const modal = document.getElementById("modal");
  const modalMessage = document.getElementById("modal-message");
  const modalCloseEls = modal.querySelectorAll("[data-modal-close]");

  let timerDisplay = null;
  let timer = null;
  let timeLeft = RESERVE_TIME_LIMIT;

  (function applyNotoSans() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700;800;900&display=swap";
    document.head.appendChild(link);
  })();

  /* =========================
   * State
   * ========================= */
  let selectedDateId = null;
  const dateIdToTakenSet = new Map();
  let selectedSeatIds = new Set();
  let concurrency = randInt(CONC_MIN, CONC_MAX);
  let concTimer = null;
  let attemptCount = 0;

  /* =========================
   * Utils
   * ========================= */
  function clamp(x, min, max) { return Math.max(min, Math.min(max, x)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b)); }
  function alphaForRow(i) { return String.fromCharCode("A".charCodeAt(0) + i); }
  function seatId(r, c) { return `${alphaForRow(r)}${c + 1}`; }
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* =========================
   * Pre-taken seats
   * ========================= */
  function pickRandomTakenSeats(totalSeats) {
    const takenRatio = rand(PRETAKEN_MIN, PRETAKEN_MAX);
    const target = Math.floor(totalSeats * takenRatio);
    const taken = new Set();
    while (taken.size < target) {
      const r = randInt(0, ROWS);
      const c = randInt(0, COLS);
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

  /* =========================
   * Screens
   * ========================= */
  function switchScreen(next) {
    Object.values(screens).forEach((el) => el && el.classList.remove("screen--active"));
    next.classList.add("screen--active");
  }

  function renderDateButtons() {
    dateList.innerHTML = "";
    DATES.forEach((d) => {
      const btn = document.createElement("button");
      btn.className = "date-btn";
      btn.type = "button";
      btn.dataset.dateId = d.id;
      btn.innerHTML =
        `<div style="font-size:14px;color:#a3a4c0">2025 • 7:00 PM</div>` +
        `<div style="font-size:20px;font-weight:800;">${d.label}</div>`;
      btn.addEventListener("click", () => {
        selectedDateId = d.id;
        selectedSeatIds = new Set();
        renderSeatMap();
        updateSelectionUI();
        startTimer(); // 타이머 시작
        switchScreen(screens.seat);
      });
      dateList.appendChild(btn);
    });
  }

  function renderSeatMap() {
    const takenSet = ensureDateTakenSet(selectedDateId);
    seatMap.innerHTML = "";
    seatMap.setAttribute("role", "grid");

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = seatId(r, c);
        const isTaken = takenSet.has(id);
        const isSelected = selectedSeatIds.has(id);

        const seat = document.createElement("button");
        seat.className = "seat " + (isTaken ? "seat--taken" : isSelected ? "seat--selected" : "seat--available");
        seat.type = "button";
        seat.dataset.seatId = id;
        seat.textContent = id;
        if (isTaken) seat.disabled = true;

        seat.addEventListener("click", () => onSeatClick(id));
        seatMap.appendChild(seat);
      }
    }

    // 타이머 표시 UI
    if (!timerDisplay) {
      timerDisplay = document.createElement("div");
      timerDisplay.style.cssText = "margin:12px auto;font-size:20px;font-weight:700;color:#fff;text-align:center;";
      seatMap.parentNode.insertBefore(timerDisplay, seatMap);
    }
    updateTimerDisplay();
  }

  /* =========================
   * Timer Logic
   * ========================= */
  function startTimer() {
    clearInterval(timer);
    timeLeft = RESERVE_TIME_LIMIT;
    updateTimerDisplay();
    timer = setInterval(() => {
      timeLeft--;
      updateTimerDisplay();
      if (timeLeft <= 0) {
        clearInterval(timer);
        showModal("⏰ Time’s up! Bots took the seats!", "https://reactiongifs.com/r/2013/03/failed.gif");
        resetGame();
      }
    }, 1000);
  }
  function updateTimerDisplay() {
    if (timerDisplay) timerDisplay.textContent = `⏱ ${String(timeLeft).padStart(2, "0")}s remaining`;
  }
  function resetGame() {
    clearInterval(timer);
    attemptCount = 0;
    selectedDateId = null;
    selectedSeatIds = new Set();
    setTimeout(() => switchScreen(screens.start), 3000);
  }

  /* =========================
   * Modal
   * ========================= */
  function showModal(message, imgSrc = null) {
    modalMessage.innerHTML = imgSrc
      ? `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
           <img src="${imgSrc}" alt="Result Image"
                style="width:320px;max-width:90%;height:auto;border-radius:12px;object-fit:cover;">
           <div style="font-size:22px;font-weight:800;color:#fff;text-align:center;">${message}</div>
         </div>`
      : `<div style="font-size:22px;font-weight:800;color:#fff;text-align:center;">${message}</div>`;
    modal.classList.add("modal--open");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    modal.classList.remove("modal--open");
    modal.setAttribute("aria-hidden", "true");
  }

  /* =========================
   * Concurrency
   * ========================= */
  let banner = document.getElementById("concurrency-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "concurrency-banner";
    document.body.prepend(banner);
  }
  function tickConcurrency() {
    const pct = rand(0.005, 0.02);
    const dir = Math.random() < 0.5 ? -1 : 1;
    concurrency = clamp(Math.floor(concurrency * (1 + dir * pct)), CONC_MIN, CONC_MAX);
    banner.textContent = `Concurrent users: ${concurrency.toLocaleString()} waiting`;
  }

  /* =========================
   * Success Model + Flow
   * ========================= */
  function currentSuccessProb() {
    const concNorm = (concurrency - CONC_MIN) / (CONC_MAX - CONC_MIN);
    const concPenalty = 0.3 * clamp(concNorm, 0, 1);
    const seatPenalty = Math.min(selectedSeatIds.size * 0.04, 0.12);
    const spikePenalty = spikeActive ? 0.2 : 0;
    const raw = BASE_SUCCESS + SUCCESS_BONUS - concPenalty - seatPenalty - spikePenalty;
    return clamp(raw, MIN_SUCCESS, MAX_SUCCESS);
  }

  let spikeActive = false;
  function scheduleSpike() {
    const nextIn = randInt(10000, 20000);
    setTimeout(() => {
      spikeActive = true;
      setTimeout(() => { spikeActive = false; scheduleSpike(); }, randInt(2000, 6000));
    }, nextIn);
  }

  function commitReservation(takenSet) {
    const reserved = Array.from(selectedSeatIds);
    reserved.forEach((id) => takenSet.add(id));
    confirmedSeatsEl.textContent =
      `Reserved seats for ${formatDateLabel(selectedDateId)}: ${reserved.join(", ")}`;
    selectedSeatIds.clear();
    renderSeatMap();
    updateSelectionUI();
    switchScreen(screens.confirmation);
  }

  function failReservation(takenSet) {
    if (Math.random() < RACE_STEAL_PROB && selectedSeatIds.size > 0) {
      const selected = shuffleArray(Array.from(selectedSeatIds));
      const stealCnt = Math.max(1, Math.floor(selected.length * rand(STEAL_RATIO_MIN, STEAL_RATIO_MAX)));
      for (let i = 0; i < stealCnt; i++) {
        takenSet.add(selected[i]);
        selectedSeatIds.delete(selected[i]);
      }
      renderSeatMap();
      updateSelectionUI();
    }
  }

  function attemptReserve() {
    if (!selectedDateId || selectedSeatIds.size === 0) return;
    const takenSet = ensureDateTakenSet(selectedDateId);
    attemptCount++;
    const win = Math.random() < currentSuccessProb();

    if (win) {
      clearInterval(timer);
      commitReservation(takenSet);
      showModal("🎉 Conglaturation!!",
        "https://media0.giphy.com/media/v1.Y2lkPTZjMDliOTUyY2duNTFnOGpocGgyenhwaWR0dWY4NHJ6cjRndXE3ZWg1cmw4aWdmbSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oz9ZE2Oo9zRC/source.gif");
      resetGame();
    } else {
      failReservation(takenSet);
      if (attemptCount >= MAX_ATTEMPTS) {
        clearInterval(timer);
        showModal("💀 You failed, Bots already occupied every seat",
          "https://reactiongifs.com/r/2013/03/failed.gif");
        resetGame();
      } else {
        showModal(`Someone else reserved first. (${attemptCount}/${MAX_ATTEMPTS} tries)`);
      }
    }
  }

  /* =========================
   * Wiring
   * ========================= */
  btnOpen.addEventListener("click", () => {
    renderDateButtons();
    switchScreen(screens.date);
  });
  btnReserve.addEventListener("click", attemptReserve);
  modalCloseEls.forEach((el) => el.addEventListener("click", closeModal));
  document.getElementById("btn-restart").addEventListener("click", resetGame);

  tickConcurrency();
  concTimer = setInterval(tickConcurrency, CONC_STEP_MS);
  scheduleSpike();
})();
