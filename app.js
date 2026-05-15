let phoneWatchlist = [];
let latestPhoneResult = null;
let latestPreventionCard = null;
let latestImageBlob = null;

const AI_SERVER_URL = "https://safecall-ai-server-abc1.onrender.com";

const highRiskWords = [
  "검찰",
  "경찰",
  "금감원",
  "금융감독원",
  "대출",
  "저금리",
  "인증번호",
  "계좌",
  "이체",
  "압수수색",
  "수사",
  "구속",
  "앱 설치",
  "원격제어",
  "보안앱",
  "URL",
  "링크",
  "택배",
  "미납",
  "과태료",
  "명의도용",
  "개인정보",
  "카드정지",
  "소액결제",
  "보안 인증",
  "본인 확인",
  "명의 정지",
  "안전계좌",
  "보호계좌"
];

const dangerousActions = [
  "인증번호를 알려",
  "인증번호 알려",
  "계좌로 보내",
  "입금해",
  "이체해",
  "앱을 설치",
  "설치하세요",
  "통화 끊지",
  "혼자만 알고",
  "은행에 말하지",
  "가족에게 말하지",
  "원격제어",
  "화면 공유",
  "신분증 보내",
  "비밀번호 알려",
  "카드번호 알려",
  "OTP 알려",
  "수수료 입금",
  "선입금"
];

function $(id) {
  return document.getElementById(id);
}

function show(id) {
  const el = $(id);
  if (el) el.classList.remove("hidden");
}

function hide(id) {
  const el = $(id);
  if (el) el.classList.add("hidden");
}

function safeText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function normalizeText(text) {
  return String(text || "").replace(/\s/g, "").toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^0-9+]/g, "");
}

function shuffleArray(items) {
  const copied = [...items];

  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

function getRiskLevel(score) {
  if (score >= 70) return "매우 위험";
  if (score >= 40) return "주의";
  if (score >= 20) return "의심";
  return "낮음";
}

function getBarColor(score) {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f97316";
  if (score >= 20) return "#eab308";
  return "#22c55e";
}

function getJsonFromStorage(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function saveJsonToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function analyzeRisk(text) {
  let score = 0;
  const reasons = [];
  const normalized = normalizeText(text);

  for (const word of highRiskWords) {
    if (text.includes(word) || normalized.includes(normalizeText(word))) {
      score += 10;
      reasons.push(`위험 키워드 감지: ${word}`);
    }
  }

  for (const action of dangerousActions) {
    if (text.includes(action) || normalized.includes(normalizeText(action))) {
      score += 25;
      reasons.push(`고위험 행동 유도 감지: ${action}`);
    }
  }

  if (/https?:\/\//i.test(text) || /bit\.ly|tinyurl|t\.co|goo\.gl|url\.kr|han\.gl/i.test(text)) {
    score += 20;
    reasons.push("외부 링크 또는 단축 URL 포함");
  }

  if (/01[0-9]-?\d{3,4}-?\d{4}/.test(text)) {
    score += 5;
    reasons.push("휴대폰 번호 포함");
  }

  if (/\d{2,6}-?\d{2,6}-?\d{2,8}/.test(text)) {
    score += 10;
    reasons.push("계좌번호 또는 긴 숫자 패턴 의심");
  }

  if (/카카오톡|텔레그램|라인|오픈채팅|문자하지말고|비밀유지/i.test(text)) {
    score += 15;
    reasons.push("비공식 연락수단 또는 비밀 유지 요구 의심");
  }

  score = Math.min(score, 100);

  if (reasons.length === 0) {
    reasons.push("현재 규칙 기준으로 뚜렷한 위험 요소는 적습니다.");
  }

  return {
    score,
    level: getRiskLevel(score),
    reasons
  };
}

function analyzePhoneNumber(rawPhone) {
  const phone = normalizePhone(rawPhone);
  let score = 0;
  const reasons = [];

  if (!phone) {
    return {
      phone,
      score: 0,
      level: "입력 필요",
      reasons: ["전화번호를 입력하세요."]
    };
  }

  const digitsOnly = phone.replace(/^\+82/, "0");

  const officialMatched = phoneWatchlist.find((item) => {
    const target = normalizePhone(item.number).replace(/^\+82/, "0");
    return target === digitsOnly || target === phone;
  });

  if (officialMatched) {
    score += Number(officialMatched.risk || 70);
    reasons.push(`의심 번호 데이터와 일치: ${officialMatched.label || "의심 번호"}`);

    if (officialMatched.reason) {
      reasons.push(officialMatched.reason);
    }
  }

  if (/^070/.test(digitsOnly)) {
    score += 15;
    reasons.push("070 인터넷전화 번호입니다. 정상 번호일 수도 있지만 피싱에 악용될 수 있어 주의가 필요합니다.");
  }

  if (/^001|^002|^006|^\+/.test(phone)) {
    score += 20;
    reasons.push("국제전화 또는 해외 발신 형태입니다. 국내 기관 사칭 전화라면 특히 주의하세요.");
  }

  if (/^010/.test(digitsOnly)) {
    score += 5;
    reasons.push("휴대폰 번호입니다. 개인번호 사칭 가능성을 확인하세요.");
  }

  if (/^02|^031|^032|^051|^053|^042|^062|^052|^044|^033|^041|^043|^054|^055|^061|^063|^064/.test(digitsOnly)) {
    score += 3;
    reasons.push("지역번호 번호입니다. 기관 대표번호와 실제 일치하는지 직접 검색해 확인하세요.");
  }

  if (/(\d)\1{5,}/.test(digitsOnly)) {
    score += 10;
    reasons.push("반복 숫자 패턴이 있습니다.");
  }

  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    score += 10;
    reasons.push("일반적인 전화번호 길이와 다릅니다.");
  }

  if (reasons.length === 0) {
    reasons.push("번호 형태만으로는 큰 위험 요소가 보이지 않습니다. 통화 내용도 함께 확인하세요.");
  }

  score = Math.min(score, 100);

  return {
    phone,
    score,
    level: getRiskLevel(score),
    reasons
  };
}

function updatePhoneResult(result) {
  latestPhoneResult = result;

  show("phoneResultBox");
  safeText("phoneRiskLevel", result.level);
  safeText("phoneRiskScore", `${result.score}%`);

  const bar = $("phoneScoreBar");

  if (bar) {
    bar.style.width = `${result.score}%`;
    bar.style.background = getBarColor(result.score);
  }

  const list = $("phoneReasonList");

  if (list) {
    list.innerHTML = "";

    for (const reason of result.reasons) {
      const li = document.createElement("li");
      li.textContent = reason;
      list.appendChild(li);
    }
  }

  showPhoneAlert(result);
}

function showPhoneAlert(result) {
  const box = $("phoneAlert");
  const title = $("phoneAlertTitle");
  const text = $("phoneAlertText");

  if (!box || !title || !text) return;

  if (result.score >= 70) {
    box.classList.remove("hidden");
    title.textContent = "매우 위험: 보이스피싱 의심";
    text.textContent = "통화를 받지 말고, 받은 경우 즉시 끊은 뒤 공식 대표번호로 직접 확인하세요.";
  } else if (result.score >= 40) {
    box.classList.remove("hidden");
    title.textContent = "주의: 의심 번호";
    text.textContent = "개인정보, 인증번호, 계좌이체, 앱 설치 요구가 나오면 즉시 거절하세요.";
  } else if (result.score >= 20) {
    box.classList.remove("hidden");
    title.textContent = "의심: 추가 확인 필요";
    text.textContent = "번호만으로는 단정할 수 없습니다. 통화 내용과 문자 내용을 함께 확인하세요.";
  } else {
    box.classList.add("hidden");
  }
}

function updateTextResult(result) {
  show("resultBox");
  safeText("riskLevel", result.level);
  safeText("riskScore", `${result.score}/100`);

  const bar = $("scoreBar");

  if (bar) {
    bar.style.width = `${result.score}%`;
    bar.style.background = getBarColor(result.score);
  }

  const list = $("reasonList");

  if (list) {
    list.innerHTML = "";

    for (const reason of result.reasons) {
      const li = document.createElement("li");
      li.textContent = reason;
      list.appendChild(li);
    }
  }

  if (result.score >= 40) {
    show("adviceBox");
  } else {
    hide("adviceBox");
  }
}

async function analyzeTextWithServer() {
  const inputText = $("inputText")?.value.trim() || "";

  if (!inputText) {
    alert("분석할 문자, URL, 통화 내용을 입력하세요.");
    return;
  }

  if (!AI_SERVER_URL) {
    alert("AI 서버 주소가 설정되지 않았습니다. 기본 분석으로 대체합니다.");
    updateTextResult(analyzeRisk(inputText));
    return;
  }

  try {
    const response = await fetch(`${AI_SERVER_URL}/analyze-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: inputText
      })
    });

    if (!response.ok) {
      throw new Error("AI 서버 응답 오류");
    }

    const result = await response.json();
    updateTextResult(result);
  } catch {
    alert("AI 서버 연결 실패. 기본 분석으로 대체합니다.");
    updateTextResult(analyzeRisk(inputText));
  }
}

function getBlockCandidates() {
  return getJsonFromStorage("blockCandidates", []);
}

function saveBlockCandidate() {
  if (!latestPhoneResult || !latestPhoneResult.phone) {
    alert("먼저 전화번호를 분석하세요.");
    return;
  }

  const items = getBlockCandidates();
  const exists = items.some((item) => item.phone === latestPhoneResult.phone);

  if (!exists) {
    items.push({
      phone: latestPhoneResult.phone,
      score: latestPhoneResult.score,
      level: latestPhoneResult.level,
      savedAt: new Date().toLocaleString()
    });
  }

  saveJsonToStorage("blockCandidates", items);
  renderBlockCandidates();

  alert("차단 후보로 저장했습니다. iPhone에서는 전화 앱에서 직접 차단해야 합니다.");
}

function renderBlockCandidates() {
  const list = $("blockCandidateList");
  if (!list) return;

  const items = getBlockCandidates();
  list.innerHTML = "";

  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "차단 후보 번호가 없습니다.";
    list.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = `${item.phone} · ${item.level} · ${item.score}% · 저장: ${item.savedAt}`;
    list.appendChild(li);
  }
}

function clearBlockCandidates() {
  localStorage.removeItem("blockCandidates");
  renderBlockCandidates();
}

async function loadPhoneWatchlist() {
  try {
    const response = await fetch(`data/phone-watchlist.json?t=${Date.now()}`);

    if (!response.ok) {
      throw new Error("phone-watchlist.json 없음");
    }

    phoneWatchlist = await response.json();
  } catch {
    phoneWatchlist = [
      {
        number: "07000000000",
        label: "테스트용 070 의심 번호",
        risk: 75,
        reason: "테스트용 번호입니다. 실제 신고 번호가 아닙니다."
      },
      {
        number: "001234567890",
        label: "테스트용 국제전화 의심 번호",
        risk: 80,
        reason: "국제전화 형태는 기관 사칭에 악용될 수 있습니다."
      }
    ];
  }
}

async function loadPreventionFeed() {
  const feed = $("preventionFeed");
  if (!feed) return;

  feed.innerHTML = "<p>경찰청 피싱 예·경보 최신 문구를 불러오는 중입니다.</p>";

  try {
    const response = await fetch(`${AI_SERVER_URL}/police-feed?t=${Date.now()}`);

    if (!response.ok) {
      throw new Error("경찰청 최신 문구 불러오기 실패");
    }

    const data = await response.json();
    const items = data.items || [];

    if (items.length === 0) {
      throw new Error("표시할 경찰청 최신 문구 없음");
    }

    const shuffledItems = shuffleArray(items);
    renderPreventionFeed(shuffledItems);
  } catch {
    const fallbackItems = [
      {
        title: "검찰·경찰·금감원 사칭 전화 주의",
        message: "수사기관이나 금융기관은 통화 중 계좌이체, 인증번호 전달, 원격제어 앱 설치를 요구하지 않습니다.",
        level: "기본 예방수칙",
        source: "앱 기본 예방 데이터",
        updatedAt: new Date().toLocaleDateString()
      },
      {
        title: "의심되면 일단 끊고 직접 확인",
        message: "모르는 번호가 수사, 대출, 계좌, 인증번호, 앱 설치를 요구하면 통화를 끊고 공식 대표번호로 직접 확인하세요.",
        level: "기본 예방수칙",
        source: "앱 기본 예방 데이터",
        updatedAt: new Date().toLocaleDateString()
      },
      {
        title: "문자 링크 클릭 전 멈추기",
        message: "택배, 과태료, 카드정지, 정부지원금 문자의 링크는 바로 누르지 말고 공식 앱이나 대표번호로 확인하세요.",
        level: "기본 예방수칙",
        source: "앱 기본 예방 데이터",
        updatedAt: new Date().toLocaleDateString()
      }
    ];

    renderPreventionFeed(shuffleArray(fallbackItems));
  }
}

function renderPreventionFeed(items) {
  const feed = $("preventionFeed");
  if (!feed) return;

  latestPreventionCard = items[0] || null;
  feed.innerHTML = "";

  for (const item of items.slice(0, 4)) {
    const card = document.createElement("article");
    card.className = "feed-card";

    card.innerHTML = `
      <span class="feed-badge">${item.level || "경찰청 피싱 예·경보"}</span>
      <h3>${item.title || "보이스피싱 예방 안내"}</h3>
      <p>${item.message || "최신 피싱 예·경보를 확인하세요."}</p>
      <small>출처: ${item.source || "피싱안심SOS"} · 업데이트: ${item.updatedAt || "-"}</small>
    `;

    feed.appendChild(card);
  }
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(" ");
  let line = "";
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = words[i] + " ";
      y += lineHeight;
      lineCount++;

      if (lineCount >= maxLines - 1) {
        ctx.fillText(line.trim() + "...", x, y);
        return y + lineHeight;
      }
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line, x, y);
  return y + lineHeight;
}

function createPreventionImage() {
  if (!latestPreventionCard) {
    alert("예방 문구를 먼저 불러오세요.");
    return;
  }

  const canvas = $("preventionCanvas");

  if (!canvas) {
    alert("이미지 생성용 canvas가 없습니다.");
    return;
  }

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1e3a8a");
  gradient.addColorStop(1, "#020617");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
  ctx.beginPath();
  ctx.arc(900, 160, 260, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.font = "900 110px Arial";
  ctx.fillText("SAFE", 650, 980);

  ctx.fillStyle = "#bfdbfe";
  ctx.font = "700 34px Arial";
  ctx.fillText("SafeCall AI", 80, 110);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 54px Arial";
  ctx.fillText(latestPreventionCard.level || "보이스피싱 예방", 80, 190);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 58px Arial";
  wrapCanvasText(ctx, latestPreventionCard.title, 80, 310, 900, 72, 3);

  ctx.fillStyle = "#dbeafe";
  ctx.font = "500 40px Arial";
  wrapCanvasText(ctx, latestPreventionCard.message, 80, 560, 900, 58, 6);

  ctx.fillStyle = "#93c5fd";
  ctx.font = "500 28px Arial";
  ctx.fillText(`업데이트: ${latestPreventionCard.updatedAt || "-"}`, 80, 900);
  ctx.fillText("의심되면 통화 종료 → 공식 번호로 직접 확인", 80, 950);

  canvas.toBlob((blob) => {
    latestImageBlob = blob;

    const url = URL.createObjectURL(blob);
    const previewBox = $("imagePreviewBox");
    const preview = $("preventionImagePreview");
    const download = $("downloadImageLink");

    if (preview) preview.src = url;
    if (download) download.href = url;
    if (previewBox) previewBox.classList.remove("hidden");
  }, "image/png");
}

async function sharePreventionImage() {
  if (!latestImageBlob) {
    createPreventionImage();

    setTimeout(() => {
      sharePreventionImage();
    }, 600);

    return;
  }

  const file = new File([latestImageBlob], "safecall-prevention-card.png", {
    type: "image/png"
  });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: "SafeCall AI 보이스피싱 예방 카드",
      text: "보이스피싱 예방 안내 카드입니다.",
      files: [file]
    });
  } else {
    alert("공유가 지원되지 않는 브라우저입니다. 이미지 다운로드 버튼을 사용하세요.");
  }
}

function bindEvents() {
  $("analyzePhoneButton")?.addEventListener("click", () => {
    const phone = $("phoneInput")?.value.trim() || "";

    if (!phone) {
      alert("전화번호를 입력하세요.");
      return;
    }

    updatePhoneResult(analyzePhoneNumber(phone));
  });

  $("analyzeButton")?.addEventListener("click", () => {
    const text = $("inputText")?.value.trim() || "";

    if (!text) {
      alert("분석할 내용을 입력하세요.");
      return;
    }

    updateTextResult(analyzeRisk(text));
  });

  $("analyzeWithServerButton")?.addEventListener("click", analyzeTextWithServer);

  $("clearButton")?.addEventListener("click", () => {
    if ($("inputText")) $("inputText").value = "";
    hide("resultBox");
  });

  $("saveBlockCandidateButton")?.addEventListener("click", saveBlockCandidate);
  $("clearCandidatesButton")?.addEventListener("click", clearBlockCandidates);

  $("refreshFeedButton")?.addEventListener("click", loadPreventionFeed);
  $("createPreventionImageButton")?.addEventListener("click", createPreventionImage);
  $("sharePreventionImageButton")?.addEventListener("click", sharePreventionImage);

  document.querySelectorAll(".copy-script").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.textContent || "";

      try {
        await navigator.clipboard.writeText(text);
        safeText("copyNotice", "거절 멘트를 복사했습니다.");
      } catch {
        safeText("copyNotice", "복사가 지원되지 않으면 문장을 길게 눌러 직접 복사하세요.");
      }
    });
  });
}

async function startApp() {
  bindEvents();

  await loadPhoneWatchlist();
  await loadPreventionFeed();

  renderBlockCandidates();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

startApp();