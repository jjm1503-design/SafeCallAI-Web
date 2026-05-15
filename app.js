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
  return text
    .replace(/\s/g, "")
    .toLowerCase();
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

  let level = "낮음";
  if (score >= 70) {
    level = "매우 위험";
  } else if (score >= 40) {
    level = "주의";
  } else if (score >= 20) {
    level = "의심";
  }

  if (reasons.length === 0) {
    reasons.push("현재 규칙 기준으로 뚜렷한 위험 요소는 적습니다.");
  }

  return {
    score,
    level,
    reasons
  };
}

function updateResult(result) {
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

  if (result.score >= 70) {
    scoreBar.style.background = "#ef4444";
  } else if (result.score >= 40) {
    scoreBar.style.background = "#f97316";
  } else if (result.score >= 20) {
    scoreBar.style.background = "#eab308";
  } else {
    scoreBar.style.background = "#22c55e";
  }

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

document.getElementById("analyzeButton").addEventListener("click", () => {
  const inputText = document.getElementById("inputText").value.trim();

  if (!inputText) {
    alert("분석할 문자, URL, 통화 내용을 입력하세요.");
    return;
  }

  const result = analyzeRisk(inputText);
  updateResult(result);
});

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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}
