import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Star, PlayCircle, BookOpen, Monitor, Shield, Moon, Sun, BrainCircuit, Mic } from 'lucide-react';
import appLogo from './assets/humanforge-adaptive-icon.png';


// Excalidraw-style hand-drawn math & science background — SPREAD & MIXED OPACITY
function BackgroundDiagram({ isDark }: { isDark: boolean }) {
    const boldColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.09)';
    const lightColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';

    const boldAccent = isDark ? 'rgba(217,119,87,0.35)' : 'rgba(217,119,87,0.2)';
    const lightAccent = isDark ? 'rgba(217,119,87,0.12)' : 'rgba(217,119,87,0.06)';

    const boldText = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
    const lightText = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';

    return (
        <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            {/* ====== SPREAD MATHEMATICAL EQUATIONS ====== */}

            {/* Bold Text (Foreground) */}
            <text x="80" y="150" fill={boldText} fontSize="20" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(-8, 80, 150)" className="animate-float" style={{ animationDelay: '0s' }}>E = mc²</text>
            <text x="1250" y="100" fill={boldText} fontSize="18" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(5, 1250, 100)" className="animate-float" style={{ animationDelay: '1s' }}>∫ f(x)dx</text>
            <text x="250" y="700" fill={boldText} fontSize="17" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(-3, 250, 700)" className="animate-float" style={{ animationDelay: '2s' }}>Σ n=1 to ∞</text>
            <text x="1100" y="750" fill={boldText} fontSize="19" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(7, 1100, 750)" className="animate-float" style={{ animationDelay: '0.5s' }}>∇ × B = μ₀J</text>
            <text x="60" y="480" fill={boldText} fontSize="18" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(3, 60, 480)">πr²</text>
            <text x="850" y="120" fill={boldText} fontSize="16" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(-10, 850, 120)">a² + b² = c²</text>

            {/* Light Text (Background Depth) */}
            <text x="350" y="220" fill={lightText} fontSize="16" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(-5, 350, 220)">F = ma</text>
            <text x="1300" y="450" fill={lightText} fontSize="17" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(-6, 1300, 450)">sin²θ + cos²θ = 1</text>
            <text x="700" y="850" fill={lightText} fontSize="16" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(4, 700, 850)">ΔG = ΔH - TΔS</text>
            <text x="1050" y="150" fill={lightText} fontSize="15" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(-4, 1050, 150)">PV = nRT</text>
            <text x="450" y="100" fill={lightText} fontSize="15" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(-2, 450, 100)">λ = h/p</text>
            <text x="150" y="320" fill={lightText} fontSize="14" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(6, 150, 320)">dy/dx</text>
            <text x="500" y="800" fill={lightText} fontSize="14" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(-5, 500, 800)">H₂O → H⁺ + OH⁻</text>
            <text x="1350" y="600" fill={lightText} fontSize="16" fontFamily="'Virgil', 'Segoe Print', cursive" transform="rotate(8, 1350, 600)">lim(x→0)</text>

            {/* ====== GEOMETRIC & SCIENTIFIC SHAPES ====== */}

            {/* Bold Shapes */}
            <path d="M120 560 L155 500 L190 560 Z" stroke={boldColor} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
            <rect x="40" y="800" width="35" height="35" stroke={boldColor} strokeWidth="2" fill="none" rx="2" transform="rotate(12, 57, 817)" />
            <path d="M1200 620 L1260 590" stroke={boldColor} strokeWidth="2" strokeLinecap="round" />
            <path d="M1255 595 L1260 590 L1252 587" stroke={boldColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* Light Shapes */}
            <circle cx="1350" cy="280" r="25" stroke={lightColor} strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
            <path d="M300 800 C320 780, 340 820, 360 800 C380 780, 400 820, 420 800 C440 780, 460 820, 480 800" stroke={lightColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M550 720 L550 660 M550 720 L620 720" stroke={lightColor} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M555 710 Q570 680 590 690 Q605 700 615 680" stroke={lightAccent} strokeWidth="1.5" fill="none" strokeLinecap="round" />

            {/* DNA Helix Sketch - Light */}
            <path d="M850 500 Q870 520 850 540 Q830 560 850 580 Q870 600 850 620" stroke={lightColor} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M850 500 Q830 520 850 540 Q870 560 850 580 Q830 600 850 620" stroke={lightAccent} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M850 510 L860 510 M840 530 L850 530 M850 550 L860 550 M840 570 L850 570 M850 590 L860 590 M840 610 L850 610" stroke={lightColor} strokeWidth="1" opacity="0.5" />

            {/* Benzene ring - Bold */}
            <g transform="translate(1320, 680)">
                <path d="M0 -15 L20 -30 L40 -15 L40 10 L20 25 L0 10 Z" stroke={boldColor} strokeWidth="1.8" fill="none" />
                <circle cx="20" cy="-3" r="12" stroke={boldColor} strokeWidth="1.2" fill="none" />
            </g>

            {/* Atom orbits - Light */}
            <g transform="translate(100, 870)">
                <ellipse cx="0" cy="0" rx="35" ry="14" stroke={lightColor} strokeWidth="1.5" fill="none" transform="rotate(-30)" />
                <ellipse cx="0" cy="0" rx="35" ry="14" stroke={lightColor} strokeWidth="1.5" fill="none" transform="rotate(30)" />
                <circle cx="0" cy="0" r="4" fill={lightAccent} />
            </g>
            <g transform="translate(900, 300) scale(0.7)">
                <ellipse cx="0" cy="0" rx="35" ry="14" stroke={boldColor} strokeWidth="1.5" fill="none" transform="rotate(-40)" />
                <ellipse cx="0" cy="0" rx="35" ry="14" stroke={boldColor} strokeWidth="1.5" fill="none" transform="rotate(40)" />
                <circle cx="0" cy="0" r="4" fill={boldAccent} />
            </g>

            {/* Open Book Sketch - Light */}
            <g transform="translate(680, 250) scale(0.8)">
                <path d="M0 35 C22 28, 45 25, 60 22 L60 0 C45 3, 22 6, 0 12 Z" stroke={lightColor} strokeWidth="1.8" fill="none" />
                <path d="M120 35 C98 28, 75 25, 60 22 L60 0 C75 3, 98 6, 120 12 Z" stroke={lightColor} strokeWidth="1.8" fill="none" />
                <line x1="68" y1="6" x2="110" y2="14" stroke={lightColor} strokeWidth="0.8" />
                <line x1="68" y1="12" x2="106" y2="18" stroke={lightColor} strokeWidth="0.8" />
            </g>

            {/* Neuron connections - Mixed */}
            <path d="M80 280 Q120 250 140 290 Q160 330 200 300" stroke={boldAccent} strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M1150 250 Q1180 220 1220 240 Q1250 260 1280 230" stroke={lightAccent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="5 5" />

            <circle cx="30" cy="300" r="5" stroke={boldAccent} strokeWidth="1.8" fill="none" />
            <circle cx="60" cy="270" r="4" stroke={boldAccent} strokeWidth="1.2" fill="none" />
            <path d="M34 297 L57 273" stroke={boldAccent} strokeWidth="1" strokeDasharray="3 3" />

            {/* ====== DOTS & PARTICLES ====== */}
            <circle cx="280" cy="180" r="3" fill={boldAccent} className="animate-pulse-dot" />
            <circle cx="830" cy="100" r="2.5" fill={boldAccent} className="animate-pulse-dot" style={{ animationDelay: '1s' }} />
            <circle cx="1120" cy="520" r="3" fill={boldAccent} className="animate-pulse-dot" style={{ animationDelay: '2s' }} />
            <circle cx="420" cy="620" r="2.5" fill={lightAccent} />
            <circle cx="670" cy="800" r="3" fill={lightAccent} />
            <circle cx="1420" cy="180" r="3" fill={boldAccent} className="animate-pulse-dot" style={{ animationDelay: '0.5s' }} />
            <circle cx="970" cy="150" r="2.5" fill={lightAccent} />
        </svg>
    );
}

interface LandingPageProps {
    onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.getAttribute('data-theme') === 'dark' ||
                (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const itemVariants: any = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.8, ease: "easeOut" }
        },
    };

    return (
        <div className="relative min-h-screen w-full bg-[#fdfdfc] dark:bg-[#0a0a0a] transition-colors duration-300 overflow-x-hidden selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
            <BackgroundDiagram isDark={isDark} />

            {/* Navbar Minimalist */}
            <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-6 max-w-[1400px] mx-auto">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-xl tracking-tight text-gray-900 dark:text-gray-100 transition-colors" style={{ fontFamily: "Geist, sans-serif" }}>
                        Lumina AI
                    </span>
                </div>
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                        aria-label="Toggle Dark Mode"
                    >
                        {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button onClick={onStart} className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors" style={{ fontFamily: "Geist, sans-serif" }}>
                        Login
                    </button>
                    <button onClick={onStart} className="text-sm font-medium bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors" style={{ fontFamily: "Geist, sans-serif" }}>
                        Sign Up
                    </button>
                </div>
            </nav>

            {/* Hero Content - Split Layout */}
            <div
                className="relative z-10 flex items-center justify-center min-h-screen px-6 lg:px-12"
            >
                <div className="max-w-[1400px] w-full flex flex-col lg:flex-row items-center lg:items-center gap-8 lg:gap-0">
                    {/* Left Side - Text Content */}
                    <motion.div
                        className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left gap-[32px] pt-20 lg:pt-0"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {/* Main Heading */}
                        <motion.h1
                            variants={itemVariants}
                            className="font-medium text-[44px] md:text-[72px] leading-[1.05] tracking-[-0.04em] text-black dark:text-white transition-colors"
                            style={{ fontFamily: "Geist, sans-serif" }}
                        >
                            Lumina — <span className="italic text-[54px] md:text-[90px] tracking-normal font-normal text-black dark:text-white transition-colors" style={{ fontFamily: "'Instrument Serif', serif" }}>Illuminate</span> <br />
                            your learning.
                        </motion.h1>

                        {/* Description */}
                        <motion.p
                            variants={itemVariants}
                            className="text-[17px] text-[#373a46] dark:text-[#a1a1aa] opacity-80 max-w-[480px] leading-relaxed transition-colors"
                            style={{ fontFamily: "Geist, sans-serif" }}
                        >
                            Lumina AI is your intelligent live tutor, featuring interactive screen-sharing, pdf learning, and dynamic canvas rendering.
                        </motion.p>

                        {/* Interactive CTA */}
                        <motion.div
                            variants={itemVariants}
                            className="flex flex-col items-center lg:items-start gap-6 mt-2"
                        >
                            <button
                                onClick={onStart}
                                className="bg-black dark:bg-white text-white dark:text-black font-medium text-lg px-8 py-4 rounded-full shadow-[inset_-4px_-6px_25px_0px_rgba(201,201,201,0.08),inset_4px_4px_10px_0px_rgba(29,29,29,0.24)] dark:shadow-[inset_-4px_-6px_25px_0px_rgba(0,0,0,0.08),inset_4px_4px_10px_0px_rgba(255,255,255,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                                style={{ fontFamily: "Geist, sans-serif" }}
                            >
                                Get Started
                            </button>
                        </motion.div>
                    </motion.div>

                    {/* Right Side - Hand-drawn Illustration + Pythagorean Theorem */}
                    <motion.div
                        className="flex-1 flex items-center justify-center relative"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
                    >
                        <svg viewBox="0 0 500 500" className="w-[420px] h-[420px] md:w-[520px] md:h-[520px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* ===== PYTHAGOREAN THEOREM — animated ===== */}
                            <g transform="translate(130, 60)">
                                {/* Right triangle */}
                                <path
                                    d="M40 240 L40 80 L200 240 Z"
                                    stroke={isDark ? '#e8a388' : '#c96442'}
                                    strokeWidth="2.5"
                                    fill="none"
                                    strokeLinejoin="round"
                                    strokeDasharray="500"
                                    className="animate-draw-triangle"
                                />
                                {/* Right angle marker */}
                                <path d="M40 220 L60 220 L60 240" stroke={isDark ? '#e8a388' : '#c96442'} strokeWidth="1.5" fill="none" />

                                {/* Side labels */}
                                <text x="20" y="165" fill={isDark ? 'white' : 'black'} fontSize="16" fontFamily="'Virgil', 'Segoe Print', cursive" opacity="0.7" fontWeight="bold">a</text>
                                <text x="120" y="260" fill={isDark ? 'white' : 'black'} fontSize="16" fontFamily="'Virgil', 'Segoe Print', cursive" opacity="0.7" fontWeight="bold">b</text>
                                <text x="135" y="150" fill={isDark ? 'white' : 'black'} fontSize="16" fontFamily="'Virgil', 'Segoe Print', cursive" opacity="0.7" fontWeight="bold" transform="rotate(-45, 135, 150)">c</text>

                                {/* Square on side a */}
                                <rect x="-80" y="80" width="120" height="160" rx="2" stroke={isDark ? 'rgba(232,163,136,0.5)' : 'rgba(201,100,66,0.3)'} strokeWidth="1.5" fill={isDark ? 'rgba(232,163,136,0.06)' : 'rgba(201,100,66,0.04)'} className="animate-fill-square" />
                                <text x="-40" y="168" fill={isDark ? '#e8a388' : '#c96442'} fontSize="14" fontFamily="'Virgil', 'Segoe Print', cursive" opacity="0.6" textAnchor="middle">a²</text>

                                {/* Square on side b */}
                                <rect x="40" y="240" width="160" height="120" rx="2" stroke={isDark ? 'rgba(232,163,136,0.5)' : 'rgba(201,100,66,0.3)'} strokeWidth="1.5" fill={isDark ? 'rgba(232,163,136,0.06)' : 'rgba(201,100,66,0.04)'} className="animate-fill-square" style={{ animationDelay: '1s' }} />
                                <text x="120" y="308" fill={isDark ? '#e8a388' : '#c96442'} fontSize="14" fontFamily="'Virgil', 'Segoe Print', cursive" opacity="0.6" textAnchor="middle">b²</text>

                                {/* The formula — bold */}
                                <text x="60" y="30" fill={isDark ? 'white' : 'black'} fontSize="22" fontFamily="'Virgil', 'Segoe Print', cursive" opacity="0.85" fontWeight="bold" className="animate-float">a² + b² = c²</text>
                            </g>

                            {/* ===== LIGHTBULB — bold strokes ===== */}
                            <g className="text-black dark:text-white" transform="translate(20, -10)">
                                <path d="M380 130 C360 130, 340 150, 340 175 C340 195, 352 208, 360 218 C362 222, 363 230, 363 238 L397 238 C397 230, 398 222, 400 218 C408 208, 420 195, 420 175 C420 150, 400 130, 380 130Z" stroke={isDark ? 'white' : 'black'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" fill="none" />
                                <path d="M372 210 C375 195, 378 200, 380 190 C382 200, 385 195, 388 210" stroke="#d97757" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" fill="none" />
                                <rect x="363" y="238" width="34" height="6" rx="2" stroke={isDark ? 'white' : 'black'} strokeWidth="1.5" opacity="0.3" fill="none" />
                                <rect x="366" y="246" width="28" height="4" rx="2" stroke={isDark ? 'white' : 'black'} strokeWidth="1.2" opacity="0.25" fill="none" />

                                {/* Light rays — bold */}
                                <g stroke="#d97757" strokeWidth="2" strokeLinecap="round" opacity="0.5">
                                    <line x1="380" y1="110" x2="380" y2="92" />
                                    <line x1="420" y1="120" x2="435" y2="105" />
                                    <line x1="440" y1="160" x2="455" y2="155" />
                                    <line x1="340" y1="120" x2="325" y2="105" />
                                    <line x1="320" y1="160" x2="305" y2="155" />
                                </g>
                                <circle cx="380" cy="85" r="3" fill="#d97757" opacity="0.5" className="animate-pulse-dot" />
                                <circle cx="440" cy="100" r="2.5" fill="#d97757" opacity="0.4" className="animate-pulse-dot" style={{ animationDelay: '1s' }} />
                                <circle cx="320" cy="100" r="2.5" fill="#d97757" opacity="0.4" className="animate-pulse-dot" style={{ animationDelay: '2s' }} />
                            </g>
                        </svg>
                    </motion.div>
                </div>
            </div>

            {/* Comprehensive Features Page / Section */}
            <div className="relative z-10 w-full bg-white dark:bg-[#0a0a0a] py-32 border-t border-gray-100 dark:border-gray-900 transition-colors duration-300">
                <div className="max-w-[1200px] mx-auto px-6 flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                        className="text-center mb-20"
                    >
                        <h2 className="text-3xl md:text-5xl font-medium text-black dark:text-white mb-6 transition-colors" style={{ fontFamily: "Geist, sans-serif" }}>
                            Everything you need to <span className="italic font-normal" style={{ fontFamily: "'Instrument Serif', serif" }}>accelerate</span> learning
                        </h2>
                        <p className="max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-400 transition-colors" style={{ fontFamily: "Geist, sans-serif" }}>
                            Lumina AI combines the power of Gemini Live API, persistent user memory, and a dynamic Excalidraw canvas to create the ultimate tutoring and management experience.
                        </p>
                    </motion.div>

                    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: <Monitor className="text-black dark:text-white" size={24} />,
                                title: "Live Screen Sharing",
                                description: "Share your screen directly with the AI. Gemini Live visually analyzes your workspace in real-time."
                            },
                            {
                                icon: <BookOpen className="text-black dark:text-white" size={24} />,
                                title: "PDF Deep Learning",
                                description: "Drop any complex research paper into the canvas. Lumina reads, parses, and explains core concepts visually."
                            },
                            {
                                icon: <PlayCircle className="text-black dark:text-white" size={24} />,
                                title: "Interactive Canvas Features",
                                description: "Learn by doing. From generating SVGs to playing interactive chess directly on the Excalidraw board."
                            },
                            {
                                icon: <BrainCircuit className="text-black dark:text-white" size={24} />,
                                title: "Persistent User Memory",
                                description: "The AI remembers your learning style and preferences locally in your profile, adapting its teaching dynamically."
                            },
                            {
                                icon: <Mic className="text-black dark:text-white" size={24} />,
                                title: "Seamless Voice Controls",
                                description: "Engage effortlessly using Push-To-Talk or Hands-Free continuous voice recognition. No typing required."
                            },
                            {
                                icon: <Shield className="text-black dark:text-white" size={24} />,
                                title: "Local Autonomy",
                                description: "Your memory files and local configuration persist directly on your machine for maximum privacy and safety."
                            }
                        ].map((feature, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, delay: idx * 0.1 }}
                                className="flex flex-col items-start text-left p-8 rounded-3xl bg-gray-50 dark:bg-[#121212] border border-gray-100 dark:border-gray-800 transition-colors"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-center mb-6 transition-colors">
                                    {feature.icon}
                                </div>
                                <h3 className="font-semibold text-lg text-black dark:text-white mb-3 transition-colors" style={{ fontFamily: "Geist, sans-serif" }}>{feature.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed transition-colors" style={{ fontFamily: "Geist, sans-serif" }}>
                                    {feature.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
