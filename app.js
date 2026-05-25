/**
 * Lexi AI Agent - Core Logic
 * Handles UI interactions, API key management, and Gemini API calls.
 */

// ==== STATE ====
let apiKey = localStorage.getItem('lexi_openai_key') || '';
let currentQuiz = null;
let weakAreas = JSON.parse(localStorage.getItem('lexi_weak_areas')) || [];
let langHistory = [];

// ==== DOM ELEMENTS ====
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const actionCards = document.querySelectorAll('.action-card');

const apiKeyInput = document.getElementById('apiKeyInput');
const btnSaveKey = document.getElementById('btnSaveKey');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const toast = document.getElementById('toast');

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// Stats
const statConcepts = document.getElementById('statConcepts');
const statQuizzes = document.getElementById('statQuizzes');
const statWeak = document.getElementById('statWeak');
const statLang = document.getElementById('statLang');

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', () => {
  if (apiKey) {
    apiKeyInput.value = apiKey;
    setConnectedState(true);
  }
  updateStats();
  renderWeakList();
  setGreeting();
});

function setGreeting() {
  const hour = new Date().getHours();
  const el = document.getElementById('topbarGreeting');
  if (hour < 12) el.textContent = 'Good morning! 👋';
  else if (hour < 18) el.textContent = 'Good afternoon! 👋';
  else el.textContent = 'Good evening! 👋';
}

// ==== NAVIGATION ====
menuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

function navigateTo(sectionId) {
  // Update Nav
  navItems.forEach(nav => nav.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${sectionId}`);
  if (activeNav) activeNav.classList.add('active');

  // Update Page
  pages.forEach(page => page.classList.remove('active'));
  const activePage = document.getElementById(`page-${sectionId}`);
  if (activePage) activePage.classList.add('active');

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
  }
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(item.dataset.section);
  });
});

actionCards.forEach(card => {
  card.addEventListener('click', () => {
    navigateTo(card.dataset.goto);
  });
});

// ==== API KEY MANAGEMENT ====
btnSaveKey.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('Please enter a valid API key.', 'error');
    return;
  }
  apiKey = key;
  localStorage.setItem('lexi_openai_key', apiKey);
  setConnectedState(true);
  showToast('API Key saved successfully!', 'success');
});

function setConnectedState(isConnected) {
  if (isConnected) {
    statusDot.classList.add('connected');
    statusText.textContent = 'Connected to OpenAI';
    btnSaveKey.textContent = 'Update';
  } else {
    statusDot.classList.remove('connected');
    statusText.textContent = 'API Key Required';
    btnSaveKey.textContent = 'Connect';
  }
}

// ==== HELPER FUNCTIONS ====
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.style.borderColor = type === 'error' ? 'var(--red)' : type === 'success' ? 'var(--green)' : 'var(--p1)';
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showLoading(text = 'Lexi is thinking...') {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

function incrementStat(id) {
  const el = document.getElementById(id);
  const current = parseInt(el.textContent);
  el.textContent = current + 1;
}

function updateStats() {
  document.getElementById('statWeak').textContent = weakAreas.length;
}

// Add weak area (max 10)
function addWeakArea(topic, severity = 'medium') {
  if (!weakAreas.find(w => w.topic.toLowerCase() === topic.toLowerCase())) {
    weakAreas.push({ topic, severity });
    if (weakAreas.length > 10) weakAreas.shift(); // Keep latest 10
    localStorage.setItem('lexi_weak_areas', JSON.stringify(weakAreas));
    renderWeakList();
    updateStats();
  }
}

// Format markdown-like text to HTML securely
function formatAIResponse(text) {
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<code>$1</code>')
    .replace(/`(.*?)`/g, '<code>$1</code>');

  const paragraphs = formatted.split('\n\n');
  return paragraphs.map(p => {
    if (p.trim().startsWith('- ')) {
      const items = p.split('\n').map(item => `<li>${item.replace(/^- /, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}


// ==========================================
// OPENAI API INTEGRATION
// ==========================================
async function callOpenAI(prompt, systemInstruction = null) {
  if (!apiKey) {
    showToast('Please connect your OpenAI API Key first.', 'error');
    return null;
  }

  const url = `https://api.openai.com/v1/chat/completions`;
  
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const payload = {
    model: 'gpt-4o-mini',
    messages: messages
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API Error:', data.error);
      showToast(`API Error: ${data.error.message}`, 'error');
      return null;
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Network Error:', error);
    showToast('Network error. Please try again.', 'error');
    return null;
  }
};

// ==========================================
// FEATURE: EXPLAIN CONCEPT
// ==========================================
document.getElementById('btnExplain').addEventListener('click', async () => {
  const concept = document.getElementById('conceptInput').value.trim();
  const level = document.getElementById('conceptLevel').value;
  const responseArea = document.getElementById('explainResponse');

  if (!concept) return showToast('Please enter a concept.', 'error');

  showLoading('Analyzing concept...');

  const system = `You are Lexi, an expert AI tutor. Explain concepts clearly. Use markdown.
  Tone: Encouraging and educational.`;

  let levelPrompt = '';
  if (level === 'beginner') levelPrompt = 'Explain it simply for a beginner, avoiding overly complex jargon.';
  else if (level === 'advanced') levelPrompt = 'Provide a deep, advanced technical explanation.';
  else if (level === 'eli5') levelPrompt = 'Explain it like I am 5 years old using a fun analogy.';
  else levelPrompt = 'Provide a standard, clear explanation suitable for a high school/college student.';

  const prompt = `Explain the concept of: "${concept}". ${levelPrompt}. 
  Structure your response with: 
  1. A short, clear definition.
  2. The core explanation (how it works).
  3. A real-world example or analogy.`;

  const result = await callOpenAI(prompt, system);
  hideLoading();

  if (result) {
    incrementStat('statConcepts');
    responseArea.innerHTML = `
      <div class="response-content animation-fade">
        <h3>Explaining: ${concept}</h3>
        ${formatAIResponse(result)}
      </div>
    `;
  }
});


// ==========================================
// FEATURE: QUIZ ME
// ==========================================
document.getElementById('btnGenerateQuiz').addEventListener('click', async () => {
  const topic = document.getElementById('quizTopic').value.trim();
  const difficulty = document.getElementById('quizDifficulty').value;
  const count = document.getElementById('quizCount').value;
  const quizArea = document.getElementById('quizArea');
  const resultsArea = document.getElementById('quizResults');

  if (!topic) return showToast('Please enter a quiz topic.', 'error');

  showLoading('Generating custom quiz...');

  // Hide previous results
  resultsArea.classList.add('hidden');

  const prompt = `Generate a ${count}-question multiple choice quiz about "${topic}" at a ${difficulty} difficulty level.
  You MUST respond ONLY with valid JSON. Do not include markdown formatting or backticks.
  Format:
  [
    {
      "q": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0, // index of correct option (0-3)
      "explanation": "Why this is correct."
    }
  ]`;

  const result = await callOpenAI(prompt);
  hideLoading();

  if (result) {
    try {
      // Clean up the JSON if Gemini wrapped it in markdown
      let cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      currentQuiz = {
        topic: topic,
        questions: JSON.parse(cleanJson),
        userAnswers: []
      };
      renderQuiz();
      incrementStat('statQuizzes');
    } catch (e) {
      console.error("Failed to parse quiz JSON:", e, result);
      showToast("Failed to generate quiz format. Please try again.", "error");
    }
  }
});

function renderQuiz() {
  const quizArea = document.getElementById('quizArea');
  if (!currentQuiz || !currentQuiz.questions.length) return;

  let html = `<div class="quiz-questions">`;

  currentQuiz.questions.forEach((q, qIndex) => {
    html += `
      <div class="quiz-question-card" id="q-card-${qIndex}">
        <div class="quiz-q-header">
          <span class="quiz-q-num">${qIndex + 1}</span>
          <span class="quiz-q-text">${q.q}</span>
        </div>
        <div class="quiz-options">
          ${q.options.map((opt, oIndex) => `
            <button class="quiz-option" data-q="${qIndex}" data-opt="${oIndex}">
              ${String.fromCharCode(65 + oIndex)}. ${opt}
            </button>
          `).join('')}
        </div>
        <div class="quiz-feedback hidden" id="feedback-${qIndex}"></div>
      </div>
    `;
  });

  html += `
    <div class="quiz-submit-row">
      <button class="btn-primary" id="btnSubmitQuiz" style="display:none;">Submit Answers</button>
    </div>
  </div>`;

  quizArea.innerHTML = html;

  // Add event listeners to options
  document.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const qIndex = parseInt(e.target.dataset.q);
      const oIndex = parseInt(e.target.dataset.opt);

      // Select option
      document.querySelectorAll(`.quiz-option[data-q="${qIndex}"]`).forEach(b => b.style.borderColor = 'var(--glass-border)');
      e.target.style.borderColor = 'var(--p1)';

      currentQuiz.userAnswers[qIndex] = oIndex;

      // Show submit button if all answered
      if (currentQuiz.userAnswers.filter(a => a !== undefined).length === currentQuiz.questions.length) {
        document.getElementById('btnSubmitQuiz').style.display = 'inline-flex';
      }
    });
  });

  document.getElementById('btnSubmitQuiz').addEventListener('click', gradeQuiz);
}

function gradeQuiz() {
  let score = 0;

  currentQuiz.questions.forEach((q, qIndex) => {
    const userAns = currentQuiz.userAnswers[qIndex];
    const isCorrect = userAns === q.answer;
    const card = document.getElementById(`q-card-${qIndex}`);
    const feedback = document.getElementById(`feedback-${qIndex}`);

    // Disable all options
    card.querySelectorAll('.quiz-option').forEach(btn => btn.disabled = true);

    // Mark choices
    const opts = card.querySelectorAll('.quiz-option');
    if (userAns !== undefined) {
      if (isCorrect) {
        opts[userAns].classList.add('correct');
        score++;
      } else {
        opts[userAns].classList.add('wrong');
        opts[q.answer].classList.add('correct'); // Show correct answer

        // Add to weak areas
        addWeakArea(currentQuiz.topic, 'high');
      }
    }

    // Show feedback
    feedback.textContent = q.explanation;
    feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'wrong'}`;
  });

  // Show Results
  const resultsArea = document.getElementById('quizResults');
  resultsArea.classList.remove('hidden');
  resultsArea.innerHTML = `
    <div class="quiz-score">${score} / ${currentQuiz.questions.length}</div>
    <div class="quiz-score-label">You scored ${Math.round((score / currentQuiz.questions.length) * 100)}%</div>
    ${score === currentQuiz.questions.length ? '<p style="color:var(--green)">Perfect score! Great job! 🎉</p>' : '<p style="color:var(--yellow)">Lexi noted your mistakes and added them to your Weak Areas.</p>'}
    <button class="btn-secondary" onclick="document.getElementById('quizArea').innerHTML=''; document.getElementById('quizResults').classList.add('hidden');">Clear Quiz</button>
  `;

  document.getElementById('btnSubmitQuiz').style.display = 'none';
}


// ==========================================
// FEATURE: WEAK AREAS
// ==========================================
function renderWeakList() {
  const list = document.getElementById('weakList');
  if (weakAreas.length === 0) {
    list.innerHTML = '<li class="empty-state-inline">No weak areas tracked yet. Take a quiz to get started!</li>';
    return;
  }

  list.innerHTML = weakAreas.map((w, i) => `
    <li class="weak-item">
      <span class="weak-item-name">${w.topic}</span>
      <div style="display:flex; gap:8px;">
        <span class="weak-badge ${w.severity}">${w.severity}</span>
        <button class="btn-secondary" style="margin:0; padding:2px 8px; font-size:.7rem" onclick="removeWeakArea(${i})">✕</button>
      </div>
    </li>
  `).join('');
}

window.removeWeakArea = function (index) {
  weakAreas.splice(index, 1);
  localStorage.setItem('lexi_weak_areas', JSON.stringify(weakAreas));
  renderWeakList();
  updateStats();
}

document.getElementById('btnAnalyzeWeak').addEventListener('click', async () => {
  if (weakAreas.length === 0) return showToast('No weak areas to analyze yet.', 'info');

  const planArea = document.getElementById('studyPlan');
  showLoading('Creating custom study plan...');

  const topicsList = weakAreas.map(w => w.topic).join(', ');
  const prompt = `I am struggling with the following topics: ${topicsList}.
  Please create a 3-step action plan to help me master these concepts.
  Format the response exactly like this template (do not include markdown block ticks, just the raw HTML):
  
  <div class="step-list">
    <div class="step-item">
      <div class="step-num">1</div>
      <div class="step-body">
        <div class="step-title">[Action Title]</div>
        <div class="step-desc">[Detailed instruction]</div>
        <div class="step-duration">Est. Time: [Time]</div>
      </div>
    </div>
    <!-- repeat for steps 2 and 3 -->
  </div>`;

  const result = await callOpenAI(prompt);
  hideLoading();

  if (result) {
    planArea.innerHTML = result.replace(/```html/g, '').replace(/```/g, '').trim();
  }
});


// ==========================================
// FEATURE: ASSIGNMENT HELPER
// ==========================================
document.getElementById('btnBreakdown').addEventListener('click', async () => {
  const assignment = document.getElementById('assignmentInput').value.trim();
  const subject = document.getElementById('assignmentSubject').value;
  const responseArea = document.getElementById('assignmentResponse');

  if (!assignment) return showToast('Please paste an assignment description.', 'error');

  showLoading('Breaking down assignment...');

  const prompt = `I have an assignment for a ${subject} class. Here is the description:
  "${assignment}"
  
  Please break this down into a logical, step-by-step action plan.
  Format your response strictly using this HTML structure (no markdown wrapper):
  
  <div class="step-list">
    <div class="step-item">
      <div class="step-num">1</div>
      <div class="step-body">
        <div class="step-title">[Step Name]</div>
        <div class="step-desc">[What to do specifically]</div>
      </div>
    </div>
    <!-- add as many steps as needed -->
  </div>`;

  const result = await callOpenAI(prompt);
  hideLoading();

  if (result) {
    responseArea.innerHTML = `
      <div class="response-content">
        <h3>Assignment Plan</h3>
        ${result.replace(/```html/g, '').replace(/```/g, '').trim()}
      </div>
    `;
  }
});


// ==========================================
// FEATURE: LANGUAGE PRACTICE
// ==========================================
const langMessages = document.getElementById('langMessages');
const langInputRow = document.getElementById('langInputRow');
const langUserInput = document.getElementById('langUserInput');
let currentLangSession = false;
let langLanguage = '';

function addChatMessage(sender, text, translation = '') {
  const isUser = sender === 'user';
  const html = `
    <div class="chat-bubble ${sender}">
      <div class="bubble-lang">${text}</div>
      ${translation ? `<div class="bubble-trans">${translation}</div>` : ''}
    </div>
  `;
  langMessages.insertAdjacentHTML('beforeend', html);
  langMessages.scrollTop = langMessages.scrollHeight;
}

function addTypingIndicator() {
  const html = `
    <div class="chat-bubble lexi typing-indicator-bubble" id="typingIndicator">
      <div class="typing-dots">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div>
    </div>
  `;
  langMessages.insertAdjacentHTML('beforeend', html);
  langMessages.scrollTop = langMessages.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

document.getElementById('btnStartLang').addEventListener('click', async () => {
  if (currentLangSession) {
    // End session
    currentLangSession = false;
    document.getElementById('btnStartLang').innerHTML = '<span>Start Session</span><span class="btn-icon">💬</span>';
    langInputRow.style.display = 'none';
    langMessages.innerHTML = `
      <div class="chat-welcome">
        <span class="chat-welcome-icon">👋</span>
        <p>Session ended. Great practice!</p>
      </div>
    `;
    return;
  }

  // Start Session
  langLanguage = document.getElementById('langSelect').value;
  const level = document.getElementById('langLevel').value;
  const scenario = document.getElementById('langScenario').value;

  langMessages.innerHTML = ''; // clear
  langInputRow.style.display = 'flex';
  document.getElementById('btnStartLang').innerHTML = '<span>End Session</span><span class="btn-icon">⏹️</span>';
  currentLangSession = true;
  langHistory = []; // Reset history
  incrementStat('statLang');

  addTypingIndicator();

  const systemPrompt = `You are a native ${langLanguage} speaker. We are roleplaying the scenario: "${scenario}". The user is at a ${level} proficiency level.
  Start the conversation. Keep your responses short (1-2 sentences). 
  Respond ONLY with a JSON object in this exact format:
  {
    "response": "Your reply in ${langLanguage}",
    "translation": "English translation of your reply",
    "correction": "If the user made a grammar mistake in their previous message, put the correction here. If no mistake, leave empty."
  }`;

  const result = await callOpenAI(`Let's start. Start the roleplay.`, systemPrompt);
  removeTypingIndicator();

  if (result) {
    try {
      const data = JSON.parse(result.replace(/```json/g, '').replace(/```/g, '').trim());
      addChatMessage('lexi', data.response, data.translation);
      // Add to history
      langHistory.push({ role: 'user', parts: [{ text: "Let's start." }] });
      langHistory.push({ role: 'model', parts: [{ text: JSON.stringify(data) }] });
    } catch (e) {
      addChatMessage('lexi', "Sorry, I had trouble starting the conversation. Let's try again.");
    }
  }
});

document.getElementById('btnSendLang').addEventListener('click', sendLangMessage);
langUserInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendLangMessage();
});

async function sendLangMessage() {
  const text = langUserInput.value.trim();
  if (!text || !currentLangSession) return;

  langUserInput.value = '';
  addChatMessage('user', text);
  addTypingIndicator();

  // Add to history
  langHistory.push({ role: 'user', parts: [{ text: text }] });

  const systemPrompt = `You are a native ${langLanguage} speaker roleplaying with the user.
  Respond ONLY with a JSON object:
  {
    "response": "Your reply in ${langLanguage}",
    "translation": "English translation",
    "correction": "Brief English explanation if user made a mistake, else empty string"
  }`;

  const result = await callOpenAI(text, systemPrompt);
  removeTypingIndicator();

  if (result) {
    try {
      const data = JSON.parse(result.replace(/```json/g, '').replace(/```/g, '').trim());

      if (data.correction) {
        addChatMessage('lexi', `<em>Note: ${data.correction}</em>`);
      }
      addChatMessage('lexi', data.response, data.translation);

      langHistory.push({ role: 'model', parts: [{ text: JSON.stringify(data) }] });
    } catch (e) {
      addChatMessage('lexi', "I didn't quite catch that. Can you repeat?");
    }
  }
}