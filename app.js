let phoneWatchlist = [];
let latestPhoneResult = null;

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
  "소액결제"
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
  "비밀번호 알려"
];

function normalizeText(text) {
  return String(text || "")
    .replace(/\s/g, "")
    .toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^0-9+]/g, "");
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

function analyzeRisk(text) {
  let score = 0;
  const reasons = [];
  const normalized = normalizeText(text);

  for (const word of highRiskWords) {
    const cleanWord = normalizeText(word);
    if (text.includes(word) || normalized.includes(cleanWord)) {
      score += 10;
      reasons.push(`위험 키워드 감지: ${word}`);
    }
  }

  for (const action of dangerousActions) {
    const cleanAction = normalizeText(action);
    if (text.includes(action) || normalized.includes(cleanAction)) {
      score += 25;
      reasons.push(`고위험 행동 유도 감지: ${action}`);
    }
  }

  if (/https?:\/\//i.test(text) || /bit\.ly|tinyurl|t\.co|goo\.gl/i.test(text)) {
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

  if (/070-?\d{3,4}-?\d{4}/.test(text)) {
    score += 5;
    reasons.push("인터넷 전화번호 패턴");
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

  const matched = phoneWatchlist.find((item) => {
    const target = normalizePhone(item.number).replace(/^\+82/, "0");
    return target === digitsOnly || target === phone;
  });

  if (matched) {
    score += Number(matched.risk || 70);
    reasons.push(`의심 번호 목록과 일치: ${matched.label}`);
    if (matched.reason) {
      reasons.push(matched.reason);
    }
  }

  if (/^070/.test(digitsOnly)) {
    score += 15;
    reasons.push("070 인터넷전화 번호입니다. 정상 번호일 수도 있지만 피싱에 악용되는 경우가 있어 주의가 필요합니다.");
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

function updateTextResult(result) {
  const resultBox = document.getElementById("resultBox");
  const riskLevel = document.getElementById("riskLevel");
  const riskScore = document.getElementById("riskScore");
  const reasonList = document.getElementById("reasonList");
  const scoreBar = document.getElementById("scoreBar");
  const adviceBox = document.getElementById("adviceBox");

  resultBox.classList.remove("hidden");
  riskLevel.textContent = result.level;
  riskScore.textContent = `${result.score}/100`;
  scoreBar.style.width = `${result.score}%`;
  scoreBar.style.background = getBarColor(result.score);

  reasonList.innerHTML = "";
  for (const reason of result.reasons) {
    const li = document.createElement("li");
    li.textContent = reason;
    reasonList.appendChild(li);
  }

  if (result.score >= 40) {
    adviceBox.classList.remove("hidden");
  } else {
    adviceBox.classList.add("hidden");
  }
}

function updatePhoneResult(result) {
  latestPhoneResult = result;

  const phoneResultBox = document.getElementById("phoneResultBox");
  const phoneRiskLevel = document.getElementById("phoneRiskLevel");
  const phoneRiskScore = document.getElementById("phoneRiskScore");
  const phoneReasonList = document.getElementById("phoneReasonList");
  const phoneScoreBar = document.getElementById("phoneScoreBar");

  phoneResultBox.classList.remove("hidden");
  phoneRiskLevel.textContent = result.level;
  phoneRiskScore.textContent = `${result.score}%`;
  phoneScoreBar.style.width = `${result.score}%`;
  phoneScoreBar.style.background = getBarColor(result.score);

  phoneReasonList.innerHTML = "";
  for (const reason of result.reasons) {
    const li = document.createElement("li");
    li.textContent = reason;
    phoneReasonList.appendChild(li);
  }

  showPhoneAlert(result);
}

function showPhoneAlert(result) {
  const phoneAlert = document.getElementById("phoneAlert");
  const phoneAlertTitle = document.getElementById("phoneAlertTitle");
  const phoneAlertText = document.getElementById("phoneAlertText");

  if (result.score >= 70) {
    phoneAlert.classList.remove("hidden");
    phoneAlertTitle.textContent = "매우 위험: 보이스피싱 의심";
    phoneAlertText.textContent = "통화를 받지 말고, 받은 경우 즉시 끊은 뒤 공식 대표번호로 직접 확인하세요.";
  } else if (result.score >= 40) {
    phoneAlert.classList.remove("hidden");
    phoneAlertTitle.textContent = "주의: 의심 번호";
    phoneAlertText.textContent = "개인정보, 인증번호, 계좌이체, 앱 설치 요구가 나오면 즉시 거절하세요.";
  } else if (result.score >= 20) {
    phoneAlert.classList.remove("hidden");
    phoneAlertTitle.textContent = "의심: 추가 확인 필요";
    phoneAlertText.textContent = "번호만으로는 단정할 수 없습니다. 통화 내용과 문자 내용을 함께 확인하세요.";
  } else {
    phoneAlert.classList.add("hidden");
  }
}

async function loadPhoneWatchlist() {
  try {
    const response = await fetch(`data/phone-watchlist.json?t=${Date.now()}`);
    phoneWatchlist = await response.json();
  } catch {
    phoneWatchlist = [];
  }
}

async function loadPreventionFeed() {
  const feedBox = document.getElementById("preventionFeed");
  feedBox.innerHTML = "<p>예방 문구를 불러오는 중입니다.</p>";

  try {
    const response = await fetch(`data/prevention-feed.json?t=${Date.now()}`);
    const items = await response.json();

    feedBox.innerHTML = "";

    for (const item of items) {
      const card = document.createElement("article");
      card.className = "feed-card";

      card.innerHTML = `
        <span class="feed-badge">${item.level || "안내"}</span>
        <h3>${item.title}</h3>
        <p>${item.message}</p>
        <div class="feed-meta">출처: ${item.source || "앱 예방 데이터"} · 업데이트: ${item.updatedAt || "-"}</div>
      `;

      feedBox.appendChild(card);
    }
  } catch {
    feedBox.innerHTML = "<p>예방 문구를 불러오지 못했습니다. 인터넷 연결 또는 data/prevention-feed.json 파일을 확인하세요.</p>";
  }
}

function getBlockCandidates() {
  try {
    return JSON.parse(localStorage.getItem("blockCandidates") || "[]");
  } catch {
    return [];
  }
}

function saveBlockCandidate() {
  if (!latestPhoneResult || !latestPhoneResult.phone) {
    alert("먼저 전화번호를 분석하세요.");
    return;
  }

  const candidates = getBlockCandidates();
  const exists = candidates.some((item) => item.phone === latestPhoneResult.phone);

  if (!exists) {
    candidates.push({
      phone: latestPhoneResult.phone,
      score: latestPhoneResult.score,
      level: latestPhoneResult.level,
      savedAt: new Date().toLocaleString()
    });
  }

  localStorage.setItem("blockCandidates", JSON.stringify(candidates));
  renderBlockCandidates();
  alert("차단 후보로 저장했습니다. iPhone 전화 앱에서 직접 차단하세요.");
}

function renderBlockCandidates() {
  const list = document.getElementById("blockCandidateList");
  const candidates = getBlockCandidates();

  list.innerHTML = "";

  if (candidates.length === 0) {
    const li = document.createElement("li");
    li.textContent = "저장된 차단 후보 번호가 없습니다.";
    list.appendChild(li);
    return;
  }

  for (const item of candidates) {
    const li = document.createElement("li");
    li.textContent = `${item.phone} · ${item.level} · ${item.score}% · 저장: ${item.savedAt}`;
    list.appendChild(li);
  }
}

function clearBlockCandidates() {
  localStorage.removeItem("blockCandidates");
  renderBlockCandidates();
}

document.getElementById("analyzeButton").addEventListener("click", () => {
  const inputText = document.getElementById("inputText").value.trim();

  if (!inputText) {
    alert("분석할 문자, URL, 통화 내용을 입력하세요.");
    return;
  }

  const result = analyzeRisk(inputText);
  updateTextResult(result);
});

document.getElementById("analyzePhoneButton").addEventListener("click", () => {
  const phoneInput = document.getElementById("phoneInput").value.trim();

  if (!phoneInput) {
    alert("전화번호를 입력하세요.");
    return;
  }

  const result = analyzePhoneNumber(phoneInput);
  updatePhoneResult(result);
});

document.getElementById("saveBlockCandidateButton").addEventListener("click", saveBlockCandidate);

document.getElementById("clearCandidatesButton").addEventListener("click", clearBlockCandidates);

document.getElementById("refreshFeedButton").addEventListener("click", loadPreventionFeed);

document.getElementById("clearButton").addEventListener("click", () => {
  document.getElementById("inputText").value = "";
  document.getElementById("resultBox").classList.add("hidden");
});

document.querySelectorAll(".copy-script").forEach((button) => {
  button.addEventListener("click", async () => {
    const text = button.textContent;

    try {
      await navigator.clipboard.writeText(text);
      document.getElementById("copyNotice").textContent = "거절 멘트를 복사했습니다.";
    } catch {
      document.getElementById("copyNotice").textContent = "복사가 지원되지 않으면 문장을 길게 눌러 직접 복사하세요.";
    }
  });
});

async function startApp() {
  await loadPhoneWatchlist();
  await loadPreventionFeed();
  renderBlockCandidates();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

startApp();
