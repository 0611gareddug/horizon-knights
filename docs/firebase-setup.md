# Firebase 설정 가이드

호라이즌 나이츠의 구글 로그인, 클라우드 저장, 랭킹, 협동에 쓰는 Firebase를 설정하는 방법이에요.
**무료 요금제(Spark)**로 충분하고, 결제 카드는 필요 없어요. 약 10분 걸려요.

> Firebase 화면의 메뉴 이름이나 위치는 가끔 바뀌어요. 이 가이드와 조금 다르면 비슷한 이름의 메뉴를 찾으면 돼요.

---

## 1단계. 프로젝트 만들기

1. https://console.firebase.google.com 에 구글 계정으로 들어가요.
2. **프로젝트 만들기** (또는 "Firebase 프로젝트 시작하기")를 눌러요.
3. 프로젝트 이름에 `horizon-knights`를 입력하고 계속을 눌러요.
4. **Google 애널리틱스**는 꺼요 (필요 없어요).
5. **프로젝트 만들기**를 누르고 잠시 기다려요.

## 2단계. 웹 앱 등록하고 설정값 받기

1. 프로젝트 첫 화면에서 **웹 아이콘 `</>`**을 눌러요.
2. 앱 닉네임에 `horizon-knights-web`을 입력해요.
3. "Firebase 호스팅 설정"은 **체크하지 않아요** (GitHub Pages를 써요).
4. **앱 등록**을 누르면 아래처럼 생긴 코드가 나와요. 이 부분을 복사해두세요.

```js
const firebaseConfig = {
  apiKey: "AIza....",
  authDomain: "horizon-knights-xxxx.firebaseapp.com",
  projectId: "horizon-knights-xxxx",
  storageBucket: "horizon-knights-xxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

> 이 값들은 비밀번호가 아니에요. 웹 게임에서는 원래 누구나 볼 수 있는 값이고, 보안은 5단계의 보안 규칙이 지켜줘요. 그래서 채팅에 그대로 붙여넣어 주셔도 괜찮아요.

## 3단계. 구글 로그인 켜기

1. 왼쪽 메뉴에서 **빌드 → Authentication**으로 가요.
2. **시작하기**를 눌러요.
3. **로그인 방법** 탭에서 **Google**을 골라요.
4. **사용 설정**을 켜고, 프로젝트 지원 이메일을 골라요 (본인 이메일).
5. **저장**을 눌러요.
6. 같은 Authentication 화면의 **설정 → 승인된 도메인**으로 가서 **도메인 추가**를 누르고 아래를 추가해요.
   - `0611gareddug.github.io`
   - (`localhost`는 보통 이미 들어 있어요)

## 4단계. Firestore 데이터베이스 만들기

1. 왼쪽 메뉴에서 **빌드 → Firestore Database**로 가요.
2. **데이터베이스 만들기**를 눌러요.
3. 위치는 **`asia-northeast3 (Seoul)`**을 골라요. 한 번 정하면 바꿀 수 없어요.
4. **프로덕션 모드에서 시작**을 골라요.
5. **만들기**를 눌러요.

## 5단계. 보안 규칙 넣기

1. Firestore Database 화면에서 **규칙** 탭으로 가요.
2. 들어 있는 내용을 전부 지우고 아래 내용을 붙여넣어요.
3. **게시**를 눌러요.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 프로필: 본인만 읽고 쓰기
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // 세이브 데이터: 본인만 읽고 쓰기, 크기 제한
    match /saves/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid
                   && request.resource.size() < 900000;
    }

    // 랭킹: 누구나 읽기, 본인 기록만 쓰기, 값 범위 검사
    match /leaderboards/{board}/entries/{uid} {
      allow read: if true;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.uid == uid
        && request.resource.data.score is number
        && request.resource.data.score >= 0
        && request.resource.data.score <= 100000
        && request.resource.data.updatedAt == request.time;
      allow delete: if false;
    }

    // 협동 방: 로그인한 사람만, 만료 시각 필수
    match /rooms/{roomCode} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.host == request.auth.uid
        && request.resource.data.expiresAt is timestamp;
      allow update: if request.auth != null;
      allow delete: if request.auth != null && resource.data.host == request.auth.uid;

      match /signals/{signalId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

> 랭킹 검증 방식(기획서 27절 D2)이 정해지면 규칙을 더 촘촘하게 바꿀 거예요.

## 6단계. 설정값 전달하기

2단계에서 복사한 `firebaseConfig` 내용을 채팅에 붙여넣어 주세요. 제가 `src/firebase-config.js`에 넣을게요.

직접 넣고 싶다면 `src/firebase-config.js` 파일을 열어 `firebaseConfig` 부분을 그대로 바꾸면 돼요.

---

## 확인 목록

- [ ] 프로젝트를 만들었다 (애널리틱스 끔)
- [ ] 웹 앱을 등록하고 `firebaseConfig`를 복사했다
- [ ] Authentication에서 Google 로그인을 켰다
- [ ] 승인된 도메인에 `0611gareddug.github.io`를 추가했다
- [ ] Firestore를 서울(`asia-northeast3`) 위치, 프로덕션 모드로 만들었다
- [ ] 보안 규칙을 붙여넣고 게시했다
- [ ] `firebaseConfig`를 전달했다

## 자주 막히는 곳

| 증상 | 해결 |
|---|---|
| 로그인 팝업이 바로 닫히고 `auth/unauthorized-domain` 오류 | 3단계 6번의 승인된 도메인을 확인해요 |
| 로그인 팝업이 안 뜸 | 브라우저 팝업 차단을 풀어요. 모바일에서는 게임이 자동으로 리디렉션 방식으로 바꿔요 |
| 저장이 안 되고 `permission-denied` 오류 | 5단계 보안 규칙이 게시됐는지 확인해요 |
