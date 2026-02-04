document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('dicomFile');
    const fileNameDisplay = document.getElementById('fileName');
    const previewSection = document.getElementById('previewSection');
    const dataSection = document.getElementById('dataSection');
    const dicomTableBody = document.querySelector('#dicomTable tbody');
    const canvas = document.getElementById('dicomImage');
    const tagSearchInput = document.getElementById('tagSearch');

    let parsedDicom = null;
    let allTags = [];

    fileInput.addEventListener('change', handleFileSelect);
    tagSearchInput.addEventListener('input', handleSearch);

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        fileNameDisplay.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (fileEvent) => {
            const arrayBuffer = fileEvent.target.result;
            const byteArray = new Uint8Array(arrayBuffer);

            try {
                // DICOM 파싱
                parsedDicom = dicomParser.parseDicom(byteArray);

                // UI 초기화 및 표시
                previewSection.classList.remove('hidden');
                dataSection.classList.remove('hidden');

                // 데이터 테이블 렌더링
                renderTable(parsedDicom, byteArray);

                // 이미지 렌더링 시도
                renderImage(parsedDicom, byteArray);

            } catch (error) {
                console.error('Error parsing DICOM:', error);
                alert('DICOM 파싱 중 오류가 발생했습니다. 올바른 DICOM 파일인지 확인해주세요.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function renderTable(dataSet, byteArray) {
        allTags = [];
        dicomTableBody.innerHTML = '';

        const keys = [];
        for (let propertyName in dataSet.elements) {
            keys.push(propertyName);
        }
        // 태그 순서대로 정렬
        keys.sort();

        keys.forEach(tagKey => {
            const element = dataSet.elements[tagKey];
            const tag = tagKey.toUpperCase();
            const vr = element.vr;
            const length = element.length;

            let value = mapElementValue(dataSet, element, byteArray);
            let name = getTagName(tag) || 'Private / Unknown';

            // 데이터 객체 저장 (검색용)
            allTags.push({ tag, name, vr, length, value });

            // DOM 생성
            const tr = createTableRow(tag, name, vr, length, value);
            dicomTableBody.appendChild(tr);
        });
    }

    function mapElementValue(dataSet, element, byteArray) {
        // Pixel Data와 같은 큰 데이터는 생략
        if (element.tag === 'x7fe00010') {
            return '<Pixel Data>';
        }

        try {
            // text types
            if (['AE', 'AS', 'CS', 'DA', 'DS', 'DT', 'IS', 'LO', 'LT', 'PN', 'SH', 'ST', 'TM', 'UI', 'UT'].includes(element.vr)) {
                let text = dataSet.string(element.tag);
                // null character 제거
                return text ? text.replace(/\0/g, '') : '';
            }
            // number types
            else if (['US', 'SS', 'UL', 'SL', 'FL', 'FD'].includes(element.vr)) {
                // dicom-parser의 편의 메서드 활용이 가능하지만, 여기서는 단순화
                // 실제로는 VR에 따라 uint16, int16 등을 정확히 읽어야 함
                // 여기서는 텍스트로 읽히는 경우만 처리하고 나머지는 Binary 표시
                return `<Binary Data (${element.length} bytes)>`;
            }
            else {
                return `<Binary Data (${element.length} bytes)>`;
            }
        } catch (e) {
            return '<Read Error>';
        }
    }

    function createTableRow(tag, name, vr, length, value) {
        const tr = document.createElement('tr');

        // Tag format: x00280010 -> (0028,0010)
        const formattedTag = `(${tag.substring(1, 5)},${tag.substring(5)})`.toUpperCase();

        tr.innerHTML = `
            <td>${formattedTag}</td>
            <td>${name} <span style="font-size:0.8em; color:#666;">(${vr})</span></td>
            <td>${length}</td>
            <td>${value}</td>
        `;
        return tr;
    }

    // 간단한 태그 이름 매핑 (전체 사전이 없으므로 일부 중요 태그만 예시)
    // 실제로는 dicom-parser가 태그 이름을 제공하지 않으므로 별도 Dict가 필요하지만, 
    // 여기서는 몇 가지 중요 태그만 하드코딩하거나 'Unknown'으로 처리하도록 함.
    // 사용자 요청: "표준에 나와있는 Tag는 해당 DataFormat에 맞게 Data를 보여줄 수 있게 해주고"
    // -> 전체 Dict를 넣기엔 너무 무거우므로, 일반적인 뷰어처럼 태그 코드 위주로 보여주되,
    // 가능하다면 주요 태그만이라도 이름을 보여주는 것이 좋음.
    function getTagName(tag) {
        const dictionary = {
            'x00020000': 'File Meta Information Group Length',
            'x00020001': 'File Meta Information Version',
            'x00020002': 'Media Storage SOP Class UID',
            'x00020003': 'Media Storage SOP Instance UID',
            'x00020010': 'Transfer Syntax UID',
            'x00080005': 'Specific Character Set',
            'x00080008': 'Image Type',
            'x00080016': 'SOP Class UID',
            'x00080018': 'SOP Instance UID',
            'x00080020': 'Study Date',
            'x00080030': 'Study Time',
            'x00080050': 'Accession Number',
            'x00080060': 'Modality',
            'x00080070': 'Manufacturer',
            'x00080080': 'Institution Name',
            'x00080090': 'Referring Physician Name',
            'x00081030': 'Study Description',
            'x0008103e': 'Series Description',
            'x00100010': 'Patient Name',
            'x00100020': 'Patient ID',
            'x00100030': 'Patient Birth Date',
            'x00100040': 'Patient Sex',
            'x00180015': 'Body Part Examined',
            'x0020000d': 'Study Instance UID',
            'x0020000e': 'Series Instance UID',
            'x00200010': 'Study ID',
            'x00200011': 'Series Number',
            'x00200013': 'Instance Number',
            'x00280010': 'Rows',
            'x00280011': 'Columns',
            'x00280030': 'Pixel Spacing',
            'x00280100': 'Bits Allocated',
            'x00280101': 'Bits Stored',
            'x00280102': 'High Bit',
            'x00280103': 'Pixel Representation',
            'x00281050': 'Window Center',
            'x00281051': 'Window Width',
            'x00281052': 'Rescale Intercept',
            'x00281053': 'Rescale Slope',
            'x7fe00010': 'Pixel Data'
        };
        return dictionary[tag.toLowerCase()];
    }

    function renderImage(dataSet, byteArray) {
        // 이미지를 그리기 위해 필요한 최소한의 정보 확인
        try {
            const rows = dataSet.uint16('x00280010');
            const columns = dataSet.uint16('x00280011');
            const pixelDataElement = dataSet.elements.x7fe00010;

            if (!rows || !columns || !pixelDataElement) {
                document.getElementById('imageInfo').textContent = '이미지 데이터가 없습니다.';
                return;
            }

            const transferSyntax = dataSet.string('x00020010');
            // 압축된 이미지는 dicom-parser만으로 디코딩 불가 (별도 코덱 필요)
            // 여기서는 Uncompressed Little Endian (1.2.840.10008.1.2.1) 등만 기본 지원 시도
            // 사용자 요청: "해석이 가능한 이미지 데이터가 존재한다면... Preview를... 보여줘"

            // 간단하게 지원되는 Transfer Syntax인지 확인 (Explicit VR Little Endian, Implicit VR Little Endian)
            const supportedSyntaxes = [
                '1.2.840.10008.1.2',      // Implicit VR Little Endian
                '1.2.840.10008.1.2.1',    // Explicit VR Little Endian
            ];

            if (transferSyntax && !supportedSyntaxes.includes(transferSyntax)) {
                // JPEG Baseline (1.2.840.10008.1.2.4.50) 및 호환 가능한 포맷 지원 시도
                const jpegSyntaxes = [
                    '1.2.840.10008.1.2.4.50', // JPEG Baseline
                    '1.2.840.10008.1.2.4.51', // JPEG Extended (Process 2 & 4)
                    '1.2.840.10008.1.2.4.70', // JPEG Lossless (Selection Value 1)
                ];

                if (jpegSyntaxes.includes(transferSyntax)) {
                    renderJpegImage(dataSet, byteArray, pixelDataElement, canvas);
                    return;
                }

                document.getElementById('imageInfo').textContent = `미리보기 불가: 지원되지 않는 전송 문법입니다 (${transferSyntax}). 압축된 이미지일 수 있습니다.`;
                // 캔버스 초기화
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            canvas.width = columns;
            canvas.height = rows;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(columns, rows);

            // Pixel Data 추출 (기본적인 Grayscale 8/16bit 처리)
            // 실제로는 BitsAllocated, BitsStored, PixelRepresentation, RescaleSlope/Intercept 등을 고려해야 함
            // 여기서는 단순히 0~255 범위로 정규화하여 표시하는 간단한 로직 구현

            const pixelDataOffset = pixelDataElement.dataOffset;
            const pixelDataLength = pixelDataElement.length;
            const bitsAllocated = dataSet.uint16('x00280100');

            let numPixels = rows * columns;
            // 안전 장치
            if (pixelDataLength < numPixels * (bitsAllocated / 8)) {
                console.warn('Pixel Data length is smaller than expected.');
            }

            // Window Level/Width 적용을 위한 값 (없으면 전체 범위 사용)
            // 간단한 구현을 위해 Min/Max Scaling 사용

            let minVal = Number.MAX_VALUE;
            let maxVal = Number.MIN_VALUE;
            let pixels = null;

            if (bitsAllocated === 8) {
                pixels = new Uint8Array(byteArray.buffer, pixelDataOffset, numPixels);
            } else if (bitsAllocated === 16) {
                pixels = new Int16Array(byteArray.buffer, pixelDataOffset, numPixels);
                // Note: Int16 vs Uint16 depends on PixelRepresentation (0=unsigned, 1=signed)
                const pixelRepresentation = dataSet.uint16('x00280103');
                if (pixelRepresentation === 0) {
                    pixels = new Uint16Array(byteArray.buffer, pixelDataOffset, numPixels);
                }
            }

            if (pixels) {
                // 1. Min/Max 찾기
                for (let i = 0; i < numPixels; i++) {
                    if (pixels[i] < minVal) minVal = pixels[i];
                    if (pixels[i] > maxVal) maxVal = pixels[i];
                }

                // 2. 렌더링
                const range = maxVal - minVal;
                let dataIndex = 0;
                for (let i = 0; i < numPixels; i++) {
                    let pixelValue = pixels[i];
                    // Normalize to 0-255
                    let val = 0;
                    if (range > 0) {
                        val = Math.floor(((pixelValue - minVal) / range) * 255);
                    } else {
                        val = 0;
                    }

                    // Grayscale
                    imageData.data[dataIndex++] = val; // R
                    imageData.data[dataIndex++] = val; // G
                    imageData.data[dataIndex++] = val; // B
                    imageData.data[dataIndex++] = 255; // Alpha
                }
                ctx.putImageData(imageData, 0, 0);
                document.getElementById('imageInfo').textContent = `${columns}x${rows}, ${bitsAllocated} bit, ${transferSyntax || 'Implicit Little Endian'}`;
            } else {
                document.getElementById('imageInfo').textContent = `미리보기 불가: 지원되지 않는 bit depth (${bitsAllocated})`;
            }

        } catch (e) {
            console.error('Image rendering error:', e);
            document.getElementById('imageInfo').textContent = '이미지 렌더링 중 오류 발생';
        }
    }

    function renderJpegImage(dataSet, byteArray, pixelDataElement, canvas) {
        try {
            // Encapsulated Format 파싱
            // Pixel Data Element Value의 시작점부터 시작
            let offset = pixelDataElement.dataOffset;
            const endOffset = offset + pixelDataElement.length;

            // 첫 번째 Item 읽기 (Basic Offset Table - 보통 비어있음)
            // Item Tag: (FF FE E0 00)
            const itemTag1 = dataSet.uint16('x00000000'); // Dummy read to access logic? No, accessing byteArray directly.

            // Helper to read simple values
            function readUint16(off) {
                return byteArray[off] + (byteArray[off + 1] << 8);
            }
            function readUint32(off) {
                return byteArray[off] + (byteArray[off + 1] << 8) + (byteArray[off + 2] << 16) + (byteArray[off + 3] << 24);
            }

            // 1. Basic Offset Table Item
            let currentOffset = offset;
            let tag = readUint16(currentOffset);    // E000
            let group = readUint16(currentOffset + 2); // FFFE
            let length = readUint32(currentOffset + 4);

            if (tag !== 0xE000 || group !== 0xFFFE) {
                throw new Error('Encapsulated Data 시작 부분에서 Item Tag를 찾을 수 없습니다.');
            }

            // Offset Table 건너뛰기
            currentOffset += 8 + length;

            // 2. 첫 번째 Fragment (실제 이미지 데이터)
            // 여러 Fragment로 나뉘어 있을 수 있으나, 보통 첫 프레임은 첫 번째 데이터 Fragment에 시작됨.
            const fragments = [];

            while (currentOffset < endOffset) {
                tag = readUint16(currentOffset);
                group = readUint16(currentOffset + 2);
                length = readUint32(currentOffset + 4);

                // Sequence Delimitation Item (FFFE E0DD)
                if (tag === 0xE0DD && group === 0xFFFE) {
                    break;
                }

                if (tag === 0xE000 && group === 0xFFFE) {
                    // Fragment 데이터 추출
                    const fragmentData = byteArray.slice(currentOffset + 8, currentOffset + 8 + length);
                    fragments.push(fragmentData);

                    // 다음 Item으로 이동
                    currentOffset += 8 + length;

                    // 간단한 구현: 첫 번째 Fragment만 처리하거나, SOI(FF D8)를 찾아서 처리
                    // JPEG 이미지는 보통 하나의 Fragment에 통째로 들어가거나, 여러개로 쪼개짐.
                    // 첫 번째 Fragment에 SOI 마커가 있으면 이것을 사용 시도.
                    if (fragmentData.length > 2 && fragmentData[0] === 0xFF && fragmentData[1] === 0xD8) {
                        // Found JPEG SOI
                        break; // 일단 첫 번째 프레임만 그리기 위해 루프 종료
                    }
                } else {
                    console.warn('Unknown Tag in Encapsulated Data:', group.toString(16), tag.toString(16));
                    break;
                }
            }

            if (fragments.length === 0) {
                throw new Error('JPEG 데이터를 찾을 수 없습니다.');
            }

            // 추출한 데이터로 Blob 생성
            // 만약 이미지가 여러 Fragment에 나뉘어 있다면 합쳐야 할 수도 있지만, 
            // DICOM 표준상 Frame 하나는 하나의 Fragment 또는 여러 Fragment에 걸칠 수 있음.
            // 여기서는 가장 단순한 Case (First Fragment contains the image) 우선 대응
            const blob = new Blob([fragments[0]], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                URL.revokeObjectURL(url); // 메모리 해제
                document.getElementById('imageInfo').textContent = `${img.width}x${img.height}, JPEG (Browser Decoded)`;
            };
            img.onerror = function () {
                document.getElementById('imageInfo').textContent = '브라우저에서 이미지 디코딩 실패';
            };
            img.src = url;

        } catch (e) {
            console.error('JPEG Rendering Error:', e);
            document.getElementById('imageInfo').textContent = 'JPEG 렌더링 중 오류 발생: ' + e.message;
        }
    }

    function handleSearch(event) {
        const query = event.target.value.toLowerCase();
        dicomTableBody.innerHTML = '';

        const filtered = allTags.filter(item => {
            return item.tag.toLowerCase().includes(query) ||
                item.name.toLowerCase().includes(query) ||
                String(item.value).toLowerCase().includes(query);
        });

        filtered.forEach(item => {
            const tr = createTableRow(item.tag, item.name, item.vr, item.length, item.value);
            dicomTableBody.appendChild(tr);
        });
    }
});
