import { BookOpen, Check, Database, FileText, Loader2, Plus, ShieldCheck, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, PageBody, PageHeader, Tabs } from '@/components/ui/primitives'
import { DataTable } from '@/components/ui/data-table'
import { FilterChip, Input, Select } from '@/components/ui/input-field'
import { AccessBadge, DocumentStatusBadge } from '@/components/ui/status-badge'
import { EmptyState, ErrorState, LoadingState, NoResultsState, ProgressBar } from '@/components/ui/states'
import { TableToolbar } from '@/components/ui/table-toolbar'
import { Modal, ConfirmationDialog } from '@/components/ui/overlays'
import { useToast } from '@/components/ui/toast'
import { FileTypeMark, KnowledgeBaseCard } from '@/components/knowledge/document-components'
import { useDocuments, useKnowledgeBases } from '@/hooks/use-api'
import { usePermissions } from '@/hooks/use-permissions'
import { useDebouncedValue } from '@/hooks/use-async'
import { knowledgeService } from '@/services'
import type { Department, KnowledgeDocument } from '@/types'
import { cn, formatBytes, formatNumber, formatRelativeTime } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Upload pipeline stages                                                      */
/* -------------------------------------------------------------------------- */

const UPLOAD_STAGES = [
  { key: 'validate', label: 'Validated', detail: 'Type, size and malware check passed' },
  { key: 'upload', label: 'Uploaded', detail: 'Stored in object storage' },
  { key: 'process', label: 'Extracting text', detail: 'Layout-aware text extraction' },
  { key: 'index', label: 'Embedding & indexing', detail: 'Vectors written to pgvector' },
  { key: 'ready', label: 'Ready for AI', detail: 'Available to permitted agents' },
] as const

type UploadStage = (typeof UPLOAD_STAGES)[number]['key'] | 'failed'

function UploadDialog({
  open,
  onClose,
  bases,
  defaultBaseId,
}: {
  open: boolean
  onClose: () => void
  bases: { id: string; name: string; department: Department }[]
  defaultBaseId?: string
}) {
  const { toast } = useToast()
  const [stage, setStage] = useState<UploadStage>('validate')
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<{ name: string; sizeBytes: number; extension: KnowledgeDocument['extension'] }[]>([])
  const [baseId, setBaseId] = useState(defaultBaseId ?? bases[0]?.id ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (!open) {
      timers.current.forEach(window.clearTimeout)
      timers.current = []
      setStage('validate')
      setProgress(0)
      setFiles([])
      return
    }
    setBaseId(defaultBaseId ?? bases[0]?.id ?? '')
  }, [open, defaultBaseId, bases])

  const acceptFiles = (list: FileList | null) => {
    if (!list) return
    const accepted: typeof files = []
    Array.from(list).forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() as KnowledgeDocument['extension']
      const supported = ['pdf', 'docx', 'xlsx', 'pptx', 'md', 'txt', 'csv'].includes(extension)
      if (!supported) {
        toast({ title: `${file.name} is not a supported format`, description: 'Supported: PDF, DOCX, XLSX, PPTX, MD, TXT, CSV.', tone: 'danger' })
        return
      }
      if (file.size > 25 * 1024 * 1024) {
        toast({ title: `${file.name} exceeds the 25 MB limit`, tone: 'danger' })
        return
      }
      accepted.push({ name: file.name, sizeBytes: file.size, extension })
    })
    setFiles((current) => [...current, ...accepted])
  }

  const startUpload = () => {
    if (files.length === 0) return
    setProgress(0)
    setStage('upload')

    // Simulated pipeline walk so the demo shows the real state machine.
    const schedule: [number, () => void][] = [
      [500, () => { setStage('process'); setProgress(35) }],
      [1300, () => { setStage('index'); setProgress(72) }],
      [2200, () => { setStage('ready'); setProgress(100) }],
    ]
    schedule.forEach(([delay, run]) => {
      timers.current.push(window.setTimeout(run, delay))
    })
    timers.current.push(
      window.setTimeout(() => {
        void knowledgeService.upload({
          name: files[0].name,
          sizeBytes: files[0].sizeBytes,
          extension: files[0].extension,
          knowledgeBaseId: baseId,
        })
        toast({
          title: 'Upload complete',
          description: `${files[0].name} is ready for retrieval in ${bases.find((base) => base.id === baseId)?.name ?? 'the knowledge base'}.`,
          tone: 'success',
        })
      }, 2600),
    )
  }

  const stageIndex = UPLOAD_STAGES.findIndex((entry) => entry.key === stage)
  const complete = stage === 'ready'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add knowledge"
      description="Documents are validated, extracted, chunked, embedded and indexed before any agent can answer from them."
      size="lg"
      dismissible={stage === 'validate' || complete}
      footer={
        stage === 'validate' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={startUpload} disabled={files.length === 0} iconLeft={<Upload aria-hidden />}>
              Start processing
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose} disabled={!complete}>
            {complete ? 'Done' : 'Processing…'}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {/* Destination --------------------------------------------------- */}
        <Select
          label="Knowledge base"
          value={baseId}
          onChange={(event) => setBaseId(event.target.value)}
          options={bases.map((base) => ({ value: base.id, label: `${base.name} · ${base.department}` }))}
          disabled={stage !== 'validate'}
        />

        {stage === 'validate' ? (
          <>
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                acceptFiles(event.dataTransfer.files)
              }}
              className={cn(
                'sc-dotted rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                dragging ? 'border-brand-400 bg-brand-50/60' : 'border-line-strong bg-surface-muted/40',
              )}
            >
              <span className="mx-auto grid size-9 place-items-center rounded-md border border-line bg-surface text-ink-400 shadow-xs">
                <Upload className="size-4" aria-hidden />
              </span>
              <p className="mt-2.5 text-body font-medium text-ink-800">Drag files here, or browse</p>
              <p className="mt-1 text-caption text-ink-400">
                PDF, DOCX, XLSX, PPTX, MD, TXT, CSV · up to 25 MB each · scanned PDFs are OCR-processed
              </p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>
                Browse files
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                aria-label="Choose files to upload"
                onChange={(event) => acceptFiles(event.target.files)}
              />
            </div>

            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
                    <FileTypeMark extension={file.extension} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-body-sm text-ink-800">{file.name}</span>
                    <span className="text-caption text-ink-400">{formatBytes(file.sizeBytes)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="grid size-6 place-items-center rounded-sm text-ink-300 hover:bg-surface-muted hover:text-ink-600"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-md border border-line-subtle bg-surface-muted px-3 py-2.5">
              <p className="text-caption font-medium text-ink-600">What happens next</p>
              <p className="mt-1 text-caption leading-relaxed text-ink-500">
                Access level is inherited from the knowledge base and can be tightened afterwards. The document becomes
                retrievable only after indexing completes — a partially indexed document never answers questions.
              </p>
            </div>
          </>
        ) : (
          /* Pipeline progress ------------------------------------------- */
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-body-sm">
                <span className="font-medium text-ink-800">
                  {complete ? 'Ready for AI' : UPLOAD_STAGES[Math.max(0, stageIndex)]?.label ?? 'Processing'}
                </span>
                <span className="tnum text-ink-500">{progress}%</span>
              </div>
              <ProgressBar value={progress} tone={complete ? 'success' : 'brand'} label={`Upload progress ${progress}%`} />
            </div>

            <ol className="space-y-2">
              {UPLOAD_STAGES.map((entry, index) => {
                const done = complete || index < stageIndex
                const active = !complete && index === stageIndex
                return (
                  <li key={entry.key} className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
                        done ? 'border-success-200 bg-success-50 text-success-700' : active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-300',
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="size-3" /> : active ? <Loader2 className="size-3 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
                    </span>
                    <div className="min-w-0">
                      <p className={cn('text-body-sm', done || active ? 'font-medium text-ink-800' : 'text-ink-400')}>{entry.label}</p>
                      <p className="text-caption text-ink-400">{entry.detail}</p>
                    </div>
                  </li>
                )
              })}
            </ol>

            {complete && (
              <div className="rounded-md border border-success-200 bg-success-50/60 px-3 py-2.5 text-body-sm text-success-800">
                {files[0]?.name} is now retrievable by agents permitted to use this knowledge base. Every retrieval will
                cite it with page and section references.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Create knowledge base dialog                                                */
/* -------------------------------------------------------------------------- */

function CreateBaseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState<Department>('Operations')
  const [accessLevel, setAccessLevel] = useState('department')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setDescription('')
      setDepartment('Operations')
      setAccessLevel('department')
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create knowledge base"
      description="A knowledge base is the unit of access control — its level determines what retrieval can reach."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!name.trim() || !description.trim()}
            onClick={async () => {
              setBusy(true)
              await knowledgeService.createBase({ name, description, department, accessLevel })
              setBusy(false)
              toast({ title: `“${name}” created`, description: 'Upload documents to make it retrievable.', tone: 'success' })
              onCreated()
              onClose()
            }}
          >
            Create knowledge base
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Procurement Policies" required />
        <div>
          <label htmlFor="kb-description" className="mb-1.5 block text-body-sm font-medium text-ink-700">
            Description
          </label>
          <textarea
            id="kb-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="What this knowledge base covers, and who it is for."
            className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-body text-ink-900 shadow-xs placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
          <p className="mt-1.5 text-caption text-ink-400">
            The description is shown to users and helps the router decide when this knowledge is relevant.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Owning department"
            value={department}
            onChange={(event) => setDepartment(event.target.value as Department)}
            options={['HR', 'Finance', 'Support', 'Engineering', 'Operations', 'General'].map((value) => ({ value, label: value }))}
          />
          <Select
            label="Access level"
            value={accessLevel}
            onChange={(event) => setAccessLevel(event.target.value)}
            options={[
              { value: 'organization', label: 'Organization — all employees' },
              { value: 'department', label: 'Department — owning team only' },
              { value: 'restricted', label: 'Restricted — named users only' },
            ]}
          />
        </div>
        <p className="rounded-md border border-line-subtle bg-surface-muted px-3 py-2.5 text-caption leading-relaxed text-ink-500">
          Access level is enforced at the retrieval layer: documents outside a requester’s scope are filtered inside the
          vector query before similarity ranking, and the exclusion is recorded in the audit log.
        </p>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function KnowledgePage() {
  const navigate = useNavigate()
  const { can, knowledgeScope } = usePermissions()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const bases = useKnowledgeBases()
  const documents = useDocuments()

  const [tab, setTab] = useState<'documents' | 'bases'>('documents')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 180)
  const [baseFilter, setBaseFilter] = useState(searchParams.get('base') ?? '')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [retryTarget, setRetryTarget] = useState<KnowledgeDocument | null>(null)
  const [retrying, setRetrying] = useState(false)

  // Deep links from the command palette and dashboard quick actions.
  useEffect(() => {
    if (searchParams.get('action') === 'upload') {
      setUploadOpen(true)
      searchParams.delete('action')
      setSearchParams(searchParams, { replace: true })
    }
    if (searchParams.get('action') === 'create-base') {
      setCreateOpen(true)
      searchParams.delete('action')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const rows = documents.data ?? []
  const filtered = useMemo(
    () =>
      rows.filter((document) => {
        if (baseFilter && document.knowledgeBaseId !== baseFilter) return false
        if (departmentFilter && document.department !== departmentFilter) return false
        if (statusFilter && document.status !== statusFilter) return false
        if (typeFilter && document.extension !== typeFilter) return false
        if (debouncedQuery) {
          const haystack = `${document.name} ${document.tags.join(' ')} ${document.ownerName}`.toLowerCase()
          if (!haystack.includes(debouncedQuery.toLowerCase())) return false
        }
        return true
      }),
    [rows, baseFilter, departmentFilter, statusFilter, typeFilter, debouncedQuery],
  )

  const activeFilters = [
    baseFilter && { label: 'Knowledge base', value: bases.data?.find((base) => base.id === baseFilter)?.name ?? baseFilter, clear: () => setBaseFilter('') },
    departmentFilter && { label: 'Department', value: departmentFilter, clear: () => setDepartmentFilter('') },
    statusFilter && { label: 'Status', value: statusFilter.replace('_', ' '), clear: () => setStatusFilter('') },
    typeFilter && { label: 'Type', value: typeFilter.toUpperCase(), clear: () => setTypeFilter('') },
  ].filter(Boolean) as { label: string; value: string; clear: () => void }[]

  const processingCount = rows.filter((document) => document.status !== 'ready').length
  const readyCount = rows.filter((document) => document.status === 'ready').length

  const exportCsv = () => {
    const header = ['Name', 'Department', 'Version', 'Owner', 'Status', 'Access', 'Updated']
    const lines = filtered.map((document) =>
      [document.name, document.department, document.version, document.ownerName, document.status, document.accessLevel, document.updatedAt].join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = 'smartcorp-knowledge.csv'
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Export started', description: `${filtered.length} documents written to CSV.`, tone: 'success' })
  }

  return (
    <>
      <PageHeader
        title="Knowledge"
        description="Manage the information your AI can understand and use. Everything retrievable is indexed, versioned and permission-checked."
        actions={
          <>
            {can('knowledge:manage') && (
              <>
                <Button variant="secondary" iconLeft={<Plus aria-hidden />} onClick={() => setCreateOpen(true)}>
                  New knowledge base
                </Button>
                <Button variant="primary" iconLeft={<Upload aria-hidden />} onClick={() => setUploadOpen(true)}>
                  Upload documents
                </Button>
              </>
            )}
          </>
        }
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Database className="size-3.5 text-ink-400" aria-hidden />
              {bases.data?.length ?? 0} knowledge bases
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="size-3.5 text-ink-400" aria-hidden />
              {formatNumber(rows.length)} documents
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-success-600" aria-hidden />
              {readyCount} ready for AI
            </span>
            {processingCount > 0 && (
              <span className="flex items-center gap-1.5 text-info-700">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {processingCount} in pipeline
              </span>
            )}
          </>
        }
        tabs={
          <Tabs
            ariaLabel="Knowledge views"
            value={tab}
            onChange={(value) => setTab(value as 'documents' | 'bases')}
            items={[
              { id: 'documents', label: 'Documents', count: rows.length },
              { id: 'bases', label: 'Knowledge bases', count: bases.data?.length ?? 0 },
            ]}
          />
        }
      />

      <PageBody className="space-y-4">
        {/* Filters ------------------------------------------------------- */}
        <TableToolbar
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search documents, tags or owners…"
          filters={[
            {
              id: 'base',
              label: 'Knowledge base',
              value: baseFilter,
              onChange: setBaseFilter,
              options: [{ value: '', label: 'All knowledge bases' }, ...(bases.data ?? []).map((base) => ({ value: base.id, label: base.name }))],
            },
            {
              id: 'department',
              label: 'Department',
              value: departmentFilter,
              onChange: setDepartmentFilter,
              hideBelow: 'md',
              options: [{ value: '', label: 'All departments' }, ...['HR', 'Finance', 'Support', 'Engineering', 'Operations'].map((value) => ({ value, label: value }))],
            },
            {
              id: 'status',
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              hideBelow: 'lg',
              options: [
                { value: '', label: 'Any status' },
                { value: 'ready', label: 'Ready for AI' },
                { value: 'processing', label: 'Processing' },
                { value: 'indexing', label: 'Indexing' },
                { value: 'failed', label: 'Failed' },
              ],
            },
            {
              id: 'type',
              label: 'File type',
              value: typeFilter,
              onChange: setTypeFilter,
              hideBelow: 'lg',
              options: [{ value: '', label: 'Any type' }, ...['pdf', 'docx', 'xlsx', 'pptx', 'md', 'csv'].map((value) => ({ value, label: value.toUpperCase() }))],
            },
          ]}
          showReset={activeFilters.length > 0}
          onReset={() => {
            setBaseFilter('')
            setDepartmentFilter('')
            setStatusFilter('')
            setTypeFilter('')
            setQuery('')
          }}
          onExport={exportCsv}
        />

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((filter) => (
              <FilterChip key={filter.label} label={filter.label} value={filter.value} onRemove={filter.clear} />
            ))}
          </div>
        )}

        {/* Content ------------------------------------------------------- */}
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-line bg-surface-muted/50 px-3 py-2.5">
          <ShieldCheck className="mt-px size-4 shrink-0 text-ink-400" aria-hidden />
          <p className="text-body-sm text-ink-600">
            You are seeing knowledge inside your scope ({knowledgeScope.length} knowledge{' '}
            {knowledgeScope.length === 1 ? 'base' : 'bases'}). Documents outside it — and documents above your access
            level — are filtered by the API and the retrieval layer, so they never reach an answer.
          </p>
        </div>
        {documents.error ? (
          <ErrorState
            title="Knowledge could not be loaded"
            cause={documents.error.message}
            status={`http_${documents.error.status ?? 'network'}`}
            onRetry={documents.reload}
          />
        ) : tab === 'bases' ? (
          bases.initialLoading ? (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <LoadingState rows={3} />
                </Card>
              ))}
            </div>
          ) : (bases.data ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={BookOpen}
                title="No knowledge bases yet"
                description="Create your first knowledge base to give SmartCorp trusted organisational context. Nothing is retrievable until it is indexed here."
                primaryAction={can('knowledge:manage') ? { label: 'Create knowledge base', onClick: () => setCreateOpen(true), icon: <Plus aria-hidden /> } : undefined}
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {(bases.data ?? []).map((base) => (
                <KnowledgeBaseCard
                  key={base.id}
                  base={base}
                  onOpen={() => setBaseFilter(base.id)}
                  onUpload={can('knowledge:manage') ? () => setUploadOpen(true) : undefined}
                />
              ))}
            </div>
          )
        ) : documents.initialLoading ? (
          <Card>
            <LoadingState rows={6} />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            {rows.length === 0 ? (
              <EmptyState
                icon={Upload}
                title="No documents yet"
                description="Upload a policy, runbook or incident report. SmartCorp will extract, chunk, embed and index it, then agents can cite it with page references."
                primaryAction={can('knowledge:manage') ? { label: 'Upload documents', onClick: () => setUploadOpen(true), icon: <Upload aria-hidden /> } : undefined}
              />
            ) : (
              <NoResultsState
                query={debouncedQuery}
                onClear={() => {
                  setQuery('')
                  setBaseFilter('')
                  setDepartmentFilter('')
                  setStatusFilter('')
                  setTypeFilter('')
                }}
              />
            )}
          </Card>
        ) : (
          <DataTable
            rows={filtered}
            getRowId={(document) => document.id}
            onRowClick={(document) => navigate(`/knowledge/${document.id}`)}
            pageSize={10}
            caption="Indexed knowledge documents with processing status and access level"
            defaultSort={{ columnId: 'updated', direction: 'desc' }}
            columns={[
              {
                id: 'name',
                header: 'Document',
                primary: true,
                sortValue: (document) => document.name,
                cell: (document) => (
                  <div className="flex items-center gap-3">
                    <FileTypeMark extension={document.extension} />
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-medium text-ink-900">{document.name}</p>
                      <p className="truncate text-caption text-ink-400">
                        {document.version} · {formatBytes(document.sizeBytes)} · {document.pages} pages · {document.chunkCount} passages
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                id: 'department',
                header: 'Department',
                sortValue: (document) => document.department,
                cell: (document) => <span className="text-body-sm text-ink-700">{document.department}</span>,
              },
              {
                id: 'owner',
                header: 'Owner',
                sortValue: (document) => document.ownerName,
                hideBelow: 'lg',
                cell: (document) => <span className="text-body-sm text-ink-700">{document.ownerName}</span>,
              },
              {
                id: 'access',
                header: 'Access',
                hideBelow: 'md',
                cell: (document) => <AccessBadge level={document.accessLevel} size="sm" />,
              },
              {
                id: 'status',
                header: 'Status',
                sortValue: (document) => document.status,
                cell: (document) => <DocumentStatusBadge status={document.status} size="sm" />,
              },
              {
                id: 'updated',
                header: 'Updated',
                align: 'right',
                sortValue: (document) => document.updatedAt,
                cell: (document) => <span className="text-caption text-ink-400">{formatRelativeTime(document.updatedAt)}</span>,
              },
              {
                id: 'actions',
                header: 'Actions',
                align: 'right',
                width: '120px',
                cell: (document) =>
                  document.status === 'failed' ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setRetryTarget(document)
                      }}
                      className="text-caption font-semibold text-danger-700 hover:text-danger-800"
                    >
                      Retry processing
                    </button>
                  ) : (
                    <span className="text-caption text-ink-300">—</span>
                  ),
              },
            ]}
            emptyState={{ title: 'No documents match these filters' }}
          />
        )}
      </PageBody>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        bases={bases.data ?? []}
        defaultBaseId={baseFilter || undefined}
      />
      <CreateBaseDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={bases.reload} />

      <ConfirmationDialog
        open={Boolean(retryTarget)}
        onClose={() => setRetryTarget(null)}
        title="Retry processing"
        body={`SmartCorp will re-run extraction, chunking and embedding for “${retryTarget?.name}”. Existing vectors are replaced, not duplicated.`}
        confirmLabel="Retry processing"
        busy={retrying}
        onConfirm={async () => {
          if (!retryTarget) return
          setRetrying(true)
          await knowledgeService.retryProcessing(retryTarget.id)
          setRetrying(false)
          setRetryTarget(null)
          documents.reload()
          toast({ title: 'Processing restarted', description: `${retryTarget.name} is back in the pipeline.`, tone: 'info' })
        }}
      />
    </>
  )
}
