// Global Application State
const state = {
    stats: null,
    presets: null,
    skillsConfig: {}, // maps skill_name -> weight (float)
    formulaSplit: 60, // percentage for Skill Match (0-100), remaining is JD Sim
    candidates: [],
    uploadedCandidate: null,
    charts: {
        bar: null,
        pie: null
    },
    activeTab: 'table', // 'table' or 'chart'
    highlightSkillsActive: true
};

// Document Ready Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// =====================================================================
// INITIALIZATION
// =====================================================================
async function initApp() {
    setupEventListeners();
    setupDragAndDrop();
    
    // Fetch initial dataset statistics and presets
    await fetchStats();
    await fetchPresets();
    
    // Select default preset (Data Scientist) on first load
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect && presetSelect.options.length > 1) {
        presetSelect.value = 'data_scientist';
        triggerPresetLoad('data_scientist');
    }
}

// Event Listeners Binding
function setupEventListeners() {
    // Preset dropdown change
    document.getElementById('preset-select').addEventListener('change', (e) => {
        triggerPresetLoad(e.target.value);
    });
    
    // Parse JD button
    document.getElementById('extract-skills-btn').addEventListener('click', () => {
        parseJobDescription();
    });
    
    // Slider bubble updating (Formula weight split)
    const weightSlider = document.getElementById('formula-weight-slider');
    weightSlider.addEventListener('input', (e) => {
        state.formulaSplit = parseInt(e.target.value);
        updateFormulaWeightUI();
    });
    
    // Slider bubble updating (Min score threshold)
    const minScoreSlider = document.getElementById('min-score-input');
    const minScoreVal = document.getElementById('min-score-val');
    minScoreSlider.addEventListener('input', (e) => {
        minScoreVal.textContent = e.target.value + '%';
    });
    
    // Run Screening & Ranking button
    document.getElementById('rank-candidates-btn').addEventListener('click', () => {
        rankCandidates();
    });
    
    // Add custom skill modal handlers
    document.getElementById('add-custom-skill-btn').addEventListener('click', () => {
        openAddSkillModal();
    });
    
    document.getElementById('modal-close-btn').addEventListener('click', closeAddSkillModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeAddSkillModal);
    document.getElementById('modal-add-btn').addEventListener('click', handleAddCustomSkill);
    
    // Close Drawer handlers
    document.getElementById('drawer-close-btn').addEventListener('click', closeDrawer);
    document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);
    
    // Highlighting toggle inside resume drawer
    document.getElementById('highlight-skills-btn').addEventListener('click', (e) => {
        state.highlightSkillsActive = !state.highlightSkillsActive;
        if (state.highlightSkillsActive) {
            e.target.classList.add('active');
        } else {
            e.target.classList.remove('active');
        }
        refreshResumeTextHighlighting();
    });
    
    // Tabs switching (Table vs Charts)
    document.getElementById('tab-table-btn').addEventListener('click', () => switchTab('table'));
    document.getElementById('tab-chart-btn').addEventListener('click', () => switchTab('chart'));
    
    // Candidate search field
    document.getElementById('candidate-search').addEventListener('input', (e) => {
        filterRankingsTable(e.target.value);
    });
}

// =====================================================================
// DATA FETCHING & PRESETS
// =====================================================================
async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        state.stats = data;
        
        // Update stats widgets
        document.querySelector('#stat-total-resumes h3').textContent = data.total_resumes.toLocaleString();
        document.querySelector('#stat-total-categories h3').textContent = data.category_list.length;
        
        // Populate category dropdown
        const catSelect = document.getElementById('category-select');
        // Clear previous options except "All Categories"
        catSelect.innerHTML = '<option value="ALL">All Categories</option>';
        data.category_list.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            catSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to fetch stats:", err);
    }
}

async function fetchPresets() {
    try {
        const response = await fetch('/api/presets');
        const data = await response.json();
        state.presets = data;
    } catch (err) {
        console.error("Failed to fetch presets:", err);
    }
}

function triggerPresetLoad(presetKey) {
    if (!state.presets || !state.presets[presetKey]) return;
    
    const preset = state.presets[presetKey];
    document.getElementById('job-title-input').value = preset.title;
    document.getElementById('jd-textarea').value = preset.description;
    document.getElementById('category-select').value = preset.category;
    
    // Auto-parse the new job description
    parseJobDescription();
}

// =====================================================================
// SKILL CONFIGURATOR
// =====================================================================
async function parseJobDescription() {
    const jdText = document.getElementById('jd-textarea').value;
    if (!jdText.trim()) {
        alert("Please enter or load a job description first.");
        return;
    }
    
    // Show spinner or disabling state
    const parseBtn = document.getElementById('extract-skills-btn');
    const originalText = parseBtn.innerHTML;
    parseBtn.disabled = true;
    parseBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Parsing...';
    
    try {
        const response = await fetch('/api/parse-jd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_description: jdText })
        });
        const data = await response.json();
        
        // Populate local state skills config (defaulting weight to 1.0 (Required))
        state.skillsConfig = {};
        data.extracted_skills.forEach(skill => {
            state.skillsConfig[skill] = 1.0;
        });
        
        renderSkillConfig();
        updateActiveSkillsCount();
    } catch (err) {
        console.error("Failed to parse JD:", err);
        alert("Error parsing job description.");
    } finally {
        parseBtn.disabled = false;
        parseBtn.innerHTML = originalText;
    }
}

function renderSkillConfig() {
    const container = document.getElementById('skills-list-container');
    container.innerHTML = '';
    
    const skills = Object.keys(state.skillsConfig);
    
    if (skills.length === 0) {
        container.innerHTML = `
            <div class="no-skills-placeholder">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>No skills configured yet. Parse a job description or add custom skills above.</p>
            </div>
        `;
        return;
    }
    
    skills.forEach(skill => {
        const weight = state.skillsConfig[skill];
        let weightClass = 'required';
        if (weight === 2.0) weightClass = 'critical';
        if (weight === 0.5) weightClass = 'preferred';
        
        const row = document.createElement('div');
        row.className = 'skill-config-row';
        row.innerHTML = `
            <div class="skill-row-left">
                <span class="skill-name-label">${escapeHtml(skill)}</span>
                <span class="skill-weight-badge ${weightClass}">${weight === 2.0 ? 'Critical' : weight === 0.5 ? 'Preferred' : 'Required'}</span>
            </div>
            <div class="skill-row-actions">
                <select class="skill-weight-select" data-skill="${skill}">
                    <option value="1.0" ${weight === 1.0 ? 'selected' : ''}>Required (1.0)</option>
                    <option value="2.0" ${weight === 2.0 ? 'selected' : ''}>Critical (2.0)</option>
                    <option value="0.5" ${weight === 0.5 ? 'selected' : ''}>Preferred (0.5)</option>
                </select>
                <button class="skill-delete-btn" data-skill="${skill}" title="Remove Skill">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        
        // Listeners for adjustments
        row.querySelector('.skill-weight-select').addEventListener('change', (e) => {
            const skillName = e.target.getAttribute('data-skill');
            state.skillsConfig[skillName] = parseFloat(e.target.value);
            renderSkillConfig();
        });
        
        row.querySelector('.skill-delete-btn').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const skillName = btn.getAttribute('data-skill');
            delete state.skillsConfig[skillName];
            renderSkillConfig();
            updateActiveSkillsCount();
        });
        
        container.appendChild(row);
    });
}

function updateFormulaWeightUI() {
    const jdVal = 100 - state.formulaSplit;
    const skillVal = state.formulaSplit;
    
    document.getElementById('weight-split-label').textContent = `${jdVal}% Cosine Sim / ${skillVal}% Skill Match`;
}

function updateActiveSkillsCount() {
    const count = Object.keys(state.skillsConfig).length;
    document.querySelector('#stat-active-skills h3').textContent = count;
}

// Add Custom Skill Modals
function openAddSkillModal() {
    document.getElementById('add-skill-modal').classList.remove('hidden');
    document.getElementById('custom-skill-input').value = '';
    document.getElementById('custom-skill-input').focus();
}

function closeAddSkillModal() {
    document.getElementById('add-skill-modal').classList.add('hidden');
}

function handleAddCustomSkill() {
    const input = document.getElementById('custom-skill-input');
    const skillName = input.value.trim().toLowerCase();
    const weight = parseFloat(document.getElementById('custom-skill-weight').value);
    
    if (!skillName) {
        alert("Please enter a skill keyword.");
        return;
    }
    
    state.skillsConfig[skillName] = weight;
    renderSkillConfig();
    updateActiveSkillsCount();
    closeAddSkillModal();
}

// =====================================================================
// RANKING ENGINE CLIENT
// =====================================================================
async function rankCandidates() {
    const jdText = document.getElementById('jd-textarea').value;
    const activeCategory = document.getElementById('category-select').value;
    const minScore = parseFloat(document.getElementById('min-score-input').value);
    
    if (!jdText.trim()) {
        alert("Please enter a job description to score against.");
        return;
    }
    
    if (Object.keys(state.skillsConfig).length === 0) {
        alert("Please parse a job description or add skills to configuration first.");
        return;
    }
    
    const tableBody = document.getElementById('rankings-tbody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="empty-table-placeholder">
                <i class="fa-solid fa-spinner fa-spin text-purple"></i>
                <p>Computing TF-IDF cosine similarity matrices and scoring candidates...</p>
            </td>
        </tr>
    `;
    
    const rankBtn = document.getElementById('rank-candidates-btn');
    const originalText = rankBtn.innerHTML;
    rankBtn.disabled = true;
    rankBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Screening Resumes...';
    
    try {
        const response = await fetch('/api/rank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_description: jdText,
                skills_config: state.skillsConfig,
                category: activeCategory,
                min_score: minScore,
                jd_weight: (100 - state.formulaSplit) / 100,
                skill_weight: state.formulaSplit / 100,
                limit: 100
            })
        });
        
        const data = await response.json();
        state.candidates = data;
        
        // If there was an uploaded candidate, let's append/merge them at the top if they match category
        if (state.uploadedCandidate) {
            const matchesCategory = activeCategory === 'ALL' || state.uploadedCandidate.category === activeCategory;
            const matchesScore = state.uploadedCandidate.final_score >= minScore;
            
            if (matchesCategory && matchesScore) {
                // Remove if already in list to avoid duplicates
                state.candidates = state.candidates.filter(c => c.id !== state.uploadedCandidate.id);
                // Insert and re-sort
                state.candidates.push(state.uploadedCandidate);
                state.candidates.sort((a, b) => b.final_score - a.final_score);
            }
        }
        
        renderRankingsTable();
        
        // If charts tab is active, redraw
        if (state.activeTab === 'chart') {
            renderCharts();
        }
        
    } catch (err) {
        console.error("Failed to rank candidates:", err);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table-placeholder text-red">
                    <i class="fa-solid fa-circle-xmark"></i>
                    <p>Failed to execute candidate matching algorithm.</p>
                </td>
            </tr>
        `;
    } finally {
        rankBtn.disabled = false;
        rankBtn.innerHTML = originalText;
    }
}

function renderRankingsTable() {
    const tableBody = document.getElementById('rankings-tbody');
    tableBody.innerHTML = '';
    
    const searchTerm = document.getElementById('candidate-search').value.trim().toLowerCase();
    
    // Filter candidates based on search
    const filteredCandidates = state.candidates.filter(cand => {
        if (!searchTerm) return true;
        return cand.id.toString().toLowerCase().includes(searchTerm);
    });
    
    // Update badge text
    document.getElementById('results-count-text').textContent = `${filteredCandidates.length} matches`;
    
    if (filteredCandidates.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table-placeholder">
                    <i class="fa-solid fa-folder-open"></i>
                    <p>No candidates found matching the active criteria.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Calculate and update average match score stat widget
    const sumScores = filteredCandidates.reduce((acc, c) => acc + c.final_score, 0);
    const avgScore = sumScores / filteredCandidates.length;
    document.querySelector('#stat-avg-score h3').textContent = Math.round(avgScore) + '%';
    
    filteredCandidates.forEach((cand, idx) => {
        const row = document.createElement('tr');
        
        let rankDisplay = `<span class="table-rank-num">${idx + 1}</span>`;
        if (idx === 0) rankDisplay = '<span class="table-rank-num" title="Top Pick"><i class="fa-solid fa-trophy text-green"></i> 1</span>';
        else if (idx === 1) rankDisplay = '<span class="table-rank-num" title="Second Pick"><i class="fa-solid fa-medal text-purple"></i> 2</span>';
        else if (idx === 2) rankDisplay = '<span class="table-rank-num" title="Third Pick"><i class="fa-solid fa-award text-secondary"></i> 3</span>';
        
        // Determine colors for score progress bar
        let scoreClass = 'low';
        if (cand.final_score >= 75) scoreClass = 'high';
        else if (cand.final_score >= 50) scoreClass = 'mid';
        
        row.innerHTML = `
            <td>${rankDisplay}</td>
            <td class="table-candidate-id">${escapeHtml(cand.id)}</td>
            <td><span class="category-tag">${escapeHtml(cand.category)}</span></td>
            <td>${cand.similarity_score}%</td>
            <td>${cand.skill_match_score}%</td>
            <td>
                <div class="score-progress-container">
                    <span class="score-percentage score-${scoreClass}">${cand.final_score}%</span>
                    <div class="progress-bar-small">
                        <div class="bar-fill ${scoreClass}" style="width: ${cand.final_score}%;"></div>
                    </div>
                </div>
            </td>
            <td class="text-right">
                <button class="btn btn-secondary btn-pill-sm view-details-btn" data-id="${cand.id}">
                    <i class="fa-solid fa-magnifying-glass"></i> Analyze
                </button>
            </td>
        `;
        
        row.querySelector('.view-details-btn').addEventListener('click', (e) => {
            const candId = e.currentTarget.getAttribute('data-id');
            openCandidateDrawer(candId);
        });
        
        tableBody.appendChild(row);
    });
}

function filterRankingsTable(query) {
    renderRankingsTable();
}

// =====================================================================
// DRAG-AND-DROP LIVE UPLOADER
// =====================================================================
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    
    // Trigger file dialog
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFile(e.target.files[0]);
        }
    });
    
    // Drag handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleUploadedFile(e.dataTransfer.files[0]);
        }
    });
}

async function handleUploadedFile(file) {
    const jdText = document.getElementById('jd-textarea').value;
    
    if (!jdText.trim()) {
        alert("Please load or paste a job description first so the system can evaluate your resume.");
        return;
    }
    
    const statusBox = document.getElementById('upload-status');
    const statusText = document.getElementById('upload-status-text');
    const progressFill = document.getElementById('upload-progress-fill');
    
    statusBox.classList.remove('hidden');
    statusText.textContent = `Analyzing "${file.name}"...`;
    progressFill.style.width = '30%';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('job_description', jdText);
    formData.append('skills_config', JSON.stringify(state.skillsConfig));
    formData.append('jd_weight', (100 - state.formulaSplit) / 100);
    formData.append('skill_weight', state.formulaSplit / 100);
    
    try {
        progressFill.style.width = '60%';
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        progressFill.style.width = '90%';
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            statusBox.classList.add('hidden');
            return;
        }
        
        progressFill.style.width = '100%';
        setTimeout(() => {
            statusBox.classList.add('hidden');
        }, 800);
        
        // Cache the uploaded candidate locally
        state.uploadedCandidate = data;
        
        // Display result in UI
        const resultsBox = document.getElementById('uploaded-results-container');
        const cardContainer = document.getElementById('uploaded-candidate-card');
        resultsBox.classList.remove('hidden');
        
        let scoreClass = 'low';
        if (data.final_score >= 75) scoreClass = 'high';
        else if (data.final_score >= 50) scoreClass = 'mid';
        
        cardContainer.innerHTML = `
            <div class="uploaded-cand-info">
                <h5>${escapeHtml(file.name)}</h5>
                <p>Extracted ${data.matched_skills.length} matching skills, ${data.missing_skills.length} missing.</p>
            </div>
            <div class="uploaded-cand-score">
                <span class="score-badge-large">${data.final_score}%</span>
                <button class="btn btn-primary btn-pill-sm inspect-uploaded-btn">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Compare
                </button>
            </div>
        `;
        
        cardContainer.querySelector('.inspect-uploaded-btn').addEventListener('click', () => {
            openCandidateDrawer(data.id);
        });
        
        // Insert candidate into global table rankings and reload table
        const index = state.candidates.findIndex(c => c.id === data.id);
        if (index > -1) {
            state.candidates[index] = data;
        } else {
            state.candidates.push(data);
        }
        state.candidates.sort((a, b) => b.final_score - a.final_score);
        renderRankingsTable();
        
    } catch (err) {
        console.error("Upload failed:", err);
        statusBox.classList.add('hidden');
        alert("Failed to parse and analyze the uploaded file. Please check file formatting.");
    }
}

// =====================================================================
// DETAIL DRAWER AND ANALYTICS
// =====================================================================
async function openCandidateDrawer(candidateId) {
    const drawer = document.getElementById('detail-drawer');
    const overlay = document.getElementById('drawer-overlay');
    
    // Check if it's the uploaded candidate
    let candidate = state.candidates.find(c => c.id === candidateId);
    if (!candidate && state.uploadedCandidate && state.uploadedCandidate.id === candidateId) {
        candidate = state.uploadedCandidate;
    }
    
    if (!candidate) {
        alert("Candidate metadata not loaded.");
        return;
    }
    
    // Show drawer structure immediately with loaders
    document.getElementById('drawer-candidate-category').textContent = candidate.category;
    document.getElementById('drawer-candidate-id').textContent = `Candidate ID: ${candidateId}`;
    document.getElementById('drawer-final-score-val').textContent = `${candidate.final_score}%`;
    
    // Fill gauge progress
    const circle = document.getElementById('drawer-final-score-circle');
    circle.style.borderColor = candidate.final_score >= 75 ? 'var(--color-success)' : candidate.final_score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
    circle.style.boxShadow = candidate.final_score >= 75 ? '0 0 15px rgba(16, 185, 129, 0.3)' : candidate.final_score >= 50 ? '0 0 15px rgba(245, 158, 11, 0.3)' : '0 0 15px rgba(239, 68, 68, 0.3)';
    
    // Fill bars
    document.getElementById('drawer-sim-score-bar').style.width = `${candidate.similarity_score}%`;
    document.getElementById('drawer-sim-score-val').textContent = `${candidate.similarity_score}%`;
    document.getElementById('drawer-skill-score-bar').style.width = `${candidate.skill_match_score}%`;
    document.getElementById('drawer-skill-score-val').textContent = `${candidate.skill_match_score}%`;
    
    // Fill skill badge counts
    document.getElementById('drawer-matched-count').textContent = candidate.matched_skills.length;
    document.getElementById('drawer-missing-count').textContent = candidate.missing_skills.length;
    
    // Fill skill badges
    const matchedBox = document.getElementById('drawer-matched-skills');
    matchedBox.innerHTML = '';
    if (candidate.matched_skills.length === 0) {
        matchedBox.innerHTML = '<span class="text-muted" style="font-size:0.75rem;">None</span>';
    } else {
        candidate.matched_skills.forEach(skill => {
            const badge = document.createElement('span');
            badge.className = 'skill-badge matched';
            badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escapeHtml(skill)}`;
            matchedBox.appendChild(badge);
        });
    }
    
    const missingBox = document.getElementById('drawer-missing-skills');
    missingBox.innerHTML = '';
    if (candidate.missing_skills.length === 0) {
        missingBox.innerHTML = '<span class="text-muted" style="font-size:0.75rem;">None (Perfect Match)</span>';
    } else {
        candidate.missing_skills.forEach(skill => {
            const badge = document.createElement('span');
            badge.className = 'skill-badge missing';
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(skill)}`;
            missingBox.appendChild(badge);
        });
    }
    
    // Set Decision Support Explainer text
    let explText = '';
    const formulaText = `(Cosine Similarity * ${(100 - state.formulaSplit)/100}) + (Skill Match * ${state.formulaSplit/100})`;
    
    if (candidate.final_score >= 80) {
        explText = `Candidate matches ${candidate.matched_skills.length} required skills, including heavy-weights. With a semantic similarity score of ${candidate.similarity_score}%, they demonstrate exceptionally strong role alignment. Recruiter Recommendation: Shortlist immediately for interview.`;
    } else if (candidate.final_score >= 60) {
        explText = `Candidate displays a solid match rate (${candidate.final_score}% overall), representing a high potential candidate. They possess crucial core skills but miss secondary ones like: ${candidate.missing_skills.slice(0, 3).join(', ') || 'N/A'}. Recruiter Recommendation: Consider for technical screening.`;
    } else {
        explText = `Candidate has a weaker match index of ${candidate.final_score}%, lacking several key requirements. Key skill gaps include: ${candidate.missing_skills.slice(0, 5).join(', ')}. Recruiter Recommendation: Hold / Review details.`;
    }
    document.getElementById('drawer-fit-explanation').innerHTML = `<strong>Score computation model:</strong> ${formulaText}<br><br>${explText}`;
    
    // Open drawer overlay instantly
    drawer.classList.add('open');
    
    // Fetch resume text
    const textContainer = document.getElementById('drawer-resume-text-container');
    textContainer.innerHTML = '<div style="padding: 20px; text-align: center;"><i class="fa-solid fa-spinner fa-spin text-purple"></i> Loading resume text...</div>';
    
    try {
        let resumeText = '';
        if (candidateId.toString().startsWith("Uploaded:")) {
            // Uploaded candidate text is cached inside candidate state
            resumeText = candidate.resume_text;
        } else {
            const response = await fetch(`/api/candidate/${candidateId}`);
            const data = await response.json();
            resumeText = data.resume_text;
        }
        
        // Cache the raw resume text on the element
        textContainer.setAttribute('data-raw-text', resumeText);
        textContainer.setAttribute('data-matched-skills', JSON.stringify(candidate.matched_skills));
        
        refreshResumeTextHighlighting();
    } catch (err) {
        console.error("Failed to load resume text:", err);
        textContainer.textContent = "Error loading candidate resume text from backend.";
    }
}

function refreshResumeTextHighlighting() {
    const textContainer = document.getElementById('drawer-resume-text-container');
    const rawText = textContainer.getAttribute('data-raw-text');
    if (!rawText) return;
    
    if (!state.highlightSkillsActive) {
        textContainer.textContent = rawText;
        return;
    }
    
    const matchedSkills = JSON.parse(textContainer.getAttribute('data-matched-skills') || '[]');
    if (matchedSkills.length === 0) {
        textContainer.textContent = rawText;
        return;
    }
    
    // Perform regex replace for highlighting. Use word boundaries to avoid double matches.
    let htmlContent = escapeHtml(rawText);
    
    // Sort matched skills by length descending to match longer phrases first (e.g. "machine learning" before "learning")
    const sortedSkills = [...matchedSkills].sort((a, b) => b.length - a.length);
    
    sortedSkills.forEach(skill => {
        // Escaping for regex safely
        const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Match word boundaries case insensitively
        const regex = new RegExp('\\b(' + escaped + ')\\b', 'gi');
        
        // Replace matched patterns with highlighted spans.
        // Since we already ran escapeHtml on rawText, it's safe to inject spans now.
        // We use a temporary token during replacements to prevent matching inside injected HTML tags!
        htmlContent = htmlContent.replace(regex, (match) => {
            return `__START_HIGHLIGHT__${match}__END_HIGHLIGHT__`;
        });
    });
    
    // Replace tokens with actual tags
    htmlContent = htmlContent.replace(/__START_HIGHLIGHT__/g, '<span class="resume-highlight match">');
    htmlContent = htmlContent.replace(/__END_HIGHLIGHT__/g, '</span>');
    
    textContainer.innerHTML = htmlContent;
}

function closeDrawer() {
    document.getElementById('detail-drawer').classList.remove('open');
}

// =====================================================================
// CHARTING VISUALIZATIONS
// =====================================================================
function switchTab(tabName) {
    state.activeTab = tabName;
    
    // Toggle buttons
    document.getElementById('tab-table-btn').classList.toggle('active', tabName === 'table');
    document.getElementById('tab-chart-btn').classList.toggle('active', tabName === 'chart');
    
    // Toggle panels
    document.getElementById('rankings-table-view').classList.toggle('active', tabName === 'table');
    document.getElementById('rankings-chart-view').classList.toggle('active', tabName === 'chart');
    
    if (tabName === 'chart') {
        renderCharts();
    }
}

function renderCharts() {
    const topCandidates = state.candidates.slice(0, 10);
    
    if (topCandidates.length === 0) {
        return;
    }
    
    // 1. Scores Bar Chart
    const barCtx = document.getElementById('scoresBarChart').getContext('2d');
    if (state.charts.bar) {
        state.charts.bar.destroy();
    }
    
    state.charts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: topCandidates.map(c => `ID: ${c.id}`),
            datasets: [{
                label: 'Overall Fit Score (%)',
                data: topCandidates.map(c => c.final_score),
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#9ca3af' } },
                title: { display: true, text: 'Top 10 Candidate Alignment Match Indices', color: '#f3f4f6', font: { size: 13, family: 'Outfit' } }
            },
            scales: {
                y: { min: 0, max: 100, ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { color: '#6b7280' }, grid: { display: false } }
            }
        }
    });
    
    // 2. Category Distribution Pie Chart
    const pieCtx = document.getElementById('categoryPieChart').getContext('2d');
    if (state.charts.pie) {
        state.charts.pie.destroy();
    }
    
    // Count category occurrences in top results
    const catCounts = {};
    topCandidates.forEach(c => {
        catCounts[c.category] = (catCounts[c.category] || 0) + 1;
    });
    
    state.charts.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catCounts),
            datasets: [{
                data: Object.values(catCounts),
                backgroundColor: [
                    'rgba(6, 182, 212, 0.7)',
                    'rgba(168, 85, 247, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(59, 130, 246, 0.7)'
                ],
                borderColor: '#0b0f19',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } },
                title: { display: true, text: 'Industry Category Breakdown (Top 10)', color: '#f3f4f6', font: { size: 13, family: 'Outfit' } }
            }
        }
    });
}

// =====================================================================
// UTILITY HELPERS
// =====================================================================
function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
