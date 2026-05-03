const issues = [
  {
    id: "BIM-CR-001",
    severity: "critical",
    zone: "Tower A L18-L23",
    title: "Fire compartment property missing",
    body: "IfcSpace 缺少 FireCompartmentRating / CompartmentRef。可能影響 fire safety automated checking 前置資料。",
    owner: "BIM Manager"
  },
  {
    id: "BIM-CR-002",
    severity: "critical",
    zone: "Podium 2/F",
    title: "Sanitary fitment count mismatch",
    body: "AI 比對 room function 與 fixture family 後，發現 male WC 可能少 2 個 urinal data tag。",
    owner: "Architect"
  },
  {
    id: "BIM-MJ-014",
    severity: "major",
    zone: "Basement B1",
    title: "IFC classification not mapped",
    body: "312 個 element 缺少 Uniclass / Omniclass 或公司 BIM classification code，影響 quantity 和 handover。",
    owner: "BIM Coordinator"
  },
  {
    id: "BIM-MJ-021",
    severity: "major",
    zone: "Typical Floor",
    title: "Room boundary geometry inconsistent",
    body: "18 個 flat unit 的 area boundary 與 door swing / wall finish layer 不一致，建議提交前修正。",
    owner: "Architect"
  },
  {
    id: "BIM-MN-033",
    severity: "minor",
    zone: "Roof",
    title: "Asset handover field incomplete",
    body: "FM handover 欄位 Manufacturer、WarrantyStartDate、MaintainableFlag 有空值。",
    owner: "M&E"
  },
  {
    id: "BIM-MN-041",
    severity: "minor",
    zone: "All levels",
    title: "Naming convention drift",
    body: "部分 family name 未跟 CIC / project BEP 命名規則，建議統一以減少 coordination error。",
    owner: "BIM Coordinator"
  }
];

const answers = {
  "這個模型是否可以做 BD BIM submission？":
    "不建議即時提交。Demo scan 顯示 readiness 68/100，有 7 個 critical blocker。建議先處理 fire compartment property、sanitary fitment count、room boundary 和 IFC property set。定位上，這個工具是 submission 前的 pre-check，不取代 AP/RSE/BIM Manager 的專業判斷。",
  "明天怎樣向客戶解釋 ROI？":
    "用三個數字講：第一，減少 submission 前人手 checklist 和返工；第二，將 issue 直接定位到 element ID / IFC GlobalId，縮短 BIM Manager 和 designer 溝通；第三，用一個 8-12 星期 pilot 證明每個項目可節省多少小時，再把結果包裝成 CITF / ESS funding case。",
  "我們應該申請什麼 funding？":
    "建議雙軌。建築公司用 CITF 包裝 BIM adoption、training 或 project-based coaching；你的 AI 初創用 ESS 做 R&D，申請 IFC rule engine、RAG compliance assistant、Revit plugin 和 audit trail。TVP 不應作主線，因為已停止接受新申請。"
};

const fallbackAnswers = [
  "MVP 建議只做 IFC checker、AI report 和香港 guideline RAG，不要一開始承諾完整 regulatory approval。8-12 星期可以做出可試用版本，預算約 HK$250k-650k，視乎是否要 Revit plugin 和客戶資料保安要求。",
  "技術難點主要有三個：BIM model data 很亂、香港 guideline 要持續維護、AI 回答必須有引用來源。解法是 rule engine 負責硬性檢查，LLM 只負責解釋、分類、生成 report 和回答問題。",
  "明天最好的成交目標不是即時賣 full platform，而是要求客戶提供一個 anonymised sample model，簽 8-12 星期 paid pilot，並共同準備 funding proposal。"
];

const navButtons = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");
const progressBar = document.getElementById("progressBar");
const scanLabel = document.getElementById("scanLabel");
const runScanBtn = document.getElementById("runScanBtn");
const loadSampleBtn = document.getElementById("loadSampleBtn");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const issueTable = document.getElementById("issueTable");
const scoreValue = document.getElementById("scoreValue");
const scoreMeter = document.getElementById("scoreMeter");
const budgetSlider = document.getElementById("budgetSlider");
const budgetLabel = document.getElementById("budgetLabel");
const citfValue = document.getElementById("citfValue");
const clientValue = document.getElementById("clientValue");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatLog = document.getElementById("chatLog");
const copyPitchBtn = document.getElementById("copyPitchBtn");
const pitchText = document.getElementById("pitchText");
const canvas = document.getElementById("modelCanvas");
const ctx = canvas.getContext("2d");

let scanScore = 68;
let animationTick = 0;
let modelLoopStarted = false;

function formatHKD(value) {
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 0
  }).format(value);
}

function setView(viewId) {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });
  views.forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
}

function severityLabel(severity) {
  if (severity === "critical") return "Critical";
  if (severity === "major") return "Major";
  return "Minor";
}

function severityClass(severity) {
  if (severity === "critical") return "bad";
  if (severity === "major") return "warn";
  return "ok";
}

function renderIssues(filter = "all") {
  const rows = issues.filter((issue) => filter === "all" || issue.severity === filter);
  issueTable.innerHTML = rows
    .map(
      (issue) => `
        <article class="issue-row">
          <div>
            <span class="tag ${severityClass(issue.severity)}">${severityLabel(issue.severity)}</span>
          </div>
          <div>
            <strong>${issue.id}</strong>
            <p>${issue.zone}</p>
          </div>
          <div>
            <strong>${issue.title}</strong>
            <p>${issue.body}</p>
          </div>
          <div>
            <strong>Owner</strong>
            <p>${issue.owner}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function updateScore(value) {
  scanScore = value;
  scoreValue.textContent = value;
  const circumference = 302;
  scoreMeter.style.strokeDashoffset = circumference - (circumference * value) / 100;
  scoreMeter.style.stroke = value >= 80 ? "#20735b" : value >= 60 ? "#d98b28" : "#bc3f36";
}

function runScan() {
  let progress = 0;
  runScanBtn.disabled = true;
  scanLabel.textContent = "Reading IFC entities...";
  progressBar.style.width = "0%";
  updateScore(52);

  const steps = [
    [18, "Parsing spatial structure..."],
    [34, "Checking property sets..."],
    [52, "Matching Hong Kong BIM rules..."],
    [71, "Locating issue elements..."],
    [88, "Generating AI report..."],
    [100, "Scan complete: 126 issues found"]
  ];

  const timer = setInterval(() => {
    const next = steps.find((step) => step[0] > progress);
    if (!next) {
      clearInterval(timer);
      runScanBtn.disabled = false;
      updateScore(68);
      drawModel();
      return;
    }
    progress = next[0];
    progressBar.style.width = `${progress}%`;
    scanLabel.textContent = next[1];
    updateScore(Math.min(68, 50 + Math.round(progress / 5)));
  }, 430);
}

function updateFunding() {
  const budget = Number(budgetSlider.value);
  const citf = Math.round(budget * 0.7);
  const client = budget - citf;
  budgetLabel.textContent = formatHKD(budget);
  citfValue.textContent = formatHKD(citf);
  clientValue.textContent = formatHKD(client);
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerHTML = `<strong>${role === "ai" ? "BIM AI" : "You"}</strong><p>${text}</p>`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function answerQuestion(question) {
  const exact = answers[question];
  if (exact) return exact;
  const lower = question.toLowerCase();
  if (lower.includes("mvp") || question.includes("幾耐") || question.includes("難度")) return fallbackAnswers[0];
  if (question.includes("技術") || question.includes("AI") || lower.includes("revit")) return fallbackAnswers[1];
  return fallbackAnswers[2];
}

function drawBuildingBlock(x, y, width, height, depth, color, issueColor) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.moveTo(x + width, y);
  ctx.lineTo(x + width + depth, y - depth * 0.55);
  ctx.lineTo(x + width + depth, y + height - depth * 0.55);
  ctx.lineTo(x + width, y + height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + depth, y - depth * 0.55);
  ctx.lineTo(x + width + depth, y - depth * 0.55);
  ctx.lineTo(x + width, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#cbd6c8";
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i += 1) {
    const yy = y + (height / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + width, yy);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i += 1) {
    const xx = x + (width / 4) * i;
    ctx.beginPath();
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + height);
    ctx.stroke();
  }

  ctx.fillStyle = issueColor;
  ctx.fillRect(x + width * 0.55, y + height * 0.25, width * 0.35, 22);
  ctx.fillRect(x + width * 0.15, y + height * 0.62, width * 0.28, 22);
}

function drawModel() {
  const width = canvas.width;
  const height = canvas.height;
  animationTick += 0.04;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f8fbf6");
  gradient.addColorStop(1, "#dfe8dd");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d2ddd0";
  ctx.lineWidth = 1;
  for (let x = -60; x < width + 80; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, height - 42);
    ctx.lineTo(x + 260, height - 190);
    ctx.stroke();
  }
  for (let x = 20; x < width + 220; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, height - 190);
    ctx.lineTo(x - 280, height - 42);
    ctx.stroke();
  }

  drawBuildingBlock(150, 145, 170, 300, 58, "#f7f9f4", "#d98b28");
  drawBuildingBlock(350, 95, 190, 350, 62, "#fdfefb", "#bc3f36");
  drawBuildingBlock(568, 190, 128, 255, 42, "#f3f8ef", "#63a56d");

  const pulse = 9 + Math.sin(animationTick * 4) * 4;
  [
    [492, 184, "#bc3f36", "CR-001"],
    [246, 337, "#d98b28", "MJ-021"],
    [416, 312, "#bc3f36", "CR-002"],
    [632, 292, "#63a56d", "OK"]
  ].forEach(([x, y, color, label]) => {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#15241f";
    ctx.font = "bold 15px system-ui";
    ctx.fillText(label, x + 16, y + 5);
  });

  ctx.fillStyle = "#16211d";
  ctx.font = "bold 22px system-ui";
  ctx.fillText("Sample Residential Tower IFC", 32, 44);
  ctx.font = "15px system-ui";
  ctx.fillStyle = "#647067";
  ctx.fillText("AI mapped issue markers to IFC GlobalId / Revit Element ID", 32, 70);

  requestAnimationFrame(drawModel);
}

function startModelLoop() {
  if (modelLoopStarted) return;
  modelLoopStarted = true;
  drawModel();
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    renderIssues(button.dataset.severity);
  });
});

runScanBtn.addEventListener("click", runScan);
loadSampleBtn.addEventListener("click", () => {
  fileName.textContent = "HK Residential Tower - Sample.ifc";
  scanLabel.textContent = "Sample model loaded";
  progressBar.style.width = "12%";
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileName.textContent = file.name;
  scanLabel.textContent = "Model selected";
  progressBar.style.width = "8%";
});

budgetSlider.addEventListener("input", updateFunding);

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;
  addMessage("user", question);
  chatInput.value = "";
  setTimeout(() => addMessage("ai", answerQuestion(question)), 250);
});

document.querySelectorAll(".quick-prompts button").forEach((button) => {
  button.addEventListener("click", () => {
    addMessage("user", button.dataset.question);
    setTimeout(() => addMessage("ai", answerQuestion(button.dataset.question)), 250);
  });
});

copyPitchBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(pitchText.textContent);
  copyPitchBtn.textContent = "已複製";
  setTimeout(() => {
    copyPitchBtn.textContent = "複製 pitch";
  }, 1200);
});

renderIssues();
updateFunding();
updateScore(68);
startModelLoop();
