import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Minimize2,
  Maximize2,
  Trash2,
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  Key,
  Check,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface ChatSource {
  type: string;
  id?: string;
  name: string;
  summary: string;
}

interface Message {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  sources?: ChatSource[];
  timestamp: string;
  providerStatus?: string;
}

interface AgentStatus {
  provider: string;
  agent: string;
  model: string;
  isConfigured: boolean;
  maskedKey?: string;
  status: string;
}

export const AIAssistantDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);

  // Gemini API Key config state
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [savingKey, setSavingKey] = useState(false);
  const [keyConfigMessage, setKeyConfigMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const location = useLocation();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = () => {
    api
      .get<{ success: boolean; data: AgentStatus }>('/ai/status')
      .then((res: any) => {
        if (res?.data) {
          setAgentStatus(res.data);
          if (res.data.model) setSelectedModel(res.data.model);
        }
      })
      .catch(() => {
        // Fallback silently if offline
      });
  };

  // Fetch Gemini Agent configuration status
  useEffect(() => {
    fetchStatus();
  }, [isOpen]);

  // Determine current page context and contextual questions
  const getPageContext = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return { page: 'dashboard', label: 'Executive Dashboard' };
    if (path.includes('/spend/preview')) return { page: 'spend-simulator', label: 'Spend Decision Simulator' };
    if (path.includes('/spend')) return { page: 'spending-request', label: 'Spending Requests' };
    if (path.includes('/approvals')) return { page: 'approvals', label: 'Approvals Queue' };
    if (path.includes('/budgets')) return { page: 'budgets', label: 'Department Budgets' };
    if (path.includes('/client-budget')) return { page: 'client-budget', label: 'Client Contract & Quotation' };
    if (path.includes('/transactions')) return { page: 'transactions', label: 'Settlement Ledger' };
    if (path.includes('/commitments')) return { page: 'commitments', label: 'Commitments Ledger' };
    if (path.includes('/forecasts')) return { page: 'forecasts', label: 'Spend Forecasting' };
    if (path.includes('/alerts')) return { page: 'alerts', label: 'Control Alerts' };
    if (path.includes('/audit')) return { page: 'audit', label: 'Audit Trail' };
    return { page: 'general', label: 'Financial Control System' };
  };

  const currentContext = getPageContext();

  const getSuggestedQuestions = (): string[] => {
    switch (currentContext.page) {
      case 'dashboard':
        return [
          'Summarize our financial situation',
          'What is our current budget utilization?',
          'Which department has the highest utilization?',
          'What are our active policy violations?',
        ];
      case 'spend-simulator':
        return [
          'What happens if I spend ₹50,000 more in Hardware?',
          'Why does this spending request require approval?',
          'Will this request exceed the departmental ceiling?',
        ];
      case 'spending-request':
        return [
          'Why was this spending request rejected?',
          'Why does this request require approval?',
          'Explain this budget violation',
        ];
      case 'budgets':
        return [
          'Show me the departments approaching their budget limits',
          'What is our remaining available budget?',
          'Which categories are consuming the most budget?',
        ];
      case 'client-budget':
        return [
          'Summarize this client quotation and financial position',
          'What is the current estimated margin and leftover budget?',
          'Why is the completion margin below target?',
          'What happens if estimated costs increase by ₹2 lakh?',
        ];
      case 'commitments':
        return [
          'Which commitments are still outstanding?',
          'What is our total outstanding committed amount?',
          'Summarize active vendor ring-fenced funds',
        ];
      case 'transactions':
        return [
          'Summarize settled transactions for this period',
          'Show recent expenditures by department',
        ];
      case 'forecasts':
        return [
          'Explain the projected violation and burn velocity',
          'Which budgets may exceed their limits this quarter?',
        ];
      case 'alerts':
        return [
          'What are the most critical active financial alerts?',
          'Summarize overspending warnings for this month',
        ];
      case 'audit':
        return [
          'Summarize recent governance decision snapshots',
          'Explain the latest audit log entries',
        ];
      default:
        return [
          'Summarize our financial situation',
          'What is our overall budget utilization?',
          'Which department has the highest spend?',
        ];
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      if (!isMinimized && !showKeyConfig) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    }
  }, [messages, isOpen, isMinimized, showKeyConfig]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'gemini',
          text: `**✦ Welcome to ATCS Gemini Intelligence.**\n\nI am your **Gemini Agent**, a read-only financial intelligence layer powered by Google Gemini. I interpret and explain authoritative data calculated by the **ATCS SpendDecisionEngine** and PostgreSQL ledger.\n\nYou can ask about budget utilization, decision snapshots, spend simulations, or client quotations.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, []);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await api.post<{
        success: boolean;
        answer: string;
        sources: ChatSource[];
        contextUsed: Record<string, any>;
        generatedAt: string;
        providerStatus: string;
      }>('/ai/chat', {
        message: text,
        context: {
          page: currentContext.page,
          departmentId: user?.departmentId || undefined,
        },
      });

      const resData = (response as any)?.data || response;
      const geminiMsg: Message = {
        id: `gemini-${Date.now()}`,
        sender: 'gemini',
        text: resData.answer || (response as any).answer || 'I have analyzed the current ATCS financial data.',
        sources: resData.sources || (response as any).sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        providerStatus: resData.providerStatus || (response as any).providerStatus || 'ONLINE',
      };

      setMessages((prev) => [...prev, geminiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `gemini-err-${Date.now()}`,
        sender: 'gemini',
        text: `### ⚠️ Assistant Temporarily Unavailable\n\nGemini Agent is temporarily unable to process your request. Your ATCS financial controls and SpendDecisionEngine remain fully operational.\n\n*Error: ${err.message || 'Network error'}*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        providerStatus: 'UNAVAILABLE',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'cleared',
        sender: 'gemini',
        text: `Chat history cleared. Context is set to **${currentContext.label}**. Ask any financial question to Gemini Agent.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setSavingKey(true);
    setKeyConfigMessage(null);

    try {
      const res = await api.post<{ success: boolean; message: string; data: AgentStatus }>('/ai/config', {
        apiKey: apiKeyInput.trim(),
        model: selectedModel,
      });

      setKeyConfigMessage({
        type: 'success',
        text: (res as any)?.message || 'Gemini API Key successfully verified and saved!',
      });
      setApiKeyInput('');
      fetchStatus();
      setTimeout(() => {
        setShowKeyConfig(false);
        setKeyConfigMessage(null);
      }, 1800);
    } catch (err: any) {
      setKeyConfigMessage({
        type: 'error',
        text: err?.message || 'Failed to verify Gemini API key. Ensure key starts with AIzaSy...',
      });
    } finally {
      setSavingKey(false);
    }
  };

  // Render markdown-like simple formatting cleanly
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-xs md:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-semibold text-slate-900 pt-1 text-sm border-b border-slate-200 pb-1">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('> ')) {
            return (
              <blockquote key={idx} className="italic text-slate-600 pl-2 border-l-2 border-blue-600 text-xs py-0.5 bg-blue-50/50 rounded-r">
                {line.replace('> ', '')}
              </blockquote>
            );
          }
          if (line.startsWith('• ') || line.startsWith('- ')) {
            const item = line.replace(/^[•-]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="text-blue-600 select-none">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
              </div>
            );
          }
          if (line.trim() === '') {
            return <div key={idx} className="h-1" />;
          }
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
          );
        })}
      </div>
    );
  };

  const formatInlineMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 font-mono text-xs text-blue-700">$1</code>');
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-105 group border border-blue-500"
          title="Open ATCS Gemini Agent"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
          </div>
          <span className="font-semibold text-sm tracking-wide">ATCS Intelligence</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-mono font-bold tracking-wider">
            GEMINI
          </span>
        </button>
      )}

      {/* Assistant Modal / Slide-Out Panel */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden ${
            isMinimized
              ? 'w-80 h-14'
              : 'w-[92vw] sm:w-[460px] md:w-[500px] h-[640px] max-h-[88vh]'
          }`}
          style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)' }}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">ATCS Intelligence</h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    GEMINI AGENT
                  </span>
                  {agentStatus && (
                    <button
                      onClick={() => setShowKeyConfig(!showKeyConfig)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
                        agentStatus.isConfigured
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                      }`}
                      title={
                        agentStatus.isConfigured
                          ? `Google Gemini Active (${agentStatus.model}). Click to manage API key.`
                          : 'Operating in local intelligence mode. Click to add Google Gemini API key.'
                      }
                    >
                      <Cpu className="w-2.5 h-2.5" />
                      {agentStatus.isConfigured ? agentStatus.model : 'Local Fallback'}
                    </button>
                  )}
                </div>
                {!isMinimized && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <span>{currentContext.label}</span>
                    <span>•</span>
                    <span className="uppercase text-[10px] font-mono font-semibold">{user?.role}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!isMinimized && (
                <>
                  <button
                    onClick={() => setShowKeyConfig(!showKeyConfig)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      showKeyConfig
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Configure Gemini API Key"
                  >
                    <Key className="w-4 h-4" />
                  </button>
                  <button
                    onClick={clearChat}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Clear conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Key Configuration Overlay Panel */}
          {showKeyConfig && !isMinimized && (
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-600" />
                  Gemini API Key Configuration
                </span>
                <button
                  onClick={() => setShowKeyConfig(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-500 mb-3">
                {agentStatus?.isConfigured
                  ? `Active Key: ${agentStatus.maskedKey || 'Configured'} (${agentStatus.model}). You can update it below or in backend/.env.`
                  : 'Currently operating in local rules mode. Enter your Google Gemini API key below or set GEMINI_API_KEY in backend/.env.'}
              </p>

              <form onSubmit={handleSaveApiKey} className="space-y-2.5">
                <div>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter Google Gemini API Key (starts with AIzaSy...)"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-600"
                    disabled={savingKey}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-600 text-slate-700"
                    disabled={savingKey}
                  >
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Recommended)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Latest Speed)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (High Reasoning)</option>
                  </select>

                  <button
                    type="submit"
                    disabled={savingKey || !apiKeyInput.trim()}
                    className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {savingKey ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Save & Verify Key'
                    )}
                  </button>
                </div>

                {keyConfigMessage && (
                  <div
                    className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                      keyConfigMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {keyConfigMessage.type === 'success' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    <span>{keyConfigMessage.text}</span>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Body Content (Visible when not minimized) */}
          {!isMinimized && (
            <>
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-3.5 shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <p className="text-xs md:text-sm whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        renderFormattedText(msg.text)
                      )}

                      {/* Sources pills if available */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            <span>Authoritative ATCS Sources:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {msg.sources.map((src, i) => (
                              <span
                                key={i}
                                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200"
                                title={src.summary}
                              >
                                {src.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-slate-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}

                {/* Thinking Indicator */}
                {loading && (
                  <div className="flex items-start gap-2 text-slate-500 text-xs">
                    <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-none text-xs text-slate-600 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                      <span>Gemini Agent is analyzing authoritative ATCS records...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Contextual Suggestions Drawer */}
              <div className="border-t border-slate-200 bg-white">
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="w-full px-4 py-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3 h-3 text-blue-600" />
                    <span>Suggested Questions for {currentContext.label}</span>
                  </span>
                  {showSuggestions ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                </button>

                {showSuggestions && (
                  <div className="px-4 pb-2.5 pt-1 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {getSuggestedQuestions().map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        disabled={loading}
                        className="text-left text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask Gemini about ${currentContext.label.toLowerCase()}...`}
                    disabled={loading}
                    className="flex-1 px-3.5 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 text-slate-900 placeholder-slate-400 disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!inputMessage.trim() || loading}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title="Send query to Gemini Agent"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-1.5 text-[10px] text-center text-slate-400">
                  Read-only intelligence layer powered by Google Gemini. Financial decisions are governed by SpendDecisionEngine.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default AIAssistantDrawer;
