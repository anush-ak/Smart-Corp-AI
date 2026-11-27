import React, { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit,
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
  Search,
  AlignLeft,
  Download,
  BookOpen,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CitationPopover } from '../components/CitationPopover';
import {
  DocumentItem,
  DocumentDetail,
  KnowledgeSearchResult,
  Citation,
  ChatMessage,
} from '../types';
import { API_BASE_URL } from '../config';
import { PageHeader, Button, Badge, Modal, ErrorBanner } from '../components/ui/Primitives';

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
    label: 'Company Leave Policy',
    query: 'What is our company leave policy?',
  },
  {
    label: 'Remote Work Rules',
    query: 'What are the remote and hybrid work eligibility rules, anchor days, and core working hours?',
  },
  {
    label: 'Employee Onboarding Process',
    query: 'Summarize the employee onboarding process and orientation guidelines.',
  },
  {
    label: 'HR Department Responsibilities',
    query: 'What are the responsibilities of the HR department regarding leave, approvals, and policy compliance?',
  },
  {
    label: 'Project Workflow Docs',
    query: 'Which documents explain our project workflow, hybrid collaboration, and approval guidelines?',
  },
];

export const KnowledgeChatPage: React.FC = () => {
  const { user, token } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Search state
  const [docSearch, setDocSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Document Inspector Modal
  const [inspectedDoc, setInspectedDoc] = useState<DocumentDetail | null>(null);
  const [isLoadingDocDetail, setIsLoadingDocDetail] = useState<boolean>(false);
  const [docSummary, setDocSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Upload PDF Modal
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadCategory, setUploadCategory] = useState<string>('HR & People Ops');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = user?.role === 'Admin' || user?.role === 'HR';

  const fetchDocuments = async () => {
    if (!token) return;
    try {
      setIsLoadingDocs(true);
      const res = await fetch(`${API_BASE_URL}/api/documents`, {
        headers: { Authorization: `Bearer ${token}` },
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

  // Semantic + metadata search across Company Brain
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = docSearch.trim();
    if (!q || !token) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/documents/search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data: KnowledgeSearchResult = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Knowledge search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setDocSearch('');
    setSearchResults(null);
  };

  // Open Document Viewer
  const openDocumentInspector = async (docId: number) => {
    if (!token) return;
    setIsLoadingDocDetail(true);
    setDocSummary(null);
    setDocError(null);
    setInspectedDoc(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to load document (${res.status})`);
      }
      const data: DocumentDetail = await res.json();
      setInspectedDoc(data);
    } catch (err: any) {
      setDocError(err.message || 'Unable to open document.');
    } finally {
      setIsLoadingDocDetail(false);
    }
  };

  const handleOpenByFilename = (filename: string) => {
    const match = documents.find(
      (d) => d.filename.toLowerCase() === filename.toLowerCase()
    );
    if (match) openDocumentInspector(match.id);
  };

  const handleSummarizeDoc = async () => {
    if (!inspectedDoc || !token) return;
    setIsSummarizing(true);
    setDocError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/documents/${inspectedDoc.id}/summarize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Summarization failed (${res.status})`);
      const data = await res.json();
      setDocSummary(data.summary);
    } catch (err: any) {
      setDocError(err.message || 'Failed to generate summary');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!inspectedDoc || !token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/documents/${inspectedDoc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('PDF file unavailable');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = inspectedDoc.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDocError(err.message || 'Unable to download PDF');
    }
  };

  // Ask Company Brain
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
        related_documents: data.related_documents || [],
        has_evidence: data.has_evidence !== false && (data.citations || []).length > 0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error retrieving answer: ${err.message || 'Unable to connect to Knowledge API.'}`,
        has_evidence: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !token) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadTitle) formData.append('title', uploadTitle);
    formData.append('category', uploadCategory);

    try {
      const res = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed with status ${res.status}`);
      }
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

  const renderMessageContent = (content: string, citations?: Citation[]) => {
    const citationRegex = /\[([^,\n\]]+?),\s*(?:Page|Pg)\s*([0-9]+)\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(content)) !== null) {
      const start = match.index;
      const end = citationRegex.lastIndex;

      if (start > lastIndex) {
        elements.push(<span key={`text-${lastIndex}`}>{content.substring(lastIndex, start)}</span>);
      }

      const rawFilename = match[1].trim();
      const rawPage = parseInt(match[2], 10);

      const matching =
        citations?.find(
          (c) =>
            c.filename.toLowerCase().includes(rawFilename.toLowerCase()) &&
            Number(c.page) === rawPage
        ) || citations?.find((c) => c.filename.toLowerCase().includes(rawFilename.toLowerCase()));

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
      elements.push(<span key={`text-${lastIndex}`}>{content.substring(lastIndex)}</span>);
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

  const filteredDocs = docSearch.trim()
    ? documents.filter(
        (d) =>
          d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
          d.filename.toLowerCase().includes(docSearch.toLowerCase()) ||
          d.category.toLowerCase().includes(docSearch.toLowerCase())
      )
    : documents;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-canvas text-text-primary transition-colors">
      <PageHeader
        title="Company Brain"
        subtitle="Organizational knowledge assistant grounded in tenant-isolated company documents"
        icon={BrainCircuit}
        badge={
          <Badge tone="emerald">
            <Database size={10} />
            <span>RAG Active</span>
          </Badge>
        }
        actions={
          <Badge tone="indigo">
            <Shield size={10} />
            <span>Org #{user?.org_id}</span>
          </Badge>
        }
      />

      {/* Main 2-Column Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Knowledge Library & Search */}
        <aside className="hidden md:flex w-80 border-r border-border bg-surface flex-col shrink-0">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers size={14} className="text-text-muted" strokeWidth={1.75} />
                <h2 className="text-xs font-semibold text-text-primary tracking-wide uppercase font-mono">
                  Knowledge Index
                </h2>
                <Badge tone="neutral">{documents.length}</Badge>
              </div>

              {canUpload && (
                <Button size="sm" onClick={() => setUploadModalOpen(true)}>
                  <Upload size={12} strokeWidth={2} />
                  <span>Upload PDF</span>
                </Button>
              )}
            </div>

            {/* Search Knowledge Base */}
            <form onSubmit={handleSearch} className="relative flex items-center">
              <Search
                size={13}
                className="absolute left-2.5 text-text-muted pointer-events-none"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Search policies & excerpts..."
                className="w-full pl-8 pr-8 py-1.5 bg-canvas border border-border rounded-md text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-indigo-500"
              />
              {docSearch && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 text-text-muted hover:text-text-primary cursor-pointer"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Semantic Chunk Search Matches */}
            {isSearching && (
              <div className="p-3 text-xs text-text-muted font-mono flex items-center gap-2">
                <Loader2 size={13} className="animate-spin text-indigo-500" />
                <span>Searching vector index...</span>
              </div>
            )}

            {searchResults && searchResults.chunks.length > 0 && (
              <div className="space-y-1.5 pb-2 mb-2 border-b border-border">
                <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-500 px-1">
                  Matching Excerpts ({searchResults.chunks.length})
                </div>
                {searchResults.chunks.slice(0, 4).map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleOpenByFilename(ch.filename)}
                    className="w-full text-left p-2.5 rounded-lg bg-indigo-500/5 border border-indigo-500/20 hover:border-indigo-500/40 transition-colors space-y-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                      <span className="truncate">{ch.filename}</span>
                      <span>Pg {ch.page}</span>
                    </div>
                    <p className="text-[11px] text-text-muted line-clamp-2">{ch.excerpt}</p>
                  </button>
                ))}
              </div>
            )}

            {isLoadingDocs ? (
              <div className="py-12 text-center text-xs text-text-muted flex flex-col items-center space-y-2">
                <Loader2 size={16} className="animate-spin text-indigo-500" />
                <span>Scanning tenant document index...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-10 px-4 text-center rounded-lg border border-dashed border-border text-xs text-text-muted">
                <FileText size={22} className="mx-auto mb-2 opacity-60" strokeWidth={1.5} />
                <p className="text-text-primary font-medium">No matching documents</p>
                <p className="mt-1 text-[11px]">
                  {canUpload
                    ? 'Upload a company PDF or clear your search filter.'
                    : 'Contact your Admin or HR to upload internal policies.'}
                </p>
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => openDocumentInspector(doc.id)}
                  className="w-full text-left p-3 rounded-lg bg-canvas border border-border hover:border-indigo-500/40 transition-colors group cursor-pointer"
                >
                  <div className="flex items-start space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded bg-surface border border-border flex items-center justify-center shrink-0 text-indigo-500 mt-0.5">
                      <FileText size={14} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-medium text-text-primary truncate group-hover:text-indigo-500 transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-[11px] font-mono text-text-muted truncate">
                        {doc.filename}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px] font-mono text-text-muted tabular-nums">
                    <Badge tone="neutral">{doc.category}</Badge>
                    <span>
                      {doc.chunk_count} chunks • {formatFileSize(doc.file_size)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-3 border-t border-border bg-surface text-[10px] font-mono text-text-muted flex items-center justify-between">
            <span className="flex items-center space-x-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">Tenant isolated: org_id={user?.org_id}</span>
            </span>
            <span>Click doc to inspect</span>
          </div>
        </aside>

        {/* Right Column: Conversational Company Brain */}
        <main className="flex-1 flex flex-col overflow-hidden bg-canvas">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-3xl mx-auto w-full space-y-6">
              {messages.length === 0 ? (
                <div className="py-10 px-6 sm:px-8 rounded-xl bg-surface border border-border text-center space-y-5 my-auto">
                  <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center mx-auto">
                    <BrainCircuit size={22} strokeWidth={1.75} />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h2 className="text-base font-semibold text-text-primary">
                      Company Brain Knowledge Assistant
                    </h2>
                    <p className="text-xs text-text-muted mt-2 leading-relaxed">
                      Ask questions about leave policies, onboarding workflows, HR responsibilities, or remote work guidelines. Answers are strictly grounded in your organization’s verified documents.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border text-left">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block mb-2.5">
                      Suggested Company Questions
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PROMPT_CHIPS.slice(0, 4).map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAsk(chip.query)}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-canvas border border-border hover:border-indigo-500/40 hover:bg-indigo-500/5 text-left text-xs transition-colors group cursor-pointer"
                        >
                          <span className="font-medium text-text-primary group-hover:text-indigo-500 transition-colors">
                            {chip.label}
                          </span>
                          <ArrowRight
                            size={13}
                            className="text-text-muted group-hover:text-indigo-500 transition-colors shrink-0"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center space-x-2 mb-1 text-[11px] font-mono text-text-muted">
                      <span>{msg.role === 'user' ? 'You' : 'SmartCorp Grounded AI'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`rounded-xl p-4 sm:p-5 text-xs leading-relaxed max-w-2xl border ${
                        msg.role === 'user'
                          ? 'bg-elevated border-border text-text-primary'
                          : 'bg-surface border-border text-text-primary'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="space-y-3">
                          {msg.has_evidence === false && (
                            <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-300 text-[11px] font-mono">
                              No supporting information found in uploaded company documents.
                            </div>
                          )}

                          <div className="whitespace-pre-wrap leading-relaxed text-text-primary">
                            {renderMessageContent(msg.content, msg.citations)}
                          </div>

                          {/* Referenced Documents (Click to Open) */}
                          {msg.related_documents && msg.related_documents.length > 0 && (
                            <div className="pt-3 border-t border-border">
                              <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1.5">
                                Referenced Documents
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.related_documents.map((rd) => (
                                  <button
                                    key={rd.id}
                                    type="button"
                                    onClick={() => openDocumentInspector(rd.id)}
                                    className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-md bg-canvas hover:bg-subtle border border-border text-[11px] font-medium text-text-primary hover:text-indigo-500 transition-colors cursor-pointer"
                                  >
                                    <BookOpen size={11} className="text-indigo-500" />
                                    <span>{rd.title}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {msg.citations && msg.citations.length > 0 && (
                            <div className="pt-3 border-t border-border">
                              <div className="flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
                                <FileCheck2 size={12} className="text-emerald-500" strokeWidth={1.75} />
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

              {isSubmitting && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center space-x-2 mb-1 text-[11px] font-mono text-text-muted">
                    <span>SmartCorp Grounded AI</span>
                    <span>•</span>
                    <span>Searching</span>
                  </div>
                  <div className="rounded-xl p-4 bg-surface border border-border flex items-center space-x-2.5 text-xs text-text-muted">
                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                    <span className="font-mono">Retrieving tenant-verified chunks & citations...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Bar */}
          <div className="p-4 sm:p-5 border-t border-border bg-surface shrink-0">
            <div className="max-w-3xl mx-auto w-full space-y-2.5">
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted shrink-0 mr-1">
                  Quick Ask:
                </span>
                {PROMPT_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAsk(chip.query)}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-canvas hover:bg-subtle text-text-muted hover:text-text-primary border border-border hover:border-indigo-500/40 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk(inputQuery);
                }}
                className="relative flex items-center"
              >
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask Company Brain anything about policies, onboarding, or HR rules..."
                  disabled={isSubmitting}
                  className="w-full bg-canvas border border-border focus:border-indigo-500 rounded-lg pl-4 pr-12 py-3 text-xs text-text-primary placeholder:text-text-muted/60 outline-none transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isSubmitting}
                  className="absolute right-2 px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:bg-subtle text-white disabled:text-text-muted transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
                  title="Send Question"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2} />}
                </button>
              </form>

              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted px-1">
                <span>Strictly grounded in uploaded tenant documents</span>
                <span>Role: {user?.role}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Document Inspector & Summarizer Modal */}
      <Modal
        open={isLoadingDocDetail || !!inspectedDoc || !!docError}
        onClose={() => {
          setInspectedDoc(null);
          setDocError(null);
          setDocSummary(null);
        }}
        title={inspectedDoc?.title || 'Document Inspector'}
        subtitle={inspectedDoc ? `${inspectedDoc.filename} • ${inspectedDoc.category}` : undefined}
        icon={BookOpen}
        maxWidth="max-w-2xl"
      >
        {isLoadingDocDetail ? (
          <div className="py-12 flex items-center justify-center space-x-2 text-xs font-mono text-text-muted">
            <Loader2 size={16} className="animate-spin text-indigo-500" />
            <span>Loading document pages...</span>
          </div>
        ) : docError ? (
          <ErrorBanner message={docError} />
        ) : (
          inspectedDoc && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-text-muted">
                  <Badge tone="neutral">{inspectedDoc.chunk_count} chunks</Badge>
                  <Badge tone="neutral">{formatFileSize(inspectedDoc.file_size)}</Badge>
                  <span>Uploaded by {inspectedDoc.uploader_name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={isSummarizing}
                    onClick={handleSummarizeDoc}
                  >
                    <AlignLeft size={12} className="text-indigo-500" />
                    <span>Summarize</span>
                  </Button>
                  {inspectedDoc.has_pdf_file && (
                    <Button variant="primary" size="sm" onClick={handleDownloadPdf}>
                      <Download size={12} />
                      <span>Download PDF</span>
                    </Button>
                  )}
                </div>
              </div>

              {docSummary && (
                <div className="p-3.5 rounded-lg bg-indigo-500/5 border border-indigo-500/25 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-500 font-semibold">
                    AI Document Summary
                  </div>
                  <div className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                    {docSummary}
                  </div>
                </div>
              )}

              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {inspectedDoc.pages.length === 0 ? (
                  <div className="text-xs text-text-muted py-6 text-center">
                    No extracted text pages available.
                  </div>
                ) : (
                  inspectedDoc.pages.map((p) => (
                    <div
                      key={p.page}
                      className="p-3.5 rounded-lg bg-canvas border border-border space-y-1.5"
                    >
                      <div className="text-[10px] font-mono uppercase text-text-muted">
                        Page {p.page}
                      </div>
                      <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                        {p.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {inspectedDoc.related_documents.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
                    Related Knowledge Documents
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {inspectedDoc.related_documents.map((rd) => (
                      <button
                        key={rd.id}
                        type="button"
                        onClick={() => openDocumentInspector(rd.id)}
                        className="px-2.5 py-1 rounded-md bg-subtle hover:bg-elevated border border-border text-[11px] font-medium text-text-primary cursor-pointer"
                      >
                        {rd.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </Modal>

      {/* Upload PDF Modal */}
      <Modal
        open={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadError(null);
        }}
        title="Upload Policy Document"
        subtitle="PDFs are chunked and indexed strictly within your organization"
        icon={Upload}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
          {uploadError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start space-x-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-text-primary mb-1.5">
              PDF Document <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setUploadFile(e.target.files[0]);
                  if (!uploadTitle) {
                    setUploadTitle(e.target.files[0].name.replace('.pdf', '').replace(/_/g, ' '));
                  }
                }
              }}
              className="w-full text-xs text-text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-elevated file:text-text-primary file:cursor-pointer cursor-pointer bg-canvas rounded-lg p-2 border border-border"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-text-primary mb-1.5">
              Document Title (Optional)
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g., Annual Travel & Expense Policy"
              className="w-full bg-canvas border border-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-text-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-text-primary mb-1.5">
              Category
            </label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="w-full bg-canvas border border-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-text-primary outline-none"
            >
              <option value="HR & People Ops">HR & People Ops</option>
              <option value="Operations">Operations</option>
              <option value="IT & Security">IT & Security</option>
              <option value="Legal & Compliance">Legal & Compliance</option>
              <option value="General Policy">General Policy</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={() => setUploadModalOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!uploadFile || isUploading}
              isLoading={isUploading}
            >
              {isUploading ? 'Indexing Chunks...' : 'Ingest & Index'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
