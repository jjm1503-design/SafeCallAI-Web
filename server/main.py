from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
from datetime import datetime
from urllib.request import Request, urlopen
from html import unescape

app = FastAPI(title="SafeCallAI Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PHISHING_ALERT_URL = "https://www.counterscam112.go.kr/bbs003/board/boardList.do"


class TextAnalyzeRequest(BaseModel):
    text: str


def clean_html_text(value: str) -> str:
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def fetch_url(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 SafeCallAI/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )

    with urlopen(req, timeout=10) as response:
        raw = response.read()

    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("euc-kr", errors="ignore")


def make_prevention_message(title: str) -> str:
    lower = title.lower()

    if "끊" in title:
        return "피싱이 의심되는 전화는 오래 듣지 말고 먼저 끊은 뒤 공식 대표번호로 직접 확인하세요."

    if "부모님" in title or "설" in title:
        return "가족과 친지에게 보이스피싱 예방법을 미리 공유하고, 송금 요구는 반드시 다른 연락수단으로 확인하세요."

    if "행동수칙" in title:
        return "수사기관·금융기관 사칭, 인증번호 요구, 앱 설치 요구가 나오면 일단 끊고 신고하세요."

    if "노쇼" in title:
        return "예약금·선결제·대량 주문을 빌미로 한 금전 요구는 사업자 대상 피싱일 수 있으니 입금 전 확인하세요."

    if "voice" in lower or "목소리" in title:
        return "검찰·대출·납치 등을 사칭하는 보이스피싱범의 목소리와 수법을 미리 알아두고 경계하세요."

    if "전화번호" in title or "10분" in title:
        return "범죄 의심 전화번호는 추가 피해를 막기 위해 신고와 차단 조치가 중요합니다."

    if "월간피싱" in title:
        return "최근 피싱 사례와 신종 수법을 확인하고, 의심 연락은 끊은 뒤 공식 번호로 직접 확인하세요."

    return "경찰청 관련 피싱 예·경보 최신 안내입니다. 의심되는 연락은 끊고 공식 번호로 직접 확인하세요."


def fallback_police_feed():
    today = datetime.now().strftime("%Y-%m-%d")

    return [
        {
            "title": "의심되면 일단 끊고 공식 번호로 확인",
            "message": "수사기관·금융기관을 사칭하며 계좌이체, 인증번호, 앱 설치를 요구하면 즉시 통화를 끊으세요.",
            "level": "기본 예방수칙",
            "source": "SafeCallAI 기본 데이터",
            "updatedAt": today,
        },
        {
            "title": "문자 링크 클릭 전 멈추기",
            "message": "택배, 과태료, 카드정지, 정부지원금 문자의 링크는 바로 누르지 말고 공식 앱이나 대표번호로 확인하세요.",
            "level": "기본 예방수칙",
            "source": "SafeCallAI 기본 데이터",
            "updatedAt": today,
        },
        {
            "title": "인증번호·계좌이체 요구는 거절",
            "message": "인증번호, 계좌번호, 비밀번호, 원격제어 앱 설치를 요구하면 보이스피싱 가능성이 높습니다.",
            "level": "기본 예방수칙",
            "source": "SafeCallAI 기본 데이터",
            "updatedAt": today,
        },
    ]


def extract_titles_from_police_page(text: str):
    titles = []

    known_titles = [
        "끈질긴 피싱을 '끊'어낼 '끊'내주는 선택",
        "이번 설, 부모님께 알려드릴 피싱 예방법 '말'끔하게 정리",
        "[대국민 피싱예방 행동수칙] 어서끊자!!!! 일단끊어!!!!!",
        "노쇼사기 예방수칙 - 건설업체, 외식업체 편",
        "월간피싱zero 제12호(2025년 12월)_ VOICE WANTED",
        "[VOICE WANTED] 보이스피싱범 목소리 공개수배",
        "월간피싱zero 제11호(2025년 11월)_ 가짜구별법",
        "<속보> 범죄 의심 전화번호 ‘10분 내 차단’",
    ]

    for title in known_titles:
        if title in text and title not in titles:
            titles.append(title)

    pattern = re.compile(
        r"([가-힣A-Za-z0-9\[\]<'’‘“”\"·\-\s!_().,#]+?(?:피싱|예방법|예방수칙|행동수칙|월간피싱|전화번호|사기|VOICE WANTED)[가-힣A-Za-z0-9\[\]<'’‘“”\"·\-\s!_().,#]*)",
        re.MULTILINE,
    )

    for match in pattern.findall(text):
        title = clean_html_text(match)

        if len(title) < 8:
            continue

        skip_words = [
            "검색",
            "전체",
            "제보센터",
            "예방·홍보센터",
            "로그인",
            "회원가입",
            "사이트맵",
            "제목 내용",
            "피싱 예 경보",
        ]

        if any(skip in title for skip in skip_words):
            continue

        if title not in titles:
            titles.append(title)

        if len(titles) >= 10:
            break

    return titles[:10]


def fetch_police_feed():
    try:
        html = fetch_url(PHISHING_ALERT_URL)
        text = clean_html_text(html)

        titles = extract_titles_from_police_page(text)
        dates = re.findall(r"20\d{2}-\d{2}-\d{2}", text)

        items = []

        for index, title in enumerate(titles):
            date = dates[index] if index < len(dates) else datetime.now().strftime("%Y-%m-%d")

            items.append({
                "title": title,
                "message": make_prevention_message(title),
                "level": "경찰청 피싱 예·경보",
                "source": "피싱안심SOS 피싱 예·경보",
                "updatedAt": date,
            })

        if not items:
            return fallback_police_feed()

        return items

    except Exception:
        return fallback_police_feed()


def analyze_text_rule(text: str):
    score = 0
    reasons = []

    high_risk_words = [
        "검찰", "경찰", "금감원", "금융감독원", "대출", "저금리",
        "인증번호", "계좌", "이체", "압수수색", "수사", "구속",
        "앱 설치", "원격제어", "보안앱", "URL", "링크", "택배",
        "미납", "과태료", "명의도용", "개인정보", "카드정지", "소액결제"
    ]

    dangerous_actions = [
        "인증번호를 알려", "인증번호 알려", "계좌로 보내", "입금해",
        "이체해", "앱을 설치", "설치하세요", "통화 끊지",
        "혼자만 알고", "은행에 말하지", "가족에게 말하지",
        "원격제어", "화면 공유", "신분증 보내", "비밀번호 알려"
    ]

    compact = re.sub(r"\s+", "", text)

    for word in high_risk_words:
        if word in text or word.replace(" ", "") in compact:
            score += 10
            reasons.append(f"위험 키워드 감지: {word}")

    for action in dangerous_actions:
        if action in text or action.replace(" ", "") in compact:
            score += 25
            reasons.append(f"고위험 행동 유도 감지: {action}")

    if re.search(r"https?://|bit\.ly|tinyurl|t\.co|goo\.gl", text, re.I):
        score += 20
        reasons.append("외부 링크 또는 단축 URL 포함")

    if re.search(r"01[0-9]-?\d{3,4}-?\d{4}", text):
        score += 5
        reasons.append("휴대폰 번호 포함")

    if re.search(r"\d{2,6}-?\d{2,6}-?\d{2,8}", text):
        score += 10
        reasons.append("계좌번호 또는 긴 숫자 패턴 의심")

    score = min(score, 100)

    if score >= 70:
        level = "매우 위험"
    elif score >= 40:
        level = "주의"
    elif score >= 20:
        level = "의심"
    else:
        level = "낮음"

    if not reasons:
        reasons.append("현재 규칙 기준으로 뚜렷한 위험 요소는 적습니다.")

    return {
        "score": score,
        "level": level,
        "reasons": reasons
    }


@app.get("/")
def home():
    return {
        "message": "SafeCallAI Server is running",
        "endpoints": [
            "/police-feed",
            "/analyze-text",
            "/docs"
        ]
    }


@app.get("/police-feed")
def police_feed():
    return {
        "items": fetch_police_feed(),
        "fetchedAt": datetime.now().isoformat(),
        "source": "피싱안심SOS 피싱 예·경보"
    }


@app.post("/analyze-text")
def analyze_text(req: TextAnalyzeRequest):
    return analyze_text_rule(req.text)