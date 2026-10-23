"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import styles from "../page.module.scss";

export type ApplicationStatus =
  | "unchecked"
  | "viewed"
  | "documentPassed"
  | "interview"
  | "rejected";

export type Application = {
  id: number | string;
  company: string;
  position: string | null;
  appliedAt: string;
  platform: string;
  location: string | null;
  phone?: string | null;
  salary: string | null;
  companySize: string | null;
  jobUrl: string | null;
  companyUrl?: string | null;
  status: ApplicationStatus;
  memo: string;
};

type Platform = "사람인" | "잡코리아";
type PlatformFilter = Platform | "전체";
type Period = 5 | 14 | 30 | 60;
type SummaryFilter = "all" | "viewed" | "interview";
type SavedValue = { status?: ApplicationStatus; memo?: string };
type SavedApplications = Record<string, SavedValue>;

const STORAGE_KEY = "company-application-overrides-v1";
const STORAGE_EVENT = "company-application-overrides-change";
const EMPTY_STORAGE = "{}";
const ITEMS_PER_PAGE = 10;

function subscribeToSavedApplications(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function getSavedApplicationsSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY_STORAGE;
  } catch {
    return EMPTY_STORAGE;
  }
}

function subscribeToDate() {
  return () => undefined;
}

function getTodaySnapshot() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const statusLabels: Record<ApplicationStatus, string> = {
  unchecked: "미열람",
  viewed: "열람",
  documentPassed: "서류 합격",
  interview: "면접",
  rejected: "불합격",
};

const periods: Array<{ label: string; value: Period }> = [
  { label: "5일 이내", value: 5 },
  { label: "2주", value: 14 },
  { label: "1개월", value: 30 },
  { label: "2개월", value: 60 },
];

function applicationKey(application: Application) {
  return `${application.platform}:${application.id}`;
}

function mergeApplication(
  application: Application,
  savedApplications: SavedApplications,
) {
  const saved = savedApplications[applicationKey(application)];

  return {
    ...application,
    status: saved?.status ?? application.status,
    memo: saved?.memo ?? application.memo,
  };
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function isWithinPeriod(value: string, days: Period, todayValue: string) {
  const today = new Date(`${todayValue}T00:00:00`);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  const appliedDate = new Date(`${value}T00:00:00`);
  return appliedDate >= cutoff && appliedDate <= today;
}

export default function ApplicationDashboard({
  applications,
}: {
  applications: Application[];
}) {
  const [platform, setPlatform] = useState<PlatformFilter>("사람인");
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter | null>(null);
  const [period, setPeriod] = useState<Period>(5);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedApplications, setExpandedApplications] = useState<string[]>([]);
  const savedApplicationsRaw = useSyncExternalStore(
    subscribeToSavedApplications,
    getSavedApplicationsSnapshot,
    () => EMPTY_STORAGE,
  );
  const savedApplications = useMemo<SavedApplications>(() => {
    try {
      return JSON.parse(savedApplicationsRaw);
    } catch {
      return {};
    }
  }, [savedApplicationsRaw]);
  const latestApplicationDate = useMemo(
    () =>
      applications.reduce(
        (latest, application) =>
          application.appliedAt > latest ? application.appliedAt : latest,
        "1970-01-01",
      ),
    [applications],
  );
  const today = useSyncExternalStore(
    subscribeToDate,
    getTodaySnapshot,
    () => latestApplicationDate,
  );

  const mergedApplications = useMemo(
    () =>
      applications.map((application) =>
        mergeApplication(application, savedApplications),
      ),
    [applications, savedApplications],
  );

  const summary = useMemo(
    () => ({
      all: mergedApplications.length,
      viewed: mergedApplications.filter(
        (application) => application.status === "viewed",
      ).length,
      interview: mergedApplications.filter(
        (application) => application.status === "interview",
      ).length,
    }),
    [mergedApplications],
  );

  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("ko-KR");

    return mergedApplications.filter((application) => {
      const matchesPlatform =
        platform === "전체" || application.platform === platform;
      const matchesSummary =
        summaryFilter === null ||
        summaryFilter === "all" ||
        application.status === summaryFilter;
      const matchesPeriod = isWithinPeriod(
        application.appliedAt,
        period,
        today,
      );
      const searchableText = `${application.company} ${application.position ?? ""}`.toLocaleLowerCase(
        "ko-KR",
      );
      const matchesSearch =
        normalizedSearch === "" || searchableText.includes(normalizedSearch);

      return matchesPlatform && matchesSummary && matchesPeriod && matchesSearch;
    });
  }, [mergedApplications, period, platform, searchTerm, summaryFilter, today]);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredApplications.length / ITEMS_PER_PAGE),
  );
  const activePage = Math.min(currentPage, totalPages);
  const visibleApplications = filteredApplications.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE,
  );
  const firstVisiblePage = Math.max(
    1,
    Math.min(activePage - 2, totalPages - 4),
  );
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstVisiblePage + index,
  );

  function saveChange(id: string, value: SavedValue) {
    const next = {
      ...savedApplications,
      [id]: { ...savedApplications[id], ...value },
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      // 브라우저 저장 공간을 사용할 수 없으면 원본 JSON 값을 유지합니다.
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchTerm(searchInput);
    setCurrentPage(1);
  }

  function toggleApplication(id: string) {
    setExpandedApplications((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function selectSummary(filter: SummaryFilter) {
    setSummaryFilter(filter);
    setPlatform("전체");
    setCurrentPage(1);
  }

  function selectPlatform(nextPlatform: Platform) {
    setPlatform(nextPlatform);
    setSummaryFilter(null);
    setCurrentPage(1);
  }

  function selectPeriod(nextPeriod: Period) {
    setPeriod(nextPeriod);
    setCurrentPage(1);
  }

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
    window.requestAnimationFrame(() => {
      document
        .getElementById("application-list-start")
        ?.scrollIntoView({ block: "start" });
    });
  }

  const listTitle =
    summaryFilter === "viewed"
      ? "서류 열람 내역"
      : summaryFilter === "interview"
        ? "면접 진행 내역"
        : platform === "전체"
          ? "전체 지원 내역"
          : `${platform} 지원 내역`;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.topArea} aria-labelledby="page-title">
          <div className={styles.summary} aria-label="지원 현황 요약">
            <button
              className={`${styles.summaryItem} ${summaryFilter === "all" ? styles.summaryActive : ""}`}
              type="button"
              aria-pressed={summaryFilter === "all"}
              onClick={() => selectSummary("all")}
            >
              <span>전체 지원</span>
              <strong>{summary.all}</strong>
            </button>
            <button
              className={`${styles.summaryItem} ${summaryFilter === "viewed" ? styles.summaryActive : ""}`}
              type="button"
              aria-pressed={summaryFilter === "viewed"}
              onClick={() => selectSummary("viewed")}
            >
              <span>서류 열람</span>
              <strong>{summary.viewed}</strong>
            </button>
            <button
              className={`${styles.summaryItem} ${summaryFilter === "interview" ? styles.summaryActive : ""}`}
              type="button"
              aria-pressed={summaryFilter === "interview"}
              onClick={() => selectSummary("interview")}
            >
              <span>면접 진행</span>
              <strong>{summary.interview}</strong>
            </button>
          </div>

          <div className={styles.headingArea}>
            <div className={styles.titleRow}>
              <h1 id="page-title">회사 리스트</h1>
              <div className={styles.platformTabs} aria-label="플랫폼 선택">
                {(["사람인", "잡코리아"] as Platform[]).map((item) => (
                  <button
                    className={`${styles.platformButton} ${platform === item ? styles.platformActive : ""}`}
                    type="button"
                    aria-pressed={platform === item}
                    onClick={() => selectPlatform(item)}
                    key={item}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <form className={styles.search} onSubmit={handleSearch} role="search">
              <label className={styles.visuallyHidden} htmlFor="company-search">
                기업명 또는 지원 직무 검색
              </label>
              <input
                id="company-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="기업명 또는 지원 직무 검색"
              />
              <button type="submit">검색</button>
            </form>
          </div>
        </section>

        <div className={styles.periodTabs} aria-label="지원 기간 선택">
          {periods.map((item) => (
            <button
              className={`${styles.periodButton} ${period === item.value ? styles.periodActive : ""}`}
              type="button"
              aria-pressed={period === item.value}
              onClick={() => selectPeriod(item.value)}
              key={item.value}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.listHeader} id="application-list-start">
          <strong>{listTitle}</strong>
          <span>{filteredApplications.length}건</span>
        </div>

        <section className={styles.cardList} aria-live="polite">
          {filteredApplications.length > 0 ? (
            visibleApplications.map((application) => {
              const key = applicationKey(application);
              const isExpanded = expandedApplications.includes(key);

              return (
                <article className={styles.card} key={key}>
                  <button
                    className={styles.cardHeading}
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleApplication(key)}
                  >
                    <div>
                      <p className={styles.platformLabel}>{application.platform}</p>
                      <h2>{application.company}</h2>
                      <p className={styles.position}>
                        {application.position ?? "지원 직무 정보 없음"}
                      </p>
                    </div>
                    <span className={styles.cardMeta}>
                      <time dateTime={application.appliedAt}>
                        지원일 {formatDate(application.appliedAt)}
                      </time>
                      <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.cardExpanded}>
                      <dl className={styles.details}>
                    <div>
                      <dt>링크</dt>
                      <dd className={styles.detailLinks}>
                        {application.jobUrl && (
                          <a
                            href={application.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            공고 보기
                          </a>
                        )}
                        {application.companyUrl && (
                          <a
                            href={application.companyUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            기업 정보
                          </a>
                        )}
                        {!application.jobUrl &&
                          !application.companyUrl &&
                          "정보 없음"}
                      </dd>
                    </div>
                    <div>
                      <dt>연봉</dt>
                      <dd>{application.salary ?? "정보 없음"}</dd>
                    </div>
                    <div>
                      <dt>근무지</dt>
                      <dd>{application.location ?? "정보 없음"}</dd>
                    </div>
                    <div>
                      <dt>기업 규모</dt>
                      <dd>{application.companySize ?? "정보 없음"}</dd>
                    </div>
                      </dl>

                      <div className={styles.editArea}>
                    <label className={styles.statusField}>
                      <span>진행 상태</span>
                      <select
                        className={styles[`status_${application.status}`]}
                        value={application.status}
                        onChange={(event) =>
                          saveChange(key, {
                            status: event.target.value as ApplicationStatus,
                          })
                        }
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.memoField}>
                      <span>메모 / 특이사항</span>
                      <textarea
                        value={application.memo}
                        onChange={(event) =>
                          saveChange(key, { memo: event.target.value })
                        }
                        placeholder="메모를 입력하세요"
                        rows={3}
                      />
                    </label>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className={styles.emptyState}>
              조건에 맞는 지원 내역이 없습니다.
            </div>
          )}
        </section>

        {filteredApplications.length > ITEMS_PER_PAGE && (
          <nav className={styles.pagination} aria-label="지원 내역 페이지 이동">
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={activePage === 1}
              aria-label="첫 페이지"
            >
              ≪
            </button>
            <button
              type="button"
              onClick={() => goToPage(activePage - 1)}
              disabled={activePage === 1}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {pageNumbers.map((page) => (
              <button
                className={page === activePage ? styles.pageActive : ""}
                type="button"
                onClick={() => goToPage(page)}
                aria-current={page === activePage ? "page" : undefined}
                key={page}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goToPage(activePage + 1)}
              disabled={activePage === totalPages}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => goToPage(totalPages)}
              disabled={activePage === totalPages}
              aria-label="마지막 페이지"
            >
              ≫
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
