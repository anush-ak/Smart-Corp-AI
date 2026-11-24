import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Upload,
  FileText,
  Send,
  Loader2,
  AlertCircle,
  FileCheck2,
  Database,
  ArrowRight,
  Shield,
  Layers,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CitationPopover } from '../components/CitationPopover';
import { DocumentItem, Citation, ChatMessage } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface PromptChip {
  label: string;
  query: string;
}

const PROMPT_CHIPS: PromptChip[] = [
  {
    label: 'Summarize Leave Policy',
    query: 'Summarize the SmartCorp annual PTO leave accrual, rollover limit, and notice requirements.',
  },
  {
    label: 'Remote Work Rules',
    query: 'What are the remote and hybrid work eligibility rules, anchor days, and core working hours?',
  },
  {
    label: 'Approval & Escalation Policy',
    query: 'What is the required notice period and manager approval timeline for taking leave?',
  },
  {
    label: 'Parental Leave Benefits',
    query: 'What are the parental leave entitlements for primary and secondary caregivers?',
  },
  {
    label: 'Home Office Stipend',
    query: 'What equipment stipends and monthly connectivity allowances do remote employees receive?',
  },
];

export const KnowledgeChatPage: React.FC = () => {
  const { user, token } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadCategory, setUploadCategory] = useState<string>('HR & People Ops');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = user?.role === 'Admin' || user?.role === 'HR';

  // Fetch tenant-isolated documents
  const fetchDocuments = async () => {
    if (!token) return;
    try {
      setIsLoadingDocs(true);
      const res = await fetch(`${API_BASE_URL}/api/documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data: DocumentItem[] = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSubmitting]);

  // Execute knowledge ask query
  const handleAsk = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || isSubmitting || !token) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/knowledge/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (${response.status})`);
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'No answer generated.',
        citations: data.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Knowledge ask error:', err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error retrieving answer: ${err.message || 'Unable to connect to Knowledge API.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAsk(inputQuery);
  };

  // Upload PDF Handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !token) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadTitle) {
      formData.append('title', uploadTitle);
    }
    formData.append('category', uploadCategory);

    try {
      const res = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed with status ${res.status}`);
      }

      // Success: Close modal & refresh document list
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      await fetchDocuments();
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading document');
    } finally {
      setIsUploading(false);
    }
  };

  // Parse inline citations in AI answers into interactive CitationPopover pills
  const renderMessageContent = (content: string, citations?: Citation[]) => {
    const citationRegex = /\[([^,\n\]]+?),\s*(?:Page|Pg)\s*([0-9]+)\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(content)) !== null) {
      const start = match.index;
      const end = citationRegex.lastIndex;

      // Text before citation
      if (start > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`}>{content.substring(lastIndex, start)}</span>
        );
      }

      const rawFilename = match[1].trim();
      const rawPage = parseInt(match[2], 10);

      // Find matching source chunk in returned citations
      const matching = citations?.find(
        (c) =>
          c.filename.toLowerCase().includes(rawFilename.toLowerCase()) &&
          Number(c.page) === rawPage
      ) || citations?.find(
        (c) => c.filename.toLowerCase().includes(rawFilename.toLowerCase())
      );

      elements.push(
        <CitationPopover
          key={`citation-${rawFilename}-${rawPage}-${start}`}
          filename={rawFilename}
          pageNumber={rawPage}
          excerpt={matching?.excerpt}
        />
      );

      lastIndex = end;
    }

    if (lastIndex < content.length) {
      elements.push(
        <span key={`text-${lastIndex}`}>{content.substring(lastIndex)}</span>
      );
    }

    return elements;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Header */}
      <header className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 bg-surface">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <BookOpen size={15} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
              Grounded RAG Knowledge Assistant
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              100% Deterministic Grounding & Click-to-Verify Inline Citations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-subtle border border-border text-xs font-mono text-zinc-500 dark:text-zinc-400">
            <Database size={12} className="text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
            <span>ChromaDB:</span>
            <span className="text-zinc-800 dark:text-zinc-200">./chroma_data</span>
          </div>

          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-600 dark:text-indigo-300">
            <Shield size={12} strokeWidth={1.75} />
            <span>Org #{user?.org_id}</span>
          </div>
        </div>
      </header>

      {/* Main 2-Column Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Compact Policy Repository Sidebar */}
        <aside className="w-72 sm:w-80 border-r border-border bg-surface flex flex-col shrink-0">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers size={14} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1.75} />
              <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tracking-wide uppercase font-mono">
                Policy Library
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-subtle text-zinc-600 dark:text-zinc-400 border border-border tabular-nums">
                {documents.length}
              </span>
            </div>

            {/* Upload PDF Button - strictly Admin & HR only */}
            {canUpload && (
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                title="Upload PDF Policy Document"
              >
                <Upload size={12} strokeWidth={2} />
                <span>Upload PDF</span>
              </button>
            )}
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoadingDocs ? (
              <div className="py-12 text-center text-xs text-zinc-500 flex flex-col items-center space-y-2">
                <Loader2 size={16} className="animate-spin text-zinc-400" />
                <span>Scanning ChromaDB tenant index...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-lg border border-dashed border-border text-xs text-zinc-500">
                <FileText size={24} className="mx-auto mb-2 text-zinc-400 dark:text-zinc-600" strokeWidth={1.5} />
                <p className="text-zinc-700 dark:text-zinc-400 font-medium">No documents indexed</p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-600">
                  {canUpload
                    ? 'Upload a company PDF to enable grounded answers.'
                    : 'Contact your Admin or HR to upload internal policies.'}
                </p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-lg bg-surface border border-border hover:border-zinc-300 dark:hover:border-white/[0.16] transition-colors group shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2.5 min-w-0">
                      <div className="w-7 h-7 rounded bg-subtle border border-border flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5">
                        <FileText size={14} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors" title={doc.title}>
                          {doc.title}
                        </h3>
                        <p className="text-[11px] font-mono text-zinc-500 truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                    <span className="px-1.5 py-0.5 rounded bg-subtle text-zinc-600 dark:text-zinc-400 border border-border">
                      {doc.category}
                    </span>
                    <div className="flex items-center space-x-2 text-zinc-500">
                      <span>{doc.chunk_count} Chunks</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Left Column Bottom: Multi-tenant ChromaDB Invariant Badge */}
          <div className="p-3 border-t border-border bg-surface text-[10px] font-mono text-zinc-500 flex items-center justify-between">
            <span className="flex items-center space-x-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="truncate">where={`{"org_id": ${user?.org_id}}`}</span>
            </span>
            <span className="text-zinc-400 dark:text-zinc-600 shrink-0">ChromaDB v0.4+</span>
          </div>
        </aside>

        {/* Right Column: Reading-width Q&A Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden bg-canvas">
          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-3xl mx-auto w-full space-y-6">
              {messages.length === 0 ? (
                /* Empty State: Linear/Vercel Aesthetic Hero Card */
                <div className="py-10 px-6 sm:px-8 rounded-xl bg-surface border border-border text-center space-y-5 my-auto shadow-xs">
                  <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    <BookOpen size={22} strokeWidth={1.75} />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Company Policy Knowledge Assistant
                    </h2>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                      Ask questions regarding employee policies, paid leave, remote guidelines, or reimbursement rules. All answers are grounded strictly in uploaded company documents with verifiable citations.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border text-left">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block mb-2.5">
                      Suggested Quick Queries:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PROMPT_CHIPS.slice(0, 4).map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAsk(chip.query)}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-subtle border border-border hover:border-indigo-500/40 hover:bg-indigo-500/5 text-left text-xs transition-colors group cursor-pointer"
                        >
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                            {chip.label}
                          </span>
                          <ArrowRight size={13} className="text-zinc-400 dark:text-zinc-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat Messages */
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1 text-[11px] font-mono text-zinc-500">
                      <span>{msg.role === 'user' ? 'You' : 'SmartCorp Grounded AI'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`rounded-xl p-4 sm:p-5 text-xs leading-relaxed max-w-2xl border shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-subtle border-border text-zinc-900 dark:text-zinc-100'
                          : 'bg-surface border-border text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="space-y-3">
                          <div className="whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200">
                            {renderMessageContent(msg.content, msg.citations)}
                          </div>

                          {/* Sources Cited Pill Bar */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-border">
                              <div className="flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                                <FileCheck2 size={12} className="text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                                <span>Verified Source Excerpts ({msg.citations.length})</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.citations.map((c) => (
                                  <CitationPopover
                                    key={`source-${c.id}`}
                                    filename={c.filename}
                                    pageNumber={c.page}
                                    excerpt={c.excerpt}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* In-Flight Query Indicator */}
              {isSubmitting && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center space-x-2 mb-1 text-[11px] font-mono text-zinc-500">
                    <span>SmartCorp Grounded AI</span>
                    <span>•</span>
                    <span>Thinking</span>
                  </div>
                  <div className="rounded-xl p-4 bg-surface border border-border flex items-center space-x-2.5 text-xs text-zinc-600 dark:text-zinc-400 shadow-xs">
                    <Loader2 size={14} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span className="font-mono">Searching ChromaDB tenant chunks & verifying citations...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Area: Prompt Chips & Clean Input Bar */}
          <div className="p-4 sm:p-6 border-t border-border bg-surface shrink-0">
            <div className="max-w-3xl mx-auto w-full space-y-2.5">
              {/* One-Click Prompt Template Chips anchored right above input bar */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0 mr-1">
                  Prompt Chips:
                </span>
                {PROMPT_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAsk(chip.query)}
                    disabled={isSubmitting}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-subtle hover:bg-elevated text-zinc-700 dark:text-zinc-300 border border-border hover:border-indigo-500/30 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              {/* Form Input */}
              <form onSubmit={handleFormSubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask a policy question... (e.g., 'How many days of paid sick leave do I get?')"
                  disabled={isSubmitting}
                  className="w-full bg-canvas border border-border focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/40 rounded-lg pl-4 pr-12 py-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isSubmitting}
                  className="absolute right-2 px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white disabled:text-zinc-400 dark:disabled:text-zinc-500 transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center shadow-xs"
                  title="Send Question"
                >
                  {isSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} strokeWidth={2} />
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 px-1">
                <span>Answers restricted strictly to uploaded documents</span>
                <span>Role: {user?.role}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Upload PDF Modal (Strictly Admin & HR) */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-surface border border-border p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Upload size={13} strokeWidth={2} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Upload Policy Document
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadModalOpen(false);
                  setUploadError(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start space-x-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" strokeWidth={1.75} />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              {/* File Select */}
              <div>
                <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  PDF Document <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0]);
                      if (!uploadTitle) {
                        setUploadTitle(
                          e.target.files[0].name.replace('.pdf', '').replace(/_/g, ' ')
                        );
                      }
                    }
                  }}
                  className="w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-100 dark:file:bg-white/[0.08] file:text-zinc-700 dark:file:text-zinc-200 hover:file:bg-zinc-200 dark:hover:file:bg-white/[0.12] file:cursor-pointer cursor-pointer bg-canvas rounded-lg p-2 border border-border"
                  required
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Annual Travel & Expense Policy"
                  className="w-full bg-canvas border border-border focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full bg-canvas border border-border focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 outline-none"
                >
                  <option value="HR & People Ops">HR & People Ops</option>
                  <option value="Operations">Operations</option>
                  <option value="IT & Security">IT & Security</option>
                  <option value="Legal & Compliance">Legal & Compliance</option>
                  <option value="General Policy">General Policy</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-subtle text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white disabled:text-zinc-400 dark:disabled:text-zinc-500 font-medium transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  {isUploading && <Loader2 size={13} className="animate-spin" />}
                  <span>{isUploading ? 'Indexing Chunks...' : 'Ingest & Index'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
