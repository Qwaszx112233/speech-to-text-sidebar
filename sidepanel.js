class SpeechToTextPro {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.finalTranscript = '';
        this.microphoneAccessGranted = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.spellCheckEnabled = false;
        this.autoPunctuationLevel = 'medium';
        this.sessionWordCount = 0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedSettings();
        this.checkBrowserSupport();
        this.setupSpellCheck();
        this.updateStats();
        this.updateEditorOverlay();
    }

    initializeElements() {
        // Основные элементы управления
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.closeBtn = document.getElementById('closeBtn');
        this.output = document.getElementById('output');
        this.status = document.getElementById('status');
        this.statusCard = document.getElementById('statusCard');
        this.recordingTime = document.getElementById('recordingTime');
        this.timeCount = document.getElementById('timeCount');
        this.languageSelect = document.getElementById('language');
        this.autoPunctuationSelect = document.getElementById('autoPunctuation');
        this.instructions = document.getElementById('instructions');
        this.editorOverlay = document.getElementById('editorOverlay');

        // Элементы панели инструментов
        this.spellCheckBtn = document.getElementById('spellCheckBtn');
        this.formatTextBtn = document.getElementById('formatTextBtn');
        this.punctuateBtn = document.getElementById('punctuateBtn');

        // Элементы статистики
        this.wordCount = document.getElementById('wordCount');
        this.charCount = document.getElementById('charCount');
        this.sessionStats = document.getElementById('sessionStats');
    }

    setupEventListeners() {
        // Основные кнопки
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.clearBtn.addEventListener('click', () => this.clearText());
        this.closeBtn.addEventListener('click', () => this.closePanel());

        // Настройки
        this.languageSelect.addEventListener('change', () => this.saveSettings());
        this.autoPunctuationSelect.addEventListener('change', () => {
            this.autoPunctuationLevel = this.autoPunctuationSelect.value;
            this.saveSettings();
        });

        // Панель инструментов
        this.spellCheckBtn.addEventListener('click', () => this.toggleSpellCheck());
        this.formatTextBtn.addEventListener('click', () => this.formatText());
        this.punctuateBtn.addEventListener('click', () => this.autoPunctuate());

        // Кнопки форматирования текста
        document.querySelectorAll('.tool-btn[data-command]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.executeCommand(btn.dataset.command);
            });
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => this.handleHotkeys(e));

        // Отслеживание изменений текста
        this.output.addEventListener('input', () => {
            this.updateStats();
            this.saveTextDraft();
            this.updateEditorOverlay();
        });

        // Автосохранение при закрытии
        window.addEventListener('beforeunload', () => this.saveSettings());
    }

    handleHotkeys(e) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            switch(e.key) {
                case '1':
                    e.preventDefault();
                    this.startRecording();
                    break;
                case '2':
                    e.preventDefault();
                    this.stopRecording();
                    break;
                case 'c':
                    if (document.activeElement !== this.output) {
                        e.preventDefault();
                        this.copyToClipboard();
                    }
                    break;
                case 'Delete':
                    e.preventDefault();
                    this.clearText();
                    break;
                case 'b':
                    e.preventDefault();
                    this.executeCommand('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.executeCommand('italic');
                    break;
                case 'u':
                    e.preventDefault();
                    this.executeCommand('underline');
                    break;
                case '9':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.closePanel();
                    }
                    break;
            }
        }
    }

    executeCommand(command) {
        this.output.focus();
        document.execCommand(command, false, null);
        this.updateStats();
    }

    async checkMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });
            
            stream.getTracks().forEach(track => track.stop());
            this.microphoneAccessGranted = true;
            this.hideInstructions();
            return true;
            
        } catch (error) {
            console.error('Microphone error:', error);
            this.microphoneAccessGranted = false;
            
            if (error.name === 'NotAllowedError') {
                this.showError('Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.', true);
            } else {
                this.showError(`Ошибка микрофона: ${error.message}`);
            }
            return false;
        }
    }

    checkBrowserSupport() {
        if (!('webkitSpeechRecognition' in window)) {
            this.showError('Браузер не поддерживает распознавание речи. Используйте Chrome или Edge.');
            this.startBtn.disabled = true;
            return false;
        }
        return true;
    }

    initializeRecognition() {
        try {
            const SpeechRecognition = window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = this.languageSelect.value;
            this.recognition.maxAlternatives = 3;

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.recordingStartTime = Date.now();
                this.startRecordingTimer();
                this.updateUI();
                this.showStatus('Идет запись... Говорите четко', 'recording');
                this.updateEditorOverlay();
            };

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalSegment = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    
                    if (event.results[i].isFinal) {
                        finalSegment += this.processPunctuation(transcript);
                        this.finalTranscript += finalSegment + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const displayText = this.finalTranscript + interimTranscript;
                this.output.value = displayText;
                this.updateStats();
                this.updateEditorOverlay();
                this.output.scrollTop = this.output.scrollHeight;
            };

            this.recognition.onerror = (event) => {
                console.error('Recognition error:', event.error);
                
                if (event.error === 'not-allowed') {
                    this.showError('Доступ к микрофону запрещен', true);
                } else if (event.error === 'no-speech') {
                    this.showStatus('Речь не обнаружена. Продолжайте говорить...', 'warning');
                    return;
                } else {
                    this.showError(`Ошибка распознавания: ${event.error}`);
                }
                
                this.stopRecording();
            };

            this.recognition.onend = () => {
                if (this.isRecording) {
                    setTimeout(() => {
                        if (this.isRecording && this.recognition) {
                            try {
                                this.recognition.start();
                            } catch (error) {
                                console.error('Restart error:', error);
                            }
                        }
                    }, 100);
                }
            };

            return true;
        } catch (error) {
            this.showError(`Ошибка инициализации: ${error.message}`);
            return false;
        }
    }

    processPunctuation(text) {
        if (this.autoPunctuationLevel === 'off') return text;

        let processed = text
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*\.\s*/g, '. ')
            .replace(/\s*\?\s*/g, '? ')
            .replace(/\s*!\s*/g, '! ');

        if (this.autoPunctuationLevel === 'high') {
            processed = processed
                .replace(/([.!?])\s+([а-яa-z])/g, (match, p1, p2) => 
                    `${p1} ${p2.toUpperCase()}`)
                .replace(/\b(но|а|и|или|что|который|где|когда)\b/gi, ', $1')
                .replace(/, ,/g, ',');
        }

        // Капитализация первого символа
        if (processed.length > 0) {
            processed = processed.charAt(0).toUpperCase() + processed.slice(1);
        }

        return processed.trim();
    }

    async startRecording() {
        if (this.isRecording) return;

        if (!this.microphoneAccessGranted) {
            const hasAccess = await this.checkMicrophonePermission();
            if (!hasAccess) return;
        }

        try {
            if (!this.recognition && !this.initializeRecognition()) {
                return;
            }

            this.finalTranscript = this.output.value || '';
            this.recognition.lang = this.languageSelect.value;
            
            setTimeout(() => {
                try {
                    this.recognition.start();
                } catch (error) {
                    this.showError(`Ошибка запуска: ${error.message}`);
                }
            }, 300);
            
            this.saveSettings();
            this.hideInstructions();
            
        } catch (error) {
            this.showError(`Не удалось начать запись: ${error.message}`);
        }
    }
    async startRecording() {
    if (this.isRecording) return;

    if (!this.microphoneAccessGranted) {
        const hasAccess = await this.checkMicrophonePermission();
        if (!hasAccess) return;
    }

    try {
        // Сброс предыдущего распознавания
        if (this.recognition) {
            this.recognition.onend = null;
            this.recognition.stop();
        }

        if (!this.initializeRecognition()) {
            return;
        }

        this.finalTranscript = this.output.value || '';
        this.recognition.lang = this.languageSelect.value;
        
        // Небольшая задержка для стабильности
        await new Promise(resolve => setTimeout(resolve, 300));
        
        this.recognition.start();
        this.saveSettings();
        this.hideInstructions();
        
    } catch (error) {
        console.error('Ошибка запуска записи:', error);
        this.showError(`Не удалось начать запись: ${error.message}`);
        
        // Попытка восстановления
        if (this.isRecording) {
            setTimeout(() => {
                if (this.isRecording) {
                    this.recognition.start();
                }
            }, 1000);
        }
    }
}

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.isRecording = false;
            this.recognition.stop();
            this.recognition = null;
            this.stopRecordingTimer();
            this.updateUI();
            this.showStatus('Запись остановлена', 'success');
            this.updateEditorOverlay();
        }
    }

    startRecordingTimer() {
        this.stopRecordingTimer();
        this.recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.timeCount.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    copyToClipboard() {
        if (!this.output.value.trim()) {
            this.showStatus('Нет текста для копирования', 'warning');
            return;
        }

        navigator.clipboard.writeText(this.output.value)
            .then(() => {
                this.showStatus('Текст скопирован в буфер обмена', 'success');
            })
            .catch(err => {
                this.showError('Ошибка копирования: ' + err);
            });
    }

    clearText() {
        if (this.output.value.trim()) {
            if (confirm('Очистить весь текст?')) {
                this.output.value = '';
                this.finalTranscript = '';
                this.updateStats();
                this.updateEditorOverlay();
                this.showStatus('Текст очищен', 'info');
            }
        }
    }

    closePanel() {
        this.saveSettings();
        chrome.runtime.sendMessage({action: "closeSidePanel"});
    }

    toggleSpellCheck() {
        this.spellCheckEnabled = !this.spellCheckEnabled;
        this.output.spellcheck = this.spellCheckEnabled;
        this.spellCheckBtn.classList.toggle('active', this.spellCheckEnabled);
        
        this.showStatus(
            this.spellCheckEnabled ? 'Проверка орфографии включена' : 'Проверка орфографии выключена',
            'info'
        );
    }

    setupSpellCheck() {
        // Базовая реализация проверки орфографии
        this.output.addEventListener('click', (e) => {
            if (!this.spellCheckEnabled) return;
        });
    }

    formatText() {
        let text = this.output.value;
        
        if (!text.trim()) {
            this.showStatus('Нет текста для форматирования', 'warning');
            return;
        }

        text = text
            .replace(/\s+/g, ' ')
            .replace(/([.!?])\s*/g, '$1 ')
            .replace(/\s*([,;:])\s*/g, '$1 ')
            .replace(/(\s)\.\s*\.\s*\./g, '$1...')
            .replace(/([.!?])\s+([а-яa-z])/g, (match, p1, p2) => 
                `${p1} ${p2.toUpperCase()}`)
            .trim();

        if (text.length > 0) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }

        this.output.value = text;
        this.updateStats();
        this.showStatus('Текст отформатирован', 'success');
    }

    autoPunctuate() {
        let text = this.output.value;
        
        if (!text.trim()) {
            this.showStatus('Нет текста для расстановки знаков препинания', 'warning');
            return;
        }

        const sentences = text.split(/(?<=[.!?])\s+/);
        const punctuated = sentences.map(sentence => {
            if (sentence.length === 0) return '';
            
            let result = sentence.trim();
            
            if (!/[.!?]$/.test(result)) {
                if (result.toLowerCase().includes('?')) {
                    result += '?';
                } else if (result.toLowerCase().includes('!')) {
                    result += '!';
                } else {
                    result += '.';
                }
            }
            
            return result.charAt(0).toUpperCase() + result.slice(1);
        }).join(' ');

        this.output.value = punctuated;
        this.updateStats();
        this.showStatus('Знаки препинания расставлены', 'success');
    }

    updateStats() {
        const text = this.output.value;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const characters = text.length;
        
        this.wordCount.textContent = `${words} слов`;
        this.charCount.textContent = `${characters} симв.`;
        this.sessionStats.innerHTML = `<span>Сессия: ${words} слов</span>`;
    }

    updateEditorOverlay() {
        if (this.output.value.trim()) {
            this.editorOverlay.classList.add('hidden');
        } else {
            this.editorOverlay.classList.remove('hidden');
        }
    }

    updateUI() {
        this.startBtn.disabled = this.isRecording;
        this.stopBtn.disabled = !this.isRecording;
        
        if (this.isRecording) {
            this.recordingTime.style.display = 'flex';
            this.statusCard.classList.add('recording');
        } else {
            this.recordingTime.style.display = 'none';
            this.statusCard.classList.remove('recording');
        }
    }

    showError(message, showInstructions = false) {
        this.status.textContent = message;
        this.statusCard.classList.add('error');
        this.isRecording = false;
        this.updateUI();
        
        if (showInstructions) {
            this.showInstructions();
        }
        
        setTimeout(() => {
            this.statusCard.classList.remove('error');
        }, 5000);
    }

    showStatus(message, type = 'info') {
        this.status.textContent = message;
        
        // Убираем все классы статусов
        this.statusCard.classList.remove('recording', 'success', 'warning', 'error');
        
        if (type !== 'info') {
            this.statusCard.classList.add(type);
        }
        
        if (type !== 'recording') {
            setTimeout(() => {
                if (!this.isRecording) {
                    this.statusCard.classList.remove(type);
                    this.status.textContent = 'Готов к записи';
                }
            }, 3000);
        }
    }

    showInstructions() {
        this.instructions.style.display = 'block';
    }

    hideInstructions() {
        this.instructions.style.display = 'none';
    }

    saveSettings() {
        const settings = {
            language: this.languageSelect.value,
            autoPunctuation: this.autoPunctuationSelect.value,
            textDraft: this.output.value
        };
        chrome.storage.local.set(settings);
    }

    saveTextDraft() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            chrome.storage.local.set({ textDraft: this.output.value });
        }, 2000);
    }

    loadSavedSettings() {
        chrome.storage.local.get(['language', 'autoPunctuation', 'textDraft'], (result) => {
            if (result.language) {
                this.languageSelect.value = result.language;
            }
            if (result.autoPunctuation) {
                this.autoPunctuationSelect.value = result.autoPunctuation;
                this.autoPunctuationLevel = result.autoPunctuation;
            }
            if (result.textDraft) {
                this.output.value = result.textDraft;
                this.finalTranscript = result.textDraft;
                this.updateStats();
                this.updateEditorOverlay();
            }
        });
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    new SpeechToTextPro();
});

// Обработка сообщений от background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startRecording") {
        const stt = new SpeechToTextPro();
        stt.startRecording();
    } else if (request.action === "stopRecording") {
        const stt = new SpeechToTextPro();
        stt.stopRecording();
    }
});