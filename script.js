const STORAGE_KEY = "weekly-work-journal-v1";
const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const TIME_SLOTS = ["08:00 - 09:00", "09:00 - 12:00", "12:00 - 14:00", "14:00 - 18:00", "18:00 - 19:00"];

const weekStartInput = document.querySelector("#weekStart");
const journalBody = document.querySelector("#journalBody");
const weekSummary = document.querySelector("#weekSummary");
const nextPlan = document.querySelector("#nextPlan");
const archiveList = document.querySelector("#archiveList");
const statusText = document.querySelector("#status");
const saveBtn = document.querySelector("#saveBtn");
const newWeekBtn = document.querySelector("#newWeekBtn");
const exportBtn = document.querySelector("#exportBtn");
const importFile = document.querySelector("#importFile");

let currentWeekKey = "";
let archive = loadArchive();

function toISODate(date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function getMonday(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function formatDateLabel(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}号 ${WEEKDAYS[date.getDay()]}`;
}

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T00:00:00`);
    date.setDate(date.getDate() + index);
    return toISODate(date);
  });
}

function createEmptyWeek(weekStart) {
  return {
    weekStart,
    entries: getWeekDates(weekStart).map((date) => ({
      date,
      slots: TIME_SLOTS.map((time) => ({ time, content: "" }))
    })),
    summary: "",
    nextPlan: "",
    updatedAt: new Date().toISOString()
  };
}

function loadArchive() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function persistArchive() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
}

function setStatus(message) {
  statusText.textContent = message;
}

function renderWeek(week) {
  journalBody.innerHTML = "";
  week.entries.forEach((day, dayIndex) => {
    day.slots.forEach((slot, slotIndex) => {
      const row = document.createElement("tr");

      if (slotIndex === 0) {
        const dateCell = document.createElement("th");
        dateCell.scope = "rowgroup";
        dateCell.rowSpan = day.slots.length;
        dateCell.className = "date-cell";
        dateCell.textContent = formatDateLabel(day.date);
        row.append(dateCell);
      }

      const timeCell = document.createElement("td");
      timeCell.className = "time-cell";
      const timeInput = document.createElement("input");
      timeInput.className = "time-input";
      timeInput.value = slot.time;
      timeInput.dataset.dayIndex = dayIndex;
      timeInput.dataset.slotIndex = slotIndex;
      timeInput.setAttribute("aria-label", `${formatDateLabel(day.date)} 的时间段`);
      timeInput.addEventListener("input", updateTimeFromInput);
      timeCell.append(timeInput);

      const contentCell = document.createElement("td");
      const textarea = document.createElement("textarea");
      textarea.value = slot.content;
      textarea.placeholder = "填写这个时间段的工作内容";
      textarea.dataset.dayIndex = dayIndex;
      textarea.dataset.slotIndex = slotIndex;
      textarea.addEventListener("input", updateEntryFromTextarea);
      contentCell.append(textarea);

      row.append(timeCell, contentCell);
      journalBody.append(row);
    });
  });

  weekSummary.value = week.summary || "";
  nextPlan.value = week.nextPlan || "";
}

function updateEntryFromTextarea(event) {
  const week = archive[currentWeekKey];
  const { dayIndex, slotIndex } = event.target.dataset;
  week.entries[dayIndex].slots[slotIndex].content = event.target.value;
  markWeekSaved(week);
}

function updateTimeFromInput(event) {
  const week = archive[currentWeekKey];
  const { dayIndex, slotIndex } = event.target.dataset;
  week.entries[dayIndex].slots[slotIndex].time = event.target.value;
  markWeekSaved(week);
}

function markWeekSaved(week) {
  week.updatedAt = new Date().toISOString();
  persistArchive();
  setStatus("已自动保存");
}

function renderArchiveList() {
  archiveList.innerHTML = "";
  const weeks = Object.values(archive).sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  if (weeks.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "暂无存档";
    archiveList.append(emptyItem);
    return;
  }

  weeks.forEach((week) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${week.weekStart} 起`;
    button.classList.toggle("active", week.weekStart === currentWeekKey);
    button.addEventListener("click", () => openWeek(week.weekStart));
    item.append(button);
    archiveList.append(item);
  });
}

function collectCurrentWeek() {
  const week = archive[currentWeekKey] || createEmptyWeek(currentWeekKey);
  week.summary = weekSummary.value;
  week.nextPlan = nextPlan.value;
  week.updatedAt = new Date().toISOString();
  archive[currentWeekKey] = week;
  persistArchive();
  return week;
}

function openWeek(weekStart) {
  currentWeekKey = weekStart;
  weekStartInput.value = weekStart;
  if (!archive[weekStart]) {
    archive[weekStart] = createEmptyWeek(weekStart);
    persistArchive();
  }
  renderWeek(archive[weekStart]);
  renderArchiveList();
  setStatus(`正在编辑 ${weekStart} 起这一周`);
}

function exportArchive() {
  collectCurrentWeek();
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `工作周记存档-${toISODate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("已导出存档文件");
}

function importArchive(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      archive = { ...archive, ...imported };
      persistArchive();
      const latestWeek = Object.keys(archive).sort().at(-1) || currentWeekKey;
      openWeek(latestWeek);
      setStatus("导入完成");
    } catch {
      setStatus("导入失败：文件格式不正确");
    } finally {
      importFile.value = "";
    }
  });
  reader.readAsText(file);
}

weekStartInput.addEventListener("change", () => openWeek(weekStartInput.value));
saveBtn.addEventListener("click", () => {
  collectCurrentWeek();
  renderArchiveList();
  setStatus("本周内容已保存");
});
newWeekBtn.addEventListener("click", () => openWeek(toISODate(getMonday(new Date()))));
exportBtn.addEventListener("click", exportArchive);
importFile.addEventListener("change", importArchive);
weekSummary.addEventListener("input", collectCurrentWeek);
nextPlan.addEventListener("input", collectCurrentWeek);

openWeek(toISODate(getMonday(new Date())));
