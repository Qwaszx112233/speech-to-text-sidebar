// Фоновый скрипт для управления расширением
chrome.runtime.onInstalled.addListener(() => {
    console.log('Голос в Текст Pro установлен');
    
    // Создаем контекстное меню
    chrome.contextMenus.create({
        id: "voiceToText",
        title: "Голос в Текст",
        contexts: ["editable", "selection"]
    });

    // Устанавливаем боковую панель по умолчанию
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch(error => console.log('Side panel error:', error));
});

// Обработка горячих клавиш
chrome.commands.onCommand.addListener((command) => {
    if (command === "start_recording") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "startRecording"})
                    .catch(error => console.log('Start recording error:', error));
            }
        });
    } else if (command === "stop_recording") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "stopRecording"})
                    .catch(error => console.log('Stop recording error:', error));
            }
        });
    } else if (command === "toggle_side_panel") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.sidePanel.open({ tabId: tabs[0].id })
                    .catch(error => console.log('Toggle side panel error:', error));
            }
        });
    }
});

// Обработка контекстного меню
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "voiceToText") {
        chrome.sidePanel.open({ tabId: tab.id })
            .catch(error => console.log('Context menu error:', error));
    }
});

// Обработка клика по иконке расширения
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id })
        .catch(error => console.log('Action click error:', error));
});

// Обработка сообщений от sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "closeSidePanel") {
        if (sender.tab) {
            chrome.sidePanel.setOptions({
                tabId: sender.tab.id,
                enabled: false
            }).catch(error => console.log('Close side panel error:', error));
        }
    }
});

// Уведомления о состоянии
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "voiceToText") {
        port.onMessage.addListener((msg) => {
            if (msg.type === "recordingStarted") {
                chrome.notifications.create({
                    type: "basic",
                    iconUrl: "icons/icon48.png",
                    title: "Голос в Текст Pro",
                    message: "Запись начата"
                });
            }
        });
    }
});

// Автоматическое открытие боковой панели на определенных сайтах
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === 'complete' && tab.url) {
        const allowedSites = [
            'docs.google.com',
            'notion.so',
            'figma.com',
            'miro.com',
            'chat.openai.com',
            'discord.com'
        ];
        
        if (allowedSites.some(site => tab.url.includes(site))) {
            chrome.sidePanel.setOptions({
                tabId,
                path: 'sidepanel.html',
                enabled: true
            }).catch(error => console.log('Auto-open error:', error));
        }
    }
});