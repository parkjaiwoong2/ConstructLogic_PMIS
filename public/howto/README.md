# 프로그램 사용법 미디어

이 폴더에 GIF 또는 MP4 파일을 넣으면 메인 페이지 "사용방법" 섹션에서 실제 화면 녹화 영상으로 교체할 수 있습니다.

예시 파일명:
- `usage-form.gif` - 사용내역 입력
- `usage-flow.gif` - 결재 흐름
- `usage-csv.gif` - CSV 임포트
- `usage-dash.gif` - 법인카드·대시보드

파일 추가 후 `Main.jsx`의 각 `main-howto-visual` 블록 내부의 mockup div를 아래와 같이 img/video 태그로 교체하세요:

```jsx
<img src="/howto/usage-form.gif" alt="사용내역 입력" className="main-howto-media-img" />
```

또는 동영상:
```jsx
<video src="/howto/usage-form.mp4" autoPlay loop muted playsInline className="main-howto-media-video" />
```
