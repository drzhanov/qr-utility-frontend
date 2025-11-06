import React, { useState, useEffect, useRef, useMemo } from 'react';

// Використовуємо стандартні імена модулів для Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// --- Конфігурація ---
const API_BASE_URL = 'https://qr-utility-api.onrender.com';
const MONOBANK_DEFAULT_URL = 'https://send.monobank.ua/jar/'; // Приклад
const DEFAULT_LOGO_URL = 'https://placehold.co/100x100/1e293b/ffffff?text=LOGO';
const SHORT_LINK_DOMAIN = 'https://toolboxtech.site'; // ✨ ТВІЙ ДОМЕН для відображення

// --- Хук Debounce для плавного введення тексту (Fix UX) ---
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

// --- Утиліти Firebase ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

let db = null;
let auth = null;

const setupFirebase = async () => {
    try {
        // Запобігаємо повторній ініціалізації
        if (db && auth) return true;

        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Встановлюємо автентифікацію
        if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        return true;
    } catch (error) {
        console.error("Firebase setup failed:", error);
        return false;
    }
};

const logDownload = async (qrData) => {
    if (!db || !auth || !auth.currentUser) {
        console.error("Firebase or user not authenticated for logging. Skipping log.");
        return;
    }
    
    const userId = auth.currentUser.uid;
    // Шлях для приватних логів користувача
    const logCollectionPath = `/artifacts/${appId}/users/${userId}/download_logs`;

    try {
        await addDoc(collection(db, logCollectionPath), {
            userId: userId,
            data: qrData,
            type: qrData.contentType,
            timestamp: serverTimestamp(),
            appContext: 'QR Generator MVP'
        });
        console.log("Download log saved to Firestore successfully.");
    } catch (error) {
        console.error("Failed to save download log to Firestore:", error);
    }
};

// --- Компоненти полів введення (винесені окремо для стабільності) ---
const InputFields = React.memo(({ 
    contentType, 
    targetUrlInput, 
    setTargetUrlInput, 
    customCode, 
    setCustomCode,
    shortUrl,
    shortLinkError,
    isShortening,
    handleShorten,
    MONOBANK_DEFAULT_URL,
    API_BASE_URL,
    SHORT_LINK_DOMAIN // ✨ НОВИЙ PROP
}) => {
    const placeholderMap = {
        'URL': 'https://google.com',
        'Text': 'Тут може бути будь-який текст...',
        'Email': 'mail@example.com',
        'Phone': '+380991234567',
        'Monobank': 'введіть ID вашої банки (наприклад, 4tVp)',
        'ShortLink': 'https://дуже-довге-посилання.com/бла-бла',
    };

    if (contentType === 'ShortLink') {
        return (
            <>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        1. Оригінальне посилання (Target URL)
                    </label>
                    <input
                        type="url"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                        placeholder={placeholderMap[contentType]}
                        value={targetUrlInput}
                        onChange={(e) => setTargetUrlInput(e.target.value)}
                        disabled={isShortening}
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        2. Власний код (опціонально)
                    </label>
                    <input
                        type="text"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                        placeholder="Наприклад: my-great-link"
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                        disabled={isShortening}
                    />
                </div>
                {/* ✨ ЗМІНЕНО: Відображення твого домену */}
                <div className="mb-4">
                    <p className="block text-sm font-medium text-gray-700 mb-1">
                        3. Короткий URL для кодування:
                        <span className="ml-2 font-mono text-xs text-blue-600 bg-blue-50 p-1 rounded-md break-all">
                            {shortUrl.includes(API_BASE_URL) 
                                ? shortUrl.replace(API_BASE_URL, SHORT_LINK_DOMAIN) 
                                : shortUrl || SHORT_LINK_DOMAIN 
                            }
                        </span>
                    </p>
                    {shortLinkError && (
                        <div className={`mt-2 p-2 text-sm rounded-lg ${shortLinkError.includes('Успіх') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {shortLinkError}
                        </div>
                    )}
                </div>
                <button
                    onClick={handleShorten}
                    className={`w-full py-3 mt-2 rounded-lg font-semibold shadow-lg transition duration-300 ${isShortening
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200/50'
                        }`}
                    disabled={isShortening || !targetUrlInput}
                >
                    {isShortening ? 'Скорочуємо...' : 'Скоротити посилання'}
                </button>
                <p className="mt-4 text-xs text-gray-500 text-center">
                    Ваші короткі посилання працюватимуть на **{SHORT_LINK_DOMAIN}**
                </p>
            </>
        );
    }

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Введіть дані ({contentType})
            </label>
            <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                placeholder={placeholderMap[contentType]}
                value={targetUrlInput}
                onChange={(e) => setTargetUrlInput(e.target.value)}
            />
            <p className="mt-2 text-xs text-gray-500">
                {contentType === 'Monobank' && `Повний URL: ${MONOBANK_DEFAULT_URL}${targetUrlInput}`}
            </p>
        </div>
    );
});

// --- Компонент налаштувань дизайну (для стабільності) ---
const DesignOptions = React.memo(({ qrOptions, setQrOptions }) => (
    <div className="space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Налаштування Дизайну</h3>

        {/* Колір точок */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Колір точок</label>
            <input
                type="color"
                value={qrOptions.dotsColor}
                onChange={(e) => setQrOptions(prev => ({ ...prev, dotsColor: e.target.value }))}
                className="w-12 h-10 p-1 border border-gray-300 rounded-lg cursor-pointer"
            />
        </div>

        {/* Колір фону */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Колір фону</label>
            <input
                type="color"
                value={qrOptions.bgColor}
                onChange={(e) => setQrOptions(prev => ({ ...prev, bgColor: e.target.value }))}
                className="w-12 h-10 p-1 border border-gray-300 rounded-lg cursor-pointer"
            />
        </div>

        {/* Стиль точок */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Стиль точок</label>
            <div className="flex flex-wrap gap-2">
                {['square', 'dots', 'rounded', 'classy'].map(type => (
                    <button
                        key={type}
                        onClick={() => setQrOptions(prev => ({ ...prev, dotsType: type }))}
                        className={`px-3 py-1 text-sm rounded-full transition duration-150 ${qrOptions.dotsType === type
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                ))}
            </div>
        </div>

        {/* Логотип */}
        <div>
            <label className="inline-flex items-center">
                <input
                    type="checkbox"
                    checked={qrOptions.hasLogo}
                    onChange={(e) => setQrOptions(prev => ({ ...prev, hasLogo: e.target.checked }))}
                    className="form-checkbox h-5 w-5 text-blue-600 rounded"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Додати логотип (ToolboxTech)</span>
            </label>
            {qrOptions.hasLogo && (
                <p className="mt-1 text-xs text-gray-500">
                    Використовується логотип-плейсхолдер.
                </p>
            )}
        </div>
    </div>
));

// --- Основний Компонент Додатку ---
export default function App() {
    const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
    const [isFirebaseReady, setIsFirebaseReady] = useState(false);
    const [qrCodeInstance, setQrCodeInstance] = useState(null);

    // --- Стан Введення (для плавного UX) ---
    const [targetUrlInput, setTargetUrlInput] = useState('');
    const debouncedTargetUrl = useDebounce(targetUrlInput, 300); // Затримка 300мс

    // --- Стан QR-коду ---
    const [content, setContent] = useState('');
    const [contentType, setContentType] = useState('URL');
    const [qrOptions, setQrOptions] = useState({
        dotsColor: '#1e293b',
        bgColor: '#ffffff',
        dotsType: 'square',
        image: DEFAULT_LOGO_URL,
        hasLogo: false,
    });
    
    // --- Стан ShortLink ---
    const [customCode, setCustomCode] = useState('');
    const [shortUrl, setShortUrl] = useState('');
    const [shortLinkError, setShortLinkError] = useState('');
    const [isShortening, setIsShortening] = useState(false);

    // Контейнер для QR-коду
    const qrRef = useRef(null);

    // 1. Динамічне завантаження бібліотеки QRCodeStyling та Firebase
    useEffect(() => {
        // Firebase Setup
        setupFirebase().then(setIsFirebaseReady);

        // QRCodeStyling Load
        const scriptId = 'qrcode-styling-script';
        if (document.getElementById(scriptId)) {
            setIsLibraryLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        // Використовуємо надійний CDN
        script.src = 'https://cdn.jsdelivr.net/npm/qr-code-styling@1.5.0/lib/qr-code-styling.js'; 
        script.onload = () => {
            setIsLibraryLoaded(true);
        };
        script.onerror = () => {
            console.error("Failed to load QRCodeStyling script.");
        };
        document.head.appendChild(script);
        
        // Очищення скрипта при розмонтуванні (хоча в цьому середовищі це не критично)
        return () => {
            document.head.removeChild(script);
            setQrCodeInstance(null); // Очищаємо інстанс
        }
    }, []);

    // 2. Логіка обробки даних контенту (залежить від debouncedTargetUrl)
    useEffect(() => {
        let newContent = '';
        setShortLinkError('');
        
        if (contentType !== 'ShortLink') {
            setShortUrl(''); 
        }

        const currentTarget = debouncedTargetUrl;

        switch (contentType) {
            case 'URL':
                newContent = currentTarget.startsWith('http') ? currentTarget : (currentTarget ? `https://${currentTarget}` : SHORT_LINK_DOMAIN); // ✨ ВИКОРИСТОВУЄМО ТВІЙ ДОМЕН
                break;
            case 'Text':
                newContent = currentTarget || 'QR Generator MVP';
                break;
            case 'Email':
                newContent = `mailto:${currentTarget}`;
                break;
            case 'Phone':
                newContent = `tel:${currentTarget.replace(/\s/g, '')}`;
                break;
            case 'Monobank':
                // Монобанк: очікує лише ID банки
                newContent = currentTarget ? `${MONOBANK_DEFAULT_URL}${currentTarget}` : 'https://send.monobank.ua/';
                break;
            case 'ShortLink':
                // Показуємо скорочене посилання (замінюємо Render на твій домен для QR)
                newContent = shortUrl 
                    ? shortUrl.replace(API_BASE_URL, SHORT_LINK_DOMAIN) 
                    : SHORT_LINK_DOMAIN; 
                break;
            default:
                newContent = SHORT_LINK_DOMAIN; // ✨ ВИКОРИСТОВУЄМО ТВІЙ ДОМЕН
        }
        setContent(newContent);
    }, [contentType, debouncedTargetUrl, shortUrl]);

    // 3. Функція генерації QR-коду (оптимізовано)
    const qrCodeOptions = useMemo(() => ({
        width: 300,
        height: 300,
        type: "svg",
        data: content,
        image: qrOptions.hasLogo ? DEFAULT_LOGO_URL : undefined, // Використовуємо DEFAULT_LOGO_URL
        dotsOptions: {
            color: qrOptions.dotsColor,
            type: qrOptions.dotsType,
        },
        backgroundOptions: {
            color: qrOptions.bgColor,
        },
        imageOptions: {
            crossOrigin: "anonymous",
            margin: 5,
        },
    }), [content, qrOptions]);


    // 4. Оновлення QR-коду в DOM
    useEffect(() => {
        if (!isLibraryLoaded || !window.QRCodeStyling || !qrRef.current) return;

        if (!qrCodeInstance) {
            // Створення нового інстансу
            const newQrCode = new window.QRCodeStyling(qrCodeOptions);
            newQrCode.append(qrRef.current);
            setQrCodeInstance(newQrCode);
        } else {
            // Оновлення існуючого інстансу
            qrCodeInstance.update(qrCodeOptions);
        }
        
    }, [isLibraryLoaded, qrCodeOptions, qrCodeInstance]);


    // --- Обробники ---

    const handleShorten = async () => {
        // Використовуємо актуальне значення з поля введення
        const currentTargetUrl = targetUrlInput.startsWith('http') ? targetUrlInput : `https://${targetUrlInput}`;

        if (!currentTargetUrl.startsWith('http')) {
            setShortLinkError("Будь ласка, введіть повне посилання, включаючи http:// або https://");
            return;
        }
        setIsShortening(true);
        setShortLinkError('');
        setShortUrl('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/shorten`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_url: currentTargetUrl,
                    custom_code: customCode || null
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                setShortLinkError(`Помилка API: ${errorData.detail || response.statusText}`);
                return;
            }

            const data = await response.json();
            setShortUrl(data.short_url); // Тут повертається URL від Render
            setShortLinkError("Успіх! Коротке посилання згенеровано.");

        } catch (error) {
            console.error("ShortLink API Call Failed:", error);
            setShortLinkError("Помилка зв'язку з бекендом Render. Перевірте консоль.");
        } finally {
            setIsShortening(false);
        }
    };

    const handleDownload = async (fileType) => {
        if (qrCodeInstance) {
            try {
                // Виклик методу завантаження
                await qrCodeInstance.download({
                    name: `qr_code_${contentType.toLowerCase()}`,
                    extension: fileType,
                });

                // Логування завантаження
                await logDownload({
                    contentType: contentType,
                    contentValue: content,
                    timestamp: new Date().toISOString(),
                });

            } catch (error) {
                console.error("Download failed:", error);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .qr-container > svg, .qr-container > canvas {
                    border-radius: 0.75rem; /* rounded-xl */
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                }
            `}</style>
            
            <header className="bg-white shadow-md p-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">
                        <span className="text-blue-600">QR</span> Uti.li <span className="text-sm font-normal text-gray-500">MVP</span>
                    </h1>
                    <p className="text-sm text-gray-600">
                        {isFirebaseReady ? "🟢 Live (Auth Ready)" : "🟡 Loading Auth..."}
                    </p>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* ЛІВА КОЛОНКА: Налаштування */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* 1. Вибір типу QR-коду */}
                        <div className="p-6 bg-white rounded-xl shadow-lg">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Виберіть тип QR-коду</h2>
                            <div className="flex flex-wrap gap-3">
                                {['URL', 'Text', 'Email', 'Phone', 'Monobank', 'ShortLink'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setContentType(type)}
                                        className={`px-4 py-2 rounded-lg font-medium transition duration-200 shadow-md
                                            ${contentType === type
                                                ? 'bg-blue-600 text-white shadow-blue-300/50'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }
                                        `}
                                    >
                                        {type === 'ShortLink' ? 'Коротке посилання (API)' : type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Введення даних */}
                        <div className="p-6 bg-white rounded-xl shadow-lg">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Введіть дані</h2>
                            <InputFields 
                                contentType={contentType}
                                targetUrlInput={targetUrlInput}
                                setTargetUrlInput={setTargetUrlInput}
                                customCode={customCode}
                                setCustomCode={setCustomCode}
                                shortUrl={shortUrl}
                                shortLinkError={shortLinkError}
                                isShortening={isShortening}
                                handleShorten={handleShorten}
                                MONOBANK_DEFAULT_URL={MONOBANK_DEFAULT_URL}
                                API_BASE_URL={API_BASE_URL}
                                SHORT_LINK_DOMAIN={SHORT_LINK_DOMAIN} // ✨ ПЕРЕДАЧА PROP
                            />
                        </div>

                        {/* 3. Налаштування дизайну */}
                        <DesignOptions qrOptions={qrOptions} setQrOptions={setQrOptions} />
                    </div>

                    {/* ПРАВА КОЛОНКА: Попередній перегляд та Завантаження */}
                    <div className="lg:col-span-1 flex flex-col items-center space-y-6 lg:sticky lg:top-20 h-fit p-6 bg-white rounded-xl shadow-lg">
                        
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 w-full text-center">Попередній перегляд</h2>
                        <div className="qr-container pt-4 pb-4" ref={qrRef}>
                            {/* Сюди буде вбудовано QR-код */}
                            {!isLibraryLoaded && (
                                <div className="w-72 h-72 bg-gray-100 flex items-center justify-center rounded-xl animate-pulse">
                                    <p className="text-gray-500 text-sm">Завантаження генератора...</p>
                                </div>
                            )}
                        </div>

                        <div className="w-full space-y-4 pt-4 border-t border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 text-center">Завантажити</h3>
                            
                            <div className="flex justify-center space-x-4">
                                <button
                                    onClick={() => handleDownload('png')}
                                    className="flex-1 py-3 px-4 rounded-lg font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition duration-150 shadow-md flex items-center justify-center"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z" /></svg>
                                    .PNG
                                </button>
                                <button
                                    onClick={() => handleDownload('svg')}
                                    className="flex-1 py-3 px-4 rounded-lg font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition duration-150 shadow-md flex items-center justify-center"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V6h2v6z" clipRule="evenodd" /></svg>
                                    .SVG
                                </button>
                            </div>
                            
                            <button
                                onClick={() => handleDownload('png')}
                                className="w-full py-3 mt-4 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition duration-200 shadow-xl shadow-indigo-300/50 flex items-center justify-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                Завантажити .PNG
                            </button>
                            <p className="mt-2 text-xs text-gray-500 text-center">
                                Файли PNG та SVG забезпечують високу якість. Логування відбувається автоматично.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
