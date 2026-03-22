import React, { useState, useRef } from 'react';
import { Upload, Video, X, ShieldAlert, FileText, Activity, Search, AlertTriangle, CheckCircle2, ChevronRight, Play, Download, MessageSquare, Camera, Monitor, Eye, Zap, BrainCircuit, Mic, MicOff, UserPlus, FileCheck, Volume2, UserCircle, Home as HomeIcon, User, Shield, ArrowRight, LogOut, IdCard, Loader2, Users, UsersRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeVideo, analyzeLiveFrame, processComplaintTurn, generateSpeech, extractIdDetails, analyzeCrowd, askEvidenceQuestion } from './services/geminiService';
import { InvestigationReport, EmotionalAnalysis, ComplaintData } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [role, setRole] = useState<'user' | 'officer' | null>(null);
  const [mode, setMode] = useState<'upload' | 'live' | 'complaint' | 'crowd' | 'home'>('home');
  const [expandedAwareness, setExpandedAwareness] = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceQuestion, setEvidenceQuestion] = useState("");
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [customQA, setCustomQA] = useState<{question: string, answer: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Monitor States
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveAnalysis, setLiveAnalysis] = useState<EmotionalAnalysis | null>(null);
  const [isLiveAnalyzing, setIsLiveAnalyzing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Complaint Registration States
  const [complaintData, setComplaintData] = useState<ComplaintData>({
    basicInfo: {},
    incidentDetails: {},
    accusedDetails: {},
    witnessDetails: {},
    propertyDetails: {},
  });
  const [complaintHistory, setComplaintHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingComplaint, setIsProcessingComplaint] = useState(false);
  const [voiceChoice, setVoiceChoice] = useState<'Male' | 'Female' | 'Child'>('Female');
  const [language, setLanguage] = useState<string>('English');
  const [finalComplaint, setFinalComplaint] = useState<string | null>(null);
  const [isExtractingId, setIsExtractingId] = useState(false);
  const [idExtracted, setIdExtracted] = useState(false);
  const [crowdAnalysis, setCrowdAnalysis] = useState<any>(null);
  const [isCrowdAnalyzing, setIsCrowdAnalyzing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startComplaint = async () => {
    setIsProcessingComplaint(true);
    try {
      const result = await processComplaintTurn([], complaintData, language);
      setComplaintHistory([{ role: 'model', text: result.nextQuestion }]);
      playAIResponse(result.nextQuestion);
    } catch (err) {
      setError("Failed to start complaint registration.");
    } finally {
      setIsProcessingComplaint(false);
    }
  };

  const handleCrowdAnalysis = async (imageBase64: string) => {
    setIsCrowdAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeCrowd(imageBase64);
      setCrowdAnalysis(result);
    } catch (err: any) {
      console.error(err);
      setError(`Crowd analysis failed: ${err.message}`);
    } finally {
      setIsCrowdAnalyzing(false);
    }
  };

  const playAIResponse = async (text: string) => {
    try {
      const audioBase64 = await generateSpeech(text, voiceChoice);
      if (audioBase64) {
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        audio.play();
      }
    } catch (err) {
      console.error("TTS error:", err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await handleUserVoiceInput(base64Audio);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingId(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const extracted = await extractIdDetails(base64, file.type);
        
        setComplaintData(prev => ({
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            fullName: extracted.fullName || prev.basicInfo.fullName,
            address: extracted.address || prev.basicInfo.address,
            idProof: extracted.idProof || prev.basicInfo.idProof,
          }
        }));
        setIdExtracted(true);
      };
    } catch (err) {
      setError("Failed to extract details from ID. Please enter manually.");
    } finally {
      setIsExtractingId(false);
    }
  };

  const handleUserVoiceInput = async (audioBase64: string) => {
    setIsProcessingComplaint(true);
    try {
      const result = await processComplaintTurn(complaintHistory, complaintData, language, audioBase64);
      
      // Update data
      setComplaintData(prev => ({
        ...prev,
        ...result.extractedData
      }));

      // Update history
      const newHistory = [
        ...complaintHistory,
        { role: 'user' as const, text: "[Voice Input]" },
        { role: 'model' as const, text: result.nextQuestion }
      ];
      setComplaintHistory(newHistory);

      if (result.isComplete && result.formalComplaint) {
        setFinalComplaint(result.formalComplaint);
      } else {
        playAIResponse(result.nextQuestion);
      }
    } catch (err: any) {
      setError(`Failed to process voice input: ${err.message}`);
    } finally {
      setIsProcessingComplaint(false);
    }
  };

  const startLiveMonitor = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        if (videoRef.current.src) {
          URL.revokeObjectURL(videoRef.current.src);
          videoRef.current.src = '';
        }
        videoRef.current.srcObject = stream;
        videoRef.current.loop = false;
        setIsLiveActive(true);
        startAnalysisLoop();
      }
    } catch (err: any) {
      setError(`Camera access denied or failed: ${err.message}`);
    }
  };

  const stopLiveMonitor = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (videoRef.current?.src) {
      URL.revokeObjectURL(videoRef.current.src);
      videoRef.current.src = '';
    }
    setIsLiveActive(false);
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }
    setLiveAnalysis(null);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        stopLiveMonitor();
        const url = URL.createObjectURL(file);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = url;
          videoRef.current.loop = true;
          videoRef.current.play();
          setIsLiveActive(true);
          if (mode === 'live') {
            startAnalysisLoop();
          }
        }
      } else {
        setError("Please upload a valid video file.");
      }
    }
  };

  const captureFrame = (): string | null => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      }
    }
    return null;
  };

  const startAnalysisLoop = () => {
    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    
    analysisIntervalRef.current = setInterval(async () => {
      const frame = captureFrame();
      if (frame && !isLiveAnalyzing) {
        setIsLiveAnalyzing(true);
        try {
          const result = await analyzeLiveFrame(frame);
          setLiveAnalysis(result);
        } catch (err) {
          console.error("Live analysis error:", err);
        } finally {
          setIsLiveAnalyzing(false);
        }
      }
    }, 5000); // Analyze every 5 seconds
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError("File size exceeds 20MB limit for this demo.");
        return;
      }
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setReport(null);
      setError(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const startAnalysis = async () => {
    if (!videoFile) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const base64 = await fileToBase64(videoFile);
      const result = await analyzeVideo(base64, videoFile.type);
      setReport(result);
    } catch (err: any) {
      console.error(err);
      setError(`Analysis failed: ${err.message}. Please restart your dev server if you just updated the API key.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!evidenceQuestion.trim() || !report) return;
    const q = evidenceQuestion.trim();
    setEvidenceQuestion("");
    setIsAskingQuestion(true);
    try {
      const answer = await askEvidenceQuestion(report, q) || "";
      setCustomQA(prev => [...prev, { question: q, answer }]);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to answer question: ${err.message}`);
    } finally {
      setIsAskingQuestion(false);
    }
  };

  const reset = () => {
    setVideoFile(null);
    setVideoUrl(null);
    setReport(null);
    setError(null);
    setCrowdAnalysis(null);
    setLiveAnalysis(null);
    setCustomQA([]);
    setEvidenceQuestion("");
  };

  return (
    <div className="min-h-screen bg-transparent text-white font-sans selection:bg-gold/30 relative z-0">
      {/* Dynamic Glassmorphic Background */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-0 left-0 w-full h-full bg-navy/90" />
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-royal/30 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-gold/15 rounded-full blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[30%] right-[30%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-2xl sticky top-0 z-50 shadow-2xl shadow-black/50">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setRole(null)}>
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-gold/30 p-2">
              <img 
                src="/emblem.svg" 
                alt="Satyameva Jayate Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold tracking-widest text-gold uppercase">Satyameva Jayate</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-semibold">Investigation System</p>
            </div>
          </div>
          
          {role && (
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
              {role === 'officer' ? (
                <>
                  <button 
                    onClick={() => { setMode('home'); reset(); stopLiveMonitor(); }}
                    className={cn("hover:text-gold transition-colors flex items-center gap-2", mode === 'home' && "text-gold font-bold")}
                  >
                    <HomeIcon className="w-4 h-4" /> Home
                  </button>
                  <button 
                    onClick={() => { setMode('upload'); reset(); stopLiveMonitor(); }}
                    className={cn("hover:text-gold transition-colors flex items-center gap-2", mode === 'upload' && "text-gold font-bold")}
                  >
                    <Upload className="w-4 h-4" /> Upload Analysis
                  </button>
                  <button 
                    onClick={() => { setMode('live'); reset(); stopLiveMonitor(); }}
                    className={cn("hover:text-gold transition-colors flex items-center gap-2", mode === 'live' && "text-gold font-bold")}
                  >
                    <Monitor className="w-4 h-4" /> Live Monitor
                  </button>
                  <button 
                    onClick={() => { setMode('crowd'); reset(); stopLiveMonitor(); }}
                    className={cn("hover:text-gold transition-colors flex items-center gap-2", mode === 'crowd' && "text-gold font-bold")}
                  >
                    <UsersRound className="w-4 h-4" /> Crowd Management
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => { setMode('complaint'); reset(); stopLiveMonitor(); }}
                    className={cn("hover:text-gold transition-colors flex items-center gap-2", mode === 'complaint' && "text-gold font-bold")}
                  >
                    <UserPlus className="w-4 h-4" /> Register Complaint
                  </button>
                  <button 
                    onClick={() => { setMode('upload'); reset(); stopLiveMonitor(); }}
                    className={cn("hover:text-gold transition-colors flex items-center gap-2", mode === 'upload' && "text-gold font-bold")}
                  >
                    <Upload className="w-4 h-4" /> Evidence Analysis
                  </button>
                </>
              )}
              <button 
                onClick={() => setRole(null)}
                className="flex items-center gap-2 px-4 py-2 bg-royal/20 border border-royal/40 rounded-full hover:bg-royal/30 transition-all text-gold"
              >
                <LogOut className="w-4 h-4" /> {role === 'officer' ? 'Officer Exit' : 'User Exit'}
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {!role ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <h2 className="text-6xl font-serif font-bold tracking-tight leading-tight">
                Welcome to the <br />
                <span className="text-gold italic">Bureau of Investigation</span>
              </h2>
              <p className="text-white/50 text-xl max-w-2xl mx-auto">
                A secure portal for citizens to register complaints and for officers to conduct digital investigations.
              </p>
            </motion.div>

            <div className="flex flex-col items-center gap-8 w-full max-w-md mx-auto">

              {/* Officer Portal */}
              <motion.div
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setRole('officer'); setMode('home'); }}
                className="group relative p-8 bg-white/5 border border-white/10 rounded-3xl cursor-pointer overflow-hidden transition-all hover:border-royal/40 hover:bg-white/10 backdrop-blur-xl shadow-2xl shadow-black/40"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-royal/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative space-y-6">
                  <div className="w-16 h-16 bg-royal/20 rounded-2xl flex items-center justify-center border border-royal/40">
                    <Shield className="w-8 h-8 text-royal" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-serif font-bold text-white">Officer Bureau</h3>
                    <p className="text-white/60">Access advanced analysis tools, live behavior monitoring, and automated incident reporting systems.</p>
                  </div>
                  <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-xs">
                    Secure Login <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="pt-12 text-center">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/20 font-bold">
                Authorized Personnel Only • Secure 256-bit Encryption
              </p>
            </div>
          </div>
        ) : (
          <>
            {mode === 'home' ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 w-full">
                {/* Embedded UI Hero Banner integrating the Awareness Graphic */}
                {/* Comic Awareness Header */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4 mb-4 mt-8">
                  <div className="inline-flex items-center justify-center gap-3 bg-yellow-400 text-black px-6 py-2 rounded-full font-black uppercase tracking-widest shadow-[4px_4px_0px_#000] rotate-[-2deg]">
                    <Zap className="w-5 h-5 fill-black" />
                    <span>Public Safety Initiative</span>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter drop-shadow-[4px_4px_0px_theme(colors.blue.600)] leading-none pt-4">
                    Be a Hero, <br/><span className="text-yellow-400 drop-shadow-[4px_4px_0px_#000]">Save Society!</span>
                  </h2>
                  <p className="text-white text-md max-w-xl mx-auto font-bold uppercase tracking-widest bg-black p-4 rounded-xl border-4 border-white shadow-[4px_4px_0px_theme(colors.blue.600)] mt-6 mb-8">
                    Stand strong against crime, drugs, and hazards.
                  </p>

                  <div className="flex flex-wrap justify-center gap-4 md:gap-6 w-full py-4 relative z-20">
                    <button onClick={() => { setMode('upload'); reset(); }} className="flex items-center gap-3 bg-black hover:bg-royal/30 border-4 border-white hover:border-royal/50 px-6 md:px-8 py-4 rounded-2xl transition-all shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:-translate-y-1 group">
                      <Upload className="w-6 h-6 text-white group-hover:text-royal transition-colors" />
                      <span className="font-black text-white uppercase tracking-widest text-xs md:text-sm">Upload Analysis</span>
                    </button>
                    <button onClick={() => { setMode('live'); reset(); }} className="flex items-center gap-3 bg-black hover:bg-gold/30 border-4 border-white hover:border-gold/50 px-6 md:px-8 py-4 rounded-2xl transition-all shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:-translate-y-1 group">
                      <Monitor className="w-6 h-6 text-white group-hover:text-gold transition-colors" />
                      <span className="font-black text-white uppercase tracking-widest text-xs md:text-sm">Live Monitor</span>
                    </button>
                    <button onClick={() => { setMode('crowd'); reset(); }} className="flex items-center gap-3 bg-black hover:bg-emerald-500/30 border-4 border-white hover:border-emerald-500/50 px-6 md:px-8 py-4 rounded-2xl transition-all shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:-translate-y-1 group">
                      <UsersRound className="w-6 h-6 text-white group-hover:text-emerald-500 transition-colors" />
                      <span className="font-black text-white uppercase tracking-widest text-xs md:text-sm">Crowd Management</span>
                    </button>
                  </div>
                </motion.div>

                {/* Comic Panel Gallery */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl pb-12 mt-6">
                  {[
                    { 
                      img: '/comic_harassment.png', title: 'Zero Harassment', desc: 'Stand up against bullying and ragging!', color: 'bg-red-500', textColor: 'text-red-500',
                      rules: [
                        "Any act of physical or mental abuse/ragging is punishable under law.",
                        "Report incidents immediately via the 'Register Complaint' portal.",
                        "Anonymous complaints are strictly and confidentially investigated."
                      ]
                    },
                    { 
                      img: '/comic_drugs.png?v=3', title: 'Say NO to Drugs', desc: 'Crush the toxins, stay clean and powerful!', color: 'bg-emerald-500', textColor: 'text-emerald-500',
                      rules: [
                        "Possession, consumption, or distribution of illegal drugs leads to imprisonment.",
                        "If you notice drug dealing in your area, alert the authorities immediately.",
                        "Rehabilitation resources are available for victims without fear of prosecution."
                      ]
                    },
                    { 
                      img: '/comic_traffic.png', title: 'Traffic Heroes', desc: 'Buckle up and wear your helmet to save lives!', color: 'bg-blue-500', textColor: 'text-blue-500',
                      rules: [
                        "Two-wheeler riders must wear BIS certified helmets correctly strapped.",
                        "Four-wheeler occupants must fasten seatbelts at all times.",
                        "Strict penalties and license suspension apply for over-speeding and signal jumping."
                      ]
                    },
                    { 
                      img: '/comic_women.png', title: 'Empowerment', desc: 'Protect, respect, and empower women everyday!', color: 'bg-purple-500', textColor: 'text-purple-500',
                      rules: [
                        "Dial emergency numbers 112 or 1091 for immediate rapid response.",
                        "Cyber-harassment and stalking carry strict, non-bailable warrants.",
                        "Women safety bureaus operate 24/7 in all major precincts."
                      ]
                    }
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col w-full group">
                      {/* Clickable Header Panel */}
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        transition={{ delay: i * 0.1 }}
                        onClick={() => setExpandedAwareness(expandedAwareness === i ? null : i)}
                        className="relative rounded-2xl overflow-hidden border-4 border-white bg-black aspect-video hover:-translate-y-2 hover:rotate-1 transition-all duration-300 shadow-[8px_8px_0px_#fff] cursor-pointer z-10"
                      >
                        <img src={item.img} alt={item.title} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                        
                        {/* Comic Halftone Overlay Effect */}
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none group-hover:opacity-0 transition-opacity" />
                        
                        {/* Interactive Hint Indicator */}
                        <div className={`absolute top-4 right-4 w-10 h-10 rounded-full border-4 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center bg-white z-20 group-hover:scale-110 transition-transform ${expandedAwareness === i ? 'rotate-90' : ''}`}>
                           <ChevronRight className="w-6 h-6 text-black font-black" />
                        </div>

                        {/* Text Box styled like a Comic Book panel */}
                        <div className="absolute bottom-4 left-4 right-4 bg-white text-black p-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_#000] rotate-[-1deg] group-hover:rotate-0 transition-transform">
                          <div className={`absolute -top-4 -right-4 w-10 h-10 rounded-full border-4 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center ${item.color}`}>
                            <Zap className="w-5 h-5 text-white fill-white" />
                          </div>
                          <h4 className="text-xl md:text-2xl font-black uppercase tracking-tight">{item.title}</h4>
                          <p className="text-xs md:text-sm font-bold leading-tight mt-1">{item.desc}</p>
                        </div>
                      </motion.div>
                      
                      {/* Expanded Rules Section */}
                      <AnimatePresence>
                        {expandedAwareness === i && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-[#ffffe8] border-4 border-black rounded-3xl p-6 md:p-8 relative shadow-[8px_8px_0px_#000] z-20 mt-4 overflow-visible">
                              {/* Comic Speech Bubble Tail pointing UP towards the comic panel */}
                              <div className="absolute -top-[20px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[20px] border-b-black" />
                              <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-b-[16px] border-b-[#ffffe8]" />
                              
                              {/* Overlay Halftone Dots */}
                              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-multiply pointer-events-none rounded-3xl" />
                              
                              <h5 className="inline-flex items-center gap-2 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs bg-black text-white px-4 py-2 border-2 border-white shadow-[4px_4px_0px_#000] rounded-xl transform -rotate-2 mb-6 relative z-10 transition-transform hover:rotate-0 cursor-default">
                                <FileText className="w-4 h-4" /> Official Public Directives
                              </h5>
                              <ul className="space-y-4 relative z-10">
                                {item.rules.map((rule, idx) => (
                                  <li key={idx} className="flex items-start gap-4 bg-white border-4 border-black p-4 rounded-2xl shadow-[4px_4px_0px_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] hover:bg-yellow-50 transition-all duration-200 cursor-default group/rule">
                                    <div className={`mt-0.5 p-1 rounded-full border-2 border-black shadow-[2px_2px_0px_#000] group-hover/rule:scale-110 transition-transform ${item.color}`}>
                                      <CheckCircle2 className="w-5 h-5 text-white stroke-[2.5]" />
                                    </div>
                                    <span className="text-black font-black uppercase text-xs md:text-sm leading-snug tracking-tighter w-full pt-1">{rule}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>



              </div>
            ) : mode === 'complaint' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Voice Chat Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="p-8 bg-white/5 border border-white/10 rounded-3xl min-h-[500px] flex flex-col justify-between relative overflow-hidden backdrop-blur-2xl shadow-2xl shadow-black/40">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0" />
                
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center">
                        <Volume2 className="w-5 h-5 text-gold" />
                      </div>
                      <h3 className="text-lg font-bold">Voice Registration</h3>
                    </div>
                    <div className="flex items-center gap-2 p-1 bg-white/5 rounded-full border border-white/10">
                      {(['Male', 'Female', 'Child'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setVoiceChoice(v)}
                          className={cn(
                            "px-3 py-1 text-[10px] font-bold uppercase rounded-full transition-all",
                            voiceChoice === v ? "bg-gold text-navy" : "text-white/40 hover:text-white"
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {complaintHistory.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-10 space-y-8"
                      >
                        <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mx-auto border border-gold/20">
                          <Mic className="w-10 h-10 text-gold" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xl font-serif font-bold">Ready to assist you</p>
                          <p className="text-sm text-white/40 max-w-xs mx-auto">Please select your preferred language to begin the official voice-based complaint registration process.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                          {['English', 'Telugu', 'Hindi', 'English + Telugu', 'Telugu + Hindi', 'English + Hindi'].map((lang) => (
                            <button
                              key={lang}
                              onClick={() => setLanguage(lang)}
                              className={cn(
                                "px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                                language === lang 
                                  ? "bg-gold text-navy border-gold shadow-lg shadow-gold/20" 
                                  : "bg-navy/40 border-white/10 text-white/40 hover:border-gold/30"
                              )}
                            >
                              {lang}
                            </button>
                          ))}
                        </div>

                        {/* ID Upload Section */}
                        <div className="max-w-md mx-auto w-full p-6 bg-gold/5 border border-gold/10 rounded-3xl space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <IdCard className="w-5 h-5 text-gold" />
                              <span className="text-xs font-bold uppercase tracking-widest">Govt ID Submission</span>
                            </div>
                            {idExtracted && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase">
                                <CheckCircle2 className="w-3 h-3" /> Extracted
                              </span>
                            )}
                          </div>
                          
                          <p className="text-[10px] text-white/40 text-left">Upload your Aadhar, PAN, or DL to automatically pre-fill your basic information.</p>
                          
                          <label className="block">
                            <div className={cn(
                              "w-full py-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
                              isExtractingId ? "border-gold/50 bg-gold/10" : "border-white/10 hover:border-gold/30 bg-white/5"
                            )}>
                              {isExtractingId ? (
                                <>
                                  <Loader2 className="w-6 h-6 text-gold animate-spin" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Extracting Details...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-6 h-6 text-white/20" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Choose ID Image</span>
                                </>
                              )}
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={handleIdUpload}
                              disabled={isExtractingId}
                            />
                          </label>
                        </div>

                        <button 
                          onClick={startComplaint}
                          className="px-12 py-4 bg-gold text-navy font-bold rounded-2xl hover:bg-gold/90 transition-all shadow-xl shadow-gold/20 flex items-center gap-3 mx-auto group"
                        >
                          Start Registration
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        {complaintHistory.slice(-2).map((msg, i) => (
                          <div key={i} className={cn(
                            "p-6 rounded-2xl max-w-[80%]",
                            msg.role === 'model' ? "bg-royal/20 border border-royal/40 mr-auto" : "bg-gold/10 border border-gold/20 ml-auto text-right"
                          )}>
                            <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-2">
                              {msg.role === 'model' ? 'Bureau Assistant' : 'You'}
                            </p>
                            <p className="text-lg leading-relaxed">
                              {msg.text}
                            </p>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="pt-8 flex flex-col items-center gap-6">
                  {isProcessingComplaint ? (
                    <div className="flex items-center gap-3 text-gold">
                      <BrainCircuit className="w-6 h-6 animate-spin" />
                      <span className="text-sm font-bold uppercase tracking-widest">AI is thinking...</span>
                    </div>
                  ) : complaintHistory.length > 0 && !finalComplaint && (
                    <div className="flex flex-col items-center gap-4">
                      <button
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        className={cn(
                          "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl",
                          isRecording ? "bg-red-500 animate-pulse scale-110" : "bg-gold hover:scale-105"
                        )}
                      >
                        {isRecording ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-navy" />}
                      </button>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                        {isRecording ? "Listening... Release to send" : "Hold to Speak"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Progress/Summary Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-6 backdrop-blur-2xl shadow-2xl shadow-black/40">
                <h4 className="text-sm font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <FileCheck className="w-4 h-4" /> Registration Progress
                </h4>
                
                <div className="space-y-4">
                  {[
                    { label: 'Basic Information', data: complaintData.basicInfo, icon: UserCircle },
                    { label: 'Incident Details', data: complaintData.incidentDetails, icon: AlertTriangle },
                    { label: 'Accused Details', data: complaintData.accusedDetails, icon: Search },
                    { label: 'Witness Details', data: complaintData.witnessDetails, icon: Eye },
                    { label: 'Property Details', data: complaintData.propertyDetails, icon: Activity }
                  ].map((section, i) => {
                      const filledCount = Object.values(section.data).filter(v => v).length;
                      const totalCount = 4; // Assuming 4 main fields per section
                      const progress = (filledCount / totalCount) * 100;

                      return (
                        <div key={i} className="space-y-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-white/60">
                              <section.icon className="w-3 h-3" />
                              <span className="font-bold uppercase tracking-widest">{section.label}</span>
                            </div>
                            <span className="font-mono text-gold">{filledCount}/{totalCount}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              className="h-full bg-gold"
                            />
                          </div>
                          {filledCount > 0 && (
                            <div className="space-y-1">
                              {Object.entries(section.data).map(([key, value], idx) => value && (
                                <div key={idx} className="flex items-center gap-2 text-[10px]">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                  <span className="text-white/40 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                  <span className="text-white/80 truncate max-w-[150px]">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {finalComplaint && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 bg-royal/10 border border-royal/20 rounded-3xl space-y-4"
                >
                  <div className="flex items-center gap-2 text-gold">
                    <FileCheck className="w-5 h-5" />
                    <h4 className="text-sm font-bold uppercase tracking-widest">Bureau Complaint Generated</h4>
                  </div>
                  <div className="p-4 bg-navy/40 rounded-xl border border-white/5 max-h-[300px] overflow-y-auto">
                    <pre className="text-[10px] leading-relaxed text-white/70 whitespace-pre-wrap font-mono">
                      {finalComplaint}
                    </pre>
                  </div>
                  <button className="w-full py-3 bg-gold text-navy font-bold rounded-xl hover:bg-gold/80 transition-all flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> Download Official PDF
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        ) : mode === 'crowd' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Camera Feed Simulation or Upload */}
            <div className="lg:col-span-7 space-y-6">
              <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl group">
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                />
                <canvas ref={canvasRef} className="hidden" />
                
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-transparent to-transparent pointer-events-none" />
                
                <div className="absolute top-6 left-6 flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/80">Bureau Live Feed • Zone 04</span>
                </div>

                {!isLiveActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy/60 backdrop-blur-sm space-y-6">
                    <button 
                      onClick={startLiveMonitor}
                      className="px-8 py-4 bg-gold text-navy font-bold rounded-full hover:bg-gold/80 transition-all flex items-center gap-3 shadow-2xl shadow-gold/20"
                    >
                      <Camera className="w-6 h-6" /> Initialize Crowd Feed
                    </button>
                    
                    <div className="flex items-center gap-4 w-64">
                      <div className="h-px bg-white/10 flex-grow" />
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">OR</span>
                      <div className="h-px bg-white/10 flex-grow" />
                    </div>

                    <label className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-all flex items-center gap-3 cursor-pointer group">
                      <Upload className="w-6 h-6 text-gold group-hover:scale-110 transition-transform" />
                      <span>Upload Video Feed</span>
                      <input 
                        type="file" 
                        accept="video/*" 
                        className="hidden" 
                        onChange={handleVideoUpload}
                      />
                    </label>
                  </div>
                )}

                {isCrowdAnalyzing && (
                  <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-12 h-12 text-gold animate-spin" />
                    <p className="text-gold font-bold uppercase tracking-widest text-xs">Analyzing Crowd Dynamics...</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    if (videoRef.current && canvasRef.current) {
                      const context = canvasRef.current.getContext('2d');
                      canvasRef.current.width = videoRef.current.videoWidth;
                      canvasRef.current.height = videoRef.current.videoHeight;
                      context?.drawImage(videoRef.current, 0, 0);
                      const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];
                      handleCrowdAnalysis(base64);
                    }
                  }}
                  disabled={!isLiveActive || isCrowdAnalyzing}
                  className="p-6 bg-royal/20 border border-royal/40 rounded-3xl hover:bg-royal/30 transition-all flex flex-col items-center gap-3 group disabled:opacity-50"
                >
                  <Users className="w-8 h-8 text-gold group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold uppercase tracking-widest">Capture & Analyze</span>
                </button>
                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">System Status</p>
                  <p className="text-emerald-500 font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Operational
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Crowd Analysis Results */}
            <div className="lg:col-span-5 space-y-6">
              <AnimatePresence mode="wait">
                {!crowdAnalysis ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full min-h-[400px] border border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-12 space-y-4"
                  >
                    <UsersRound className="w-12 h-12 text-white/10" />
                    <div>
                      <p className="text-lg font-medium text-white/40">Crowd Intelligence</p>
                      <p className="text-sm text-white/20">Capture a frame to analyze density and movement</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6 overflow-y-auto max-h-[80vh] pr-2 custom-scrollbar"
                  >
                    {/* 1. Crowd Detection Card */}
                    <div className="p-6 bg-royal/10 border border-royal/20 rounded-3xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gold flex items-center gap-2">
                          <Search className="w-4 h-4" /> Crowd Detection
                        </h4>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          crowdAnalysis.detection.density === 'Critical' ? "bg-red-500 text-white animate-pulse" : 
                          crowdAnalysis.detection.density === 'High' ? "bg-orange-500 text-white" : "bg-emerald-500 text-white"
                        )}>
                          {crowdAnalysis.detection.density} Density
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-navy/40 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">People Count</p>
                          <p className="text-3xl font-serif font-bold text-white">{crowdAnalysis.detection.count}</p>
                        </div>
                        <div className="p-4 bg-navy/40 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Tracking Status</p>
                          <p className="text-[10px] font-medium leading-tight text-white/80">{crowdAnalysis.detection.trackingStatus}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-white/40">Movement & Flow</p>
                        <p className="text-xs text-white/80 leading-relaxed">{crowdAnalysis.detection.movement}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-white/40">High Density Zones (Heatmap)</p>
                        <div className="flex flex-wrap gap-2">
                          {crowdAnalysis.detection.heatmapAreas.map((area: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[9px] text-red-400">
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 2. Crowd Behavior Analysis */}
                    <div className="p-6 bg-navy/40 border border-white/10 rounded-3xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4" /> Behavior Analysis
                        </h4>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          crowdAnalysis.behavior.status === 'Abnormal' ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        )}>
                          {crowdAnalysis.behavior.status}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-widest text-white/40">Dominant Emotion</p>
                          <p className="text-sm font-bold text-white flex items-center gap-2">
                            <Activity className="w-3 h-3 text-gold" /> {crowdAnalysis.behavior.emotion}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-widest text-white/40">Panic Detection</p>
                          <p className={cn(
                            "text-sm font-bold flex items-center gap-2",
                            crowdAnalysis.behavior.panicDetected ? "text-red-500" : "text-emerald-500"
                          )}>
                            {crowdAnalysis.behavior.panicDetected ? "PANIC DETECTED" : "No Panic Detected"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-white/40">Group Formations</p>
                        <p className="text-xs text-white/80 leading-relaxed">{crowdAnalysis.behavior.groupFormations}</p>
                      </div>

                      {crowdAnalysis.behavior.anomalyDetails.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-white/40">Detected Anomalies</p>
                          <ul className="space-y-1">
                            {crowdAnalysis.behavior.anomalyDetails.map((anomaly: string, i: number) => (
                              <li key={i} className="text-[10px] text-red-400 flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3" /> {anomaly}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* 3. Crowd Management Strategies */}
                    <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> Management Strategies
                      </h4>

                      {crowdAnalysis.management.alertNeeded && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shrink-0 animate-pulse">
                            <ShieldAlert className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-red-400 uppercase">Immediate Alert Triggered</p>
                            <p className="text-[9px] text-red-300/70">{crowdAnalysis.management.alertReason}</p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Flow Control & Smooth Lines</p>
                          <p className="text-xs text-white/80 italic">"{crowdAnalysis.management.flowControl}"</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Crowd Clearing Strategy</p>
                          <p className="text-xs text-white/80 italic">"{crowdAnalysis.management.crowdClearing}"</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Actionable Plan</p>
                          <ul className="list-decimal pl-4 space-y-1">
                            {crowdAnalysis.management.actionablePlan?.map((step: string, idx: number) => (
                              <li key={idx} className="text-xs text-white/80 italic">"{step}"</li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Resource Allocation</p>
                          <p className="text-xs text-white/80 italic">"{crowdAnalysis.management.resourceDeployment}"</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Emergency Handling</p>
                          <p className="text-xs text-white/80 italic">"{crowdAnalysis.management.emergencyPlan}"</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : mode === 'live' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Live Feed Column */}
            <div className="lg:col-span-8 space-y-6">
              <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl group">
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {!isLiveActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy/60 backdrop-blur-sm space-y-6">
                    <Camera className="w-16 h-16 text-white/20" />
                    <div className="flex flex-col items-center gap-4">
                      <button 
                        onClick={startLiveMonitor}
                        className="px-8 py-3 bg-gold text-navy font-bold rounded-full hover:bg-gold/80 transition-all shadow-lg shadow-gold/20 flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" /> Initialize Live Feed
                      </button>
                      
                      <div className="flex items-center gap-4 w-48">
                        <div className="h-px bg-white/10 flex-grow" />
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">OR</span>
                        <div className="h-px bg-white/10 flex-grow" />
                      </div>

                      <label className="px-8 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-all flex items-center gap-2 cursor-pointer group">
                        <Upload className="w-4 h-4 text-gold group-hover:scale-110 transition-transform" />
                        <span>Upload Video</span>
                        <input 
                          type="file" 
                          accept="video/*" 
                          className="hidden" 
                          onChange={handleVideoUpload}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {isLiveActive && (
                  <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/20">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Bureau Monitor Active</span>
                  </div>
                )}

                {isLiveAnalyzing && (
                  <div className="absolute bottom-6 right-6 flex items-center gap-2 px-3 py-1.5 bg-gold/20 border border-gold/40 backdrop-blur-md rounded-full">
                    <BrainCircuit className="w-4 h-4 text-gold animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Processing Intent...</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-6 bg-royal/10 border border-royal/20 rounded-3xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
                    <Eye className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <p className="font-medium">Real-time Emotional Analysis</p>
                    <p className="text-xs text-white/40">Detecting intent and behavior patterns</p>
                  </div>
                </div>
                <button 
                  onClick={stopLiveMonitor}
                  className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all text-sm font-medium"
                >
                  Stop Monitor
                </button>
              </div>
            </div>

            {/* Analysis Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <AnimatePresence mode="wait">
                {!liveAnalysis ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full min-h-[400px] border border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-12 space-y-4"
                  >
                    <Zap className="w-12 h-12 text-white/10 animate-pulse" />
                    <p className="text-sm text-white/30">Scanning for entities and emotional triggers...</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    {/* Risk Score */}
                    <div className={cn(
                      "p-6 rounded-3xl border transition-all duration-500",
                      liveAnalysis.riskScore === 'HIGH' ? "bg-red-500/10 border-red-500/20" : 
                      liveAnalysis.riskScore === 'MEDIUM' ? "bg-orange-500/10 border-orange-500/20" : 
                      "bg-gold/10 border-gold/20"
                    )}>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Risk Assessment</span>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          liveAnalysis.riskScore === 'HIGH' ? "bg-red-500 text-white" : 
                          liveAnalysis.riskScore === 'MEDIUM' ? "bg-orange-500 text-white" : 
                          "bg-gold text-navy"
                        )}>
                          {liveAnalysis.riskScore}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div className="space-y-1">
                          <p className="text-3xl font-serif font-bold tracking-tight">{liveAnalysis.emotion}</p>
                          <p className="text-xs text-white/40 uppercase tracking-widest">Primary Emotion</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-mono font-bold text-gold">{(liveAnalysis.confidence * 100).toFixed(0)}%</p>
                          <p className="text-[10px] text-white/20 uppercase tracking-widest">Confidence</p>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Analysis */}
                    <div className="space-y-4">
                      <div className="p-5 bg-royal/10 border border-royal/20 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-white/40 mb-1">
                          <Activity className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Body Language</span>
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed">{liveAnalysis.bodyLanguage}</p>
                      </div>

                      <div className="p-5 bg-royal/10 border border-royal/20 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-white/40 mb-1">
                          <BrainCircuit className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Behavior Pattern</span>
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed">{liveAnalysis.behaviorPattern}</p>
                      </div>

                      <div className="p-5 bg-royal/10 border border-royal/20 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-white/40 mb-1">
                          <Search className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Intent Inference</span>
                        </div>
                        <p className="text-sm text-gold/80 leading-relaxed font-medium">"{liveAnalysis.intentInference}"</p>
                      </div>
                    </div>

                    {/* Alert Banner */}
                    {liveAnalysis.riskScore === 'HIGH' && (
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="p-4 bg-red-500 text-white rounded-2xl flex items-center gap-4 shadow-xl shadow-red-500/20"
                      >
                        <AlertTriangle className="w-8 h-8 shrink-0 animate-bounce" />
                        <div>
                          <p className="font-bold text-sm">CRITICAL ALERT</p>
                          <p className="text-xs opacity-80">Suspicious intent detected. Immediate intervention recommended.</p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : !videoFile ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto text-center space-y-8"
          >
            <div className="space-y-4">
              <h2 className="text-5xl font-serif font-bold tracking-tight leading-tight">
                National Forensic <br />
                <span className="text-gold italic">Investigation Bureau</span>
              </h2>
              <p className="text-white/50 text-lg max-w-md mx-auto">
                Official platform for automated incident detection, entity tracking, and forensic reporting.
              </p>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative border-2 border-dashed border-gold/20 rounded-3xl p-16 transition-all hover:border-gold/50 hover:bg-gold/5 cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-gold" />
                </div>
                <div>
                  <p className="text-lg font-medium">Submit Evidence for Analysis</p>
                  <p className="text-sm text-white/40">MP4, MOV or AVI (Max 20MB)</p>
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*"
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-8">
              {[
                { icon: Search, label: "Object Detection" },
                { icon: Activity, label: "Action Recognition" },
                { icon: FileText, label: "Auto Reporting" }
              ].map((item, i) => (
                <div key={i} className="p-4 bg-royal/10 border border-royal/20 rounded-2xl space-y-2">
                  <item.icon className="w-5 h-5 text-gold mx-auto" />
                  <p className="text-xs font-medium text-white/60">{item.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Video & Controls */}
            <div className="lg:col-span-7 space-y-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
              >
                {videoUrl && (
                  <video 
                    src={videoUrl} 
                    controls 
                    className="w-full h-full object-contain"
                  />
                )}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-navy/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-gold/20 rounded-full animate-pulse" />
                      <div className="absolute inset-0 w-20 h-20 border-t-4 border-gold rounded-full animate-spin" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-xl font-serif font-bold tracking-tight">Analyzing Evidence...</p>
                      <p className="text-sm text-white/40 animate-pulse">Running National Forensic Protocols</p>
                    </div>
                  </div>
                )}
              </motion.div>

              <div className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-3xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                    <Video className="w-6 h-6 text-white/60" />
                  </div>
                  <div>
                    <p className="font-medium truncate max-w-[200px]">{videoFile.name}</p>
                    <p className="text-xs text-white/40">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={reset}
                    className="px-6 py-2.5 text-sm font-medium hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={startAnalysis}
                    disabled={isAnalyzing}
                    className="px-8 py-2.5 bg-gold text-navy font-bold rounded-full hover:bg-gold/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isAnalyzing ? "Processing..." : "Start Bureau Investigation"}
                    {!isAnalyzing && <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Right Column: Analysis Results */}
            <div className="lg:col-span-5 space-y-6">
              <AnimatePresence mode="wait">
                {!report ? (
                  <motion.div 
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full min-h-[400px] border border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-12 space-y-4"
                  >
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                      <Activity className="w-8 h-8 text-white/20" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-white/40">Awaiting Analysis</p>
                      <p className="text-sm text-white/20">Start the investigation to generate the report</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="report"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    {/* Status Card */}
                    <div className="p-6 bg-royal/10 border border-royal/20 rounded-3xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-gold" />
                          <span className="text-xs font-bold uppercase tracking-wider text-gold">Investigation Complete</span>
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          report.scores.riskLevel === 'HIGH' ? "bg-red-500 text-white" : "bg-gold text-navy"
                        )}>
                          {report.scores.riskLevel} RISK
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-serif font-bold">{report.caseType}</h3>
                        <p className="text-sm text-white/60 leading-relaxed">{report.summary}</p>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="p-6 bg-navy/40 border border-white/10 rounded-3xl space-y-6">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Bureau Timeline
                      </h4>
                      <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                        {report.timeline.map((event, i) => (
                          <div key={i} className="relative pl-8 group">
                            <div className="absolute left-0 top-1.5 w-6 h-6 bg-navy border-2 border-white/20 rounded-full flex items-center justify-center group-hover:border-gold transition-colors">
                              <div className="w-1.5 h-1.5 bg-white/40 rounded-full group-hover:bg-gold" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-gold font-bold">{event.time}</span>
                                <span className="text-[10px] text-white/20 font-mono">Conf: {(event.confidence * 100).toFixed(0)}%</span>
                              </div>
                              <p className="text-sm text-white/80">{event.event}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Entities */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Suspects</p>
                        <ul className="space-y-1">
                          {report.entities.suspects.map((s, i) => (
                            <li key={i} className="text-xs text-white/60">• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Victims</p>
                        <ul className="space-y-1">
                          {report.entities.victims.map((v, i) => (
                            <li key={i} className="text-xs text-white/60">• {v}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Dynamic Q&A */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-6">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Professional Intelligence Q&A
                      </h4>
                      <div className="space-y-4">
                        {report.dynamicQA.map((qa, i) => (
                          <div key={i} className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-xs font-bold text-emerald-500 italic">Q: {qa.question}</p>
                            <p className="text-sm text-white/70 leading-relaxed font-serif">A: {qa.answer}</p>
                          </div>
                        ))}
                        {customQA.map((qa, i) => (
                          <div key={`custom-${i}`} className="space-y-2 p-4 bg-royal/10 rounded-2xl border border-royal/20">
                            <p className="text-xs font-bold text-gold italic">Officer: {qa.question}</p>
                            <p className="text-sm text-white/80 leading-relaxed font-serif">HAWK: {qa.answer}</p>
                          </div>
                        ))}
                      </div>
                      
                      {/* Ask bar */}
                      <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                        <input 
                          type="text"
                          value={evidenceQuestion}
                          onChange={(e) => setEvidenceQuestion(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                          placeholder="Ask a specific professional question about this evidence..."
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold transition-colors text-white placeholder-white/30"
                        />
                        <button 
                          onClick={handleAskQuestion}
                          disabled={isAskingQuestion || !evidenceQuestion.trim()}
                          className="px-6 py-3 bg-gold text-navy font-bold rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50"
                        >
                          {isAskingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Incident Narrative (Fact Story) */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Incident Narrative
                      </h4>
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                        <p className="text-sm text-white/80 leading-relaxed font-serif italic">
                          {report.factStory}
                        </p>
                      </div>
                    </div>

                    {/* Conclusion & Export */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Final Conclusion</p>
                        <p className="text-sm text-white/80 italic leading-relaxed">"{report.conclusion}"</p>
                      </div>
                      <button className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" /> Download Full Report (PDF)
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </>
    )}
  </main>

      {/* Footer */}
      <footer className="border-t border-gold/10 py-12 bg-navy/50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2 opacity-40">
            <Shield className="w-5 h-5 text-gold" />
            <span className="text-xs font-serif font-bold tracking-widest uppercase text-gold">Case Study</span>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-white/20">
            <a href="#" className="hover:text-gold transition-colors">Privacy Protocol</a>
            <a href="#" className="hover:text-gold transition-colors">Legal Compliance</a>
            <a href="#" className="hover:text-gold transition-colors">Bureau Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
