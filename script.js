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

  const PRETAKEN_MIN = 0.60;
  const PRETAKEN_MAX = 0.85;

  const CONC_MIN = 3000;
  const CONC_MAX = 60000;
  const CONC_STEP_MS = 1000;

  const STEAL_RATIO_MIN = 0.5;
  const STEAL_RATIO_MAX = 0.9;
  const RACE_STEAL_PROB = 0.8;

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

  // 타이머 표시용 div
  let timerEl = document.getElementById("timer");
  if (!timerEl) {
    timerEl = document.createElement("div");
    timerEl.id = "timer";
    Object.assign(timerEl.style, {
      fontSize: "18px",
      color: "#ff6b6b",
      fontWeight: "700",
      textAlign: "center",
      margin: "8px 0",
    });
    screens.seat.prepend(timerEl);
  }

  /* =========================
   * Fonts
   * ========================= */
  (function applyNotoSans() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700;800;900&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent =
      "*{font-family:'Noto Sans',system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif !important;}";
    document.head.appendChild(style);
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
  const MAX_ATTEMPTS = 3;

  let timer = null;
  let remainingTime = 60;

  /* =========================
   * Utils
   * ========================= */
  function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function randInt(a, b) {
    return Math.floor(rand(a, b));
  }
  function alphaForRow(i) {
    return String.fromCharCode("A".charCodeAt(0) + i);
  }
  function seatId(r, c) {
    return `${alphaForRow(r)}${c + 1}`;
  }
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
    Object.values(screens).forEach((el) =>
      el && el.classList.remove("screen--active")
    );
    next.classList.add("screen--active");
  }

  function renderDateButtons() {
    dateList.innerHTML = "";
    DATES.forEach((d) => {
      const btn = document.createElement("button");
      btn.className = "date-btn";
      btn.type = "button";
      btn.dataset.dateId = d.id;
      btn.innerHTML = `
        <div style="font-size:14px;color:#a3a4c0">2025 • 7:00 PM</div>
        <div style="font-size:20px;font-weight:800;">${d.label}</div>`;
      btn.addEventListener("click", () => {
        selectedDateId = d.id;
        selectedSeatIds = new Set();
        renderSeatMap();
        updateSelectionUI();
        switchScreen(screens.seat);
        startTimer(); // 타이머 시작
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
        seat.className =
          "seat " +
          (isTaken
            ? "seat--taken"
            : isSelected
            ? "seat--selected"
            : "seat--available");
        seat.type = "button";
        seat.dataset.seatId = id;
        seat.textContent = id;

        if (isTaken) seat.disabled = true;
        seat.addEventListener("click", () => onSeatClick(id));
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
    el.classList.toggle("seat--selected");
    el.classList.toggle("seat--available");
  }

  function updateSelectionUI() {
    const count = selectedSeatIds.size;
    selectedCountEl.textContent = String(count);
    btnReserve.disabled = count === 0;
  }

  /* =========================
   * Timer
   * ========================= */
  function startTimer() {
    clearInterval(timer);
    remainingTime = 60;
    timerEl.textContent = `⏰ ${remainingTime}s left`;
    timer = setInterval(() => {
      remainingTime--;
      timerEl.textContent = `⏰ ${remainingTime}s left`;
      if (remainingTime <= 0) {
        clearInterval(timer);
        showModal("⏳ Time is up! You failed to complete reservation.");
        setTimeout(() => {
          selectedDateId = null;
          selectedSeatIds = new Set();
          switchScreen(screens.start);
          addHeroBanner(screens.start);
        }, 2000);
      }
    }, 1000);
  }

  /* =========================
   * Modal
   * ========================= */
  function showModal(message, imgSrc = null) {
    modalMessage.innerHTML = imgSrc
      ? `
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
          <img src="${imgSrc}" alt="Result Image"
            style="width:320px;max-width:90%;height:auto;border-radius:12px;object-fit:cover;">
          <div style="font-size:22px;font-weight:800;color:#fff;text-align:center;">${message}</div>
        </div>`
      : `<div style="font-size:22px;font-weight:800;color:#fff;text-align:center;">${message}</div>`;
    modal.classList.add("modal--open");
    modal.setAttribute("
