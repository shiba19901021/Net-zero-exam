// ===== State =====
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let flaggedQuestions = new Set();
let selectedSubject = 'subject1';
let feedbackMode = 'instant';
let isViewingHistory = false;
let lastRenderedIndex = -1;
let customAnswers = JSON.parse(localStorage.getItem('customAnswers') || '{}');

// Apply custom answers globally on load
[...pastQuestionsS1, ...pastQuestionsS2, ...aiQuestionsS1, ...aiQuestionsS2].forEach(q => {
    if (customAnswers.hasOwnProperty(q.id)) {
        q.correctIndex = customAnswers[q.id];
        q.verified = true;
    }
});

function getQuestionById(id) {
  return [...pastQuestionsS1, ...pastQuestionsS2, ...aiQuestionsS1, ...aiQuestionsS2].find(q => q.id === id);
}

document.addEventListener('DOMContentLoaded', () => {
    const aiCount = aiQuestionsS1.length + aiQuestionsS2.length;
    const pastCount = pastQuestionsS1.length + pastQuestionsS2.length;
    
    const statTotal = document.getElementById('stat-total');
    const statAi = document.getElementById('stat-ai');
    const statPast = document.getElementById('stat-past');
    
    if (statTotal) statTotal.textContent = aiCount + pastCount;
    if (statAi) statAi.textContent = aiCount;
    if (statPast) statPast.textContent = pastCount;
});

// ===== DOM Elements =====
const $ = id => document.getElementById(id);
const dashboardView = $('dashboard');
const examView = $('exam-view');
const resultView = $('result-view');
const historyView = $('history-view');
const ratioSlider = $('ratio-slider');
const startBtn = $('start-btn');
const historyBtn = $('history-btn');

// ===== Initialize Stats =====
function initStats() {
  const pastCount = pastQuestionsS1.length + pastQuestionsS2.length;
  const aiCount = aiQuestionsS1.length + aiQuestionsS2.length;
  $('stat-total').textContent = (pastCount + aiCount).toLocaleString();
  $('stat-past').textContent = pastCount.toLocaleString();
  $('stat-ai').textContent = aiCount.toLocaleString();
}
initStats();

// ===== Dashboard: Radio Selection =====
document.querySelectorAll('.radio-option').forEach(opt => {
  opt.addEventListener('click', () => {
    const group = opt.closest('.radio-group');
    if (!group) return;
    group.querySelectorAll('.radio-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    
    if (group.id === 'subject-selection') {
      selectedSubject = opt.dataset.value;
    } else if (group.id === 'feedback-mode-selection') {
      feedbackMode = opt.dataset.value;
    }
  });
});

// ===== Dashboard: Slider =====
ratioSlider.addEventListener('input', e => {
  const pastCount = parseInt(e.target.value);
  $('ratio-past-val').textContent = pastCount;
  $('ratio-ai-val').textContent = 50 - pastCount;
});

// ===== Start Exam =====
startBtn.addEventListener('click', () => {
  const pastCount = parseInt(ratioSlider.value);
  const aiCount = 50 - pastCount;

  currentQuestions = getQuestionPool(selectedSubject, pastCount, aiCount);
  userAnswers = new Array(currentQuestions.length).fill(null);
  flaggedQuestions.clear();
  currentQuestionIndex = 0;

  initExamUI();
  switchView(examView);
});

$('wrong-practice-btn').addEventListener('click', () => {
  let wrongQ = JSON.parse(localStorage.getItem('wrongQuestions') || '{}');
  const wrongIds = Object.keys(wrongQ);
  if (wrongIds.length === 0) {
      alert("🎉 太棒了！你目前沒有任何錯題紀錄。");
      return;
  }
  
  currentQuestions = wrongIds.map(getQuestionById).filter(Boolean);
  currentQuestions.sort(() => Math.random() - 0.5); // Shuffle
  if (currentQuestions.length > 50) currentQuestions = currentQuestions.slice(0, 50);

  userAnswers = new Array(currentQuestions.length).fill(null);
  flaggedQuestions.clear();
  currentQuestionIndex = 0;
  selectedSubject = 'wrong_practice';

  initExamUI();
  switchView(examView);
});

$('clear-wrong-btn')?.addEventListener('click', () => {
    let wrongQ = JSON.parse(localStorage.getItem('wrongQuestions') || '{}');
    if (Object.keys(wrongQ).length === 0) {
        alert("你目前沒有任何錯題喔！");
        return;
    }
    if (confirm("確定要清除所有錯題紀錄嗎？此動作無法復原。")) {
        localStorage.removeItem('wrongQuestions');
        alert("已清除所有錯題！");
    }
});

function switchView(target) {
  [dashboardView, examView, resultView, historyView].forEach(v => {
    if (v) {
      v.classList.remove('view-active');
      v.classList.add('view-hidden');
    }
  });
  target.classList.remove('view-hidden');
  target.classList.add('view-active');
  window.scrollTo(0, 0);
}

// ===== Exam UI =====
function initExamUI() {
  const dotsContainer = $('question-dots');
  dotsContainer.innerHTML = '';
  currentQuestions.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.addEventListener('click', () => renderQuestion(i));
    dotsContainer.appendChild(dot);
  });
  renderQuestion(0);
}

function renderQuestion(index) {
  const isNavigating = (lastRenderedIndex !== index);
  lastRenderedIndex = index;
  currentQuestionIndex = index;
  const q = currentQuestions[index];

  // Progress
  $('question-progress').textContent = `第 ${index + 1} 題 / 共 ${currentQuestions.length} 題`;
  $('progress-bar').style.width = `${((index + 1) / currentQuestions.length) * 100}%`;

  // Tag
  const tag = $('question-tag');
  if (q.type === 'ai') {
    tag.textContent = '🤖 AI 時事改編';
    tag.className = 'question-tag ai-tag';
  } else {
    tag.textContent = '📚 歷屆考古題';
    tag.className = 'question-tag';
  }

  // Question text
  $('question-text').textContent = q.question;

  // Options
  const container = $('options-container');
  container.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
  q.options.forEach((opt, optIdx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    
    if (userAnswers[index] === optIdx) {
        btn.classList.add('selected');
    }

    btn.innerHTML = `
      <span class="option-letter">${letters[optIdx]}</span>
      <span>${opt}</span>
    `;

    if (feedbackMode === 'instant' && userAnswers[index] !== null) {
        if (optIdx === q.correctIndex) {
            btn.style.borderColor = 'var(--success)';
            btn.style.background = 'rgba(183,204,185,0.1)';
            btn.style.borderWidth = '2px';
        } else if (optIdx === userAnswers[index]) {
            btn.style.borderColor = 'var(--error)';
            btn.style.background = 'rgba(255,180,171,0.08)';
            btn.style.borderWidth = '2px';
        } else {
            // Compress unselected incorrect options to save space
            btn.style.padding = '8px 14px';
            btn.style.opacity = '0.5';
            btn.style.fontSize = '0.9rem';
            const letter = btn.querySelector('.option-letter');
            if (letter) {
                letter.style.width = '26px';
                letter.style.height = '26px';
                letter.style.fontSize = '0.8rem';
            }
        }
        btn.style.cursor = 'default';
    }

    btn.addEventListener('click', () => {
      if (feedbackMode === 'instant' && userAnswers[index] !== null) return;
      userAnswers[index] = optIdx;
      renderQuestion(index);
    });
    container.appendChild(btn);
  });

  const hintBox = $('hint-box');
  if (feedbackMode === 'instant' && userAnswers[index] !== null) {
      hintBox.style.display = 'flex';
      hintBox.style.flexDirection = 'column';
      
      const isCorrect = userAnswers[index] === q.correctIndex;
      const resultHtml = isCorrect 
          ? '<div style="color:var(--success); font-weight:bold; margin-bottom: 8px;">✅ 答對了！</div>' 
          : `<div style="color:var(--error); font-weight:bold; margin-bottom: 8px;">❌ 答錯了，正確答案是 ${letters[q.correctIndex]}</div>`;
          
      let wrongQ = JSON.parse(localStorage.getItem('wrongQuestions') || '{}');
      let questionStats = JSON.parse(localStorage.getItem('questionStats') || '{}');
      let wrongStats = JSON.parse(localStorage.getItem('wrongStats') || '{}');
      const isInWrongList = wrongQ.hasOwnProperty(q.id);
      
      const totalCorrect = (questionStats[q.id] || 0) + (isCorrect ? 1 : 0);
      const totalWrong = (wrongStats[q.id] || 0) + (!isCorrect ? 1 : 0);
      
      let statsHtml = `<div style="font-size:0.85rem; color:var(--on-surface-variant); margin-bottom:12px; display:flex; gap:12px; flex-wrap:wrap; background:var(--surface-variant); padding:8px; border-radius:6px;">`;
      statsHtml += `<span>🎯 歷史答對：${totalCorrect} 次</span>`;
      statsHtml += `<span>❌ 歷史答錯：${totalWrong} 次</span>`;
      if (selectedSubject === 'wrong_practice' && isInWrongList) {
          const streak = isCorrect ? (wrongQ[q.id] || 0) + 1 : 0;
          statsHtml += `<span style="color:var(--primary); font-weight:bold;">🔥 連續答對：${streak} / 5 次</span>`;
      }
      statsHtml += `</div>`;
      
      let actionButtons = `
        <div style="display:flex; gap:8px; margin-top:12px;">
            <button class="filter-btn correct-ans-btn" style="font-size:0.8rem; padding:4px 10px; color:var(--primary); border-color:var(--primary);">✏️ 修改正確答案</button>
      `;
      if (isInWrongList) {
          actionButtons += `<button class="filter-btn remove-wrong-btn" style="font-size:0.8rem; padding:4px 10px; color:var(--error); border-color:var(--error);">🗑️ 從錯題庫中移除</button>`;
      }
      actionButtons += `</div>`;

      const explanationHtml = `
        ${resultHtml}
        ${statsHtml}
        <div><strong>💡 解析：</strong><br>${q.explanation}</div>
        ${actionButtons}
      `;
      $('hint-text').innerHTML = explanationHtml;
      
      const correctBtn = $('hint-text').querySelector('.correct-ans-btn');
      if (correctBtn) {
          correctBtn.addEventListener('click', () => {
              const input = prompt("請輸入這題正確的選項字母 (A, B, C, 或 D) :");
              if (!input) return;
              const letter = input.trim().toUpperCase();
              const idx = ['A', 'B', 'C', 'D'].indexOf(letter);
              if (idx !== -1) {
                  q.correctIndex = idx;
                  q.verified = true;
                  customAnswers[q.id] = idx;
                  localStorage.setItem('customAnswers', JSON.stringify(customAnswers));
                  alert(`✅ 已將正確答案修改為 ${letter}！`);
                  renderQuestion(currentQuestionIndex); // re-render
              } else {
                  alert("❌ 無效的輸入，請輸入 A, B, C 或 D。");
              }
          });
      }

      if (isInWrongList) {
          const removeWrongBtn = $('hint-text').querySelector('.remove-wrong-btn');
          removeWrongBtn.addEventListener('click', (e) => {
              let currentWrongQ = JSON.parse(localStorage.getItem('wrongQuestions') || '{}');
              delete currentWrongQ[q.id];
              localStorage.setItem('wrongQuestions', JSON.stringify(currentWrongQ));
              e.target.textContent = '✅ 已移除';
              e.target.style.color = 'var(--on-surface-variant)';
              e.target.style.borderColor = 'var(--outline-variant)';
              e.target.disabled = true;
          });
      }
  } else {
      hintBox.style.display = 'none';
      hintBox.style.flexDirection = 'row';
  }

  // Dots
  const dots = $('question-dots').children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].className = 'dot';
    if (i === index) dots[i].classList.add('current');
    if (userAnswers[i] !== null) dots[i].classList.add('answered');
    if (flaggedQuestions.has(i)) dots[i].classList.add('flagged');
  }

  // Flag button
  const flagBtn = $('flag-btn');
  const flagIcon = $('flag-icon');
  const flagLabel = $('flag-label');
  if (flaggedQuestions.has(index)) {
    flagBtn.classList.add('flagged');
    flagIcon.textContent = 'bookmark_added';
    flagIcon.style.fontVariationSettings = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    flagLabel.textContent = '已標記';
  } else {
    flagBtn.classList.remove('flagged');
    flagIcon.textContent = 'bookmark';
    flagIcon.style.fontVariationSettings = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    flagLabel.textContent = '標記';
  }

  // Nav
  $('prev-btn').disabled = index === 0;
  $('next-btn').disabled = index === currentQuestions.length - 1;

  // Auto Scroll Logic
  if (isNavigating) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (feedbackMode === 'instant' && userAnswers[index] !== null) {
      setTimeout(() => {
          $('hint-box').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
  }
}

// Nav buttons
$('prev-btn').addEventListener('click', () => {
  if (currentQuestionIndex > 0) renderQuestion(currentQuestionIndex - 1);
});
$('next-btn').addEventListener('click', () => {
  if (currentQuestionIndex < currentQuestions.length - 1) renderQuestion(currentQuestionIndex + 1);
});

// Flag
$('flag-btn').addEventListener('click', () => {
  if (flaggedQuestions.has(currentQuestionIndex)) {
    flaggedQuestions.delete(currentQuestionIndex);
  } else {
    flaggedQuestions.add(currentQuestionIndex);
  }
  renderQuestion(currentQuestionIndex);
});

// Submit
$('submit-exam-btn').addEventListener('click', () => {
  const unanswered = userAnswers.filter(a => a === null).length;
  if (unanswered > 0) {
    if (!confirm(`你還有 ${unanswered} 題未作答，確定要交卷嗎？`)) return;
  } else {
    if (!confirm('確定要交卷嗎？')) return;
  }
  isViewingHistory = false;
  showResult();
});

// ===== Result =====
function showResult() {
  switchView(resultView);

  let correctCount = 0;
  currentQuestions.forEach((q, i) => {
    if (userAnswers[i] === q.correctIndex) correctCount++;
  });

  const score = Math.round((correctCount / currentQuestions.length) * 100);
  $('final-score').textContent = score;
  $('correct-count').textContent = correctCount;
  $('total-count').textContent = currentQuestions.length;

  // Color the score circle based on performance
  const circle = document.querySelector('.score-circle');
  if (score >= 70) {
    circle.style.borderColor = 'var(--success)';
  } else {
    circle.style.borderColor = 'var(--error)';
  }

  const backBtn = $('back-dashboard-btn');
  if (isViewingHistory) {
    backBtn.innerHTML = '<span class="material-symbols-outlined">arrow_back</span> 返回歷史紀錄';
  } else {
    backBtn.innerHTML = '<span class="material-symbols-outlined">home</span> 回首頁';
  }

  // Save to history if we just finished an exam (not viewing history)
  if (!isViewingHistory) {
    let wrongQ = JSON.parse(localStorage.getItem('wrongQuestions') || '{}');
    let questionStats = JSON.parse(localStorage.getItem('questionStats') || '{}');
    let wrongStats = JSON.parse(localStorage.getItem('wrongStats') || '{}');
    
    currentQuestions.forEach((q, i) => {
        const isCorrect = userAnswers[i] === q.correctIndex;
        const isFlagged = flaggedQuestions.has(i);
        
        // Track total wrong answers
        if (!isCorrect) {
            wrongStats[q.id] = (wrongStats[q.id] || 0) + 1;
        }

        // 如果答錯，或者答對但有「標記」(表示是用猜的)，都加進錯題庫並歸零次數
        if (!isCorrect || isFlagged) {
            wrongQ[q.id] = 0; 
        } else {
            // Track correct counts for spaced repetition
            questionStats[q.id] = (questionStats[q.id] || 0) + 1;
            
            if (wrongQ.hasOwnProperty(q.id)) {
                wrongQ[q.id] += 1;
                if (wrongQ[q.id] >= 5) {
                    delete wrongQ[q.id]; // Remove if correct 5 times!
                }
            }
        }
    });
    
    localStorage.setItem('wrongQuestions', JSON.stringify(wrongQ));
    localStorage.setItem('questionStats', JSON.stringify(questionStats));
    localStorage.setItem('wrongStats', JSON.stringify(wrongStats));
    localStorage.setItem('lastSyncTime', Date.now().toString());

    saveHistory(score, correctCount);
  }

  renderReview('all');
}

// ===== History System =====
function saveHistory(score, correctCount) {
  const history = JSON.parse(localStorage.getItem('examHistory') || '[]');
  const record = {
    id: Date.now().toString(),
    date: new Date().toLocaleString(),
    score: score,
    correctCount: correctCount,
    totalCount: currentQuestions.length,
    subject: selectedSubject === 'subject1' ? '考科 1' : selectedSubject === 'subject2' ? '考科 2' : selectedSubject === 'wrong_practice' ? '錯題專區' : '綜合測驗',
    questionIds: currentQuestions.map(q => q.id),
    userAnswers: [...userAnswers],
    flagged: Array.from(flaggedQuestions)
  };
  
  // Prevent filling up LocalStorage by limiting to 50 records
  if (history.length >= 50) {
    history.pop();
  }
  
  history.unshift(record);
  localStorage.setItem('examHistory', JSON.stringify(history));
}

if (historyBtn) {
  historyBtn.addEventListener('click', () => {
    renderHistoryList();
    switchView(historyView);
  });
}

$('history-back-btn')?.addEventListener('click', () => switchView(dashboardView));

$('clear-history-btn')?.addEventListener('click', () => {
  if (confirm('確定要刪除所有測驗紀錄嗎？此動作無法復原。')) {
    localStorage.removeItem('examHistory');
    renderHistoryList();
  }
});

function renderHistoryList() {
  const container = $('history-list-container');
  container.innerHTML = '';
  const history = JSON.parse(localStorage.getItem('examHistory') || '[]');
  
  if (history.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--on-surface-variant); padding:2rem;">目前沒有任何測驗紀錄。</p>';
    return;
  }
  
  history.forEach(record => {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.cursor = 'pointer';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.marginBottom = '12px';
    
    item.innerHTML = `
      <div style="flex:1;">
        <h3 style="color:var(--primary); font-family:'Manrope', sans-serif; margin-bottom:4px;">${record.score} 分</h3>
        <p style="font-size:0.85rem; color:var(--on-surface-variant);">${record.date} ─ ${record.subject}</p>
        <p style="font-size:0.85rem; color:var(--on-surface-variant);">答對 ${record.correctCount} / ${record.totalCount} 題</p>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="delete-history-item-btn" style="background:none; border:none; color:var(--error); cursor:pointer; padding:4px;">
            <span class="material-symbols-outlined" style="font-size:1.2rem;">delete</span>
        </button>
        <span class="material-symbols-outlined" style="color:var(--on-surface-variant);">chevron_right</span>
      </div>
    `;
    
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-history-item-btn')) {
          e.stopPropagation();
          if (confirm('確定要刪除這筆紀錄嗎？')) {
              const hist = JSON.parse(localStorage.getItem('examHistory') || '[]');
              const newHist = hist.filter(r => r.id !== record.id);
              localStorage.setItem('examHistory', JSON.stringify(newHist));
              renderHistoryList();
          }
          return;
      }
      // Load history state
      if (record.questionIds) {
        currentQuestions = record.questionIds.map(getQuestionById).filter(Boolean);
      } else if (record.questions) {
        // Fallback for old history format
        currentQuestions = record.questions;
      }
      userAnswers = record.userAnswers;
      flaggedQuestions = new Set(record.flagged);
      isViewingHistory = true;
      showResult();
    });
    
    container.appendChild(item);
  });
}

function renderReview(filter) {
  const container = $('review-container');
  container.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  currentQuestions.forEach((q, index) => {
    const isCorrect = userAnswers[index] === q.correctIndex;
    const isFlagged = flaggedQuestions.has(index);
    const isUnverified = !q.verified;

    if (filter === 'wrong' && isCorrect) return;
    if (filter === 'flagged' && !isFlagged) return;
    if (filter === 'unverified' && !isUnverified) return;

    const item = document.createElement('div');
    item.className = `review-item ${isCorrect ? 'correct' : 'wrong'}`;

    const userLetter = userAnswers[index] !== null ? letters[userAnswers[index]] : '未作答';
    const correctLetter = letters[q.correctIndex];
    const flagHtml = isFlagged ? ' <span style="color:var(--secondary)">📌</span>' : '';
    const unverifiedHtml = isUnverified ? ' <span class="unverified-badge">⚠️ 答案待核實</span>' : '';

    const resultHtml = isCorrect
      ? '<span style="color:var(--success)">✅ 答對</span>'
      : `<span style="color:var(--error)">❌ 答錯（你選 ${userLetter}，正確 ${correctLetter}）</span>`;

    const optionsHtml = q.options.map((opt, i) => {
      let cls = 'review-option';
      if (q.correctIndex === i) cls += ' is-correct';
      else if (userAnswers[index] === i && userAnswers[index] !== q.correctIndex) cls += ' is-wrong';
      return `<div class="${cls}">${letters[i]}. ${opt}</div>`;
    }).join('');

    item.innerHTML = `
      <h4>第 ${index + 1} 題${flagHtml}${unverifiedHtml}</h4>
      <div class="q-text">${q.question}</div>
      ${optionsHtml}
      <div class="review-result">${resultHtml}</div>
      <div class="review-explanation">
        <strong>💡 解析：</strong><br>
        ${q.explanation}
      </div>
    `;

    let currentWrongQ = JSON.parse(localStorage.getItem('wrongQuestions') || '{}');
    const actionContainer = document.createElement('div');
    actionContainer.style.display = 'flex';
    actionContainer.style.gap = '8px';
    actionContainer.style.marginTop = '12px';
    
    let buttonsHtml = `<button class="filter-btn correct-ans-btn" style="font-size:0.8rem; padding:4px 10px; color:var(--primary); border-color:var(--primary);">✏️ 修改正確答案</button>`;
    if (currentWrongQ.hasOwnProperty(q.id)) {
        buttonsHtml += `<button class="filter-btn remove-wrong-btn" style="font-size:0.8rem; padding:4px 10px; color:var(--error); border-color:var(--error);">🗑️ 從錯題庫中移除</button>`;
    }
    actionContainer.innerHTML = buttonsHtml;
    item.appendChild(actionContainer);

    const correctBtn = actionContainer.querySelector('.correct-ans-btn');
    if (correctBtn) {
        correctBtn.addEventListener('click', () => {
            const input = prompt("請輸入這題正確的選項字母 (A, B, C, 或 D) :");
            if (!input) return;
            const letter = input.trim().toUpperCase();
            const idx = ['A', 'B', 'C', 'D'].indexOf(letter);
            if (idx !== -1) {
                q.correctIndex = idx;
                q.verified = true;
                customAnswers[q.id] = idx;
                localStorage.setItem('customAnswers', JSON.stringify(customAnswers));
                alert(`✅ 已將正確答案修改為 ${letter}！`);
                // Check if currently right/wrong changes, but simplest is just re-render everything
                renderReview('all'); 
            } else {
                alert("❌ 無效的輸入，請輸入 A, B, C 或 D。");
            }
        });
    }

    if (currentWrongQ.hasOwnProperty(q.id)) {
        const removeBtn = actionContainer.querySelector('.remove-wrong-btn');
        removeBtn.addEventListener('click', (e) => {
            let wq = JSON.parse(localStorage.getItem('wrongQuestions') || '{}');
            delete wq[q.id];
            localStorage.setItem('wrongQuestions', JSON.stringify(wq));
            e.target.textContent = '✅ 已移除';
            e.target.style.color = 'var(--on-surface-variant)';
            e.target.style.borderColor = 'var(--outline-variant)';
            e.target.disabled = true;
        });
    }

    container.appendChild(item);
  });

  if (container.children.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--on-surface-variant); padding:2rem;">沒有符合篩選條件的題目 🎉</p>';
  }
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    renderReview(e.target.dataset.filter);
  });
});

// Back to dashboard
$('back-dashboard-btn').addEventListener('click', () => {
  if (isViewingHistory) {
    switchView(historyView);
  } else {
    switchView(dashboardView);
  }
});

// ===== Sync System =====
const exportBtn = $('export-sync-btn');
const importBtn = $('import-sync-btn');
const syncArea = $('sync-code-area');
const confirmImportBtn = $('confirm-import-btn');
const syncStatus = $('sync-status');

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        syncArea.style.display = 'block';
        confirmImportBtn.style.display = 'none';
        
        const h = JSON.parse(localStorage.getItem('examHistory') || '[]').slice(0, 5);
        const w = JSON.parse(localStorage.getItem('wrongQuestions') || '{}');
        const c = JSON.parse(localStorage.getItem('customAnswers') || '{}');
        const s = JSON.parse(localStorage.getItem('questionStats') || '{}');
        const ws = JSON.parse(localStorage.getItem('wrongStats') || '{}');
        const t = parseInt(localStorage.getItem('lastSyncTime') || Date.now().toString());
        
        const dataStr = JSON.stringify({ h, w, c, s, ws, t });
        const code = btoa(encodeURIComponent(dataStr));
        syncArea.value = code;
        syncArea.select();
        try {
            document.execCommand('copy');
            syncStatus.style.color = 'var(--primary)';
            syncStatus.textContent = '✅ 已為你產生同步代碼，並自動複製到剪貼簿！請到另一台裝置「貼上」此代碼。';
        } catch(e) {
            syncStatus.style.color = 'var(--on-surface)';
            syncStatus.textContent = '請手動複製上方的整串代碼，並到另一台裝置貼上。';
        }
    });

    importBtn.addEventListener('click', () => {
        syncArea.style.display = 'block';
        confirmImportBtn.style.display = 'block';
        syncArea.value = '';
        syncStatus.textContent = '請在上方貼上你從另一台裝置取得的同步代碼，然後點擊確認。';
        syncStatus.style.color = 'var(--on-surface-variant)';
    });

    confirmImportBtn.addEventListener('click', () => {
        const code = syncArea.value.trim();
        if (!code) {
            syncStatus.textContent = '❌ 請先貼上代碼！';
            syncStatus.style.color = 'var(--error)';
            return;
        }
        
        try {
            const jsonStr = decodeURIComponent(atob(code));
            const data = JSON.parse(jsonStr);
            if (!data.w || !data.t) throw new Error("Format Error");
            
            const localTime = parseInt(localStorage.getItem('lastSyncTime') || '0');
            if (data.t < localTime) {
                if(!confirm("⚠️ 警告：你貼上的這組代碼，產生的時間比這台裝置目前的紀錄還要舊！你確定要用舊進度覆蓋目前的進度嗎？")) {
                    syncStatus.textContent = '🛑 已取消匯入。';
                    return;
                }
            }
            
            localStorage.setItem('wrongQuestions', JSON.stringify(data.w));
            if (data.s) {
                localStorage.setItem('questionStats', JSON.stringify(data.s));
            }
            if (data.ws) {
                localStorage.setItem('wrongStats', JSON.stringify(data.ws));
            }
            localStorage.setItem('lastSyncTime', data.t.toString());
            
            if (data.c) {
                localStorage.setItem('customAnswers', JSON.stringify(data.c));
                customAnswers = data.c;
                [...pastQuestionsS1, ...pastQuestionsS2, ...aiQuestionsS1, ...aiQuestionsS2].forEach(q => {
                    if (customAnswers.hasOwnProperty(q.id)) {
                        q.correctIndex = customAnswers[q.id];
                        q.verified = true;
                    }
                });
            }
            
            if (data.h && Array.isArray(data.h)) {
                const localHistory = JSON.parse(localStorage.getItem('examHistory') || '[]');
                const existingIds = new Set(localHistory.map(r => r.id));
                const newHistory = [...localHistory];
                data.h.forEach(record => {
                    if (!existingIds.has(record.id)) newHistory.push(record);
                });
                newHistory.sort((a,b) => b.id - a.id);
                localStorage.setItem('examHistory', JSON.stringify(newHistory.slice(0, 50)));
            }
            
            syncStatus.style.color = 'var(--success)';
            syncStatus.textContent = '🎉 匯入成功！兩邊裝置的錯題進度已完全同步！';
            syncArea.style.display = 'none';
            confirmImportBtn.style.display = 'none';
        } catch (e) {
            syncStatus.style.color = 'var(--error)';
            syncStatus.textContent = '❌ 錯誤：這組代碼似乎有問題，請確認是否有複製完整！';
        }
    });
}
