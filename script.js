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

  // 난이도 조정 (더 어렵게)
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

  /* =========================
   * Global font
   * ========================= */
  (function applyNotoSans() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700;800;900&display=swap";
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
        seat.setAttribute("aria-label", `Seat ${id}`);
        seat.setAttribute("role", "gridcell");
        seat.textContent = id;

        if (isTaken) {
          seat.setAttribute("aria-disabled", "true");
          seat.disabled = true;
        }

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

  function showModal(message) {
    modalMessage.textContent = message;
    modal.classList.add("modal--open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("modal--open");
    modal.setAttribute("aria-hidden", "true");
  }

  /* =========================
   * Concurrency banner
   * ========================= */
  let banner = document.getElementById("concurrency-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "concurrency-banner";
    banner.setAttribute("aria-live", "polite");
    Object.assign(banner.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      padding: "14px 16px",
      textAlign: "center",
      zIndex: "9999",
      background: "#2a2f36",
      color: "#ffd166",
      borderBottom: "8px solid #101317",
      fontSize: "22px",
      fontWeight: "800",
      letterSpacing: "0.5px",
    });
    document.body.prepend(banner);
    document.body.style.paddingTop =
      (parseInt(getComputedStyle(document.body).paddingTop || 0, 10) + 56) + "px";
  }

  function tickConcurrency() {
    const pct = rand(0.005, 0.02);
    const dir = Math.random() < 0.5 ? -1 : 1;
    concurrency = clamp(Math.floor(concurrency * (1 + dir * pct)), CONC_MIN, CONC_MAX);
    banner.textContent = `Concurrent users: ${concurrency.toLocaleString()} waiting`;
  }

  /* =========================
   * Success model
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

  /* =========================
   * Reservation flow
   * ========================= */
  function formatDateLabel(dateId) {
    const d = DATES.find((x) => x.id === dateId);
    return d ? d.label : dateId;
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
    showModal("Someone else has reserved those seats. Please review your selection and try again");
  }

  function attemptReserve() {
    if (!selectedDateId || selectedSeatIds.size === 0) return;
    const takenSet = ensureDateTakenSet(selectedDateId);
    const p = currentSuccessProb();
    const win = Math.random() < p;

    if (win) commitReservation(takenSet);
    else failReservation(takenSet);
  }

  /* =========================
   * Hero banner (start + date screens)
   * ========================= */
  function addHeroBanner(screen) {
    if (!screen || document.querySelector(`#${screen.id} #hero-banner`)) return;

    const hero = document.createElement("img");
    hero.id = "hero-banner";
    hero.src = "https://drive.usercontent.google.com/download?id=1jOnL0Lw4trHbN1L74uT83gynLsciRObZ&export=view&authuser=2";
    hero.alt = "K-pop Demon Traffic Hunters";
    hero.referrerPolicy = "no-referrer";
    hero.loading = "eager";
    Object.assign(hero.style, {
      width: "100%",
      maxWidth: "980px",
      height: "auto",
      display: "block",
      margin: "24px auto 12px",
      borderRadius: "16px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)"
    });

    screen.insertBefore(hero, screen.firstChild);
  }

  /* =========================
   * Wiring
   * ========================= */
  btnOpen.addEventListener("click", () => {
    renderDateButtons();
    switchScreen(screens.date);
    addHeroBanner(screens.date);
  });

  btnReserve.addEventListener("click", attemptReserve);

  modalCloseEls.forEach((el) => el.addEventListener("click", closeModal));
  modal.addEventListener("click", (e) => {
    if (e.target && e.target.hasAttribute("data-modal-close")) closeModal();
  });

  document.getElementById("btn-restart").addEventListener("click", () => {
    selectedDateId = null;
    selectedSeatIds = new Set();
    switchScreen(screens.start);
    addHeroBanner(screens.start);
  });

  // init
  tickConcurrency();
  concTimer = setInterval(tickConcurrency, CONC_STEP_MS);
  scheduleSpike();
  addHeroBanner(screens.start);
})();
