const API = "";
const tickerNames = {
  "^VIX":"VIX Index","GC=F":"Gold Futures","SI=F":"Silver Futures","PL=F":"Platinum Futures","^GSPC":"S&P 500","DX-Y.NYB":"US Dollar Index",
  "SPY":"S&P 500 ETF","QQQ":"Nasdaq-100 ETF","GLD":"Gold ETF","SLV":"Silver ETF","TLT":"Long-Term Treasury ETF",
  "AAPL":"Apple","MSFT":"Microsoft","NVDA":"NVIDIA","AMD":"AMD","TSLA":"Tesla","JPM":"JPMorgan Chase","XLF":"Financials ETF",
  "XOM":"Exxon Mobil","CVX":"Chevron","KO":"Coca-Cola","PEP":"PepsiCo","BTC-USD":"Bitcoin","ETH-USD":"Ethereum",
  "EURUSD=X":"EUR/USD","^DJI":"Dow Jones","CL=F":"Crude Oil Futures","NG=F":"Natural Gas Futures","XLE":"Energy ETF","USO":"Oil ETF"
};
const els = {};
[
  "assetX","assetY","metric","range","window","dayOffset","customDates","startDate","endDate","customTicker",
  "runButton","error","pairTitle","status","nValue","dateValue","pearsonValue","pearsonP",
  "spearmanValue","spearmanP","scatterUnit","windowBadge","scatterChart","rollingChart","tooltip",
  "scatterSubtitle","rollingSubtitle","scatterOffsetBadge","rollingOffsetBadge","interpretationLabel","interpretationText","significanceText",
  "explorerView","gameView","explorerTab","gameTab","methodTab","backToExplorer","gameScore","roundNumber","gameTimer","timerBar",
  "gameQuestion","gameContext","answerOptions","gameFeedback","startGameButton"
].forEach(id => els[id] = document.getElementById(id));

const GAME_SECONDS = 15;
const GAME_ROUNDS = 5;
let gameScore = 0;
let nextQuestionIndex = 0;
let currentQuestionIndex = null;
let selectedQuestions = [];
let gameTimerId = null;
let secondsRemaining = GAME_SECONDS;
let gameData = null;
const gameQuestions = [
  {x:"^VIX",y:"GC=F",metric:"pct_return",range:"5Y",offset:0,prompt:"Over the past five years, have daily VIX and gold-futures returns tended to move together, move oppositely, or show little linear relationship?"},
  {x:"^VIX",y:"SI=F",metric:"pct_return",range:"5Y",offset:1,prompt:"When the VIX moves today, what kind of relationship has silver's return on the next trading day shown over five years?"},
  {x:"^VIX",y:"SPY",metric:"pct_return",range:"5Y",offset:0,prompt:"Over five years, how have daily VIX changes and S&P 500 ETF returns been correlated on the same trading day?"},
  {x:"^GSPC",y:"^VIX",metric:"level",range:"5Y",offset:0,prompt:"Across the last five years of closing levels, what kind of correlation appears between the S&P 500 and VIX indices?"},
  {x:"GC=F",y:"SI=F",metric:"pct_return",range:"5Y",offset:0,prompt:"Do daily gold and silver futures returns show a positive, negligible, or negative relationship over five years?"},
  {x:"PL=F",y:"GC=F",metric:"pct_return",range:"5Y",offset:0,prompt:"How have daily platinum and gold futures returns correlated over the past five years?"},
  {x:"CL=F",y:"GC=F",metric:"pct_return",range:"5Y",offset:0,prompt:"What is the direction category for daily crude-oil versus gold-futures returns over five years?"},
  {x:"NG=F",y:"CL=F",metric:"pct_return",range:"5Y",offset:0,prompt:"Over five years, how have daily natural-gas and crude-oil futures returns been related?"},
  {x:"AAPL",y:"MSFT",metric:"pct_return",range:"5Y",offset:0,prompt:"Do Apple and Microsoft daily stock returns move together, oppositely, or with little linear correlation?"},
  {x:"NVDA",y:"AMD",metric:"pct_return",range:"5Y",offset:0,prompt:"What correlation category best describes NVIDIA and AMD daily returns over five years?"},
  {x:"TSLA",y:"SPY",metric:"pct_return",range:"5Y",offset:0,prompt:"How have Tesla's daily returns correlated with the broad S&P 500 ETF over five years?"},
  {x:"JPM",y:"XLF",metric:"pct_return",range:"5Y",offset:0,prompt:"What relationship category appears between JPMorgan and the financial-sector ETF on daily returns?"},
  {x:"XOM",y:"CVX",metric:"pct_return",range:"5Y",offset:0,prompt:"Over the past five years, have Exxon Mobil and Chevron daily returns shown a positive, negligible, or negative correlation?"},
  {x:"KO",y:"PEP",metric:"pct_return",range:"5Y",offset:0,prompt:"How are Coca-Cola and PepsiCo daily stock returns correlated over five years?"},
  {x:"GLD",y:"SPY",metric:"pct_return",range:"5Y",offset:0,prompt:"What is the relationship category for daily returns on the gold ETF and S&P 500 ETF?"},
  {x:"TLT",y:"SPY",metric:"pct_return",range:"5Y",offset:0,prompt:"Over five years, how have long-term Treasury ETF returns related to S&P 500 ETF returns?"},
  {x:"BTC-USD",y:"ETH-USD",metric:"pct_return",range:"5Y",offset:0,prompt:"Do Bitcoin and Ethereum daily returns tend to move together, oppositely, or with negligible linear correlation?"},
  {x:"BTC-USD",y:"SPY",metric:"pct_return",range:"5Y",offset:0,prompt:"What correlation category describes Bitcoin and S&P 500 ETF daily returns over five years?"},
  {x:"EURUSD=X",y:"DX-Y.NYB",metric:"pct_return",range:"5Y",offset:0,prompt:"How have EUR/USD and the US Dollar Index daily returns been related over five years?"},
  {x:"^DJI",y:"^GSPC",metric:"pct_return",range:"5Y",offset:0,prompt:"What relationship category appears between daily Dow Jones and S&P 500 index returns?"},
  {x:"QQQ",y:"SPY",metric:"pct_return",range:"5Y",offset:0,prompt:"Over five years, how have Nasdaq-100 ETF and S&P 500 ETF daily returns correlated?"},
  {x:"GLD",y:"SLV",metric:"level",range:"5Y",offset:0,prompt:"Comparing closing price levels rather than returns, what correlation category do the gold and silver ETFs show?"},
  {x:"AAPL",y:"^VIX",metric:"pct_return",range:"5Y",offset:-1,prompt:"Does Apple's daily return have a positive, negligible, or negative correlation with the VIX on the previous trading day?"},
  {x:"MSFT",y:"^GSPC",metric:"pct_return",range:"5Y",offset:0,prompt:"How have Microsoft's daily returns correlated with the S&P 500 index's daily returns?"},
  {x:"TSLA",y:"BTC-USD",metric:"pct_return",range:"5Y",offset:0,prompt:"What correlation category best fits Tesla and Bitcoin daily returns over five years?"},
  {x:"CL=F",y:"^VIX",metric:"pct_return",range:"5Y",offset:1,prompt:"When crude oil moves today, what kind of correlation has its return shown with the VIX return on the next trading day?"},
  {x:"NVDA",y:"QQQ",metric:"pct_return",range:"5Y",offset:0,prompt:"How have NVIDIA daily returns related to the Nasdaq-100 ETF's daily returns?"},
  {x:"TLT",y:"GLD",metric:"pct_return",range:"5Y",offset:0,prompt:"Over five years, what is the correlation category between long-term Treasury and gold ETF daily returns?"},
  {x:"GC=F",y:"DX-Y.NYB",metric:"pct_return",range:"5Y",offset:0,prompt:"How have gold-futures and US Dollar Index daily returns been correlated over five years?"},
  {x:"XLE",y:"USO",metric:"pct_return",range:"5Y",offset:0,prompt:"What relationship category appears between the energy-sector ETF and oil ETF daily returns?"}
];

async function init() {
  let presets = [
    ["^VIX","VIX Index"],["GC=F","Gold Futures"],["SI=F","Silver Futures"],
    ["PL=F","Platinum Futures"],["^GSPC","S&P 500"],["DX-Y.NYB","US Dollar Index"]
  ];
  try {
    const response = await fetch(`${API}/api/presets`);
    if (!response.ok) throw new Error(`Could not load ticker presets (${response.status}).`);
    presets = (await response.json()).presets.map(p => [p.ticker,p.name]);
  } catch (error) {
    console.warn(error.message);
  }
  els.assetX.replaceChildren();
  els.assetY.replaceChildren();
  for (const [ticker,name] of presets) {
    els.assetX.add(new Option(name, ticker));
    els.assetY.add(new Option(name, ticker));
  }
  for (let offset=-10; offset<=10; offset++) {
    const label = offset > 0 ? `+${offset} trading day${offset === 1 ? "" : "s"}` :
      offset < 0 ? `${offset} trading day${offset === -1 ? "" : "s"}` : "0 (same day)";
    els.dayOffset.add(new Option(label, offset));
  }
  els.dayOffset.value = "0";
  els.assetX.value = "^VIX";
  els.assetY.value = "GC=F";
  els.range.addEventListener("change", () => els.customDates.hidden = els.range.value !== "CUSTOM");
  els.runButton.addEventListener("click", analyze);
  els.customTicker.addEventListener("keydown", e => { if (e.key === "Enter") useCustomTicker(); });
  els.customTicker.addEventListener("change", useCustomTicker);
  els.explorerTab.addEventListener("click", () => showView("explorer"));
  els.gameTab.addEventListener("click", () => showView("game"));
  els.methodTab.addEventListener("click", () => showView("explorer"));
  els.backToExplorer.addEventListener("click", () => showView("explorer"));
  els.startGameButton.addEventListener("click", startGameRound);
  els.answerOptions.addEventListener("click", event => {
    const option = event.target.closest("[data-answer]");
    if (option && !option.disabled && gameData) submitGameAnswer(option.dataset.answer);
  });
  analyze();
}

function showView(view) {
  const isGame = view === "game";
  els.explorerView.hidden = isGame;
  els.gameView.hidden = !isGame;
  els.explorerTab.classList.toggle("active", !isGame);
  els.gameTab.classList.toggle("active", isGame);
}

function useCustomTicker() {
  const ticker = els.customTicker.value.trim().toUpperCase();
  if (!ticker) return;
  if (![...els.assetX.options].some(o => o.value === ticker)) {
    els.assetX.add(new Option(ticker, ticker));
  }
  els.assetX.value = ticker;
  els.customTicker.value = "";
  analyze();
}

function nameFor(ticker) {
  return tickerNames[ticker] || ticker;
}

function formatP(value) {
  if (value === null || value === undefined) return "p-value —";
  if (value === 0) return "p-value < 1×10⁻³";
  if (value < 0.001) return `p-value ${value.toExponential(2)}`;
  return `p-value ${value.toFixed(4)}`;
}

function offsetLabel(offset) {
  if (offset === 0) return "Offset: 0 (same day)";
  return `Offset: ${offset > 0 ? "+" : ""}${offset} trading day${Math.abs(offset) === 1 ? "" : "s"}`;
}

function metricName(metric) {
  return {pct_return:"Daily percentage returns",point_change:"Daily point changes",level:"Closing price levels"}[metric] || metric;
}

async function analyze() {
  els.error.hidden = true;
  els.status.textContent = "Loading";
  els.status.classList.add("loading");
  els.runButton.disabled = true;
  const params = currentCorrelationParams();
  try {
    const response = await fetch(`${API}/api/correlation?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "The analysis could not be completed.");
    render(data);
  } catch (error) {
    els.error.textContent = error.message;
    els.error.hidden = false;
  } finally {
    els.status.textContent = "Updated";
    els.status.classList.remove("loading");
    els.runButton.disabled = false;
  }
}

function currentCorrelationParams() {
  const params = new URLSearchParams({
    asset_x: els.assetX.value, asset_y: els.assetY.value, metric: els.metric.value,
    range: els.range.value === "CUSTOM" ? "5Y" : els.range.value,
    window: els.window.value, day_offset: els.dayOffset.value
  });
  if (els.range.value === "CUSTOM") {
    if (els.startDate.value) params.set("start", els.startDate.value);
    if (els.endDate.value) params.set("end", els.endDate.value);
  }
  return params;
}

async function startGameRound() {
  clearInterval(gameTimerId);
  gameTimerId = null;
  gameData = null;
  if (selectedQuestions.length === 0 || nextQuestionIndex >= GAME_ROUNDS) {
    selectedQuestions = chooseRandomQuestions(GAME_ROUNDS);
    nextQuestionIndex = 0;
    gameScore = 0;
    els.gameScore.textContent = "0";
    els.startGameButton.querySelector("span:first-child").textContent = "Loading live data…";
  }
  currentQuestionIndex = nextQuestionIndex;
  const question = selectedQuestions[currentQuestionIndex];
  els.startGameButton.disabled = true;
  els.startGameButton.querySelector("span:first-child").textContent = "Loading live data…";
  els.gameFeedback.textContent = "Loading this question's live market data…";
  els.answerOptions.querySelectorAll("[data-answer]").forEach(button => {
    button.disabled = true;
    button.classList.remove("correct", "incorrect");
  });
  els.roundNumber.textContent = `${currentQuestionIndex + 1} / ${GAME_ROUNDS}`;
  els.gameQuestion.textContent = question.prompt;

  try {
    const params = new URLSearchParams({
      asset_x: question.x,
      asset_y: question.y,
      metric: question.metric,
      range: question.range,
      day_offset: question.offset,
      window: 30
    });
    const response = await fetch(`${API}/api/correlation?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Could not prepare a round.");
    gameData = data;
    secondsRemaining = GAME_SECONDS;
    els.gameTimer.textContent = `${secondsRemaining}s`;
    els.timerBar.style.width = "100%";
    els.gameContext.textContent = `${metricName(data.metric)} · ${data.start_date} to ${data.end_date} · ${offsetLabel(data.day_offset)} · n = ${data.sample_size.toLocaleString()}`;
    els.gameFeedback.textContent = "Choose your prediction before the timer runs out.";
    els.answerOptions.querySelectorAll("[data-answer]").forEach(button => button.disabled = false);
    els.startGameButton.querySelector("span:first-child").textContent = "Next round";
    beginGameTimer();
  } catch (error) {
    gameData = null;
    els.gameFeedback.textContent = error.message;
    els.startGameButton.querySelector("span:first-child").textContent = "Try again";
  } finally {
    els.startGameButton.disabled = false;
  }
}

function chooseRandomQuestions(count) {
  const shuffled = [...gameQuestions];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

function beginGameTimer() {
  gameTimerId = setInterval(() => {
    secondsRemaining -= 1;
    els.gameTimer.textContent = `${secondsRemaining}s`;
    els.timerBar.style.width = `${Math.max(0, secondsRemaining / GAME_SECONDS * 100)}%`;
    if (secondsRemaining <= 0) finishGameRound(null);
  }, 1000);
}

function correlationCategory(r) {
  if (Math.abs(r) < 0.1) return "negligible";
  return r > 0 ? "positive" : "negative";
}

function submitGameAnswer(answer) {
  if (!gameData) return;
  finishGameRound(answer);
}

function finishGameRound(answer) {
  if (!gameData) return;
  clearInterval(gameTimerId);
  gameTimerId = null;
  const correctAnswer = correlationCategory(gameData.pearson.r);
  const isCorrect = answer === correctAnswer;
  const points = isCorrect ? 100 + secondsRemaining * 10 : 0;
  gameScore += points;
  els.gameScore.textContent = gameScore.toLocaleString();
  els.answerOptions.querySelectorAll("[data-answer]").forEach(button => {
    button.disabled = true;
    if (button.dataset.answer === correctAnswer) button.classList.add("correct");
    else if (button.dataset.answer === answer) button.classList.add("incorrect");
  });

  const result = answer === null ? "Time's up!" : isCorrect ? "Correct!" : "Not quite.";
  els.gameFeedback.textContent = `${result} Pearson r = ${gameData.pearson.r.toFixed(3)} (${correctAnswer}). ${isCorrect ? `+${points} points — 100 for accuracy and ${secondsRemaining * 10} for speed.` : "0 points this round."}`;
  nextQuestionIndex = currentQuestionIndex + 1;
  if (nextQuestionIndex >= GAME_ROUNDS) {
    els.startGameButton.querySelector("span:first-child").textContent = "Start a new 5-question game";
    els.gameFeedback.textContent += " You completed all five questions!";
  } else {
    els.startGameButton.querySelector("span:first-child").textContent = "Next question";
  }
  gameData = null;
}

function render(data) {
  els.pairTitle.textContent = `${nameFor(data.pair.x)} × ${nameFor(data.pair.y)}`;
  const sampleSize = data.sample_size ?? data.n;
  els.nValue.textContent = sampleSize.toLocaleString();
  els.dateValue.textContent = `${data.start_date} — ${data.end_date} · ${offsetLabel(data.day_offset)}`;
  els.pearsonValue.textContent = data.pearson.r.toFixed(3);
  els.pearsonP.textContent = formatP(data.pearson.p_value);
  els.spearmanValue.textContent = data.spearman.rho.toFixed(3);
  els.spearmanP.textContent = formatP(data.spearman.p_value);
  const metricLabels = {pct_return:"Daily % return",point_change:"Point change",level:"Closing level"};
  els.scatterUnit.textContent = metricLabels[data.metric];
  els.windowBadge.textContent = `${data.window}-day window`;
  els.scatterSubtitle.textContent = `n = ${sampleSize.toLocaleString()} · ${data.start_date} — ${data.end_date}`;
  els.rollingSubtitle.textContent = `n = ${sampleSize.toLocaleString()} matched pairs`;
  els.scatterOffsetBadge.textContent = offsetLabel(data.day_offset);
  els.rollingOffsetBadge.textContent = offsetLabel(data.day_offset);
  renderInterpretation(data);
  drawScatter(data);
  drawRolling(data);
}

function renderInterpretation(data) {
  const r = data.pearson.r;
  const magnitude = Math.abs(r);
  const strength = magnitude < 0.1 ? "Negligible" : magnitude < 0.3 ? "Weak" :
    magnitude < 0.5 ? "Moderate" : "Strong";
  const direction = magnitude < 0.1 ? " / no clear linear relationship" : r > 0 ? " positive correlation" : " negative correlation";
  els.interpretationLabel.textContent = `${strength}${direction}`;

  const offsetMeaning = data.day_offset === 0 ? "on the same trading day" :
    data.day_offset > 0 ? `${data.day_offset} trading day${data.day_offset === 1 ? "" : "s"} later` :
    `${Math.abs(data.day_offset)} trading day${data.day_offset === -1 ? "" : "s"} earlier`;
  const relation = data.metric === "pct_return" ?
    `days when ${nameFor(data.pair.x)} has a larger daily move tend to line up with ${nameFor(data.pair.y)} having a ${r >= 0 ? "higher" : "lower"} daily return` :
    `higher ${nameFor(data.pair.x)} values tend to line up with ${nameFor(data.pair.y)} values that are ${r >= 0 ? "higher" : "lower"}`;
  els.interpretationText.textContent = `${relation}, pairing X on day t with Y ${offsetMeaning}. Pearson r describes the linear relationship (strength bands: <0.10 negligible, 0.10–0.29 weak, 0.30–0.49 moderate, ≥0.50 strong).`;

  const p = data.pearson.p_value;
  const significance = p === null ? "Statistical significance could not be calculated." :
    p < 0.01 ? "Statistically significant at the 1% level." :
    p < 0.05 ? "Statistically significant at the 5% level, but not the 1% level." :
    "Not statistically significant at the 5% level.";
  els.significanceText.textContent = `${significance} P-values are unadjusted; multiple testing and time dependence (autocorrelation) can affect inference. Correlation does not imply causation.`;
}

function svgElement(name, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key,value]) => node.setAttribute(key,value));
  return node;
}

function makeChart(container) {
  container.innerHTML = "";
  const width = Math.max(container.clientWidth, 320), height = container.clientHeight || 330;
  const margin = {top:12,right:14,bottom:42,left:52};
  const svg = svgElement("svg",{viewBox:`0 0 ${width} ${height}`,"aria-label":"Interactive chart"});
  container.appendChild(svg);
  return {svg,width,height,margin,innerW:width-margin.left-margin.right,innerH:height-margin.top-margin.bottom};
}

function scales(values, minRange=0) {
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max-min)*0.06;
  return [min-pad,max+pad];
}

function drawScatter(data) {
  const c = makeChart(els.scatterChart);
  const [xmin,xmax] = scales(data.scatter.map(d=>d.x));
  const [ymin,ymax] = scales(data.scatter.map(d=>d.y));
  const sx = v => c.margin.left + (v-xmin)/(xmax-xmin)*c.innerW;
  const sy = v => c.margin.top + c.innerH-(v-ymin)/(ymax-ymin)*c.innerH;
  drawGrid(c, sx, sy, xmin,xmax,ymin,ymax, 5);

  const trend = svgElement("polyline",{fill:"none",stroke:"#d5ae56","stroke-width":"2","stroke-linejoin":"round","stroke-linecap":"round"});
  trend.setAttribute("points",data.trendline.map(p=>`${sx(p.x)},${sy(p.y)}`).join(" "));
  c.svg.appendChild(trend);

  data.scatter.forEach(p => {
    const point = svgElement("circle",{cx:sx(p.x),cy:sy(p.y),r:"2.2",fill:"#1f7662",opacity:"0.48"});
    const yDateLabel = data.day_offset === 0 ? "" : `<br>${nameFor(data.pair.y)} date: ${p.y_date}`;
    point.addEventListener("pointerenter", e => showTooltip(e, `${nameFor(data.pair.x)} date: ${p.x_date}<br>${nameFor(data.pair.x)}: ${p.x}${yDateLabel}<br>${nameFor(data.pair.y)}: ${p.y}`));
    point.addEventListener("pointermove", e => showTooltip(e));
    point.addEventListener("pointerleave", hideTooltip);
    c.svg.appendChild(point);
  });
  const yAxisLabel = data.day_offset === 0 ? `${nameFor(data.pair.y)} (day t)` :
    `${nameFor(data.pair.y)} (day t ${data.day_offset > 0 ? "+" : "−"} ${Math.abs(data.day_offset)})`;
  axisLabel(c.svg,c.margin.left+c.innerW/2,c.height-5,`${nameFor(data.pair.x)} (day t)`);
  axisLabel(c.svg,12,c.margin.top+c.innerH/2,yAxisLabel,-90);
}

function drawGrid(c,sx,sy,xmin,xmax,ymin,ymax,count) {
  for(let i=0;i<=count;i++) {
    const x=c.margin.left+i*c.innerW/count;
    const y=c.margin.top+i*c.innerH/count;
    c.svg.appendChild(svgElement("line",{x1:x,y1:c.margin.top,x2:x,y2:c.margin.top+c.innerH,class:"grid-line"}));
    c.svg.appendChild(svgElement("line",{x1:c.margin.left,y1:y,x2:c.margin.left+c.innerW,y2:y,class:"grid-line"}));
    const xt=xmin+(xmax-xmin)*(i/count), yt=ymax-(ymax-ymin)*(i/count);
    const tx=svgElement("text",{x,y:c.height-c.margin.bottom+24,class:"axis-text","text-anchor":"middle"});
    tx.textContent=compact(xt); c.svg.appendChild(tx);
    const ty=svgElement("text",{x:c.margin.left-9,y:y+3,class:"axis-text","text-anchor":"end"});
    ty.textContent=compact(yt); c.svg.appendChild(ty);
  }
}

function axisLabel(svg,x,y,text,rotation=0) {
  const attributes = {x,y,class:"axis-text","text-anchor":"middle"};
  if (rotation) attributes.transform = `rotate(${rotation} ${x} ${y})`;
  const node=svgElement("text",attributes);
  node.textContent=text.length>18?text.slice(0,18)+"…":text; svg.appendChild(node);
}

function compact(value) {
  if(Math.abs(value)>=1000)return (value/1000).toFixed(1)+"k";
  if(Math.abs(value)>=100)return value.toFixed(0);
  if(Math.abs(value)>=10)return value.toFixed(1);
  return value.toFixed(2);
}

function drawRolling(data) {
  const c=makeChart(els.rollingChart);
  if(!data.rolling.length)return;
  const values=data.rolling.map(d=>d.value);
  let ymin=-1,ymax=1;
  const low=Math.min(...values,-1), high=Math.max(...values,1);
  ymin=Math.max(-1,Math.min(-.1,low-.08)); ymax=Math.min(1,Math.max(.1,high+.08));
  if(ymin>=ymax){ymin=-1;ymax=1}
  const sx=i=>c.margin.left+i/(data.rolling.length-1)*c.innerW;
  const sy=v=>c.margin.top+c.innerH-(v-ymin)/(ymax-ymin)*c.innerH;
  for(let i=0;i<=5;i++){
    const y=c.margin.top+i*c.innerH/5;
    c.svg.appendChild(svgElement("line",{x1:c.margin.left,y1:y,x2:c.margin.left+c.innerW,y2:y,class:"grid-line"}));
    const val=ymax-(ymax-ymin)*i/5;
    const label=svgElement("text",{x:c.margin.left-9,y:y+3,class:"axis-text","text-anchor":"end"});
    label.textContent=val.toFixed(1);c.svg.appendChild(label);
  }
  const zeroY=sy(0);
  c.svg.appendChild(svgElement("line",{x1:c.margin.left,y1:zeroY,x2:c.margin.left+c.innerW,y2:zeroY,stroke:"#9ea9a5","stroke-dasharray":"4 4"}));
  const path=data.rolling.map((p,i)=>`${i?"L":"M"}${sx(i)},${sy(p.value)}`).join(" ");
  c.svg.appendChild(svgElement("path",{d:path,fill:"none",stroke:"#1f7662","stroke-width":"1.8","stroke-linejoin":"round"}));
  data.rolling.forEach((p,i)=>{
    if(i%Math.max(1,Math.floor(data.rolling.length/120))!==0)return;
    const dot=svgElement("circle",{cx:sx(i),cy:sy(p.value),r:"2.2",fill:"#1f7662",opacity:"0.75"});
    const yDateLabel = data.day_offset === 0 ? "" : `<br>${nameFor(data.pair.y)} date: ${p.y_date}`;
    dot.addEventListener("pointerenter",e=>showTooltip(e,`${nameFor(data.pair.x)} date: ${p.x_date}${yDateLabel}<br>Rolling r: ${p.value.toFixed(3)}`));
    dot.addEventListener("pointermove",e=>showTooltip(e));dot.addEventListener("pointerleave",hideTooltip);
    c.svg.appendChild(dot);
  });
  for(let i=0;i<=4;i++){
    const index=Math.round(i*(data.rolling.length-1)/4), p=data.rolling[index];
    const label=svgElement("text",{x:sx(index),y:c.height-c.margin.bottom+24,class:"axis-text","text-anchor":"middle"});
    label.textContent=p.date.slice(0,7);c.svg.appendChild(label);
  }
  axisLabel(c.svg,c.margin.left+c.innerW/2,c.height-5,"Date");
}

function showTooltip(event,html) {
  if(html)els.tooltip.innerHTML=html;
  els.tooltip.hidden=false;
  els.tooltip.style.left=`${Math.min(event.clientX+12,window.innerWidth-180)}px`;
  els.tooltip.style.top=`${event.clientY-12}px`;
}
function hideTooltip(){els.tooltip.hidden=true;}

init();
