document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('dicomFile');
    const fileNameDisplay = document.getElementById('fileName');
    const previewSection = document.getElementById('previewSection');
    const dataSection = document.getElementById('dataSection');
    const dicomTableBody = document.querySelector('#dicomTable tbody');
    const canvas = document.getElementById('dicomImage');
    const tagSearchInput = document.getElementById('tagSearch');

    const addTagBtn = document.getElementById('addTagBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const addTagModal = document.getElementById('addTagModal');
    const cancelTagBtn = document.getElementById('cancelTagBtn');
    const saveTagBtn = document.getElementById('saveTagBtn');

    let parsedDicom = null;
    let loadedDicomData = null; // dcmjs object
    let allTags = [];

    fileInput.addEventListener('change', handleFileSelect);
    tagSearchInput.addEventListener('input', handleSearch);

    // UI Events
    addTagBtn.addEventListener('click', () => {
        addTagModal.classList.remove('hidden');
    });

    cancelTagBtn.addEventListener('click', () => {
        addTagModal.classList.add('hidden');
    });

    saveTagBtn.addEventListener('click', addNewTag);
    downloadBtn.addEventListener('click', downloadDicom);

    // Close modal on outside click
    addTagModal.addEventListener('click', (e) => {
        if (e.target === addTagModal) {
            addTagModal.classList.add('hidden');
        }
    });

    // 기본 파일 자동 로드
    loadDefaultFile();

    function loadDefaultFile() {
        const defaultFileName = 'IMG-0002-00001.dcm';
        fetch(defaultFileName)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                const byteArray = new Uint8Array(arrayBuffer);
                processDicomData(byteArray, defaultFileName);
            })
            .catch(e => {
                console.warn('기본 파일 로드 실패:', e);
                // 로컬 실행(file://) 환경에서는 CORS 이슈로 fetch가 차단될 수 있음을 안내
                if (window.location.protocol === 'file:') {
                    alert('로컬 파일 실행(file://) 환경에서는 브라우저 보안 정책으로 인해 기본 파일을 자동으로 불러올 수 없습니다.\n\n파일을 직접 선택하거나, 로컬 웹 서버(예: python -m http.server)를 사용하여 실행해주세요.');
                } else {
                    console.error('기본 파일을 불러오는 중 오류가 발생했습니다. 파일이 존재하는지 확인해주세요.');
                }
            });
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (fileEvent) => {
            const arrayBuffer = fileEvent.target.result;
            const byteArray = new Uint8Array(arrayBuffer);
            processDicomData(byteArray, file.name);
        };
        reader.readAsArrayBuffer(file);
    }

    function processDicomData(byteArray, fileName) {
        fileNameDisplay.textContent = fileName;

        try {
            // 1. dicom-parser 파싱 (뷰어 및 기존 로직용)
            parsedDicom = dicomParser.parseDicom(byteArray);

            // 2. dcmjs 파싱 (편집 및 저장용)
            // dcmjs는 ArrayBuffer를 입력으로 받습니다.
            loadedDicomData = dcmjs.data.DicomMessage.parse(byteArray.buffer);

            // UI 초기화 및 표시
            previewSection.classList.remove('hidden');
            dataSection.classList.remove('hidden');

            // 데이터 테이블 렌더링
            renderTable(parsedDicom, byteArray);

            // 이미지 렌더링 시도
            renderImage(parsedDicom, byteArray);

        } catch (error) {
            console.error('Error parsing DICOM:', error);
            alert('DICOM 파싱 중 오류가 발생했습니다. 올바른 DICOM 파일인지 확인해주세요.\n\n' + error.message);
        }
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
        // dcmjs uses '00280010' (no 'x')
        // We need a standard key for consistent editing
        const tagKey = tag.startsWith('x') ? tag.substring(1) : tag;

        const group = tagKey.substring(0, 4);
        const element = tagKey.substring(4, 8);
        const formattedTag = `(${group},${element})`.toUpperCase();

        // Editable check: Only text based VRs are editable for now
        const editableVRs = ['PN', 'LO', 'SH', 'DA', 'TM', 'CS', 'ST', 'LT', 'UT', 'AE', 'AS', 'DS', 'IS', 'UI'];
        const isEditable = editableVRs.includes(vr);

        const valueCell = document.createElement('td');
        valueCell.className = isEditable ? 'editable-cell' : '';
        valueCell.innerHTML = value; // innerHTML for safe content (already sanitized or mapped)

        if (isEditable) {
            valueCell.title = "Click to edit";
            valueCell.style.cursor = "pointer";
            valueCell.onclick = function () {
                makeCellEditable(this, tagKey, vr);
            };
        }

        tr.innerHTML = `
            <td>${formattedTag}</td>
            <td>${name} <span style="font-size:0.8em; color:#666;">(${vr})</span></td>
            <td>${length}</td>
        `;
        tr.appendChild(valueCell);

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

            // 압축된 형식 처리
            const supportedSyntaxes = [
                '1.2.840.10008.1.2',      // Implicit VR Little Endian
                '1.2.840.10008.1.2.1',    // Explicit VR Little Endian
            ];

            const jpegSyntaxes = [
                '1.2.840.10008.1.2.4.50',
                '1.2.840.10008.1.2.4.51',
                '1.2.840.10008.1.2.4.70',
            ];

            if (transferSyntax && !supportedSyntaxes.includes(transferSyntax)) {
                if (jpegSyntaxes.includes(transferSyntax)) {
                    document.getElementById('windowControls').classList.add('hidden');
                    renderJpegImage(dataSet, byteArray, pixelDataElement, canvas);
                } else {
                    document.getElementById('imageInfo').textContent = `미리보기 불가: 지원되지 않는 전송 문법입니다 (${transferSyntax}).`;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
                return;
            }

            // Uncompressed Image Logic
            document.getElementById('windowControls').classList.remove('hidden');

            canvas.width = columns;
            canvas.height = rows;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(columns, rows);

            const pixelDataOffset = pixelDataElement.dataOffset;
            const bitsAllocated = dataSet.uint16('x00280100');
            const pixelRepresentation = dataSet.uint16('x00280103'); // 0=unsigned, 1=signed
            const rescaleSlope = dataSet.floatString('x00281053') || 1.0;
            const rescaleIntercept = dataSet.floatString('x00281052') || 0.0;

            // Raw Pixel Data Loading
            let numPixels = rows * columns;
            let pixels = null;

            if (bitsAllocated === 8) {
                pixels = new Uint8Array(byteArray.buffer, pixelDataOffset, numPixels);
            } else if (bitsAllocated === 16) {
                if (pixelRepresentation === 1) {
                    pixels = new Int16Array(byteArray.buffer, pixelDataOffset, numPixels);
                } else {
                    pixels = new Uint16Array(byteArray.buffer, pixelDataOffset, numPixels);
                }
            }

            if (!pixels) {
                document.getElementById('imageInfo').textContent = `지원되지 않는 bit depth (${bitsAllocated})`;
                return;
            }

            // --- Window Level Logic ---
            const wcSlider = document.getElementById('wcSlider');
            const wwSlider = document.getElementById('wwSlider');
            const wcValue = document.getElementById('wcValue');
            const wwValue = document.getElementById('wwValue');
            const resetBtn = document.getElementById('resetWindowBtn');

            // Initial Values (Try to get from tags)
            let initialWC = 0;
            let initialWW = 0;

            // 안전하게 파싱 시도
            try {
                const wcStr = dataSet.string('x00281050');
                const wwStr = dataSet.string('x00281051');
                if (wcStr) initialWC = parseFloat(wcStr.split('\\')[0]);
                if (wwStr) initialWW = parseFloat(wwStr.split('\\')[0]);
            } catch (e) { }

            // Calculate Range from Min/Max Pixel
            let minPixel = Number.MAX_VALUE;
            let maxPixel = Number.MIN_VALUE;

            for (let i = 0; i < numPixels; i++) {
                if (pixels[i] < minPixel) minPixel = pixels[i];
                if (pixels[i] > maxPixel) maxPixel = pixels[i];
            }

            const minHU = minPixel * rescaleSlope + rescaleIntercept;
            const maxHU = maxPixel * rescaleSlope + rescaleIntercept;

            if (!initialWW || initialWW <= 0) {
                initialWW = maxHU - minHU; // Full Range
            }
            if (isNaN(initialWC)) {
                initialWC = (maxHU + minHU) / 2; // Middle
            }

            // Set Ranges
            wcSlider.min = Math.floor(minHU - 1000);
            wcSlider.max = Math.floor(maxHU + 1000);
            wwSlider.min = 1;
            wwSlider.max = Math.floor((maxHU - minHU) * 2) || 4000;

            // Apply Values
            updateGUI(initialWC, initialWW);
            drawWindowedImage(initialWC, initialWW);

            // Events
            wcSlider.oninput = (e) => {
                const val = parseFloat(e.target.value);
                wcValue.textContent = Math.round(val);
                drawWindowedImage(val, parseFloat(wwSlider.value));
            };

            wwSlider.oninput = (e) => {
                const val = parseFloat(e.target.value);
                wwValue.textContent = Math.round(val);
                drawWindowedImage(parseFloat(wcSlider.value), val);
            };

            resetBtn.onclick = () => {
                updateGUI(initialWC, initialWW);
                drawWindowedImage(initialWC, initialWW);
            };

            function updateGUI(c, w) {
                wcSlider.value = c;
                wwSlider.value = w;
                wcValue.textContent = Math.round(c);
                wwValue.textContent = Math.round(w);
            }

            function drawWindowedImage(wc, ww) {
                const wc_val = wc;
                const ww_val = ww;

                const minWindow = wc_val - 0.5 * ww_val;
                const maxWindow = wc_val + 0.5 * ww_val;
                const windowRange = maxWindow - minWindow;

                let dataIndex = 0;
                for (let i = 0; i < numPixels; i++) {
                    let rawValue = pixels[i];
                    let huValue = rawValue * rescaleSlope + rescaleIntercept;

                    let val = 0;
                    if (huValue <= minWindow) {
                        val = 0;
                    } else if (huValue >= maxWindow) {
                        val = 255;
                    } else {
                        val = Math.floor(((huValue - minWindow) / windowRange) * 255);
                    }

                    imageData.data[dataIndex++] = val; // R
                    imageData.data[dataIndex++] = val; // G
                    imageData.data[dataIndex++] = val; // B
                    imageData.data[dataIndex++] = 255; // Alpha
                }
                ctx.putImageData(imageData, 0, 0);
                document.getElementById('imageInfo').textContent = `${columns}x${rows}, ${bitsAllocated} bit, WC: ${Math.round(wc_val)}, WW: ${Math.round(ww_val)}`;
            }

        } catch (e) {
            console.error('Image rendering error:', e);
            document.getElementById('imageInfo').textContent = '이미지 렌더링 중 오류 발생';
        }
    }
    function renderJpegImage(dataSet, byteArray, pixelDataElement, canvas) {
        try {
            // Encapsulated Format 파싱
            let offset = pixelDataElement.dataOffset;
            const endOffset = offset + pixelDataElement.length;

            let fragments = [];
            let isStandardEncapsulation = false;

            try {
                // Helper to read simple values
                function readUint16(off) {
                    return byteArray[off] + (byteArray[off + 1] << 8);
                }
                function readUint32(off) {
                    return byteArray[off] + (byteArray[off + 1] << 8) + (byteArray[off + 2] << 16) + (byteArray[off + 3] << 24);
                }

                // 1. Basic Offset Table Item Check
                let currentOffset = offset;

                // 범위 체크
                if (currentOffset + 8 <= endOffset) {
                    let tag = readUint16(currentOffset);    // E000
                    let group = readUint16(currentOffset + 2); // FFFE

                    if (tag === 0xE000 && group === 0xFFFE) {
                        // 표준 구조로 보임
                        isStandardEncapsulation = true;
                        let length = readUint32(currentOffset + 4);
                        currentOffset += 8 + length; // Offset Table 건너뛰기

                        // Fragment Loop
                        while (currentOffset < endOffset) {
                            if (currentOffset + 8 > endOffset) break; // 안전 장치

                            tag = readUint16(currentOffset);
                            group = readUint16(currentOffset + 2);
                            length = readUint32(currentOffset + 4);

                            // Sequence Delimitation Item (FFFE E0DD)
                            if (tag === 0xE0DD && group === 0xFFFE) {
                                break;
                            }

                            if (tag === 0xE000 && group === 0xFFFE) {
                                if (currentOffset + 8 + length > endOffset) {
                                    // 데이터 잘림 방지
                                    length = endOffset - (currentOffset + 8);
                                }

                                const fragmentData = byteArray.slice(currentOffset + 8, currentOffset + 8 + length);
                                fragments.push(fragmentData);
                                currentOffset += 8 + length;

                                if (fragmentData.length > 2 && fragmentData[0] === 0xFF && fragmentData[1] === 0xD8) {
                                    break; // 첫 번째 프레임 발견 시 중단 (단순화)
                                }
                            } else {
                                // 알 수 없는 태그 -> 구조 깨짐으로 간주
                                console.warn('Unknown Tag in Encapsulated Data:', group.toString(16), tag.toString(16));
                                isStandardEncapsulation = false; // Fallback으로 전환
                                fragments = [];
                                break;
                            }
                        }
                    }
                }
            } catch (parseErr) {
                console.warn('Standard parsing failed:', parseErr);
                isStandardEncapsulation = false;
                fragments = [];
            }

            // 2. Fallback: Raw Byte Scanning
            // 표준 구조 파싱에 실패했거나, 결과가 없을 경우
            if (!isStandardEncapsulation || fragments.length === 0) {
                console.log('Falling back to Raw Byte Scanning for JPEG SOI...');

                // Pixel Data 영역 내에서 JPEG SOI (FF D8) 검색
                let scanIndex = offset;
                let foundSoi = -1;

                // 너무 오래 걸리지 않게 앞부분 4KB 정도만 검색하거나, 그냥 전체 검색 (이미지 크기에 따라 다름)
                while (scanIndex < endOffset - 1) {
                    if (byteArray[scanIndex] === 0xFF && byteArray[scanIndex + 1] === 0xD8) {
                        foundSoi = scanIndex;
                        break;
                    }
                    scanIndex++;
                }

                if (foundSoi !== -1) {
                    // 발견된 SOI 부터 Pixel Data 끝까지를 Blob으로 간주
                    // (뒤에 패딩이나 다른 프레임이 있어도 브라우저 디코더가 무시하길 기대)
                    // 일부 브라우저는 뒤에 쓰레기 값이 많으면 에러를 낼 수도 있으므로, EOI(FF D9)를 찾는 것이 좋으나
                    // EOI가 여러개일 수도 있고 썸네일일 수도 있어 일단 전체를 넘김
                    const jpegData = byteArray.slice(foundSoi, endOffset);
                    fragments.push(jpegData);
                    const info = document.getElementById('imageInfo');
                    if (info) info.textContent += ' (Recovered)';
                }
            }

            if (fragments.length === 0) {
                throw new Error('JPEG 데이터를 찾을 수 없습니다 (No SOI found).');
            }

            // 렌더링
            const blob = new Blob([fragments[0]], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                URL.revokeObjectURL(url);
                const info = document.getElementById('imageInfo');
                if (info && !info.textContent.includes('JPEG')) {
                    const transferSyntax = dataSet.string('x00020010');
                    info.textContent = `${img.width}x${img.height}, JPEG (Browser Decoded), TS: ${transferSyntax}`;
                }
            };
            img.onerror = function () {
                document.getElementById('imageInfo').textContent = '브라우저에서 이미지 디코딩 실패 (Invalid Stream)';
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

    // --- Editing & Saving Features ---

    function makeCellEditable(cell, tagKey, vr) {
        if (cell.querySelector('input')) return; // Already editing

        const currentValue = cell.innerText;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.className = 'edit-input';

        // Save on Blur or Enter
        const saveHandler = () => {
            const newValue = input.value;
            // Update UI
            cell.innerText = newValue;
            // Update Data
            saveTagValue(tagKey, vr, newValue);
        };

        input.onblur = saveHandler;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        };

        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
    }

    function saveTagValue(tagKey, vr, newValue) {
        // tagKey format: '00100010' (no 'x')
        // dcmjs dict structure: dataset.dict['00100010'] = { vr: 'PN', Value: ['Name'] }

        if (!loadedDicomData || !loadedDicomData.dict) return;

        // Ensure key format matches dcmjs expectations
        const key = tagKey.startsWith('x') ? tagKey.substring(1) : tagKey;

        if (!loadedDicomData.dict[key]) {
            // Create if not exists (shouldn't happen for edit, only add)
            loadedDicomData.dict[key] = { vr: vr, Value: [] };
        }

        // dcmjs Value is usually an array
        // Handle Multi-value VRs if needed, for now treat as single string
        // Some VRs need specific parsing (e.g. DS, IS, FL) but string is robust for simple text
        if (['DS', 'IS', 'US', 'SS', 'UL', 'SL', 'FL', 'FD'].includes(vr)) {
            // Try number parsing
            const num = Number(newValue);
            loadedDicomData.dict[key].Value = [isNaN(num) ? newValue : num];
        } else {
            loadedDicomData.dict[key].Value = [newValue];
        }

        console.log(`Updated ${key} to ${newValue}`);

        // Update allTags array for search consistency
        const tagIndex = allTags.findIndex(t => t.tag === ('x' + key) || t.tag === key);
        if (tagIndex !== -1) {
            allTags[tagIndex].value = newValue;
        }
    }

    function addNewTag() {
        const group = document.getElementById('tagGroup').value;
        const element = document.getElementById('tagElement').value;
        const vr = document.getElementById('tagVR').value;
        const value = document.getElementById('tagValue').value;

        if (!group || !element || group.length !== 4 || element.length !== 4) {
            alert('Group and Element must be 4-character Hex strings (e.g. 0010).');
            return;
        }

        const tagKey = group + element;

        if (loadedDicomData.dict[tagKey]) {
            if (!confirm('Tag already exists. Overwrite?')) return;
        }

        // Add to dcmjs dict
        loadedDicomData.dict[tagKey] = {
            vr: vr,
            Value: [value]
        };

        // Add to UI (Manual update or re-render)
        // Re-rendering table is safer but heavier. Let's just append to table and allTags.

        const name = getTagName('x' + tagKey) || 'Custom Tag';

        // createTableRow expects 'x...' format usually for 'tag' arg if based on dicom-parser key
        // passing raw hex key and handling it in createTableRow is safer now.
        const tr = createTableRow(tagKey, name, vr, value.length, value);

        // Prepend to body or append? Append.
        // If sorting matters, we should re-render. Let's try re-rendering from updated dict if possible,
        // but our renderTable depends on dicomParser dataSet, not dcmjs loadedDicomData.
        // So we strictly manage UI element addition here manually to avoid full re-parse logic complexity.

        dicomTableBody.insertBefore(tr, dicomTableBody.firstChild); // Show at top for visibility

        // Update search cache
        allTags.push({
            tag: tagKey, // or 'x'+tagKey
            name: name,
            vr: vr,
            length: value.length,
            value: value
        });

        // Close Modal
        document.getElementById('addTagModal').classList.add('hidden');

        // Clear inputs
        document.getElementById('tagGroup').value = '';
        document.getElementById('tagElement').value = '';
        document.getElementById('tagValue').value = '';

        alert('Tag Added!');
    }

    function downloadDicom() {
        if (!loadedDicomData) {
            alert('No DICOM data loaded.');
            return;
        }

        try {
            // Write to ArrayBuffer
            const buffer = loadedDicomData.write();

            // Create Blob
            const blob = new Blob([buffer], { type: 'application/dicom' });

            // Create Link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // File Name
            const originalName = fileNameDisplay.textContent || 'image.dcm';
            const dotIndex = originalName.lastIndexOf('.');
            const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
            link.download = `${baseName}_modified.dcm`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (e) {
            console.error('Error generating DICOM:', e);
            alert('Failed to generate DICOM file.\n' + e.message);
        }
    }
});
