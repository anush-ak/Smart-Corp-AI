import { ArrowRight, BookOpen, Bot, Gavel, Lock, ScrollText, ShieldCheck, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BrandMark, BrandWordmark } from '@/components/brand'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { useToast } from '@/components/ui/toast'
import { ROLE_LABELS, useAuth } from '@/contexts/auth-context'
import { useDemoAccounts } from '@/hooks/use-api'
import { cn } from '@/utils/format'

/**
 * Login — the entry point of the product story.
 *
 * Enterprise framing: SSO-first, region and retention stated up front, and a
 * one-click role selector so the demo can show how scope changes what the AI
 * can retrieve. The role picker is explicitly labelled as a demonstration aid.
 */
export function LoginPage() {
  const { login, isAuthenticated, initialising } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const demoAccounts = useDemoAccounts()
  const organization = demoAccounts.data?.organization
  const candidates = demoAccounts.data?.users ?? []
  const [email, setEmail] = useState('anush.kannan@northwind.example')
  const [password, setPassword] = useState('demo-password')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated && !initialising) {
    return <Navigate to="/overview" replace />
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      toast({
        title: 'Signed in',
        description: 'Your role determines which knowledge the AI can retrieve.',
        tone: 'success',
      })
      navigate('/overview', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_minmax(420px,0.95fr)]">
      {/* ---------------------------------------------------------------- */}
      {/* Product story panel                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative hidden flex-col justify-between border-r border-line bg-surface px-10 py-10 lg:flex xl:px-14">
        <div className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <BrandWordmark />
          <StatusBadge tone="neutral" size="sm" className="ml-2">
            Enterprise
          </StatusBadge>
        </div>

        <div className="max-w-[520px]">
          <p className="text-label uppercase text-brand-600">One trusted interface</p>
          <h1 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink-900">
            Knowledge, agents, decisions and governance — in one system.
          </h1>
          <p className="mt-4 text-body text-ink-500">
            SmartCorp AI answers from your organisation’s approved knowledge, shows the evidence behind every answer,
            and routes anything consequential to a human for approval.
          </p>

          <p className="mt-8 rounded-md border border-line bg-surface-muted px-3.5 py-3 text-body-sm font-medium text-ink-700">
            AI recommends. Evidence explains. Humans control.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
            {[
              { icon: BookOpen, title: 'Permission-aware RAG', body: 'Retrieval is filtered by role before ranking — restricted content never reaches the model.' },
              { icon: Bot, title: 'Multi-agent routing', body: 'Intent is classified and routed to HR, Finance or Support with the reason shown.' },
              { icon: Gavel, title: 'Decision centre', body: 'Recommendations carry evidence, business impact and risk before any action is taken.' },
              { icon: ScrollText, title: 'Complete auditability', body: 'Every query, retrieval, approval and permission change is recorded and exportable.' },
            ].map((feature) => (
              <div key={feature.title}>
                <dt className="flex items-center gap-2 text-body-sm font-semibold text-ink-800">
                  <feature.icon className="size-4 text-ink-400" aria-hidden />
                  {feature.title}
                </dt>
                <dd className="mt-1 text-caption leading-relaxed text-ink-500">{feature.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-ink-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden />
            SSO + MFA enforced
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden />
            Data processed in {organization?.dataRegion ?? 'EU (Frankfurt)'}
          </span>
          <span>Audit retention 730 days</span>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Authentication panel                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col justify-center bg-canvas px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark size={28} />
            <BrandWordmark />
          </div>

          <h2 className="text-h1 text-ink-900">Sign in to SmartCorp</h2>
          <p className="mt-1.5 text-body-sm text-ink-500">
            Continue with your {organization?.name ?? 'organisation'} account.
          </p>

          <Button variant="secondary" size="lg" className="mt-6 w-full justify-center" iconLeft={<ShieldCheck aria-hidden />}>
            Continue with single sign-on
          </Button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-caption text-ink-400">or use your email</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Input
              label="Work email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              trailing={
                <button
                  type="button"
                  className="text-caption font-medium text-brand-700 hover:text-brand-800"
                  onClick={() => toast({ title: 'Password reset', description: 'Your administrator manages credentials through the corporate identity provider.', tone: 'info' })}
                >
                  Forgot?
                </button>
              }
            />

            {error && (
              <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-body-sm text-danger-800">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={busy} iconRight={<ArrowRight aria-hidden />}>
              Sign in
            </Button>
          </form>

          {/* Demo role selector ------------------------------------------ */}
          <div className="mt-8 rounded-lg border border-line bg-surface p-3.5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-body-sm font-medium text-ink-700">
                <Sparkles className="size-3.5 text-ink-400" aria-hidden />
                Demonstration roles
              </p>
              <StatusBadge tone="neutral" size="sm">
                Demo aid
              </StatusBadge>
            </div>
            <p className="mt-1.5 text-caption leading-relaxed text-ink-500">
              Sign in as a different role to see how scope changes the AI’s answers, the navigation available and the
              decisions you can approve. Hiding a control is never the security boundary — the API enforces the same rule.
            </p>
            <ul className="mt-3 space-y-1">
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(candidate.email)
                      setPassword('demo-password')
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                      email === candidate.email ? 'bg-brand-50' : 'hover:bg-surface-muted',
                    )}
                  >
                    <Avatar name={candidate.name} color={candidate.avatarColor} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm text-ink-800">{candidate.name}</span>
                      <span className="block truncate text-[11px] text-ink-400">
                        {candidate.jobTitle}
                      </span>
                    </span>
                    <StatusBadge tone={email === candidate.email ? 'brand' : 'neutral'} size="sm">
                      {ROLE_LABELS[candidate.role]}
                    </StatusBadge>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 text-caption leading-relaxed text-ink-400">
            By signing in you agree that AI-generated answers and recommendations are advisory. Consequential actions
            require human approval and are recorded in the audit log.
          </p>
        </div>
      </section>
    </div>
  )
}
