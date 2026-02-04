# 구현 계획서 (Implementation Plan)

## 목표
HTML5, CSS, JavaScript를 사용하여 DICOM 파일을 열고, 포함된 모든 태그 정보를 테이블 형태로 보여주며, 가능한 경우 이미지 미리보기를 제공하는 웹 애플리케이션 개발.

## 사용자 리뷰 필요 사항
- **이미지 렌더링 확장**: JPEG Baseline (1.2.840.10008.1.2.4.50) 형식 지원을 추가합니다. 브라우저 내장 디코더를 활용하여 렌더링합니다.

## 제안된 변경 사항

### 기본 구조
- **JavaScript**:
### [Frontend]
#### [Modify] [index.html](file:///Users/soul/Source/dicomparser/index.html)
- Window Center(Level) / Window Width 조절을 위한 슬라이더 UI 추가.

#### [Modify] [script.js](file:///Users/soul/Source/dicomparser/script.js)
- `renderImage` 함수 강화:
    - 원본 픽셀 데이터 저장.
    - Windowing 적용 로직 (VOI LUT - Linear Function) 구현.
    - 슬라이더 이벤트 핸들러 추가하여 실시간 밝기/대비 조절.
- **[NEW] 자동 로드**: `DOMContentLoaded` 시 `IMG-0002-00001.dcm` 파일을 fetch하여 초기 화면에 표시.

### [Frontend]
#### [NEW] [index.html](file:///Users/soul/Source/dicomparser/index.html)
- 앱의 진입점. 레이아웃 정의.
- dicom-parser CDN 스크립트 태그 포함.

#### [NEW] [style.css](file:///Users/soul/Source/dicomparser/style.css)
- 프리미엄 느낌의 다크 테마 스타일링.
- 테이블 스타일링 (가독성 확보).

#### [NEW] [script.js](file:///Users/soul/Source/dicomparser/script.js)
- `ParseDICOM` 함수: 파일 읽기 및 태그 추출.
- `RenderTable` 함수: 태그 정보 DOM 조작.
- `RenderImage` 함수: PixelData 처리 및 시각화.

## 검증 계획

### 자동화/수동 검증
- [ ] **파일 로드 테스트**: 로컬 DICOM 파일 3개 이상 로드하여 에러 없이 읽히는지 확인.
- [ ] **태그 확인**: 표준 태그와 Private 태그가 모두 리스트에 나타나는지 확인.
- [ ] **이미지 확인**: 테스트용 DICOM 이미지(MR/CT 등)가 상단에 표시되는지 확인.
