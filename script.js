document.addEventListener("DOMContentLoaded", () => {
  /* =========================
   * Config
   * ========================= */
  const ROWS = 10, COLS = 12;
  const DATES = [
    { id: "2025-12-23", label: "23, Dec" },
    { id: "2025-12-24", label: "24, Dec" },
    { id: "2025-12-25", label: "25, Dec" },
  ];
  const CONC_MIN = 3000, CONC_MAX = 60000, CONC_STEP_MS = 1000;
  const BASE_SUCCESS = 0.2, SUCCESS_BONUS = 0.05, MAX_SUCCESS = 0.85, MIN_SUCCESS = 0.02;
  const PRETAKEN_MIN = 0.2, PRETAKEN_MAX = 0.35;
  const STEAL_RATIO_MIN = 0.5, STEAL_RATIO_MAX = 0.9, RACE_STEAL_PROB = 0.8;
  const MAX_ATTEMPTS = 3;
  const HERO_IMG_URL = "https://drive.google.com/uc?export=view&id=1jOnL0Lw4trHbN1L74uT83gynLsciRObZ";

  /* =========================
   * Base setup
   * ========================= */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b)); }
  function clamp(x, min, max) { return Math.max(min, Math.min(max, x)); }
  function alphaForRow(i) { return String.fromCharCode(65 + i); }
  function seatId(r, c) { return `${alphaForRow(r)}${c + 1}`; }
  function shuffleArray(a) { for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* =========================
   * Banner
   * ========================= */
  const banner = document.createElement("div");
  Object.assign(banner.style, {
    position: "fixed", top: 0, left: 0, right: 0,
    padding: "14px 16px", textAlign: "center", background: "#2a2f36",
    color: "#ffd166", borderBottom: "8px solid #101317",
    fontSize: "22px", fontWeight: "800", zIndex: "9999"
  });
  document.body.prepend(banner);
  document.body.style.paddingTop = "56px";

  let concurrency = randInt(CONC_MIN, CONC_MAX);
  function tick() {
    const pct = rand(0.005, 0.02), dir = Math.random() < 0.5 ? -1 : 1;
    concurrency = clamp(Math.floor(concurrency * (1 + dir * pct)), CONC_MIN, CONC_MAX);
    banner.textContent = `Concurrent users: ${concurrency.toLocaleString()} waiting`;
  }
  setInterval(tick, CONC_STEP_MS);
  tick();

  /* =========================
   * Elements
   * ========================= */
  const s = {
    start: document.getElementById("start-screen"),
    date: document.getElementById("date-screen"),
    seat: document.getElementById("seat-screen"),
    conf: document.getElementById("confirmation-screen"),
  };
  const btnOpen = document.getElementById("btn-open");
  const btnReserve = document.getElementById("btn-reserve");
  const seatMap = document.getElementById("seat-map");
  const dateList = document.getElementById("date-list");
  const selectedCountEl = document.getElementById("selected-count");
  const confirmedSeatsEl = document.getElementById("confirmed-seats");

  /* =========================
   * Hero banner
   * ========================= */
  function addHeroBanner(target) {
    if (!target || document.querySelector(`#${target.id} #hero-banner`)) return;
    const img = document.createElement("img");
    img.id = "hero-banner";
    img.src = HERO_IMG_URL;
    img.alt = "K-pop Demon Traffic Hunters";
    Object.assign(img.style, {
      width: "100%", maxWidth: "980px", height: "auto",
      display: "block", margin: "24px auto 12px",
      borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.35)"
    });
    img.onerror = () => console.error("❌ Hero image failed to load:", HERO_IMG_URL);
    img.onload = () => console.log("✅ Hero image loaded successfully.");
    target.insertBefore(img, target.firstChild);
  }

  /* =========================
   * Logic (좌석/예약)
   * ========================= */
  const takenMap = new Map();
  function ensureTaken(dateId) {
    if (!takenMap.has(dateId)) {
      const set = new Set();
      const total = ROWS * COLS, taken = Math.floor(total * rand(PRETAKEN_MIN, PRETAKEN_MAX));
      while (set.size < taken) set.add(seatId(randInt(0, ROWS), randInt(0, COLS)));
      takenMap.set(dateId, set);
    }
    return takenMap.get(dateId);
  }

  let selectedDateId = null, selectedSeats = new Set(), attempts = 0;

  function switchScreen(next) {
    Object.values(s).forEach(el => el.classList.remove("screen--active"));
    next.classList.add("screen--active");
  }

  function renderDates() {
    dateList.innerHTML = "";
    DATES.forEach(d => {
      const b = document.createElement("button");
      b.className = "date-btn";
      b.innerHTML = `<div style="color:#aaa;font-size:14px">2025 • 7:00PM</div><div style="font-weight:800;font-size:20px">${d.label}</div>`;
      b.onclick = () => { selectedDateId = d.id; selectedSeats.clear(); renderSeats(); switchScreen(s.seat); };
      dateList.appendChild(b);
    });
  }

  function renderSeats() {
    const taken = ensureTaken(selectedDateId);
    seatMap.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = seatId(r, c);
        const b = document.createElement("button");
        b.textContent = id;
        const st = taken.has(id) ? "seat--taken" : selectedSeats.has(id) ? "seat--selected" : "seat--available";
        b.className = "seat " + st;
        if (taken.has(id)) b.disabled = true;
        b.onclick = () => {
          if (taken.has(id)) return;
          selectedSeats.has(id) ? selectedSeats.delete(id) : selectedSeats.add(id);
          renderSeats();
          updateUI();
        };
        seatMap.appendChild(b);
      }
    }
  }

  function updateUI() {
    selectedCountEl.textContent = selectedSeats.size;
    btnReserve.disabled = selectedSeats.size === 0;
  }

  function tryReserve() {
    if (!selectedDateId) return;
    const p = BASE_SUCCESS + SUCCESS_BONUS - 0.3 * ((concurrency - CONC_MIN) / (CONC_MAX - CONC_MIN));
    const win = Math.random() < clamp(p, MIN_SUCCESS, MAX_SUCCESS);
    if (win) {
      const taken = ensureTaken(selectedDateId);
      selectedSeats.forEach(id => taken.add(id));
      confirmedSeatsEl.textContent = `Reserved: ${[...selectedSeats].join(", ")}`;
      switchScreen(s.conf);
      selectedSeats.clear();
    } else {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        alert("Bots occupied all seats. Restarting.");
        attempts = 0;
        selectedSeats.clear();
        switchScreen(s.start);
        addHeroBanner(s.start);
      } else alert(`Failed (${attempts}/${MAX_ATTEMPTS})`);
    }
  }

  /* =========================
   * Events
   * ========================= */
  btnOpen.onclick = () => { renderDates(); switchScreen(s.date); addHeroBanner(s.date); };
  btnReserve.onclick = tryReserve;
  document.getElementById("btn-restart").onclick = () => { switchScreen(s.start); addHeroBanner(s.start); };

  /* =========================
   * Init
   * ========================= */
  addHeroBanner(s.start);
});
