# 배포 권리 조사 보고서

조사일: 2026-10-28 (KST). 범위: 브리프의 S1–S12 및 공개 이력. 법률 자문이나 출시 승인 아님. 현재 약관은 과거 수집 당시 적용 약관을 증명하지 않는다. 법률상 금지와 프로젝트의 보수적 출시 보류를 구별한다. 원문, API 응답, 모델 가중치, 개인 데이터는 수집하지 않았다. 아래 웹 자료는 달리 적지 않으면 이날 조회했으며, 페이지의 개정일을 확인하지 못한 경우 미확인으로 둔다. 기존 기록은 당시의 관찰이며 현재 확인과 구분한다.

판정: **조건부** = 적힌 조건 아래 근거가 있음; **불명** = 허가나 금지 어느 쪽도 확정하지 못함; **금지** = 명시적 제한이 해당하는 범위; **해당 없음** = 그 형태로 제공하지 않는 경우. 개인 사용은 이미 적법하게 보유한 자료를 전제로 하며, 취득 행위를 소급 승인하지 않는다. 공개 저장소는 기록 전체를 포함한다.

> 상태 메모 (2026-10-29): 사용자는 데스크톱 배포와 회사별 목록 내장을 결정했다(ADR 007, ADR 008). 이 보고서의 보류 권고는
> 기록으로 남기며, 미해결 항목은 `specs/company-prep/distribution-considerations.md`(DC-1–DC-6)에서 추적하고 공개 출시 전
> 사용자가 검토한다(DA-9). 판정 자체는 바뀌지 않았다.

## 우선 조치

1. 공개 이력의 본문은 삭제 여부를 권리자 및 법률 검토와 함께 결정한다. [GitHub 안내](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)는 재작성 후에도 포크·클론·캐시·PR 참조가 남을 수 있다고 설명한다. 지원팀의 캐시 제거는 민감 정보 대상이며 이 사안이 지원 대상인지는 미확인이다. 이력 변경이나 강제 푸시는 하지 않았다. DMCA 요청 가능성은 예측 불가.
2. LeetCode 카탈로그와 회사별 목록의 배포, NVIDIA trial 출력의 사용자 제공은 권리 확인 전 보류한다. NVIDIA 약관이 해당 계정에 적용된다면 trial 출력 배포 및 production 사용은 금지된다.
3. 공개 전 `research/recommendation_inputs/`의 실제 파일과 생성 출처를 별도 검토한다. 본문이 없다는 브리프의 이전 스캔만으로 파생물 권리가 해결되지는 않는다.

## P0 공개 이력과 연구 결과

| 항목 | 개인 로컬 | 공개 저장소 | 데스크톱 배포 | 웹 호스팅 |
|---|---|---|---|---|
| 과거 LeetCode/백준 본문 | 불명: 취득·보존 근거 필요 | 불명: 권리자 허가 확인 필요, 현재 공개는 브리프의 기존 조사 | 불명 | 불명 |
| ID/slug 매핑, 라벨, 풀, 그림 | 불명: 출처·계약 검토 | 불명: 실질적 추출 및 계약 검토 | 불명 | 불명 |
| 미푸시 연구 산출물 | 불명: 구성별 검토 | 불명: 공개 전 검토 | 불명 | 불명 |

[LeetCode 약관](https://leetcode.com/terms/)은 “crawling,” “scraping,” “spidering”을 금지하고 질문을 콘텐츠에 포함한다. 이전 조사에서 최종 수정일 2024-04-05로 기록; 이번 조사에서 재확인하지 못함. 백준의 서비스 종료 이후 개별 문제 권리자와 이전 약관은 확인하지 못했다. 본문 없는 ID나 해시는 자동으로 침해도, 자동으로 무제한 허용도 아니다. EU 데이터베이스권은 보호 대상 데이터베이스와 실질적 투자/추출 등 요건, 한국 데이터베이스 제작자 권리는 구체적 데이터와 행위 검토가 필요하다. 원본·계약·관할별 법률 검토가 필요하며 확정 판단하지 않는다.

개선 순서: 노출 경로와 참조 목록을 읽기 전용으로 확정 → 배포 보류 및 권리자/전문가 검토 → 필요 시 모든 refs, 협업자와 포크, GitHub 지원 가능성을 포함한 이력 정리 계획 수립. 이번 조사에서 원격 공개 상태와 각 파일 내용은 독립 재검증하지 않았고 브리프의 사실을 그대로 인용했다.

## S1–S6 플랫폼 데이터

| 항목 | 개인 로컬 | 공개 저장소 | 데스크톱 배포 | 웹 호스팅 |
|---|---|---|---|---|
| S1 LeetCode 본문/벡터 | 불명: 기존 격리 유지 | 불명 | 불명 | 불명 |
| S2 LeetCode 카탈로그 | 불명 | 불명 | 불명 | 불명 |
| S3 Codeforces API 메타데이터·사용자 기록 | 조건부: API 및 약관 준수 | 불명: 재배포 허가 미확인 | 불명 | 불명: 특히 상업 이용 |
| S4 AtCoder Problems 메타데이터·모델 | 불명: 데이터 사용권 미확인 | 불명 | 불명 | 불명 |
| S5 AtCoder 대회 목록 HTML 파싱 | 불명 | 해당 없음: 코드 공개만으로 데이터 사용권 보장 안 됨 | 불명 | 불명 |
| S6 ContestDeck/CLIST 일정 | 불명: 원본 조건 확인 필요 | 불명 | 불명 | 불명 |

- S1/S2: [LeetCode 약관](https://leetcode.com/terms/)의 스크래핑 금지는 취득 경로에 관계된다. 사실성·저작권 문제와 계약 문제는 별개다. 사용자 입력 링크만 저장하는 방안은 노출을 줄이나 적법성을 보증하지 않는다. 공식 라이선스 API나 파트너 허가 경로는 확인하지 못했다. 대안: 사용자 입력 링크 → 권리자 서면 허가 → 허가된 대체 카탈로그.
- S3: [Codeforces 약관](https://codeforces.com/terms)과 [API 문서](https://codeforces.com/apiHelp)를 열었다. 이전 `research/full_catalog/terms-review.v1.json`은 사이트 자료의 판매·재라이선스·상업화를 제한한다고 기록했다. 이번 검색의 추출 화면에서 해당 문구와 정확한 API 속도 제한을 독립적으로 확인하지 못했다. 공개 API 접근은 재배포 허가를 증명하지 않는다. 다른 이용자 기록은 개인정보와 연구 목적도 검토한다. 대안: 사용자 자신의 기록만 처리, 최신 약관 및 운영자에게 재배포·상업 이용 문의.
- S4: [비공식 API 문서](https://github.com/kenkoooo/AtCoderProblems/blob/main/doc/api.md)는 “sleep for more than 1 second between accesses”라고 요청한다. 데이터 및 난이도 모델의 별도 라이선스와 소유권은 확인하지 못했다. 코드 라이선스가 데이터에 자동 적용된다고 가정하지 않는다. 대안: 캐시·요청 제한, 데이터 제공자에게 서면 허가.
- S5: [AtCoder 약관](https://atcoder.jp/tos?lang=en)과 이전 로봇 검토를 확인했다. robots 허용은 이용 허가가 아니며 AI 학습 거부 신호는 LLM 추론에 대한 명시적 금지와 동일하지 않다. 대회 목록 자동 파싱 허가 및 LLM 전송은 미확인. 대안: 사용자 입력 또는 허가된 피드, AtCoder 문의.
- S6: [ContestDeck README](https://github.com/MaskedCarrot/contestdeck-data)는 MIT가 소스 코드에 적용되고 원본 데이터는 별도 조건이라고 명시한다. CLIST의 재배포 조건을 이번 조사에서 확인하지 못했다. 대안: 일정 기능 비활성화, CLIST 및 미러 제공자의 허가 확인.

## S7 연구 데이터셋

| 항목 | 개인 로컬 | 공개 저장소 | 데스크톱 배포 | 웹 호스팅 |
|---|---|---|---|---|
| CodeContests 비코드 | 조건부: CC BY 및 제3자 조건 검토 | 불명: 개별 원본 권리 | 불명 | 불명 |
| CodeNet 설명 | 불명: 데이터셋과 개별 설명 권리 범위 | 불명 | 불명 | 불명 |

[CodeContests 라이선스](https://github.com/google-deepmind/code_contests#license)는 비코드 CC BY 4.0과 코드 Apache 2.0을 명시하고 제3자 조건 및 권리 비보증을 별도로 둔다. 어떤 개별 원문에 어떤 제3자 조건이 적용되는지는 조사하지 못했다. 기존 `research/algorithm_system/CHECKPOINT2.md`는 CodeNet 데이터셋을 CDLA-Permissive-2.0으로 기록하지만 이번에 IBM의 해당 설명 아카이브에 대한 직접 라이선스 문구와 원문별 권리를 독립 확인하지 못했다. 해당 기록의 사적 연구 허용은 공개 배포 승인과 다르다. 대안: 데이터·본문을 배포물에서 제외하고 출처·라이선스 기록 유지 → 배포 대상 행별 권리 확인.

## S8 모델

| 모델 | 모델 카드 표시 | 개인 로컬 | 공개 repo / 데스크톱 가중치 배포 | 웹 호스팅 |
|---|---|---|---|---|
| [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) | Apache-2.0 | 조건부 | 조건부 | 조건부 |
| [paraphrase-multilingual-MiniLM-L12-v2](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2) | Apache-2.0 | 조건부 | 조건부 | 조건부 |
| [LaBSE](https://huggingface.co/sentence-transformers/LaBSE) | Apache-2.0 | 조건부 | 조건부 | 조건부 |
| [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) | **미확인** | 불명 | 불명 | 불명 |
| [ms-marco-MiniLM-L6-v2](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2) | Apache-2.0 | 조건부 | 조건부 | 조건부 |
| [opus-mt-ja-en](https://huggingface.co/Helsinki-NLP/opus-mt-ja-en) | Apache-2.0 | 조건부 | 조건부 | 조건부 |

카드의 라이선스 표시는 각 모델의 실제 고정 revision, 개별 파일, NOTICE 및 학습 데이터 권리 전부에 대한 독립 검증이 아니다. e5 페이지는 웹 도구가 `Content length is too large` 오류를 반환했다. Apache 배포 시 라이선스 사본, 해당 저작권 및 NOTICE, 변경 사항 등 [라이선스 제4조](https://www.apache.org/licenses/LICENSE-2.0)를 확인한다. 웹 서비스에서 가중치를 배포하지 않는 경우와 번들은 구별한다. 입력 데이터 사용권은 모델 라이선스로 해결되지 않는다. 대안: 가중치 비번들 → 고정 revision의 파일별 라이선스 및 NOTICE 검토 후 번들.

## S9–S12 AI와 사용자 데이터

| 항목 | 개인 로컬 | 공개 저장소 | 데스크톱 배포 | 웹 호스팅 |
|---|---|---|---|---|
| Gemini 설명 | 조건부: 사용 약관과 입력 권리 | 불명: 출력 및 입력 권리 확인 | 불명: 제품·계정별 조건 | 불명: 사용자 제공 및 개인정보 조건 확인 |
| NVIDIA API Catalog trial 설명 | 조건부: 시험 목적 및 입력 제한 | 금지: trial 약관이 적용되는 출력 제공 | 금지: 해당 trial 출력 제공 | 금지: trial 서비스/출력 production 사용 |
| S10 AI 라벨 | 불명: 생성 도구·계약별 | 불명 | 불명 | 불명 |
| S11 회사별 목록 | 불명: 출처·취득 조건 | 불명: 허가 확인 전 보류 | 불명 | 불명 |
| S12 사용자 풀이 | 조건부: 본인의 권리 및 포함된 제3자 자료 검토 | 조건부: 권리자 동의 및 개인정보 검토 | 조건부 | 조건부: 적용 개인정보법·계약 준수 |

- [NVIDIA trial 약관](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf) 1.2는 시험 목적과 production 사용 금지, 4.2는 생성물의 타인 제공 제한, 4.3은 별도 허가 없는 식별 가능한 개인정보 업로드 제한을 규정한다. 실제 계정과 엔드포인트에 이 계약이 적용되는지 및 별도 상용 계약은 확인하지 못했다. 버전 날짜 미확인. 대안: trial 비활성화 → 적용 계약 확인 → 상용 권한 있는 대체 제공자.
- [Gemini API 약관](https://ai.google.dev/gemini-api/terms)은 무료 서비스 입력과 출력을 제품 개선에 사용할 수 있고 사람 검토가 가능하다고 명시하며 EEA/스위스/영국 예외와 유료 조건을 둔다. 계정·지역·계약별 실제 적용과 제3자에게 출력 제공, 연령 및 고지 요구를 완전히 확인하지 못했다. 실제 전송 필드도 코드 추적을 수행하지 않았다. 대안: 로컬 설명 사용, 전송 데이터 최소화와 적용 계약 확인.
- S10: 라벨별 생성 서비스, 당시 계정과 약관, 원본 입력의 권리를 확인하지 못했다. AI 판정은 인간 검증이 아니다. S11: 저장소에 라이선스가 없다는 내용은 브리프의 기존 확인이며 이번에 독립 확인하지 않았다. Premium 유래라는 주장만으로 모든 사용이 법적으로 금지된다고 단정하지 않는다. 대안: 목록을 추가하지 않고 허가 또는 사용자 작성 자료 사용.
- S12: [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)은 적용 범위에 해당할 때 법적 근거, 목적 제한, 최소화, 보관 제한, 삭제 등 의무를 둔다. 한국 개인정보 보호법의 구체적 최신 조문과 국외 이전·보관 예외는 이번에 완전히 검증하지 못했다. 이용자 위치, 운영자 역할, 실제 데이터 흐름에 따라 판단한다. 호스팅 전 개인정보 흐름도, 법적 근거, 고지, 보관·삭제, 처리위탁 및 국외 이전 검토가 필요하다. 로컬 파일이라도 타인의 개인정보나 저작물이 포함될 수 있다.

## 공통 사항과 미조사 영역

- 상표: 플랫폼 명칭을 식별 목적으로 사용하는 것과 로고·앱 이름에서 제휴를 암시하는 것은 구별한다. 각 권리자의 상표 정책과 한국·미국·일본·UAE별 판단은 확인하지 못했다. 이름 사용을 일괄 승인하지 않는다.
- 저장소 라이선스: 브리프는 LICENSE가 없다고 기록한다. 공개 상태만으로 일반적 오픈소스 라이선스가 부여되지는 않는다. 다만 [GitHub 서비스 약관](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)은 공개 저장소 열람·포크에 관한 별도 권한을 둔다. 소유자의 코드 라이선스 선택은 제3자 자료의 권리를 해결하지 않는다.
- Node/Electron/Tauri 및 npm: 실제 배포 스택과 의존성 목록이 확정되지 않아 전수 조사하지 못했다. 출시 산출물 기준 SBOM, 각 라이선스·저작권·NOTICE와 수정 사항을 검토해야 한다.
- 한국/미국/UAE/일본 법률, EU 데이터베이스권 적용, 백준 권리자, CLIST 약관, e5 카드, 모델별 고정 revision, AI 라벨 생성 계약, API 전송 필드 및 실제 공개 refs는 미확인이다. 법률 전문가나 각 제공자의 답변이 필요하다. 명시적으로 확인되지 않은 항목은 승인으로 해석하지 않는다.

검증: 문서만 작성했으며 코드·데이터·원격 이력은 변경하지 않았다. 자동 테스트는 해당 없음. 추천 커밋 메시지: `docs: assess distribution rights and outstanding questions`.

## 검증 노트 (2026-10-28, 보고서 작성 후 별도 확인)

- **NVIDIA trial 약관** (PDF 파일 날짜 2025-10-07, 본문에 시행일 표시 없음): 1.2 "limited trial purposes only and without use of
  the API Service or Generated Content in production" 확인. 1.4는 production 사용에 별도 Subscription이 필요하다고 규정한다. 4.2(생성물
  타인 제공 금지)와 4.3(개인정보 업로드 제한)도 확인했다. 보고서에 없던 조항: 3.3(iv)는 User Content와 Generated Content를 NVIDIA
  제품 개선에 수집할 수 있다고 하고, 4.12는 경쟁 제품 개발에 사용하는 것을 금지한다. 개인 학습 용도가 "internal testing and
  evaluation"에 해당하는지는 약관 문구만으로는 불명확하다.
- **Gemini API 약관** (Last updated 2026-04-28, effective 2026-03-23): 무료 이용 시 입력·출력의 제품 개선 사용과 사람 검토 가능을
  확인했다. 보고서에 없던 조건: 18세 이상만 사용할 수 있고, 18세 미만이 쓸 가능성이 있는 앱에는 사용할 수 없다. EEA·스위스·영국
  사용자에게 제공하는 앱은 유료 서비스만 쓸 수 있다. 웹 호스팅이나 배포 시 직접 해당한다.
- **ContestDeck**: README가 "MIT license covers this repository's source code"라고 하고, 데이터는 CList(clist.by) 원본 조건을 따른다고
  명시한다. 보고서 내용과 같다. CList 약관은 여전히 미확인이다.
- **multilingual-e5-small**: Hugging Face 모델 메타데이터의 라이선스 태그가 `license:mit`이다. 보고서의 "미확인"을 이것으로 채운다
  (고정 revision과 파일별 NOTICE는 여전히 별도 확인 필요).
- **LLM에 실제로 보내는 필드** (hosted/mastery/explanations.mjs `explanationEvidence`): 추천 스냅샷 ID, 날짜, 카탈로그·정책 버전,
  `problem_key`, **카탈로그 제목**, 추천 종류, 단계, 난이도, 개념 라벨, 정책 근거 문장(예: "2/3 Easy and 0/2 Medium solves"처럼
  학습 진행 수치 포함), 복습 기한. 학습자 ID와 이메일은 보내지 않는다(`learner_hash`는 로컬 저장에만 쓰인다). 즉 LeetCode
  카탈로그 유래 제목과 개인 학습 진행 정보가 두 제공자에게 전송되며, 무료 이용 조건상 제품 개선에 쓰일 수 있다.
- **공개 이력 (P0)**: 보고서는 독립 재검증하지 않았다고 적었다. 브리프 작성 시 `origin/main`에서 직접 확인했다:
  `leetcode_raw_data.jsonl` 100행(`content` 평균 1,565자), `baekjoon_raw_data.jsonl` 100행, 2025-12-30 추가, 2026-01-07 삭제, 태그
  `v1.0.0-faiss-index`에는 없음. 저장소는 PUBLIC이고 LICENSE 파일이 없다.
