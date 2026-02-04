# 구현 계획서 (Implementation Plan)

## 목표
HTML5, CSS, JavaScript를 사용하여 DICOM 파일을 열고, 포함된 모든 태그 정보를 테이블 형태로 보여주며, 가능한 경우 이미지 미리보기를 제공하는 웹 애플리케이션 개발.

## 사용자 리뷰 필요 사항
- **외부 라이브러리 사용**: DICOM 파싱을 위해 `dicom-parser` (JavaScript 라이브러리)를 CDN을 통해 사용할 예정입니다. 인터넷 연결이 필수가 됩니다. (오프라인 필요 시 로컬 포함으로 변경 가능)
- **이미지 렌더링 제한**: 비압축(Uncompressed) DICOM 이미지 위주로 지원하며, 압축된 포맷(JPEG 2000 등)은 별도 디코더가 필요하여 이번 범위에서는 기본 지원만 목표로 합니다.

## 제안된 변경 사항

### 기본 구조
- **HTML**: 파일 입력, 메타데이터 테이블, 이미지 캔버스를 포함한 시맨틱 구조.
- **CSS**: 다크 모드 기반의 깔끔하고 현대적인 디자인. 반응형 레이아웃.
- **JavaScript**:
    - `dicom-parser` 라이브러리 로드.
    - 파일 입력 이벤트 핸들링 (FileReader).
    - DataElement 파싱 및 테이블 동적 생성.
    - PixelData 추출 및 Canvas 렌더링 (Window Center/Width 적용은 생략하거나 기본값 적용).

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
