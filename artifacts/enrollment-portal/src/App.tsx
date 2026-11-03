import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BadgeCheck, Check, CheckCircle2,
  ChevronDown, CircleHelp, Copy, FileCheck2, FileText, Headphones, Home, LifeBuoy, Mail,
  GripVertical, LockKeyhole, LogOut, Menu, MessageCircle, RefreshCw, Search, Send, Settings, ShieldCheck, Smartphone, Trash2, Upload, X,
} from 'lucide-react';
import {
  getGetApplicationQueryKey, getGetApplicantSummaryQueryKey,
  getGetAdminApplicationHistoryQueryKey, getGetAdminApplicationQueryKey,
  getGetAdminApplicationPinQueryKey, getGetAdminGuestPreapplicationPinQueryKey,
  getGetAdminGuestApplicationHistoryQueryKey,
  getGetAdminOverviewQueryKey,
  getGetAdminEmailSettingsQueryKey,
  getGetAdminSmsSettingsQueryKey,
  getListAdminSmsActivityQueryKey,
  getListAdminEmailTemplatesQueryKey,
  getListAdminEmailOutboxQueryKey,
  getGetPortalSettingsQueryKey,
  getListApplicationsForReviewQueryKey, getListMyApplicationsQueryKey,
  getListAdminGuestPreapplicationsQueryKey,
  getListAdminUsersQueryKey, getListMySupportTicketsQueryKey, getListSupportTicketsForAdminQueryKey,
  useAddAdminApplicationNote, useAddApplicantSupportMessage, useAssignSupportTicket,
  useCreateGuestPreapplication, useLookupGuestPreapplication, useListAdminGuestPreapplications,
  useUpdateGuestPreapplicationProgress,
  useUpdateGuestPreapplicationEmail,
  useRequestGuestApplicantEvidenceUpload, useCompleteGuestApplicantEvidenceUpload,
  useSubmitGuestPreapplication,
  useLinkGuestPreapplicationAccount,
  useCreateSupportTicket, useDecideApplication, useDeleteMyDrafts,
  useGetAdminApplication, useGetAdminApplicationHistory, useGetAdminGuestApplicationHistory, useGetAdminOverview,
  useGetAdminApplicationPin, useGetAdminGuestPreapplicationPin,
  useGetAdminEmailSettings, useListAdminEmailOutbox, useUpdateAdminEmailSettings,
  useListAdminEmailTemplates, useCreateAdminEmailTemplate, useUpdateAdminEmailTemplate, useDeleteAdminEmailTemplate,
  useSendAdminEmail, useRetryAdminEmail, useRequestAdminEmailLogoUpload, useCompleteAdminEmailLogoUpload,
  useGetAdminSmsSettings, useUpdateAdminSmsSettings, useSendAdminSms,
  useListAdminSmsActivity,
  useCheckStaffRegistrationEmail, useClaimAllowlistedStaffAccess,
  useGetApplication, useGetApplicantSummary, useListApplicationsForReview,
  useListAdminUsers, useListEnrollmentCategories, useListMyApplications, useListMySupportTickets,
  useListSupportTicketsForAdmin, useReplyToSupportTicket, useSubmitApplication, useSubmitNewApplication,
  useUpdateAdminUserStatus, useUpdateApplication,
  useUpdateAdminUserRole, useGetPortalSettings, useUpdatePortalSettings,
  useUpdateAdminGuestPreapplication,
  useClearApplicantRecords,
  useCreateAdminUserInvitation,
  useCreateApplicationDraft,
  useRequestGuestPreapplicationEvidenceUpload,
  useCompleteGuestPreapplicationEvidenceUpload,
} from '@workspace/api-client-react';
import type {
  AdminGuestPreapplication, AdminUser, AdminUserInvitationInput, ApplicationDecision, ApplicationEvent, ClearApplicantRecordsInput, EnrollmentApplication, EnrollmentCategory,
  AdminEmailAlertEvents, AdminEmailBranding, AdminEmailMessage, AdminEmailTemplate, AdminSmsSettings, AdminSmsSendResponse, GuestPreapplicationCreated, GuestPreapplicationInput, GuestPreapplicationStatus, PortalPageTheme, PortalSettings, PortalSettingsCardsItem, SupportTicket,
} from '@workspace/api-client-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CategoryEntryForm, type CategoryEntryAnswers } from './components/CategoryEntryForm';
import { EnrollmentWizard } from './components/EnrollmentWizard';
import { PortalWordmark } from './components/PortalWordmark';
import { SecurityHeroVisual, SecurityLoadingIndicator } from './components/SecurityVisuals';
import { DEFAULT_PAGE_THEME, PAGE_THEME_SCREENS, normalizePageThemes, pageThemeBackground, pageThemeKeyForRoute } from './pageTheme';
import categoryOneLogo from './assets/category-one-national-bank-logo-updated.png';
import categoryTwoLogo from './assets/category-two-bred-bank-logo.jpg';
import categoryThreeLogo from './assets/category-three-anz-logo.jpg';
import categoryFourLogo from './assets/category-four-bsp-logo.jpg';
import {
  changeSessionDraftCategory, clearSessionDrafts,
  getSessionDraft, isSessionDraftId, listSessionDrafts,
  removeSessionDraft, updateSessionDraft,
} from './sessionDraftStore';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  variables: {
    colorPrimary: '#174d80',
    colorForeground: '#19324d',
    colorMutedForeground: '#68798b',
    colorDanger: '#b73535',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#19324d',
    colorNeutral: '#d5dee7',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.85rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    logoBox: { display: 'none' },
    logoImage: { display: 'none' },
    headerTitle: 'font-semibold tracking-tight text-[#19324d]',
    headerSubtitle: 'text-[#68798b]',
    formFieldLabel: 'font-medium text-[#29435c]',
    formFieldInput: 'rounded-xl border-[#d5dee7] shadow-none',
    formButtonPrimary: 'rounded-xl bg-[#174d80] hover:bg-[#103e69]',
    footerActionLink: 'font-semibold text-[#174d80]',
  },
};

function PrimaryButton({ children, onClick, disabled, kind = 'button', testId, quiet = false }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'button' | 'submit';
  testId: string; quiet?: boolean;
}) {
  return (
    <button type={kind} onClick={onClick} disabled={disabled} data-testid={testId}
      className={`button ${quiet ? 'button-quiet' : 'button-primary'} ${disabled ? 'button-disabled' : ''}`}>
      {children}
    </button>
  );
}

function LoadingPanel({ label = 'Loading your information' }: { label?: string }) {
  return (
    <div className="loading-panel" data-testid="state-loading">
      <SecurityLoadingIndicator label={label} />
    </div>
  );
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <section className="state-card" role="alert" data-testid="state-error">
    <span className="state-icon error-icon"><Activity size={19} /></span>
    <h2>We couldn’t load this view</h2><p>{message}</p>
    <button className="text-action" onClick={retry} data-testid="button-retry">Try again <ArrowRight size={15} /></button>
  </section>;
}

function EmptyPanel({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return <section className="empty-panel" data-testid="state-empty">
    <span className="empty-icon"><FileText size={22} /></span><h3>{title}</h3><p>{message}</p>{action}
  </section>;
}

function StatusPill({ status, testId }: { status: string; testId?: string }) {
  const labels: Record<string, string> = {
    draft: 'Draft',
    in_progress: 'In Progress',
    submitted: 'Pending Review',
    under_review: 'Under Review',
    needs_information: 'Additional Information Required',
    approved: 'Approved',
    rejected: 'Rejected',
    received: 'Received',
    contacted: 'Contacted',
    open: 'Open',
    answered: 'In Progress',
    closed: 'Resolved',
    resolved: 'Resolved',
  };
  return <span className={`status-pill status-${status}`} data-testid={testId ?? `status-${status}-current`}>{labels[status] ?? status.replaceAll('_', ' ')}</span>;
}

function applicationDisplayStatus(application: Pick<EnrollmentApplication, 'status' | 'currentStep'>) {
  return application.status === 'draft' && application.currentStep > 0 ? 'in_progress' : application.status;
}

function copyText(settings: PortalSettings | undefined, screen: string, key: string, fallback: string) {
  const value = settings?.screenCopy?.[screen]?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function configuredCategoryTitle(settings: PortalSettings | undefined, categoryId: string, fallback: string) {
  const title = settings?.cards.find((card) => card.id === categoryId)?.title?.trim();
  return title || fallback;
}

function categoryEntryScreenId(categoryId: string) {
  return `category-entry-${categoryId.replace(/^category-/, '')}`;
}

function configuredFieldLabel(
  settings: PortalSettings | undefined,
  workflowStep: number | undefined,
  group: string | undefined,
  key: string,
  fallback: string,
) {
  if (!workflowStep || !group) return fallback;
  return copyText(settings, `workflow-step-${workflowStep}`, `field_${group}_${key}`, fallback);
}

function cardLogoPositionStyle(alignment?: string, verticalOffset?: number): CSSProperties {
  const alignSelf: CSSProperties['alignSelf'] = alignment === 'center'
    ? 'center'
    : alignment === 'right'
      ? 'flex-end'
      : 'flex-start';
  const offset = Number.isFinite(verticalOffset)
    ? Math.max(-48, Math.min(48, verticalOffset ?? 0))
    : 0;
  return { alignSelf, transform: offset ? `translateY(${offset}px)` : undefined };
}

type CategoryCardStyle = CSSProperties & {
  '--category-tone': string;
  '--category-title-size': string | undefined;
  '--category-title-x': string | undefined;
  '--category-title-y': string | undefined;
  '--category-description-size': string | undefined;
  '--category-description-x': string | undefined;
  '--category-description-y': string | undefined;
};

function clampSettingsValue(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value ?? fallback)) : fallback;
}

function categoryCardStyle(card: PortalSettingsCardsItem | undefined, fallbackTone: string): CategoryCardStyle {
  const cssLength = (value: number | undefined, min: number, max: number) =>
    Number.isFinite(value) ? `${clampSettingsValue(value, 0, min, max)}px` : undefined;
  return {
    '--category-tone': card?.backgroundColor ?? fallbackTone,
    '--category-title-size': cssLength(card?.cardTitleFontSize, 10, 24),
    '--category-title-x': cssLength(card?.cardTitleHorizontalOffset, -40, 40),
    '--category-title-y': cssLength(card?.cardTitleVerticalOffset, -40, 40),
    '--category-description-size': cssLength(card?.cardDescriptionFontSize, 8, 18),
    '--category-description-x': cssLength(card?.cardDescriptionHorizontalOffset, -40, 40),
    '--category-description-y': cssLength(card?.cardDescriptionVerticalOffset, -40, 40),
  };
}

function fallbackLogoForCategory(categoryId: PortalSettingsCardsItem['id']): string {
  switch (categoryId) {
    case 'category-1': return categoryOneLogo;
    case 'category-2': return categoryTwoLogo;
    case 'category-3': return categoryThreeLogo;
    case 'category-4': return categoryFourLogo;
  }
}

function AppFrame({ children, active = 'dashboard', fitDashboard = false, publicDashboard = false }: {
  children: ReactNode;
  active?: string;
  fitDashboard?: boolean;
  publicDashboard?: boolean;
}) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const links = publicDashboard
    ? [
        { label: 'Home', href: '/', key: 'home', icon: ArrowLeft },
        { label: 'Categories', href: '/dashboard', key: 'dashboard', icon: Home },
        { label: 'Track application', href: '/guest/track', key: 'track', icon: FileCheck2 },
      ]
    : [
        { label: 'Overview', href: '/dashboard', key: 'dashboard', icon: Home },
        { label: 'Applications', href: '/dashboard', key: 'applications', icon: FileCheck2 },
        { label: 'Support', href: '/support', key: 'support', icon: LifeBuoy },
      ];
  return (
    <div className={`app-shell portal-frame ${publicDashboard ? 'guest-shared-dashboard' : ''}`} data-testid={publicDashboard ? 'guest-applicant-dashboard-frame' : undefined}>
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand"><PortalWordmark inverse /></div>
        <div className="workspace-label">APPLICANT PORTAL</div>
        <nav className="side-nav" aria-label="Applicant navigation">
          {links.map(({ label, href, key, icon: Icon }) => (
            <Link href={href} key={key} onClick={() => { setMenuOpen(false); if (key === 'applications') setLocation('/dashboard'); }}
              className={`nav-link ${active === key ? 'nav-link-active' : ''}`} data-testid={`link-nav-${key}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </Link>
          ))}
          {!publicDashboard && ['admin', 'sub_admin', 'moderator'].includes(String(user?.publicMetadata?.role)) && (
            <Link href="/admin" onClick={() => setMenuOpen(false)}
              className={`nav-link ${active === 'admin' ? 'nav-link-active' : ''}`} data-testid="link-nav-admin">
              <ShieldCheck size={18} strokeWidth={1.8} /><span>Admin panel</span>
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><LockKeyhole size={17} /><div><b>Your information is protected</b><span>{publicDashboard ? 'Guest applicant workspace' : 'Secure application workspace'}</span></div></div>
          {user && <button className="nav-link signout-link" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out">
            <LogOut size={18} /><span>Sign out</span>
          </button>}
        </div>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} data-testid="button-close-menu" />}
      <div className="main-column">
        <div className="compact-bar">
          <button className="menu-trigger" aria-label="Open menu" onClick={() => setMenuOpen(true)} data-testid="button-open-menu"><Menu size={20} /></button>
          <PortalWordmark className="portal-wordmark-compact" />
          {publicDashboard
            ? <Link href="/guest/track" className="compact-help" aria-label="Track an application" data-testid="link-compact-guest-track"><FileCheck2 size={18} /></Link>
            : <Link href="/support" className="compact-help" data-testid="link-compact-support"><CircleHelp size={18} /></Link>}
        </div>
        <main className={`page-content portal-scroll ${fitDashboard ? 'dashboard-page-content' : ''}`}>{children}</main>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="page-heading rise">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action}
  </div>;
}

function PublicLanding() {
  const portalSettings = useGetPortalSettings();
  const hero = portalSettings.data?.hero;
  const primaryLabel = hero?.getStartedLabel ?? 'Get Started';
  return (
    <main className="landing portal-frame">
      <section className="landing-copy">
        <PortalWordmark className="portal-wordmark-landing" />
        <div className="landing-content rise">
          <div className="eyebrow"><span className="eyebrow-rule" />SECURE ENROLLMENT</div>
          <h1>{copyText(portalSettings.data, 'landing', 'title', hero?.title ?? 'Welcome to Our Enrollment Portal')}</h1>
          <p className="landing-lede">{copyText(portalSettings.data, 'landing', 'description', hero?.description ?? 'Select your enrollment category and complete your application through our secure enrollment process.')}</p>
          <div className="landing-actions">
            <Link href="/guest/apply" className="button button-primary" data-testid="link-get-started">
              {copyText(portalSettings.data, 'landing', 'buttonLabel', primaryLabel)} <ArrowRight size={17} />
            </Link>
            <Link href="/guest/track" className="landing-secondary-link" data-testid="link-track-application">
              Track an application <ArrowRight size={15} />
            </Link>
          </div>
          <div className="landing-assurances">
            <div><span className="assurance-icon"><LockKeyhole size={16} /></span><span><b>Private by design</b><small>Your details stay protected</small></span></div>
            <div><span className="assurance-icon"><Activity size={16} /></span><span><b>Know where you stand</b><small>Track review status clearly</small></span></div>
          </div>
          <div className="landing-security-mobile"><SecurityHeroVisual /></div>
        </div>
      </section>
      <section className="landing-art" aria-label="Security and data protection overview">
        <SecurityHeroVisual />
      </section>
    </main>
  );
}

function staffReviewReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }
  const path = value.split(/[?#]/, 1)[0];
  if (
    path === '/admin/review' ||
    path === '/admin/pre-applications' ||
    path === '/admin/email' ||
    /^\/admin\/applications\/[0-9a-f-]{36}$/i.test(path) ||
    /^\/admin\/guest-applications\/[0-9a-f-]{36}$/i.test(path)
  ) {
    return path;
  }
  return null;
}

function AuthPage({ mode, allowlistedEmail }: { mode: 'in' | 'up' | 'staff'; allowlistedEmail?: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const directStaffRegistration = mode === 'staff' && !!allowlistedEmail;
  const staffSignInRegistration = mode === 'in' && new URLSearchParams(window.location.search).get('staffRegistration') === '1';
  const staffRegistrationIntent = directStaffRegistration || staffSignInRegistration;
  const guestSubmissionIntent = new URLSearchParams(window.location.search).get('guestApplication') === '1';
  const reviewReturnPath = staffReviewReturnPath(new URLSearchParams(window.location.search).get('returnTo'));
  const guestAuthContext = guestSubmissionIntent ? readGuestAuthContext() : null;
  const completionUrl = staffRegistrationIntent
    ? `${basePath}/auth/complete?staffRegistration=1`
    : guestSubmissionIntent
      ? `${basePath}/auth/complete?guestApplication=1`
      : reviewReturnPath
        ? `${basePath}/auth/complete?returnTo=${encodeURIComponent(reviewReturnPath)}`
        : `${basePath}/auth/complete`;
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setLocation(staffRegistrationIntent
        ? '/auth/complete?staffRegistration=1'
        : guestSubmissionIntent
          ? '/auth/complete?guestApplication=1'
          : reviewReturnPath
            ? `/auth/complete?returnTo=${encodeURIComponent(reviewReturnPath)}`
            : '/auth/complete', { replace: true });
    }
  }, [isLoaded, isSignedIn, staffRegistrationIntent, guestSubmissionIntent, reviewReturnPath, setLocation]);
  if (isLoaded && isSignedIn) return <main className="portal-frame auth-loading"><LoadingPanel label="Opening your secure workspace" /></main>;
  return <main className="auth-page portal-frame">
    <div className="auth-brand"><PortalWordmark /><span>SECURE ACCESS</span></div>
    <div className="auth-canvas">
      <div className="auth-intro"><div className="eyebrow">{mode === 'staff' ? directStaffRegistration ? 'AUTHORIZED STAFF ACCESS' : 'INVITED STAFF ACCESS' : 'A thoughtful process starts here'}</div><h1>{mode === 'in' ? 'Welcome back.' : mode === 'staff' ? directStaffRegistration ? 'Your staff account.' : 'Your team account.' : 'Let’s get started.'}</h1>
        <p>{mode === 'in' ? 'Your application and its latest updates are waiting in your secure workspace.' : mode === 'staff' ? directStaffRegistration ? 'Create an account with the approved email address. Staff access activates only after email verification.' : 'Accept your staff invitation to activate the role assigned by your portal administrator.' : 'Create a secure account to begin and return to your application whenever you need.'}</p>
        <div className="auth-security"><LockKeyhole size={17} /><span>Protected access for your enrollment journey</span></div></div>
      <div className="auth-widget">
        {mode === 'in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={staffSignInRegistration ? `${basePath}/staff/sign-up` : guestSubmissionIntent ? `${basePath}/sign-up?guestApplication=1` : `${basePath}/sign-up`} forceRedirectUrl={completionUrl} initialValues={guestAuthContext ? { emailAddress: guestAuthContext.email } : undefined} /> :
          <SignUp routing="path" path={`${basePath}${mode === 'staff' ? '/staff/sign-up' : '/sign-up'}`} signInUrl={directStaffRegistration ? `${basePath}/sign-in?staffRegistration=1` : guestSubmissionIntent ? `${basePath}/sign-in?guestApplication=1` : `${basePath}/sign-in`} forceRedirectUrl={completionUrl} initialValues={allowlistedEmail ? { emailAddress: allowlistedEmail } : guestAuthContext ? { emailAddress: guestAuthContext.email } : undefined} />}
      </div>
    </div>
  </main>;
}

function StaffSignUpPage() {
  const invitationTicket = new URLSearchParams(window.location.search).get('__clerk_ticket');
  if (invitationTicket) return <AuthPage mode="staff" />;
  return <AllowlistedStaffSignUp />;
}

function AllowlistedStaffSignUp() {
  const checkEmail = useCheckStaffRegistrationEmail();
  const [email, setEmail] = useState('');
  const [allowlistedEmail, setAllowlistedEmail] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim();
    checkEmail.mutate({ data: { email: normalizedEmail } }, {
      onSuccess: (result) => {
        if (result.allowed) {
          setAllowlistedEmail(normalizedEmail);
        } else {
          setError('This email is not authorized for staff registration.');
        }
      },
      onError: () => setError('Staff registration could not be checked. Please try again.'),
    });
  };

  if (allowlistedEmail) return <AuthPage mode="staff" allowlistedEmail={allowlistedEmail} />;

  return <main className="signedout-page portal-frame" data-testid="staff-allowlist-check">
    <PortalWordmark />
    <div className="signedout-card">
      <span className="state-icon"><LockKeyhole size={21} /></span>
      <div className="eyebrow">AUTHORIZED STAFF ACCESS</div>
      <h1>Staff registration</h1>
      <p>Enter an approved email address to continue. Your role is assigned only after that email is verified.</p>
      <form className="staff-registration-form" onSubmit={submit}>
        <label className="field-label" htmlFor="staff-registration-email">Email address</label>
        <input
          id="staff-registration-email"
          className="text-input"
          type="email"
          autoComplete="email"
          required
          maxLength={320}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          data-testid="input-staff-registration-email"
        />
        {error && <p className="inline-error" role="alert" data-testid="text-staff-registration-error">{error}</p>}
        <button className="button button-primary" type="submit" disabled={checkEmail.isPending} data-testid="button-check-staff-registration">
          {checkEmail.isPending ? 'Checking…' : 'Continue to sign up'} <ArrowRight size={15} />
        </button>
      </form>
      <Link href="/sign-in?staffRegistration=1" className="text-action" data-testid="link-staff-registration-sign-in">Already have an account? Sign in</Link>
    </div>
  </main>;
}

function AuthComplete() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const claimStaffAccess = useClaimAllowlistedStaffAccess();
  const claimStarted = useRef(false);
  const [claimError, setClaimError] = useState('');
  const isStaffRegistration = new URLSearchParams(window.location.search).get('staffRegistration') === '1';
  const isGuestSubmission = new URLSearchParams(window.location.search).get('guestApplication') === '1';
  const reviewReturnPath = staffReviewReturnPath(new URLSearchParams(window.location.search).get('returnTo'));

  useEffect(() => {
    if (!isLoaded || !userLoaded) return;
    if (!isSignedIn) {
      setLocation(isGuestSubmission ? '/sign-in?guestApplication=1' : '/sign-in', { replace: true });
      return;
    }
    if (isGuestSubmission) {
      if (claimStarted.current) return;
      const guestContext = readGuestAuthContext();
      if (!guestContext) {
        setClaimError('The saved guest application context is unavailable. Your draft can still be restored with its reference and private key.');
        return;
      }
      claimStarted.current = true;
      setLocation('/guest/apply?resume=1', { replace: true });
      return;
    }
    if (isStaffRegistration) {
      if (claimStarted.current) return;
      claimStarted.current = true;
      claimStaffAccess.mutate(undefined, {
        onSuccess: () => window.location.replace(`${basePath}/admin`),
        onError: () => setClaimError('This verified email could not be authorized for the assigned staff role.'),
      });
      return;
    }
    setLocation(reviewReturnPath ?? (['admin', 'sub_admin', 'moderator'].includes(String(user?.publicMetadata?.role)) ? '/admin' : '/dashboard'), { replace: true });
  }, [isLoaded, isSignedIn, userLoaded, user?.id, user?.publicMetadata?.role, setLocation, isStaffRegistration, isGuestSubmission, reviewReturnPath, claimStaffAccess.mutate]);

  if (claimError) return <main className="signedout-page portal-frame" data-testid={isGuestSubmission ? 'guest-submit-error' : 'staff-claim-error'}>
    <PortalWordmark />
    <div className="signedout-card">
      <span className="state-icon"><LockKeyhole size={21} /></span>
      <div className="eyebrow">{isGuestSubmission ? 'APPLICATION SUBMISSION' : 'STAFF ACCESS CHECK'}</div>
      <h1>{isGuestSubmission ? 'Your application is still saved.' : 'Staff access wasn’t activated.'}</h1>
      <p>{claimError}</p>
      {isGuestSubmission
        ? <>
          <Link href="/guest/apply?resume=1" className="button button-primary">Return to saved application <ArrowRight size={15} /></Link>
          <button className="text-action" type="button" onClick={() => void signOut({ redirectUrl: `${basePath}/sign-in?guestApplication=1` })}>Switch account</button>
        </>
        : <Link href="/dashboard" className="button button-primary">Continue as applicant <ArrowRight size={15} /></Link>}
      <button className="text-action" type="button" onClick={() => window.location.reload()}>Retry</button>
    </div>
  </main>;

  return <main className="portal-frame auth-loading"><LoadingPanel label="Opening your secure workspace" /></main>;
}

function SignedOutNotice({ returnTo }: { returnTo?: string | null } = {}) {
  return <main className="signedout-page portal-frame"><PortalWordmark /><div className="signedout-card">
    <span className="state-icon"><LockKeyhole size={21} /></span><div className="eyebrow">SECURE ACCESS</div>
    <h1>Sign in to continue</h1><p>Your application workspace is private. Sign in to view or manage your enrollment.</p>
    <Link href={returnTo ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : '/sign-in'} className="button button-primary" data-testid="link-auth-sign-in">Continue to sign in <ArrowRight size={16} /></Link>
  </div></main>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <main className="portal-frame auth-loading"><LoadingPanel label="Checking secure access" /></main>;
  return isSignedIn ? <>{children}</> : <SignedOutNotice />;
}

function Dashboard() {
  const { user, isLoaded: userLoaded } = useUser();
  const summary = useGetApplicantSummary();
  const applications = useListMyApplications();
  const categories = useListEnrollmentCategories();
  const portalSettings = useGetPortalSettings();
  const deleteDrafts = useDeleteMyDrafts();
  const createDraft = useCreateApplicationDraft();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [sessionRevision, setSessionRevision] = useState(0);
  const [startingCategoryId, setStartingCategoryId] = useState<string | null>(null);
  const [draftFeedback, setDraftFeedback] = useState('');
  const sessionRecords = useMemo(
    () => user?.id ? listSessionDrafts(user.id) : [],
    [user?.id, sessionRevision],
  );
  const sessionApplications = sessionRecords.map((record) => record.application);
  const allApplications = useMemo(() => {
    const records = new Map<string, EnrollmentApplication>();
    for (const application of applications.data ?? []) records.set(application.id, application);
    for (const application of sessionApplications) records.set(application.id, application);
    return [...records.values()].sort((left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }, [applications.data, sessionApplications]);
  const dashboardSummary = summary.data
    ? {
        ...summary.data,
        total: summary.data.total + sessionRecords.length,
        drafts: summary.data.drafts + sessionRecords.length,
      }
    : undefined;
  const palette = ['#0EAD46', '#0C4DA1', '#0072AE', '#FFFFFF'];
  const iconColors = ['#168341', '#244fc7', '#087eaf', '#174d80'];
  const activeStatuses = ['draft', 'submitted', 'under_review', 'needs_information'];
  const applicationsForCategory = (categoryId: string) =>
    allApplications.filter((application) => application.categoryId === categoryId);
  const orderedCategories = useMemo(() => {
    const items = (categories.data ?? []).slice(0, 4);
    const order = portalSettings.data?.cards;
    if (!order?.length) return items;
    return items.sort((left, right) => {
      const leftOrder = order.findIndex((card) => card.id === left.id);
      const rightOrder = order.findIndex((card) => card.id === right.id);
      return (leftOrder < 0 ? Number.MAX_SAFE_INTEGER : leftOrder)
        - (rightOrder < 0 ? Number.MAX_SAFE_INTEGER : rightOrder);
    });
  }, [categories.data, portalSettings.data?.cards]);

  const begin = async (category: EnrollmentCategory) => {
    if (!user?.id || startingCategoryId) return;
    setStartingCategoryId(category.id);
    setDraftFeedback('');
    try {
      const draft = await createDraft.mutateAsync({ data: { categoryId: category.id } });
      void queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetApplicantSummaryQueryKey() });
      setLocation(`/apply/${draft.id}`);
    } catch {
      setStartingCategoryId(null);
      setDraftFeedback('A secure application draft could not be opened. Please try again.');
    }
  };
  const clearDrafts = () => {
    if (!user?.id || deleteDrafts.isPending || !window.confirm(
      'Permanently delete all unfinished applications on this account? Submitted applications will remain.',
    )) return;
    deleteDrafts.mutate(undefined, {
      onSuccess: () => {
        clearSessionDrafts(user.id);
        setSessionRevision((revision) => revision + 1);
        setDraftFeedback('All unfinished applications on this account were removed.');
        void queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetApplicantSummaryQueryKey() });
      },
      onError: () => setDraftFeedback('Unfinished applications could not be cleared. Please try again.'),
    });
  };
  const busy = !userLoaded || summary.isLoading || applications.isLoading || categories.isLoading;
  const failure = summary.isError || applications.isError || categories.isError;
  return <AppFrame active="dashboard" fitDashboard>
    <div className="dashboard-layout">
      <div className="dashboard-main">
         <PageHeading eyebrow="YOUR ENROLLMENT" title={copyText(portalSettings.data, 'dashboard', 'title', 'A good place to begin.')} detail={copyText(portalSettings.data, 'dashboard', 'description', `Signed in as ${user?.fullName || user?.primaryEmailAddress?.emailAddress || 'your account'}. Start a separate application for each enrollment category.`)} />
        {failure ? <ErrorPanel message="Your enrollment information is temporarily unavailable." retry={() => { void summary.refetch(); void applications.refetch(); void categories.refetch(); }} /> :
          busy ? <LoadingPanel /> : <>
            <section className="selection-section rise-delay">
              <div className="section-line"><div><h2>Select an enrollment path</h2><p>Choose the option that best matches your application.</p></div><span className="step-indicator">STEP 01 / 03</span></div>
              <div className={`category-grid${orderedCategories.length > 2 ? ' category-grid--with-row-divider' : ''}`}>
                {orderedCategories.map((category, index) => {
                  const categoryIndex = Math.max(0, Number(category.id.split('-')[1]) - 1);
                  const cardSettings = portalSettings.data?.cards.find((card) => card.id === category.id);
                  const cardTitle = cardSettings?.title ?? category.name;
                  const categoryDescription = cardSettings?.description?.trim() || category.description;
                  const categoryApplications = applicationsForCategory(category.id);
                  const activeApplication = categoryApplications.find((application) => activeStatuses.includes(application.status));
                  const selected = Boolean(activeApplication);
                  const completedApplication = categoryApplications[0];
                  const selectionAction = startingCategoryId === category.id
                    ? 'Opening…'
                    : selected
                      ? ['draft', 'needs_information'].includes(activeApplication!.status)
                        ? 'Continue application'
                        : 'View current status'
                      : completedApplication
                        ? 'Start another application'
                        : copyText(portalSettings.data, 'dashboard', 'buttonLabel', cardSettings?.buttonLabel ?? 'Select category');
                  return <button type="button" key={category.id} disabled={startingCategoryId !== null} onClick={() => {
                    if (activeApplication) {
                      setLocation(['draft', 'needs_information'].includes(activeApplication.status) ? `/apply/${activeApplication.id}` : `/applications/${activeApplication.id}`);
                      return;
                    }
                    begin(category);
                  }}
                    className={`category-card category-${categoryIndex + 1}`} style={categoryCardStyle(cardSettings, palette[categoryIndex])}
                    aria-label={`${cardTitle}. ${categoryDescription}. ${selectionAction}`}
                    data-testid={`card-category-${category.id}`}>
                    <span className="category-number">0{index + 1}</span>
                    {cardSettings?.logoDataUrl
                      ? <img src={cardSettings.logoDataUrl} alt="" className="category-logo" style={cardLogoPositionStyle(cardSettings.cardLogoAlignment, cardSettings.cardLogoVerticalOffset)} />
                      : category.id === 'category-1'
                        ? <img src={categoryOneLogo} alt="National Bank Vanuatu" className="category-logo category-one-default-logo" style={cardLogoPositionStyle(cardSettings?.cardLogoAlignment, cardSettings?.cardLogoVerticalOffset)} />
                        : category.id === 'category-2'
                        ? <img src={categoryTwoLogo} alt="BRED Bank Vanuatu" className="category-logo category-two-default-logo" style={cardLogoPositionStyle(cardSettings?.cardLogoAlignment, cardSettings?.cardLogoVerticalOffset)} />
                        : category.id === 'category-3'
                          ? <img src={categoryThreeLogo} alt="ANZ" className="category-logo category-three-default-logo" style={cardLogoPositionStyle(cardSettings?.cardLogoAlignment, cardSettings?.cardLogoVerticalOffset)} />
                          : category.id === 'category-4'
                            ? <img src={categoryFourLogo} alt="BSP" className="category-logo category-four-default-logo" style={cardLogoPositionStyle(cardSettings?.cardLogoAlignment, cardSettings?.cardLogoVerticalOffset)} />
                            : <span className="category-symbol" style={{ color: iconColors[categoryIndex] }}><FileCheck2 size={22} strokeWidth={1.75} /></span>}
                    <span className="category-title">{cardTitle}</span>
                    <span className="category-description">{categoryDescription}</span>
                    <span className="category-select">{selectionAction} <ArrowUpRight size={15} /></span>
                  </button>;
                })}
              </div>
              {categories.data?.length === 0 && <EmptyPanel title="Enrollment paths are unavailable" message="Please return later or contact support for help." />}
            </section>
            <section className="recent-section">
              <div className="section-line">
                <div><h2>Your applications</h2><p>Each saved step is stored securely so you can return later. Authorized enrollment reviewers can see your progress.</p></div>
                <div className="section-line-actions">
                  <span className="step-indicator">{allApplications.length} total</span>
                  {allApplications.some((application) => application.status === 'draft') && <button type="button" className="text-action" onClick={clearDrafts} disabled={deleteDrafts.isPending} data-testid="button-clear-drafts">{deleteDrafts.isPending ? 'Clearing…' : 'Clear all drafts'}</button>}
                </div>
              </div>
              {draftFeedback && <p className={deleteDrafts.isError ? 'inline-error' : 'inline-success'} role="status" data-testid="text-draft-feedback">{draftFeedback}</p>}
              {allApplications.length === 0 ? <EmptyPanel title="Your application list is clear" message="Choose an enrollment path above to begin an application." /> :
                 <div className="application-list">{allApplications.map((app) => <ApplicationRow key={app.id} application={app} />)}</div>}
            </section>
          </>}
      </div>
      <aside className="dashboard-aside">
        <div className="summary-card">
          <div className="summary-head"><span className="summary-label">YOUR OVERVIEW</span><Activity size={17} /></div>
          {summary.isLoading ? <div className="summary-skeleton"><div /><div /><div /></div> : dashboardSummary ? <>
            <div className="summary-total" data-testid="text-summary-total">{dashboardSummary.total}<span> applications</span></div>
            <div className="summary-list">
              <SummaryLine label="Draft / in progress" value={dashboardSummary.drafts} tone="slate" />
              <SummaryLine label="In review" value={dashboardSummary.inReview} tone="blue" />
              <SummaryLine label="Approved" value={dashboardSummary.approved} tone="green" />
              <SummaryLine label="Needs attention" value={dashboardSummary.needsAttention} tone="amber" />
            </div>
          </> : <p className="summary-note">Summary is not available right now.</p>}
          <div className="summary-foot">Updated when your application changes</div>
        </div>
        <div className="help-card"><div className="help-icon"><Headphones size={18} /></div><div><b>Need a hand?</b><p>Our support team can help you along the way.</p><Link href="/support" className="text-action" data-testid="link-dashboard-support">Visit support <ArrowRight size={14} /></Link></div></div>
        <div className="aside-note"><ShieldCheck size={16} /><span>Secure, private, and always in your control.</span></div>
      </aside>
    </div>
  </AppFrame>;
}

function SummaryLine({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="summary-line" data-testid={`summary-${tone}`}><span><i className={`summary-dot ${tone}`} />{label}</span><b>{value}</b></div>;
}

function ApplicationRow({ application }: { application: EnrollmentApplication }) {
  const href = application.status === 'draft' ? `/apply/${application.id}` : `/applications/${application.id}`;
  return <Link href={href} className="application-row" data-testid={`row-application-${application.id}`}>
    <span className="application-file"><FileText size={18} /></span>
    <span className="application-row-main"><b>{application.categoryName}</b><small>{application.reference} <span>·</span> Updated {formatDate(application.updatedAt)}</small></span>
      <StatusPill status={applicationDisplayStatus(application)} testId={`status-application-${application.id}`} /><ArrowRight className="row-arrow" size={16} />
  </Link>;
}

function formatDate(date?: string | null) {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function formatDateTime(date?: string | null) {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function getCategoryEntryFields(answers: Record<string, unknown>, categoryId: string, settings?: PortalSettings) {
  const screen = categoryEntryScreenId(categoryId);
  const copy = settings?.screenCopy?.[screen];
  const fields = [
    { label: copyText(settings, screen, 'nameLabel', 'Name'), value: answers.name },
    ...(categoryId === 'category-1'
      ? [{ label: copy?.nicknameLabel?.trim() || 'Nickname', value: answers.nickname }]
      : [{ label: copy?.surnameLabel?.trim() || 'Surname', value: answers.surname }]),
  ];
  return fields.filter((field): field is { label: string; value: string } =>
    typeof field.value === 'string' && field.value.trim().length > 0);
}

function DraftApplication() {
  const params = useParams<{ applicationId?: string }>();
  const id = params.applicationId ?? '';
  const { user, isLoaded: userLoaded } = useUser();
  const sessionOnlyRoute = isSessionDraftId(id);
  const app = useGetApplication(id, { query: { enabled: !!id && !sessionOnlyRoute, queryKey: getGetApplicationQueryKey(id) } });
  const categories = useListEnrollmentCategories();
  const portalSettings = useGetPortalSettings();
  const update = useUpdateApplication();
  const submitExisting = useSubmitApplication();
  const submitNew = useSubmitNewApplication();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [feedback, setFeedback] = useState('');
  const [showSuccess, setShowSuccess] = useState(() => new URLSearchParams(window.location.search).get('submitted') === '1');
  const [sessionState, setSessionState] = useState<{ routeId: string; application: EnrollmentApplication | null }>(() => ({
    routeId: id,
    application: user?.id ? getSessionDraft(id, user.id)?.application ?? null : null,
  }));
  useEffect(() => {
    setSessionState({
      routeId: id,
      application: user?.id ? getSessionDraft(id, user.id)?.application ?? null : null,
    });
    setShowSuccess(new URLSearchParams(window.location.search).get('submitted') === '1');
  }, [id, user?.id]);
  const sessionApplication = sessionState.routeId === id ? sessionState.application : null;
  const application = sessionApplication ?? app.data;
  const showLoading = !userLoaded || (!application && !sessionOnlyRoute && app.isLoading);
  const setSessionApplication = (next: EnrollmentApplication | null) =>
    setSessionState({ routeId: id, application: next });
  if (showLoading) return <AppFrame><LoadingPanel /></AppFrame>;
  if (!application && sessionOnlyRoute) return <AppFrame><section className="state-card">
    <span className="state-icon"><FileText size={20} /></span><h2>This unfinished application has expired</h2>
    <p>Unsubmitted details are held only for the current browser session. Start a new application from your dashboard.</p>
    <button className="button button-primary" onClick={() => setLocation('/dashboard')}>Return to dashboard <ArrowRight size={15} /></button>
  </section></AppFrame>;
  if (!application && app.isError) return <AppFrame><ErrorPanel message="This application could not be found or opened." retry={() => void app.refetch()} /></AppFrame>;
  if (!application) return <AppFrame><LoadingPanel /></AppFrame>;
  if (!['draft', 'needs_information'].includes(application.status)) return <AppFrame>
    <section className="state-card"><span className="state-icon"><FileCheck2 size={20} /></span><h2>This application has already been submitted</h2><p>Its current status and any updates are available in the application detail view.</p><Link href={`/applications/${id}`} className="button button-primary" data-testid="link-open-submitted">View application <ArrowRight size={15} /></Link></section>
    {showSuccess && <div className="success-overlay">
      <section className="success-dialog" role="dialog" aria-modal="true" aria-labelledby="submission-success-title" data-testid="modal-submission-success">
        <button className="modal-close" onClick={() => { setShowSuccess(false); setLocation(`/apply/${application.id}`); }} aria-label="Close submission confirmation" data-testid="button-close-success"><span aria-hidden="true">×</span></button>
        <span className="success-seal"><CheckCircle2 size={25} /></span>
        <div className="eyebrow">APPLICATION RECEIVED</div>
        <h2 id="submission-success-title">Enrollment Submitted Successfully!</h2>
        <p>Your enrollment application has been submitted successfully. Your information is now awaiting review by our authorized enrollment team.</p>
        <div className="success-reference"><span>REFERENCE</span><b className="mono">{application.reference}</b></div>
        <div className="review-field"><span>Selected category</span><b>{application.categoryName}</b></div>
        <div className="review-field"><span>Submission date</span><b>{formatDate(application.submittedAt)}</b></div>
        <div className="review-field"><span>Current status</span><b>Pending Review</b></div>
        <button className="button button-primary" onClick={() => setLocation(`/applications/${application.id}`)} data-testid="button-view-submitted-status">View Application Status <ArrowRight size={15} /></button>
        <button className="button button-quiet" onClick={() => setLocation('/dashboard')} data-testid="button-return-dashboard">Return to Dashboard</button>
      </section>
    </div>}
  </AppFrame>;
  const saveStep = async (answers: Record<string, unknown>, currentStep: number) => {
    setFeedback('');
    if (sessionOnlyRoute) {
      if (!user?.id) return false;
      const saved = updateSessionDraft(application.id, user.id, { answers, currentStep });
      if (!saved) {
        setFeedback('This session-only application is no longer available. Start a new application.');
        return false;
      }
      setSessionApplication(saved.application);
      return true;
    }
    try {
      const saved = await update.mutateAsync({
        applicationId: id,
        data: { answers, currentStep },
      });
      queryClient.setQueryData(getGetApplicationQueryKey(id), saved);
      queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetApplicantSummaryQueryKey() });
      return true;
    } catch {
      setFeedback('We could not save your changes. Please try again.');
      return false;
    }
  };
  const backToCategoryEntry = async (answers: Record<string, unknown>) => {
    if (application.status !== 'draft') {
      setLocation('/dashboard');
      return true;
    }
    const entryAnswers = { ...answers, categoryEntryComplete: false };
    if (sessionOnlyRoute) {
      if (!user?.id) return false;
      const saved = updateSessionDraft(application.id, user.id, {
        answers: entryAnswers,
        currentStep: 0,
      });
      if (!saved) {
        setFeedback('This session-only application is no longer available. Start a new application.');
        return false;
      }
      setSessionApplication(saved.application);
      return true;
    }
    try {
      const saved = await update.mutateAsync({
        applicationId: id,
        data: { answers: entryAnswers, currentStep: 0 },
      });
      queryClient.setQueryData(getGetApplicationQueryKey(id), saved);
      return true;
    } catch {
      setFeedback('We could not save your changes. Please try again.');
      return false;
    }
  };
  const submitDraft = async (answers: Record<string, unknown>) => {
    try {
      let saved: EnrollmentApplication;
      if (sessionOnlyRoute) {
        if (!user?.id) throw new Error('The signed-in account could not be confirmed.');
        const record = getSessionDraft(application.id, user.id);
        if (!record) throw new Error('This session-only application is no longer available.');
        if (!record.pin) throw new Error('Create the category PIN before submitting.');
        saved = await submitNew.mutateAsync({
          data: {
            submissionId: record.submissionId,
            categoryId: application.categoryId,
            answers,
            pin: record.pin,
          },
        });
        removeSessionDraft(application.id, user.id);
      } else {
        saved = await submitExisting.mutateAsync({ applicationId: id });
      }
      queryClient.setQueryData(getGetApplicationQueryKey(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetApplicantSummaryQueryKey() });
      setShowSuccess(true);
      setLocation(`/apply/${saved.id}?submitted=1`);
      return true;
    } catch {
      setFeedback('Your application was not submitted. Check the required information and try again.');
      return false;
    }
  };
  const categoryEntryScreenId = `category-entry-${application.categoryId.replace('category-', '')}`;
  const categoryEntryCopy = portalSettings.data?.screenCopy[categoryEntryScreenId] ?? {};
  const categoryEntryCard = portalSettings.data?.cards.find((card) => card.id === application.categoryId);
  if (application.answers?.categoryEntryComplete !== true) {
    return <CategoryEntryForm
      key={application.categoryId}
      categoryId={application.categoryId}
      reference={application.reference}
      savedAnswers={application.answers ?? {}}
      isSaving={!sessionOnlyRoute && update.isPending}
      error={feedback}
      pinScreenBackground={portalSettings.data?.theme.pinScreenBackground}
      categoryInputTransparent={portalSettings.data?.theme.categoryInputTransparent}
      screenCopy={categoryEntryCopy}
      pageTheme={portalSettings.data?.pageThemes?.[categoryEntryScreenId]}
      entryLogoDataUrl={categoryEntryCard?.entryLogoDataUrl ?? categoryEntryCard?.logoDataUrl}
      pinLogoDataUrl={categoryEntryCard?.pinLogoDataUrl ?? categoryEntryCard?.entryLogoDataUrl ?? categoryEntryCard?.logoDataUrl}
      entryLogoAlignment={categoryEntryCard?.entryLogoAlignment ?? categoryEntryCopy.entryLogoAlignment}
      entryLogoVerticalOffset={categoryEntryCard?.entryLogoVerticalOffset ?? categoryEntryCopy.entryLogoVerticalOffset}
      pinLogoAlignment={categoryEntryCard?.pinLogoAlignment ?? categoryEntryCopy.entryLogoAlignment}
      pinLogoVerticalOffset={categoryEntryCard?.pinLogoVerticalOffset ?? categoryEntryCopy.entryLogoVerticalOffset}
      onComplete={(entryAnswers: CategoryEntryAnswers, entryPin: string) => {
        setFeedback('');
        if (sessionOnlyRoute) {
          if (!user?.id) {
            setFeedback('The signed-in account could not be confirmed.');
            return;
          }
          const saved = updateSessionDraft(application.id, user.id, {
            currentStep: 0,
            answers: { ...application.answers, ...entryAnswers, categoryEntryComplete: true },
            hasPin: true,
          }, entryPin);
          if (!saved) {
            setFeedback('This session-only application is no longer available. Start a new application.');
            return;
          }
          setSessionApplication(saved.application);
          return;
        }
        update.mutate({
          applicationId: id,
          data: {
            currentStep: 0,
            answers: { ...application.answers, ...entryAnswers, categoryEntryComplete: true },
            pin: entryPin,
          },
        }, {
          onSuccess: (saved) => {
            queryClient.setQueryData(getGetApplicationQueryKey(id), saved);
            queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetApplicantSummaryQueryKey() });
          },
          onError: () => setFeedback('Your details could not be saved. Check the form and try again.'),
        });
      }}
    />;
  }
  const requested = application.answers?.__requestedSections;
  const reopenedSections = Array.isArray(requested)
    ? requested.filter((index): index is number => Number.isInteger(index) && index >= 0 && index <= 6)
    : [];
  const changeCategoryFromWizard = (categoryId: string) => {
    const next = categories.data?.find((category) => category.id === categoryId);
    if (!next || next.id === application.categoryId || application.status !== 'draft') return;
    if (!window.confirm(`Change to ${next.name}? This resets the current details and PIN.`)) return;
    if (sessionOnlyRoute) {
      if (!user?.id) return;
      const changed = changeSessionDraftCategory(application.id, user.id, next);
      if (changed) setSessionApplication(changed.application);
      return;
    }
    update.mutate({ applicationId: id, data: { categoryId: next.id } }, {
      onSuccess: (saved) => {
        queryClient.setQueryData(getGetApplicationQueryKey(id), saved);
        void queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetApplicantSummaryQueryKey() });
      },
      onError: () => setFeedback('The enrollment category could not be changed. Please try again.'),
    });
  };
  return <EnrollmentWizard
    application={application}
    categories={categories.data ?? []}
    status={application.status}
    storageAvailable={false}
    maxUploadBytes={10 * 1024 * 1024}
    isSaving={!sessionOnlyRoute && update.isPending}
    isSubmitting={submitExisting.isPending || submitNew.isPending}
    error={feedback}
    reopenedSections={reopenedSections}
    saveStep={saveStep}
    submit={submitDraft}
    onChangeCategory={changeCategoryFromWizard}
    onBackToCategoryEntry={backToCategoryEntry}
    screenCopy={portalSettings.data?.screenCopy}
    categoryCards={portalSettings.data?.cards}
    pageThemes={portalSettings.data?.pageThemes}
  />;
}

function ApplicationDetail() {
  const portalSettings = useGetPortalSettings();
  const params = useParams<{ applicationId?: string }>();
  const id = params.applicationId ?? '';
  const app = useGetApplication(id, { query: { enabled: !!id, queryKey: getGetApplicationQueryKey(id) } });
  if (app.isLoading) return <AppFrame><LoadingPanel /></AppFrame>;
  if (app.isError || !app.data) return <AppFrame><ErrorPanel message="We could not retrieve this application." retry={() => void app.refetch()} /></AppFrame>;
  const record = app.data;
  return <AppFrame>
    <div className="detail-page">
      <Link href="/dashboard" className="back-link" data-testid="link-detail-back"><ArrowLeft size={16} /> Your applications</Link>
      <section className="detail-hero">
        <div className="detail-meta"><span className="eyebrow">APPLICATION RECORD</span><StatusPill status={applicationDisplayStatus(record)} testId={`status-detail-${record.id}`} /></div>
        <h1>{copyText(portalSettings.data, 'application-status', 'title', record.categoryName)}</h1><p className="mono detail-reference">{record.reference}</p>
        <div className="detail-created">Last updated {formatDate(record.updatedAt)}</div>
      </section>
      <div className="detail-grid">
        <section className="detail-card"><div className="detail-card-title"><Activity size={17} /><h2>Verification progress</h2></div>
          <div className="status-timeline">
            <div className={`status-event complete`}><span><Check size={13} /></span><div><b>Application created</b><small>{formatDate(record.createdAt)}</small></div></div>
            <div className={`status-event ${record.submittedAt ? 'complete' : 'current'}`}><span>{record.submittedAt ? <Check size={13} /> : <span />}</span><div><b>Submitted for review</b><small>{record.submittedAt ? formatDate(record.submittedAt) : 'Not yet submitted'}</small></div></div>
            <div className={`status-event ${['approved', 'rejected'].includes(record.status) ? 'complete' : ''}`}><span>{['approved', 'rejected'].includes(record.status) ? <Check size={13} /> : null}</span><div><b>Verification decision</b><small>{record.status === 'under_review' || record.status === 'submitted' ? 'Review in progress' : record.status === 'needs_information' ? 'Additional information required' : record.status.replaceAll('_', ' ')}</small></div></div>
          </div>
          {record.outstandingRequirements?.length ? <div className="review-note" data-testid="application-outstanding-requirements">
            <b>Items still needed</b><ul>{record.outstandingRequirements.map((item) => <li key={item}>{item}</li>)}</ul>
          </div> : null}
          {(record.applicantFollowup ?? record.reviewNote) && <div className="review-note"><b>Update from the review team</b><p>{record.applicantFollowup ?? record.reviewNote}</p></div>}
          {['draft', 'needs_information'].includes(record.status) && <Link href={`/apply/${record.id}`} className="button button-primary" data-testid="link-continue-draft">{record.status === 'needs_information' ? 'Provide requested information' : 'Continue application'} <ArrowRight size={15} /></Link>}
        </section>
        <section className="detail-card detail-help"><span className="help-icon"><MessageCircle size={18} /></span><h2>Questions about this application?</h2><p>Send a note to the support team and follow the reply here.</p><Link href="/support" className="text-action" data-testid="link-detail-support">Contact support <ArrowRight size={14} /></Link></section>
      </div>
    </div>
  </AppFrame>;
}

function SupportPage() {
  const tickets = useListMySupportTickets();
  const applications = useListMyApplications();
  const create = useCreateSupportTicket();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'enrollment' | 'account' | 'technical' | 'documents' | 'other'>('enrollment');
  const [applicationId, setApplicationId] = useState('');
  const [notice, setNotice] = useState('');
  const canSubmit = subject.trim().length >= 3 && message.trim().length >= 5;
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setNotice('');
    create.mutate({ data: { subject: subject.trim(), category, message: message.trim(), applicationId: applicationId || null } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMySupportTicketsQueryKey() });
        setSubject(''); setMessage(''); setApplicationId(''); setCategory('enrollment');
        setNotice('Your support request has been sent.');
      },
      onError: () => setNotice('Your request could not be sent. Please try again.'),
    });
  };
  return <AppFrame active="support">
    <div className="support-page">
      <PageHeading eyebrow="APPLICANT SUPPORT" title="We’re here to help." detail="Send a secure message about your enrollment or an application." />
      <div className="support-grid">
        <section className="support-form-card">
          <div className="form-card-heading"><span className="form-card-icon"><MessageCircle size={18} /></span><div><h2>Send a message</h2><p>Replies will appear in your support history.</p></div></div>
          <form onSubmit={send} className="support-form">
            <label className="field-label" htmlFor="support-subject">Subject</label>
            <input id="support-subject" className="text-input" value={subject} onChange={(e) => setSubject(e.target.value)} minLength={3} maxLength={200} required placeholder="What can we help with?" data-testid="input-support-subject" />
            <label className="field-label" htmlFor="support-category">Request category</label>
            <select id="support-category" className="text-input select-input" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} data-testid="select-support-category">
              <option value="enrollment">Enrollment</option><option value="account">Account</option><option value="technical">Technical</option><option value="documents">Documents</option><option value="other">Other</option>
            </select>
            <label className="field-label" htmlFor="support-application">Related application <span>Optional</span></label>
            <select id="support-application" className="text-input select-input" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} data-testid="select-support-application">
              <option value="">No application selected</option>{(applications.data ?? []).map((application) => <option key={application.id} value={application.id}>{application.reference} · {application.categoryName}</option>)}
            </select>
            <label className="field-label" htmlFor="support-message">Message</label>
            <textarea id="support-message" className="text-input form-textarea support-message-input" value={message} onChange={(e) => setMessage(e.target.value)} minLength={5} maxLength={5000} required placeholder="Tell us a little more so we can help." data-testid="input-support-message" />
            <p className="field-help">Secure attachments are not available right now. Do not include identity documents in this message.</p>
            <div className="support-form-end"><span className="save-status" role="status" data-testid="text-support-feedback">{notice}</span><PrimaryButton kind="submit" disabled={!canSubmit || create.isPending} testId="button-send-support">{create.isPending ? 'Sending…' : 'Send message'} <ArrowRight size={15} /></PrimaryButton></div>
          </form>
        </section>
        <section className="ticket-history">
          <div className="section-line"><div><h2>Your support history</h2><p>Messages and replies from the team.</p></div></div>
          {tickets.isLoading ? <LoadingPanel /> : tickets.isError ? <ErrorPanel message="Support history is temporarily unavailable." retry={() => void tickets.refetch()} /> :
            (tickets.data ?? []).length === 0 ? <EmptyPanel title="No messages yet" message="Your support conversations will appear here." /> :
              <div className="ticket-list">{(tickets.data ?? []).map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}</div>}
        </section>
      </div>
    </div>
  </AppFrame>;
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const addMessage = useAddApplicantSupportMessage();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const send = () => {
    if (!draft.trim()) return;
    setError('');
    addMessage.mutate({ ticketId: ticket.id, data: { message: draft.trim() } }, {
      onSuccess: () => {
        setDraft('');
        queryClient.invalidateQueries({ queryKey: getListMySupportTicketsQueryKey() });
      },
      onError: () => setError('Your reply could not be sent. Please try again.'),
    });
  };
  return <article className="ticket-card" data-testid={`ticket-${ticket.id}`}>
    <div className="ticket-head"><span className="ticket-subject">{ticket.subject}</span><StatusPill status={ticket.status} testId={`status-ticket-${ticket.id}`} /></div>
    <div className="ticket-date">{ticket.category.replaceAll('_', ' ')}{ticket.applicationReference ? ` · ${ticket.applicationReference}` : ''}</div>
    <div className="ticket-date">Opened {formatDate(ticket.createdAt)}</div>
    <div className="ticket-conversation" aria-label="Support conversation">
      {(ticket.messages ?? []).map((item) => <div key={item.id} className={item.actorRole === 'administrator' ? 'ticket-response' : 'ticket-message'}>
        <b>{item.actorRole === 'administrator' ? 'Support team' : 'You'}</b><p>{item.body}</p><small>{formatDate(item.createdAt)}</small>
      </div>)}
    </div>
    {!['resolved', 'closed'].includes(ticket.status) && <div className="ticket-reply-form">
      <label className="field-label" htmlFor={`support-reply-${ticket.id}`}>Reply</label>
      <textarea id={`support-reply-${ticket.id}`} className="text-input form-textarea" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} rows={2} data-testid={`input-support-reply-${ticket.id}`} />
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="button button-quiet" onClick={send} disabled={!draft.trim() || addMessage.isPending} data-testid={`button-support-reply-${ticket.id}`}>{addMessage.isPending ? 'Sending…' : 'Send reply'} <ArrowRight size={14} /></button>
    </div>}
  </article>;
}

function AdminShell({ children, active = 'overview' }: { children: ReactNode; active?: string }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const role = user?.publicMetadata?.role;
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  const canReview = role === 'sub_admin' || role === 'admin';
  const canManage = role === 'admin';
  const navLinks = [
    { href: '/admin', key: 'overview', label: canManage ? 'Admin home' : 'Overview', icon: Activity, testId: 'link-admin-overview' },
    ...(canReview ? [
      { href: '/admin/review', key: 'review', label: 'Applicants', icon: FileCheck2, testId: 'link-admin-review' },
      { href: '/admin/email', key: 'email', label: 'Email center', icon: Mail, testId: 'link-admin-email' },
    ] : []),
    ...(canManage ? [
      { href: '/admin/users', key: 'users', label: 'Users and roles', icon: CheckCircle2, testId: 'link-admin-users' },
      { href: '/admin/settings', key: 'settings', label: 'Portal settings', icon: Settings, testId: 'link-admin-settings' },
    ] : []),
    { href: '/admin/support', key: 'support', label: 'Support inbox', icon: Headphones, testId: 'link-admin-support' },
  ];
  return <div className="admin-shell portal-frame">
    <div className="admin-mobile-bar">
      <button type="button" className="admin-menu-trigger" aria-label={menuOpen ? 'Close staff navigation' : 'Open staff navigation'} aria-expanded={menuOpen} aria-controls="admin-staff-navigation" onClick={() => setMenuOpen((open) => !open)} data-testid="button-admin-menu">
        {menuOpen ? <X size={19} /> : <Menu size={19} />}
      </button>
      <PortalWordmark className="portal-wordmark-compact" />
      <span className="admin-mobile-role">{role === 'admin' ? 'ADMIN' : role === 'sub_admin' ? 'REVIEW STAFF' : 'SUPPORT STAFF'}</span>
    </div>
    {menuOpen && <button className="admin-mobile-scrim" type="button" aria-label="Close staff navigation" onClick={() => setMenuOpen(false)} data-testid="button-admin-close-menu" />}
    <aside className={`admin-sidebar ${menuOpen ? 'admin-sidebar-open' : ''}`} id="admin-staff-navigation">
      <div className="sidebar-brand"><PortalWordmark inverse /></div><div className="workspace-label">STAFF WORKSPACE</div>
      <nav className="side-nav" aria-label="Staff navigation">
        {navLinks.map(({ href, key, label, icon: Icon, testId }) => <Link key={key} href={href} onClick={() => setMenuOpen(false)} aria-current={active === key ? 'page' : undefined} className={`nav-link ${active === key ? 'nav-link-active' : ''}`} data-testid={testId}>
          <Icon size={18} /><span>{label}</span>
        </Link>)}
      </nav>
      <div className="sidebar-bottom"><div className="privacy-note"><LockKeyhole size={17} /><div><b>Restricted workspace</b><span>Access verified by service</span></div></div>
        <button className="nav-link signout-link" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-admin-signout"><LogOut size={18} /><span>Sign out</span></button>
      </div>
    </aside>
    <main className="admin-content portal-scroll">{children}</main>
  </div>;
}

function AdminGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  const [location] = useLocation();
  if (!isLoaded || (isSignedIn && !userLoaded)) return <main className="portal-frame auth-loading"><LoadingPanel label="Checking staff access" /></main>;
  if (!isSignedIn) return <SignedOutNotice returnTo={staffReviewReturnPath(location)} />;
  const role = user?.publicMetadata?.role;
  if (!['admin', 'sub_admin', 'moderator'].includes(String(role))) return <main className="signedout-page portal-frame"><PortalWordmark /><div className="signedout-card"><span className="state-icon"><LockKeyhole size={21} /></span><div className="eyebrow">RESTRICTED WORKSPACE</div><h1>Administrator access required</h1><p>This console is available only to authorized administrators.</p><Link href="/dashboard" className="button button-primary" data-testid="link-admin-denied-dashboard">Return to your dashboard <ArrowRight size={15} /></Link></div></main>;
  if (role === 'moderator' && location !== '/admin/support') return <main className="signedout-page portal-frame"><PortalWordmark /><div className="signedout-card"><span className="state-icon"><Headphones size={21} /></span><div className="eyebrow">SUPPORT STAFF</div><h1>Support workspace</h1><p>Moderator access is limited to support requests.</p><Link href="/admin/support" className="button button-primary" data-testid="link-moderator-support">Open support inbox <ArrowRight size={15} /></Link></div></main>;
  if (role === 'sub_admin' && (location === '/admin/users' || location === '/admin/settings')) return <main className="signedout-page portal-frame"><PortalWordmark /><div className="signedout-card"><span className="state-icon"><LockKeyhole size={21} /></span><div className="eyebrow">RESTRICTED WORKSPACE</div><h1>Administrator access required</h1><p>Your staff role does not include user or portal settings management.</p><Link href="/admin/review" className="button button-primary" data-testid="link-subadmin-review">Open Applicants <ArrowRight size={15} /></Link></div></main>;
  return <>{children}</>;
}

function AdminManagementHome() {
  return <AdminShell active="overview">
    <div className="admin-page">
      <PageHeading eyebrow="SECURE STAFF WORKSPACE" title="Admin home" detail="Review applicant enrollments, manage portal configuration and staff access, and respond to applicant support." />
      <section className="admin-overview-actions" aria-label="Administration actions">
        <Link href="/admin/review" className="detail-card admin-overview-link" data-testid="link-admin-home-review">
          <span className="admin-action-icon"><FileCheck2 size={18} /></span><b>Applicants</b><span>Review submitted enrollments and saved guest drafts in one place.</span><strong>All applicant records</strong><ArrowRight size={16} />
        </Link>
        <Link href="/admin/users" className="detail-card admin-overview-link" data-testid="link-admin-home-users">
          <span className="admin-action-icon"><CheckCircle2 size={18} /></span><b>Users and roles</b><span>Manage staff access and account status.</span><strong>Admin only</strong><ArrowRight size={16} />
        </Link>
        <Link href="/admin/settings" className="detail-card admin-overview-link" data-testid="link-admin-home-settings">
          <span className="admin-action-icon"><Settings size={18} /></span><b>Portal settings</b><span>Update enrollment content and presentation.</span><strong>Admin only</strong><ArrowRight size={16} />
        </Link>
        <Link href="/admin/email" className="detail-card admin-overview-link" data-testid="link-admin-home-email">
          <span className="admin-action-icon"><Mail size={18} /></span><b>Email center</b><span>Manage reviewer alerts, send messages, and retry failed emails.</span><strong>Reviewer access</strong><ArrowRight size={16} />
        </Link>
        <Link href="/admin/support" className="detail-card admin-overview-link" data-testid="link-admin-home-support">
          <span className="admin-action-icon"><Headphones size={18} /></span><b>Support inbox</b><span>Respond to applicant conversations and track resolution.</span><strong>Staff access</strong><ArrowRight size={16} />
        </Link>
      </section>
      <GuestInviteLinkCard />
    </div>
  </AdminShell>;
}

function GuestInviteLinkCard() {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const inviteInput = useRef<HTMLInputElement>(null);
  const inviteUrl = useMemo(() => `${window.location.origin}${basePath}/dashboard`, []);

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState('copied');
    } catch {
      inviteInput.current?.focus();
      inviteInput.current?.select();
      setCopyState('manual');
    }
  };

  return <section className="admin-guest-invite" aria-labelledby="admin-guest-invite-title" data-testid="admin-guest-invite-card">
    <div className="admin-guest-invite-copy">
      <span className="eyebrow">APPLICANT ACCESS</span>
      <h2 id="admin-guest-invite-title">Reusable guest invite link</h2>
      <p>Share this link to open the category dashboard. Applicants can start without creating an enrollment-portal account.</p>
    </div>
    <div className="admin-guest-invite-share">
      <label className="admin-guest-invite-field">
        <span>Public category link</span>
        <input
          ref={inviteInput}
          className="text-input"
          type="url"
          readOnly
          value={inviteUrl}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Reusable guest invite link"
          data-testid="input-admin-guest-invite-link"
        />
      </label>
      <button type="button" className="button button-primary" onClick={() => void copyInviteLink()} data-testid="button-copy-admin-guest-invite">
        {copyState === 'copied' ? <Check size={15} /> : <Copy size={15} />}
        {copyState === 'copied' ? 'Copied' : 'Copy link'}
      </button>
      <p className="admin-guest-invite-status" aria-live="polite">
        {copyState === 'copied' ? 'Link copied. It can be reused.' : copyState === 'manual' ? 'Automatic copy was blocked; the link is selected for manual copying.' : 'Anyone with the link can open the public guest portal.'}
      </p>
    </div>
  </section>;
}

function AdminLanding() {
  const { user } = useUser();
  return user?.publicMetadata?.role === 'admin' ? <AdminManagementHome /> : <AdminOverview />;
}

function draftProgressLabel(application: {
  currentStep: number;
  answers?: Record<string, unknown> | null;
}) {
  if (application.answers?.categoryEntryComplete !== true) return 'Category details not saved yet';
  if (application.currentStep === 0) return 'Category details saved · wizard step 1 next';
  return `Saved through step ${Math.min(application.currentStep, 8)} of 8`;
}

function AccessError({ retry }: { retry: () => void }) {
  return <section className="admin-access-error" data-testid="state-admin-access-error"><div className="access-seal"><LockKeyhole size={23} /></div><div className="eyebrow">STAFF ACCESS CHECK</div><h1>This workspace isn’t available</h1><p>The service did not authorize this staff view, or the queue could not be reached. Access is verified securely by the server.</p><button className="button button-quiet" onClick={retry} data-testid="button-retry-admin">Check access again <ArrowRight size={15} /></button><Link href="/" className="text-action" data-testid="link-admin-home">Return to portal</Link></section>;
}

function AdminOverview() {
  const overview = useGetAdminOverview();
  const recentQuery = useListApplicationsForReview();
  const { user } = useUser();
  const role = user?.publicMetadata?.role;
  const canReview = role === 'sub_admin' || role === 'admin';
  const canEditPortal = user?.publicMetadata?.role === 'admin';
  if (overview.isError) return <AdminShell><AccessError retry={() => void overview.refetch()} /></AdminShell>;
  const metrics = [
    ['Total registered users', overview.data?.totalUsers, 'users'],
    ['Enrollment applications', overview.data?.totalApplications, 'applications'],
    ['Pending applications', overview.data?.pendingApplications, 'pending'],
    ['Under review', overview.data?.underReviewApplications, 'review'],
    ['Approved', overview.data?.approvedApplications, 'approved'],
    ['Rejected', overview.data?.rejectedApplications, 'rejected'],
    ['Additional information required', overview.data?.needsInformationApplications, 'information'],
    ['Unresolved support requests', overview.data?.unresolvedSupportRequests, 'support'],
  ] as const;
  return <AdminShell active="overview"><div className="admin-page">
    <PageHeading eyebrow="SECURE STAFF WORKSPACE" title="Overview" detail="Live enrollment and support totals from the service." action={<div className="admin-overview-heading-actions">
      {canEditPortal && <Link href="/admin/settings" className="button button-primary" data-testid="link-overview-edit-modifications"><Settings size={16} /> Edit &amp; modifications</Link>}
      {canReview && <Link href="/admin/review" className={`button ${canEditPortal ? 'button-quiet' : 'button-primary'}`} data-testid="link-overview-review">Open Applicants <ArrowRight size={15} /></Link>}
    </div>} />
    {overview.isLoading ? <LoadingPanel label="Loading administrator totals" /> : <section className="admin-metric-grid" aria-label="Enrollment overview totals">
      {metrics.map(([label, value, key]) => <article className="admin-metric-card" key={key} data-testid={`metric-${key}`}><span>{label}</span><strong>{value ?? '—'}</strong></article>)}
    </section>}
    <section className="admin-action-center" aria-label="Workspace actions">
      <div className="admin-section-heading"><div><span className="eyebrow">WORK QUEUE</span><h2>Next actions</h2></div><span className="admin-live-mark"><span className="server-dot" /> Live service data</span></div>
      <div className="admin-overview-actions">
        {canReview && <Link href="/admin/review" className="detail-card admin-overview-link" data-testid="link-overview-review-action"><span className="admin-action-icon"><FileCheck2 size={18} /></span><b>Applicants</b><span>Review submitted applications and saved guest drafts.</span><strong>{overview.data?.pendingApplications ?? '—'} pending</strong><ArrowRight size={16} /></Link>}
        {canReview && <Link href="/admin/email" className="detail-card admin-overview-link" data-testid="link-overview-email-action"><span className="admin-action-icon"><Mail size={18} /></span><b>Email center</b><span>Manage reviewer alerts, send external messages, and retry failures.</span><strong>Reviewer access</strong><ArrowRight size={16} /></Link>}
        <Link href="/admin/support" className="detail-card admin-overview-link" data-testid="link-overview-support-action"><span className="admin-action-icon"><Headphones size={18} /></span><b>Support inbox</b><span>Respond to applicant conversations and track resolution.</span><strong>{overview.data?.unresolvedSupportRequests ?? '—'} unresolved</strong><ArrowRight size={16} /></Link>
        {canEditPortal && <Link href="/admin/users" className="detail-card admin-overview-link" data-testid="link-overview-users-action"><span className="admin-action-icon"><CheckCircle2 size={18} /></span><b>Users and roles</b><span>Manage staff access and account status.</span><strong>Admin only</strong><ArrowRight size={16} /></Link>}
        {canEditPortal && <Link href="/admin/settings" className="detail-card admin-overview-link" data-testid="link-overview-settings-action"><span className="admin-action-icon"><Settings size={18} /></span><b>Portal settings</b><span>Update enrollment content and presentation.</span><strong>Admin only</strong><ArrowRight size={16} /></Link>}
      </div>
    </section>
    {canReview && <section className="admin-recent-section">
      <div className="admin-section-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Applications to review</h2></div><Link href="/admin/review" className="text-action" data-testid="link-overview-all-applications">View Applicants <ArrowRight size={14} /></Link></div>
      <div className="admin-recent-card">
        {recentQuery.isError ? <div className="admin-recent-error" role="alert"><span>Recent applications could not be loaded.</span><button type="button" className="text-action" onClick={() => void recentQuery.refetch()}>Try again</button></div>
          : recentQuery.isLoading ? <div className="admin-recent-skeleton" aria-label="Loading recent applications">{[0, 1, 2].map((item) => <span className="skeleton" key={item} />)}</div>
          : (recentQuery.data ?? []).length === 0 ? <EmptyPanel title="No applications to show" message="New applications will appear here when they are submitted." />
          : <div className="admin-recent-list">{(recentQuery.data ?? []).slice(0, 5).map((application) => <Link href={`/admin/applications/${application.id}`} className="admin-recent-row" key={application.id} data-testid={`row-admin-recent-${application.id}`}>
            <span className="admin-recent-file"><FileText size={17} /></span><span className="admin-recent-main"><b>{application.categoryName}</b><small>{application.applicantName || 'Applicant'} · {application.reference}</small></span><span className="admin-recent-date">{formatDate(application.submittedAt)}</span><StatusPill status={application.status} testId={`status-admin-recent-${application.id}`} /><ArrowRight size={15} className="admin-recent-arrow" />
          </Link>)}</div>}
      </div>
    </section>}
  </div></AdminShell>;
}

function AdminUsers() {
  const [search, setSearch] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [roleFeedback, setRoleFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(accountStatus ? { accountStatus: accountStatus as 'active' | 'suspended' } : {}),
  }), [search, accountStatus]);
  const users = useListAdminUsers(params);
  const updateStatus = useUpdateAdminUserStatus();
  const updateRole = useUpdateAdminUserRole();
  const createInvitation = useCreateAdminUserInvitation();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminUserInvitationInput['role']>('sub_admin');
  const [inviteFeedback, setInviteFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const records = users.data?.users ?? [];
  const sendInvitation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteFeedback(null);
    createInvitation.mutate({ data: { email: inviteEmail.trim(), role: inviteRole } }, {
      onSuccess: (invitation) => {
        setInviteEmail('');
        setInviteFeedback({ message: invitation.message, error: false });
      },
      onError: (error) => setInviteFeedback({
        message: error.status === 409
          ? 'This email already has an account or a pending invitation.'
          : 'The invitation could not be sent. Check the email address and try again.',
        error: true,
      }),
    });
  };
  const changeStatus = (record: AdminUser) => {
    const next = record.accountStatus === 'suspended' ? 'active' : 'suspended';
    const verb = next === 'suspended' ? 'suspend' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${verb} ${record.name || record.email || 'this account'}? Enrollment records will be preserved.`)) return;
    updateStatus.mutate({ userId: record.userId, data: { accountStatus: next } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
      },
    });
  };
  const changeRole = (record: AdminUser, role: AdminUser['role']) => {
    if (record.userId === user?.id || role === record.role) return;
    if (!window.confirm(`Change ${record.name || record.email || 'this user'}’s role to ${role.replaceAll('_', ' ')}?`)) return;
    setRoleFeedback(null);
    updateRole.mutate({ userId: record.userId, data: { role } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        setRoleFeedback({ message: `Role updated to ${role.replaceAll('_', ' ')}.`, error: false });
      },
      onError: () => setRoleFeedback({ message: 'The role could not be changed. Refresh the account list and try again.', error: true }),
    });
  };
  if (users.isError) return <AdminShell active="users"><AccessError retry={() => void users.refetch()} /></AdminShell>;
  return <AdminShell active="users"><div className="admin-page">
    <PageHeading eyebrow="ACCOUNT MANAGEMENT" title="Users and roles" detail="Manage applicant accounts and assign authorized staff roles." />
    <section className="detail-card admin-staff-invite" data-testid="panel-staff-invitation">
      <div className="detail-card-title"><ShieldCheck size={17} /><h2>Invite staff</h2></div>
      <p>Invitations expire after 7 days. The selected role is applied only after the recipient accepts the emailed invitation on the separate <code>/staff/sign-up</code> page.</p>
      <form className="admin-staff-invite-form" onSubmit={sendInvitation}>
        <label className="admin-staff-invite-field"><span className="field-label">Staff email</span>
          <input className="text-input" type="email" autoComplete="email" required maxLength={320} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="colleague@example.com" data-testid="input-staff-invitation-email" />
        </label>
        <label className="admin-staff-invite-field"><span className="field-label">Role after acceptance</span>
          <select className="text-input" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as AdminUserInvitationInput['role'])} data-testid="select-staff-invitation-role">
            <option value="sub_admin">Sub admin — review enrollment</option>
            <option value="moderator">Moderator — support requests</option>
            <option value="admin">Admin — manage staff and settings</option>
          </select>
        </label>
        <button type="submit" className="button button-primary" disabled={createInvitation.isPending} data-testid="button-send-staff-invitation">
          {createInvitation.isPending ? 'Sending invitation…' : 'Send invitation'} <ArrowRight size={15} />
        </button>
      </form>
      {inviteFeedback && <p className={inviteFeedback.error ? 'inline-error' : 'success-message'} role="status" data-testid="text-staff-invitation-feedback">{inviteFeedback.message}</p>}
      <p className="admin-staff-invite-warning">Only invite people you trust with the selected level of access. Admins can assign staff roles and edit portal settings.</p>
    </section>
    <div className="admin-toolbar">
      <label className="searchbox"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, user ID, or reference" aria-label="Search user accounts" data-testid="input-admin-user-search" /></label>
      <label className="filter-select"><span className="sr-only">Filter by account status</span><select value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)} data-testid="select-account-status"><option value="">All account statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select><ChevronDown size={15} /></label>
    </div>
      {roleFeedback && <p className={roleFeedback.error ? 'inline-error' : 'success-message'} role="status" data-testid="text-role-feedback">{roleFeedback.message}</p>}
    {selected && <section className="detail-card admin-user-detail" data-testid="panel-admin-user-detail">
      <div className="detail-card-title"><Activity size={17} /><h2>Account details</h2><button className="text-action" onClick={() => setSelected(null)} data-testid="button-close-user-detail">Close</button></div>
      <div className="review-field"><span>User ID</span><b className="mono">{selected.userId}</b></div>
      <div className="review-field"><span>Name</span><b>{selected.name || selected.username || 'Not provided'}</b></div>
      <div className="review-field"><span>Email</span><b>{selected.email || 'Not provided'}</b></div>
      <div className="review-field"><span>Role</span><b>{selected.role.replaceAll('_', ' ')}</b></div>
      <div className="review-field"><span>Selected category</span><b>{selected.categoryName || 'None selected'}</b></div>
      <div className="review-field"><span>Application reference</span><b>{selected.applicationReference || 'No application'}</b></div>
      <div className="review-field"><span>Registration date</span><b>{formatDate(selected.registrationDate)}</b></div>
      <div className="review-field"><span>Account status</span><b>{selected.accountStatus}</b></div>
      <div className="review-field"><span>Enrollment status</span><b>{selected.enrollmentStatus ? <StatusPill status={selected.enrollmentStatus} /> : 'No application'}</b></div>
      {selected.applicationId && <Link className="button button-quiet" href={`/admin/applications/${selected.applicationId}`}>View application history <ArrowRight size={14} /></Link>}
    </section>}
    <section className="queue-card admin-user-table-card">
      <div className="queue-card-head"><div><b>Accounts</b><span>Suspending an account does not delete its enrollment record.</span></div><span className="queue-count" data-testid="text-admin-user-count">{users.isLoading ? '…' : users.data?.totalCount ?? records.length}</span></div>
      {users.isLoading ? <LoadingPanel label="Loading applicant accounts" /> : records.length === 0 ? <EmptyPanel title="No matching user accounts" message="Try another name, email, reference, or account status." /> :
        <div className="admin-table-scroll"><table className="admin-user-table"><thead><tr><th>User ID</th><th>Name / username</th><th>Email</th><th>Selected category</th><th>Application reference</th><th>Registration date</th><th>Account status</th><th>Enrollment status</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>{records.map((record) => <tr key={record.userId} data-testid={`row-admin-user-${record.userId}`}>
            <td className="mono">{record.userId}</td><td>{record.name || record.username || '—'}</td><td>{record.email || '—'}</td><td>{record.categoryName || '—'}</td>
            <td className="mono">{record.applicationReference || '—'}</td><td>{formatDate(record.registrationDate)}</td><td><StatusPill status={record.accountStatus} /></td>
            <td>{record.enrollmentStatus ? <StatusPill status={record.enrollmentStatus} /> : '—'}</td>
            <td><select value={record.role} disabled={updateRole.isPending || record.userId === user?.id} onChange={(event) => changeRole(record, event.target.value as AdminUser['role'])} aria-label={`Assign role for ${record.name || record.email || record.userId}`} data-testid={`select-user-role-${record.userId}`}><option value="applicant">Applicant</option><option value="admin">Admin</option><option value="sub_admin">Sub admin</option><option value="moderator">Moderator</option></select></td>
            <td className="admin-user-actions"><button className="text-action" onClick={() => setSelected(record)} data-testid={`button-view-user-${record.userId}`}>View user</button>
              {record.applicationId && <Link className="text-action" href={`/admin/applications/${record.applicationId}`} data-testid={`link-user-application-${record.userId}`}>View application</Link>}
              {record.role === 'applicant' && <button className="text-action" onClick={() => changeStatus(record)} disabled={updateStatus.isPending} data-testid={`button-toggle-user-${record.userId}`}>{record.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'}</button>}
            </td>
          </tr>)}</tbody></table></div>}
    </section>
  </div></AdminShell>;
}

function AdminSettings() {
  const settingsQuery = useGetPortalSettings();
  const saveSettings = useUpdatePortalSettings();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PortalSettings | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const normalizeAlignment = (value?: string): PortalSettingsCardsItem['entryLogoAlignment'] =>
    value === 'left' || value === 'right' || value === 'center' ? value : 'center';
  const prepareSettingsDraft = (settings: PortalSettings): PortalSettings => ({
    ...settings,
    cards: settings.cards.map((card) => {
      const screen = `category-entry-${card.id.slice(-1)}`;
      const legacyCopy = settings.screenCopy?.[screen] ?? {};
      const parseOffset = (value?: string) => {
        const parsed = Number.parseInt(value ?? '0', 10);
        return Number.isFinite(parsed) ? Math.max(-120, Math.min(120, parsed)) : 0;
      };
      return {
        ...card,
        cardTitleFontSize: clampSettingsValue(card.cardTitleFontSize, 14, 10, 24),
        cardTitleHorizontalOffset: clampSettingsValue(card.cardTitleHorizontalOffset, 0, -40, 40),
        cardTitleVerticalOffset: clampSettingsValue(card.cardTitleVerticalOffset, 0, -40, 40),
        cardDescriptionFontSize: clampSettingsValue(card.cardDescriptionFontSize, 11, 8, 18),
        cardDescriptionHorizontalOffset: clampSettingsValue(card.cardDescriptionHorizontalOffset, 0, -40, 40),
        cardDescriptionVerticalOffset: clampSettingsValue(card.cardDescriptionVerticalOffset, 0, -40, 40),
        cardLogoAlignment: card.cardLogoAlignment ?? 'left',
        cardLogoVerticalOffset: card.cardLogoVerticalOffset ?? 0,
        entryLogoAlignment: card.entryLogoAlignment ?? normalizeAlignment(legacyCopy.entryLogoAlignment),
        entryLogoVerticalOffset: card.entryLogoVerticalOffset ?? parseOffset(legacyCopy.entryLogoVerticalOffset),
        pinLogoAlignment: card.pinLogoAlignment ?? normalizeAlignment(legacyCopy.entryLogoAlignment),
        pinLogoVerticalOffset: card.pinLogoVerticalOffset ?? parseOffset(legacyCopy.entryLogoVerticalOffset),
      };
    }),
    pageThemes: normalizePageThemes(settings.pageThemes),
  });
  useEffect(() => {
    if (settingsQuery.data) {
      setDraft(prepareSettingsDraft(settingsQuery.data));
    }
  }, [settingsQuery.data]);
  const updateHero = (key: keyof PortalSettings['hero'], value: string) => {
    setDraft((current) => current ? { ...current, hero: { ...current.hero, [key]: value } } : current);
  };
  const updateTheme = (key: keyof PortalSettings['theme'], value: string | boolean) => {
    setDraft((current) => current ? { ...current, theme: { ...current.theme, [key]: value } } : current);
  };
  const updateCard = (id: string, key: string, value: string | number | null) => {
    setDraft((current) => current ? {
      ...current,
      cards: current.cards.map((card) => card.id === id ? { ...card, [key]: value } : card),
    } : current);
  };
  const cardTextLayoutEditor = (card: PortalSettingsCardsItem, target: 'title' | 'description') => {
    const isTitle = target === 'title';
    const controls = isTitle
      ? [
          { axis: 'size' as const, label: 'Text size', key: 'cardTitleFontSize', value: card.cardTitleFontSize ?? 14, min: 10, max: 24 },
          { axis: 'horizontal' as const, label: 'Horizontal offset', key: 'cardTitleHorizontalOffset', value: card.cardTitleHorizontalOffset ?? 0, min: -40, max: 40 },
          { axis: 'vertical' as const, label: 'Vertical offset', key: 'cardTitleVerticalOffset', value: card.cardTitleVerticalOffset ?? 0, min: -40, max: 40 },
        ]
      : [
          { axis: 'size' as const, label: 'Text size', key: 'cardDescriptionFontSize', value: card.cardDescriptionFontSize ?? 11, min: 8, max: 18 },
          { axis: 'horizontal' as const, label: 'Horizontal offset', key: 'cardDescriptionHorizontalOffset', value: card.cardDescriptionHorizontalOffset ?? 0, min: -40, max: 40 },
          { axis: 'vertical' as const, label: 'Vertical offset', key: 'cardDescriptionVerticalOffset', value: card.cardDescriptionVerticalOffset ?? 0, min: -40, max: 40 },
        ];
    const formatValue = (axis: 'size' | 'horizontal' | 'vertical', value: number) => {
      if (axis === 'size') return `${value}px`;
      if (value === 0) return 'Centered';
      const direction = axis === 'horizontal'
        ? value < 0 ? 'left' : 'right'
        : value < 0 ? 'up' : 'down';
      return `${Math.abs(value)}px ${direction}`;
    };
    return <fieldset className="settings-card-text-editor" data-testid={`settings-card-${target}-layout-${card.id}`}>
      <legend>Card {target}</legend>
      {controls.map(({ axis, label, key, value, min, max }) => (
        <label className="settings-card-text-control" key={key}>
          <span>{label}<output>{formatValue(axis, value)}</output></span>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(event) => updateCard(card.id, key, Number(event.target.value))}
            aria-label={`${card.title} ${target} ${label.toLowerCase()}`}
            data-testid={`input-settings-card-${target}-${axis}-${card.id}`}
          />
        </label>
      ))}
    </fieldset>;
  };
  const reorderCards = (sourceId: string, targetId: string, afterTarget = false) => {
    if (sourceId === targetId) return;
    setDraft((current) => {
      if (!current) return current;
      const sourceIndex = current.cards.findIndex((card) => card.id === sourceId);
      if (sourceIndex < 0 || !current.cards.some((card) => card.id === targetId)) return current;
      const cards = [...current.cards];
      const [movingCard] = cards.splice(sourceIndex, 1);
      const targetIndex = cards.findIndex((card) => card.id === targetId);
      cards.splice(targetIndex + (afterTarget ? 1 : 0), 0, movingCard);
      return { ...current, cards };
    });
  };
  const moveCard = (cardId: string, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      const sourceIndex = current.cards.findIndex((card) => card.id === cardId);
      const targetIndex = sourceIndex + direction;
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.cards.length) return current;
      const cards = [...current.cards];
      [cards[sourceIndex], cards[targetIndex]] = [cards[targetIndex], cards[sourceIndex]];
      return { ...current, cards };
    });
  };
  const updateScreenCopy = (screen: string, key: string, value: string) => {
    setDraft((current) => current ? {
      ...current,
      screenCopy: {
        ...current.screenCopy,
        [screen]: { ...(current.screenCopy[screen] ?? {}), [key]: value },
      },
    } : current);
  };
  const updatePageTheme = (screen: string, key: keyof PortalPageTheme, value: PortalPageTheme[keyof PortalPageTheme]) => {
    setDraft((current) => current ? {
      ...current,
      pageThemes: {
        ...normalizePageThemes(current.pageThemes),
        [screen]: {
          ...(current.pageThemes?.[screen] ?? DEFAULT_PAGE_THEME),
          [key]: value,
        },
      },
    } : current);
  };
  const uploadLogo = (cardId: string, field: 'logoDataUrl' | 'entryLogoDataUrl' | 'pinLogoDataUrl', file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Choose a PNG, JPEG, or WebP image no larger than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateCard(cardId, field, reader.result);
        setError('');
      }
    };
    reader.onerror = () => setError('The image could not be read.');
    reader.readAsDataURL(file);
  };
  const logoEditor = (card: PortalSettingsCardsItem, placement: 'card' | 'entry' | 'pin') => {
    const assetField = placement === 'card'
      ? 'logoDataUrl'
      : placement === 'entry'
        ? 'entryLogoDataUrl'
        : 'pinLogoDataUrl';
    const alignmentField = placement === 'card'
      ? 'cardLogoAlignment'
      : placement === 'entry'
        ? 'entryLogoAlignment'
        : 'pinLogoAlignment';
    const offsetField = placement === 'card'
      ? 'cardLogoVerticalOffset'
      : placement === 'entry'
        ? 'entryLogoVerticalOffset'
        : 'pinLogoVerticalOffset';
    const activeAsset = card[assetField];
    const fallbackAsset = placement === 'card'
      ? fallbackLogoForCategory(card.id)
      : placement === 'entry'
        ? card.logoDataUrl || fallbackLogoForCategory(card.id)
        : card.entryLogoDataUrl || card.logoDataUrl || fallbackLogoForCategory(card.id);
    const previewAsset = activeAsset || fallbackAsset;
    const alignment = typeof card[alignmentField] === 'string' ? card[alignmentField] as string : placement === 'card' ? 'left' : 'center';
    const offset = typeof card[offsetField] === 'number' ? card[offsetField] as number : 0;
    const limit = placement === 'card' ? 48 : 120;
    const editorTitle = placement === 'card'
      ? 'Category card logo'
      : placement === 'entry'
        ? 'Entry form logo'
        : 'PIN screen logo';
    const inputTestId = `input-settings-${placement}-logo-${card.id}`;
    const resetLabel = placement === 'card'
      ? 'Use built-in category logo'
      : placement === 'entry'
        ? 'Use category card logo'
        : 'Use entry form logo';
    return <div className="settings-logo-editor" key={placement} data-testid={`settings-logo-editor-${placement}-${card.id}`}>
      <div className="settings-logo-editor-heading">
        <div><b>{editorTitle}</b><small>PNG, JPEG, or WebP · up to 2 MB</small></div>
        <label className="button button-secondary settings-logo-upload" htmlFor={inputTestId}>Choose image</label>
        <input
          id={inputTestId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            uploadLogo(card.id, assetField, event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
          data-testid={inputTestId}
        />
      </div>
      <div className="settings-logo-preview-frame" aria-label={`${card.title} ${editorTitle.toLowerCase()} preview`}>
        <img src={previewAsset} alt="" style={cardLogoPositionStyle(alignment, offset)} />
      </div>
      <div className="settings-logo-position-controls">
        <label className="field-label">Horizontal position
          <select
            className="text-input select-input"
            value={alignment}
            onChange={(event) => updateCard(card.id, alignmentField, event.target.value)}
            data-testid={`select-${placement}-logo-alignment-${card.id}`}
          >
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
        </label>
        <label className="field-label settings-logo-offset-field">
          <span>Vertical position <b>{offset > 0 ? `${offset}px down` : offset < 0 ? `${Math.abs(offset)}px up` : 'Centered'}</b></span>
          <input
            type="range"
            min={-limit}
            max={limit}
            step="2"
            value={offset}
            onChange={(event) => updateCard(card.id, offsetField, Number(event.target.value))}
            aria-label={`${card.title} ${editorTitle.toLowerCase()} vertical position`}
            data-testid={`input-${placement}-logo-offset-${card.id}`}
          />
        </label>
      </div>
      <button
        type="button"
        className="text-action"
        disabled={!activeAsset}
        onClick={() => updateCard(card.id, assetField, null)}
        data-testid={`button-reset-${placement}-logo-${card.id}`}
      >
        {resetLabel}
      </button>
    </div>;
  };
  const screenLabels = [
    ['dashboard', 'User dashboard'],
    ['category-entry-1', 'Category One entry form'],
    ['category-entry-2', 'Category Two entry form'],
    ['category-entry-3', 'Category Three entry form'],
    ['category-entry-4', 'Category Four entry form'],
    ...Array.from({ length: 8 }, (_, index) => [`workflow-step-${index + 1}`, `Enrollment step ${index + 1}`] as [string, string]),
    ['application-status', 'Application status'],
    ['support', 'Applicant support'],
    ['admin-overview', 'Admin overview'],
    ['admin-review', 'Admin review'],
    ['admin-support', 'Admin support'],
  ];
  const categoryEntrySettings = [
    {
      screen: 'category-entry-1',
      title: 'Category One',
      fields: [
        ['nameLabel', 'Name field label', 'Name'],
        ['nicknameLabel', 'Nickname field label', 'Nickname'],
        ['pinLabel', 'PIN prompt label', 'Please enter your PIN'],
        ['buttonLabelStep1', 'Continue button text', 'Continue'],
      ],
    },
    {
      screen: 'category-entry-2',
      title: 'Category Two',
      fields: [
        ['nameLabel', 'Login field label', 'Login'],
        ['surnameLabel', 'Surname field label', 'Surname'],
        ['pinLabel', 'PIN prompt label', 'Please enter your PIN'],
        ['buttonLabelStep1', 'First step button text', 'Connect'],
        ['buttonLabelStep2', 'Second step button text', 'Continue'],
      ],
    },
    {
      screen: 'category-entry-3',
      title: 'Category Three',
      fields: [
        ['nameLabel', 'Name field label', 'Name'],
        ['surnameLabel', 'Surname field label', 'Surname'],
        ['pinLabel', 'PIN prompt label', 'Please enter your PIN'],
        ['buttonLabelStep1', 'Continue button text', 'Continue'],
      ],
    },
    {
      screen: 'category-entry-4',
      title: 'Category Four',
      fields: [
        ['nameLabel', 'Name field label', 'Name'],
        ['surnameLabel', 'Surname field label', 'Surname'],
        ['pinLabel', 'PIN prompt label', 'Please enter your PIN'],
        ['buttonLabelStep1', 'Continue button text', 'Continue'],
      ],
    },
  ] as const;
  const workflowFieldLabels: Record<string, [string, string][]> = {
    'workflow-step-1': [
      ['field_personalInformation_firstName', 'First name'], ['field_personalInformation_middleName', 'Middle name'],
      ['field_personalInformation_surname', 'Surname'], ['field_personalInformation_dateOfBirth', 'Date of birth'],
      ['field_personalInformation_nationality', 'Nationality'], ['field_personalInformation_phone', 'Phone number'],
      ['field_personalInformation_email', 'Email address'], ['field_personalInformation_residentialAddress', 'Residential address'],
      ['field_personalInformation_stateRegion', 'State / region'], ['field_personalInformation_city', 'City / local government area'],
      ['field_personalInformation_postalCode', 'Postal code'],
    ],
    'workflow-step-2': [
      ['field_nextOfKin_fullName', 'Full name'], ['field_nextOfKin_relationship', 'Relationship'],
      ['field_nextOfKin_phone', 'Phone number'], ['field_nextOfKin_email', 'Email address'],
      ['field_nextOfKin_residentialAddress', 'Residential address'], ['field_nextOfKin_city', 'City'],
      ['field_nextOfKin_stateRegion', 'State / region'],
    ],
    'workflow-step-3': [
      ['field_education_highestQualification', 'Highest qualification'], ['field_education_institution', 'Institution'],
      ['field_education_courseField', 'Course / field'], ['field_education_startYear', 'Start year'],
      ['field_education_completionYear', 'Completion year'], ['field_education_certificationStatus', 'Certification status'],
      ['field_education_additionalQualifications', 'Additional qualifications'], ['field_education_certificateObjectPath', 'Certificate upload label'],
    ],
    'workflow-step-4': [
      ['field_workInformation_employmentStatus', 'Employment status'], ['field_workInformation_occupation', 'Occupation'],
      ['field_workInformation_employer', 'Employer'], ['field_workInformation_businessName', 'Business name'],
      ['field_workInformation_workAddress', 'Business / work address'], ['field_workInformation_workPhone', 'Work phone'],
      ['field_workInformation_yearsExperience', 'Years of experience'],
    ],
    'workflow-step-5': [
      ['field_proofOfIdentity_documentType', 'Document type'], ['field_proofOfIdentity_documentNumber', 'Document number'],
      ['field_proofOfIdentity_frontObjectPath', 'Front image upload label'], ['field_proofOfIdentity_backObjectPath', 'Back image upload label'],
    ],
    'workflow-step-7': [
      ['field_bankDetails_bankName', 'Bank'], ['field_bankDetails_accountHolder', 'Account holder'],
      ['field_bankDetails_accountNumber', 'Account number'], ['field_bankDetails_accountType', 'Account type'],
    ],
  };
  const save = () => {
    if (!draft) return;
    setMessage('');
    setError('');
    saveSettings.mutate({ data: draft }, {
      onSuccess: (saved) => {
        queryClient.setQueryData<PortalSettings>(getGetPortalSettingsQueryKey(), saved);
        setDraft(prepareSettingsDraft(saved));
        setMessage('Portal settings saved.');
      },
      onError: () => setError('Settings could not be saved. Please try again.'),
    });
  };
  if (settingsQuery.isError) return <AdminShell active="settings"><AccessError retry={() => void settingsQuery.refetch()} /></AdminShell>;
  if (!draft) return <AdminShell active="settings"><LoadingPanel label="Loading portal settings" /></AdminShell>;
  return <AdminShell active="settings"><div className="admin-page admin-settings-page">
    <PageHeading eyebrow="PORTAL CONFIGURATION" title="Portal settings" detail="Edit the home page, enrollment cards, screen copy, and visual settings." action={<button className="button button-primary" onClick={save} disabled={saveSettings.isPending} data-testid="button-save-portal-settings">{saveSettings.isPending ? 'Saving…' : 'Save changes'} <Check size={15} /></button>} />
    {message && <p className="success-message" role="status" data-testid="text-settings-success">{message}</p>}
    {error && <p className="inline-error" role="alert" data-testid="text-settings-error">{error}</p>}
    <nav className="settings-jump-nav" aria-label="Settings sections">
      <span>JUMP TO</span>
      <a href="#settings-landing">Landing</a>
      <a href="#settings-categories">Categories</a>
      <a href="#settings-appearance">Controls</a>
      <a href="#settings-backgrounds">Backgrounds</a>
      <a href="#settings-category-copy">Category forms</a>
      <a href="#settings-workflow-copy">Workflow text</a>
    </nav>
    <section className="detail-card settings-panel" id="settings-landing" aria-labelledby="settings-landing-title">
      <div className="detail-card-title"><Home size={17} /><h2 id="settings-landing-title">Landing page</h2></div>
      <label className="field-label">Hero heading<input className="text-input" value={draft.hero.title} maxLength={160} onChange={(event) => updateHero('title', event.target.value)} data-testid="input-settings-hero-title" /></label>
      <label className="field-label">Hero description<textarea className="text-input form-textarea" value={draft.hero.description} maxLength={500} rows={3} onChange={(event) => updateHero('description', event.target.value)} data-testid="input-settings-hero-description" /></label>
      <div className="settings-inline-fields">
        <label className="field-label">Primary button label<input className="text-input" value={draft.hero.getStartedLabel} maxLength={60} onChange={(event) => updateHero('getStartedLabel', event.target.value)} /></label>
      </div>
    </section>
    <section className="detail-card settings-panel" id="settings-categories" aria-labelledby="settings-categories-title">
      <div className="detail-card-title"><GripVertical size={17} /><h2 id="settings-categories-title">Enrollment categories</h2></div>
      <p className="field-help">Manage category presentation and the order shown on the applicant dashboard.</p>
      <h3 className="settings-subheading">Dashboard card order</h3>
      <p className="field-help">Drag the cards into the order applicants should see, or use the arrow buttons. Save changes to publish the new order.</p>
      <ol className="settings-card-order" aria-label="Enrollment card display order">
        {draft.cards.map((card, index) => <li
          key={card.id}
          className={`settings-card-order-item ${draggedCardId === card.id ? 'settings-card-order-dragging' : ''}`}
          draggable
          onDragStart={(event) => {
            setDraggedCardId(card.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', card.id);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            event.preventDefault();
            const sourceId = event.dataTransfer.getData('text/plain') || draggedCardId;
            if (sourceId) {
              const bounds = event.currentTarget.getBoundingClientRect();
              reorderCards(sourceId, card.id, event.clientY > bounds.top + bounds.height / 2);
            }
            setDraggedCardId(null);
          }}
          onDragEnd={() => setDraggedCardId(null)}
          data-testid={`settings-card-order-${card.id}`}
        >
          <span className="settings-card-order-grip" aria-hidden="true"><GripVertical size={16} /></span>
          <span className="settings-card-order-name"><strong>{card.title}</strong><small>Position {index + 1}</small></span>
          <span className="settings-card-order-actions">
            <button type="button" className="settings-card-order-button" onClick={() => moveCard(card.id, -1)} disabled={index === 0} aria-label={`Move ${card.title} up`} title="Move up" data-testid={`button-card-order-up-${card.id}`}><ArrowUp size={15} /></button>
            <button type="button" className="settings-card-order-button" onClick={() => moveCard(card.id, 1)} disabled={index === draft.cards.length - 1} aria-label={`Move ${card.title} down`} title="Move down" data-testid={`button-card-order-down-${card.id}`}><ArrowDown size={15} /></button>
          </span>
        </li>)}
      </ol>
    </section>
    <section className="settings-card-grid" aria-label="Enrollment card settings">
      {draft.cards.map((card) => <article className="detail-card settings-panel" key={card.id} data-testid={`settings-card-${card.id}`}>
        <div className="detail-card-title"><FileCheck2 size={17} /><h2>{card.id.replace('category-', 'Category ')}</h2></div>
        <label className="field-label">Card title<input className="text-input" value={card.title} maxLength={100} onChange={(event) => updateCard(card.id, 'title', event.target.value)} /></label>
        <label className="field-label">Description<textarea className="text-input form-textarea" value={card.description} maxLength={240} rows={2} onChange={(event) => updateCard(card.id, 'description', event.target.value)} /></label>
         <div className="settings-card-text-editors">
           {cardTextLayoutEditor(card, 'title')}
           {cardTextLayoutEditor(card, 'description')}
         </div>
        <label className="field-label">Selection button label<input className="text-input" value={card.buttonLabel} maxLength={60} onChange={(event) => updateCard(card.id, 'buttonLabel', event.target.value)} /></label>
        <label className="field-label settings-color-field">Dashboard card background<input type="color" value={card.backgroundColor} onChange={(event) => updateCard(card.id, 'backgroundColor', event.target.value.toUpperCase())} aria-label={`${card.title} background color`} /></label>
         <div className="settings-logo-editors">
           {logoEditor(card, 'card')}
           {logoEditor(card, 'entry')}
           {logoEditor(card, 'pin')}
         </div>
      </article>)}
    </section>
    <section className="detail-card settings-panel" id="settings-appearance" aria-labelledby="settings-appearance-title">
      <div className="detail-card-title"><Settings size={17} /><h2 id="settings-appearance-title">Form and button appearance</h2></div>
      <div className="settings-inline-fields">
        <label className="field-label settings-color-field">PIN screen background<input type="color" value={draft.theme.pinScreenBackground} onChange={(event) => updateTheme('pinScreenBackground', event.target.value.toUpperCase())} /></label>
        <label className="field-label">Primary button size<select className="text-input select-input" value={draft.theme.buttonSize} onChange={(event) => updateTheme('buttonSize', event.target.value)}><option value="compact">Compact</option><option value="standard">Standard</option><option value="large">Large</option></select></label>
        <label className="field-label">Primary button placement<select className="text-input select-input" value={draft.theme.buttonPlacement} onChange={(event) => updateTheme('buttonPlacement', event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      </div>
      <label className="settings-check"><input type="checkbox" checked={draft.theme.categoryInputTransparent} onChange={(event) => updateTheme('categoryInputTransparent', event.target.checked)} /> Keep category-entry fields transparent with a single underline</label>
    </section>
    <section className="detail-card settings-panel" id="settings-backgrounds" aria-labelledby="settings-backgrounds-title">
      <div className="detail-card-title"><Settings size={17} /><h2 id="settings-backgrounds-title">Page backgrounds</h2></div>
      <p className="field-help">Set an individual solid color or a two-color gradient for every page and enrollment stage. Background-image uploads will be added when private App Storage is available.</p>
      <div className="settings-page-theme-grid">
        {PAGE_THEME_SCREENS.map(([screen, label]) => {
          const pageTheme = draft.pageThemes?.[screen] ?? DEFAULT_PAGE_THEME;
          const previewBackground = pageThemeBackground(pageTheme) ?? 'linear-gradient(135deg, #F4F7F9, #E7EEF3)';
          return <article className="settings-page-theme" key={screen} data-testid={`settings-page-theme-${screen}`}>
            <div className="settings-page-theme-heading">
              <div><b>{label}</b><small>{screen}</small></div>
              <span className="settings-page-theme-swatch" style={{ background: previewBackground }} aria-label={`${label} background preview`} />
            </div>
            <label className="field-label">Background mode
              <select className="text-input select-input" value={pageTheme.mode} onChange={(event) => updatePageTheme(screen, 'mode', event.target.value as PortalPageTheme['mode'])} data-testid={`select-page-theme-mode-${screen}`}>
                <option value="inherit">Use current design</option>
                <option value="solid">Solid color</option>
                <option value="gradient">Two-color gradient</option>
              </select>
            </label>
            <div className="settings-page-theme-colors">
              <label className="field-label settings-color-field">Base color
                <input type="color" value={pageTheme.color} disabled={pageTheme.mode === 'inherit'} onChange={(event) => updatePageTheme(screen, 'color', event.target.value.toUpperCase())} aria-label={`${label} base color`} data-testid={`input-page-theme-color-${screen}`} />
              </label>
              <label className="field-label settings-color-field">Blend color
                <input type="color" value={pageTheme.blendColor} disabled={pageTheme.mode !== 'gradient'} onChange={(event) => updatePageTheme(screen, 'blendColor', event.target.value.toUpperCase())} aria-label={`${label} blend color`} data-testid={`input-page-theme-blend-${screen}`} />
              </label>
            </div>
            {pageTheme.mode === 'gradient' && <label className="field-label settings-theme-angle">Gradient angle <span>{pageTheme.angle}°</span>
              <input type="range" min="0" max="360" step="5" value={pageTheme.angle} onChange={(event) => updatePageTheme(screen, 'angle', Number(event.target.value))} aria-label={`${label} gradient angle`} data-testid={`input-page-theme-angle-${screen}`} />
            </label>}
          </article>;
        })}
      </div>
    </section>
    <section className="detail-card settings-panel" id="settings-category-copy" aria-labelledby="settings-category-copy-title">
      <div className="detail-card-title"><FileText size={17} /><h2 id="settings-category-copy-title">Category entry form labels and buttons</h2></div>
      <p className="field-help">Customize the visible field labels, PIN prompts, and action buttons for each category. Leave a field blank to use its current default.</p>
      <div className="settings-screen-list">
        {categoryEntrySettings.map(({ screen, title, fields }) => {
          const copy = draft.screenCopy[screen] ?? {};
          const publishedCopy = settingsQuery.data?.screenCopy?.[screen] ?? {};
          const resolvedText = (key: string, fallback: string) => copy[key]?.trim() || fallback;
          const previewFields = fields.filter(([key]) => ['nameLabel', 'nicknameLabel', 'surnameLabel'].includes(key));
          const previewButtons = fields.filter(([key]) => key.startsWith('buttonLabel'));
          const pinPrompt = fields.find(([key]) => key === 'pinLabel');
          return <details className="settings-screen" key={screen} data-testid={`settings-category-entry-${screen}`}>
            <summary>{title}<span>{screen}</span></summary>
            <div className="settings-inline-fields">
              {fields.map(([key, label, defaultText]) => <label className="field-label" key={key}>{label}
                <input
                  className="text-input"
                  value={copy[key] ?? ''}
                  maxLength={key.startsWith('buttonLabel') ? 60 : 120}
                  placeholder={`Default: ${defaultText}`}
                  onChange={(event) => updateScreenCopy(screen, key, event.target.value)}
                  data-testid={`input-copy-${screen}-${key}`}
                />
              </label>)}
            </div>
            <section className="settings-published-copy" aria-label={`${title} current published text`} data-testid={`published-copy-${screen}`}>
              <span className="settings-category-preview-caption">Currently published on this screen</span>
              <div className="settings-published-copy-list">
                {fields.map(([key, label, defaultText]) => <p key={key}><b>{label}</b><span>{publishedCopy[key]?.trim() || defaultText}</span></p>)}
              </div>
            </section>
            <section className={`settings-category-preview category-preview-${screen}`} aria-label={`${title} live preview`} data-testid={`preview-${screen}`}>
              <span className="settings-category-preview-caption">Live preview · updates as you edit</span>
              <div className="settings-category-preview-fields">
                {previewFields.map(([key, , defaultText]) => <div className="settings-category-preview-field" key={key}>
                  <span>{resolvedText(key, defaultText)}</span>
                  <div aria-hidden="true" />
                </div>)}
              </div>
              {pinPrompt && <div className="settings-category-preview-pin">
                <span>{resolvedText(pinPrompt[0], pinPrompt[2])}</span>
              </div>}
              <div className="settings-category-preview-actions">
                {previewButtons.map(([key, label, defaultText]) => <div className="settings-category-preview-action" key={key}>
                  <small>{label}</small>
                  <button type="button" tabIndex={-1} aria-hidden="true">{resolvedText(key, defaultText)}</button>
                </div>)}
              </div>
            </section>
          </details>;
        })}
      </div>
    </section>
    <section className="detail-card settings-panel" id="settings-workflow-copy" aria-labelledby="settings-workflow-copy-title">
      <div className="detail-card-title"><FileText size={17} /><h2 id="settings-workflow-copy-title">Page and workflow text</h2></div>
      <p className="field-help">Edit the main copy for each page or workflow step. Empty values use the portal’s default labels.</p>
      <div className="settings-screen-list">{screenLabels.map(([screen, label]) => {
        const keys = ([
            'title', 'description', 'sectionIdLabel',
            ...(screen.startsWith('category-entry-')
              ? ['backButtonLabel']
              : ['buttonLabel', ...(screen.startsWith('workflow-step-') ? ['backButtonLabel', ...(workflowFieldLabels[screen] ?? []).map(([key]) => key)] : [])]),
          ] as string[]).filter((key) => screen !== 'dashboard' || key !== 'buttonLabel');
        const publishedCopy = settingsQuery.data?.screenCopy?.[screen] ?? {};
        return <details className="settings-screen" key={screen}>
          <summary>{label}<span>{screen}</span></summary>
          <section className="settings-published-copy" aria-label={`${label} currently published text`} data-testid={`published-copy-${screen}`}>
            <span className="settings-category-preview-caption">Currently saved text</span>
            <div className="settings-published-copy-list">
              {keys.map((key) => {
                const currentText = publishedCopy[key]?.trim();
                const fallbackText = screen === 'dashboard' && key === 'title'
                  ? 'Choose an enrollment category.'
                  : screen === 'dashboard' && key === 'description'
                    ? 'Start or continue your application without creating an account. Identity files and verification video are collected later.'
                    : screen === 'dashboard' && key === 'sectionIdLabel'
                      ? 'APPLICANT DASHBOARD'
                      : (workflowFieldLabels[screen] ?? []).find(([fieldKey]) => fieldKey === key)?.[1]
                        ?? 'Portal default (no custom text saved)';
                return <p key={key}><b>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}</b><span>{currentText || fallbackText}</span></p>;
              })}
            </div>
          </section>
          <div className="settings-inline-fields">
            {keys.map((key) => <label className="field-label" key={key}>{key === 'sectionIdLabel' ? 'Section ID label' : key === 'buttonLabel' ? 'Primary button label' : key === 'buttonLabelStep1' ? 'Step 1 button text' : key === 'buttonLabelStep2' ? 'Step 2 button text' : key === 'backButtonLabel' ? 'Back button label' : key === 'nameLabel' ? 'Name / login field label' : key === 'pinLabel' ? 'PIN prompt label' : key === 'title' ? 'Screen title' : key === 'description' ? 'Description' : (workflowFieldLabels[screen] ?? []).find(([fieldKey]) => fieldKey === key)?.[1] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}
              <input className="text-input" value={draft.screenCopy[screen]?.[key] ?? ''} maxLength={key.startsWith('buttonLabel') || key === 'backButtonLabel' ? 60 : 500} placeholder="Use portal default" onChange={(event) => updateScreenCopy(screen, key, event.target.value)} data-testid={`input-copy-${screen}-${key}`} />
            </label>)}
          </div>
        </details>;
      })}</div>
    </section>
    <div className="settings-save-bottom"><button className="button button-primary" onClick={save} disabled={saveSettings.isPending} data-testid="button-save-portal-settings-bottom">{saveSettings.isPending ? 'Saving…' : 'Save portal settings'} <Check size={15} /></button></div>
  </div></AdminShell>;
}

function readAnswerGroup(answers: Record<string, unknown> | undefined, key: string): Record<string, unknown> {
  const value = answers?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function displayAdminValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(displayAdminValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function AdminAnswerSection({
  title,
  data,
  note,
  settings,
  workflowStep,
  group,
}: {
  title: string;
  data: Record<string, unknown>;
  note?: string;
  settings?: PortalSettings;
  workflowStep?: number;
  group?: string;
}) {
  const entries = Object.entries(data).filter(([key]) => !key.startsWith('__') && !key.toLowerCase().includes('ciphertext') && !key.toLowerCase().includes('objectpath'));
  const sectionTitle = workflowStep
    ? copyText(settings, `workflow-step-${workflowStep}`, 'title', title)
    : title;
  return <section className="detail-card admin-answer-section">
    <div className="detail-card-title"><FileText size={17} /><h2>{sectionTitle}</h2></div>
    {entries.length ? entries.map(([key, value]) => <div className="review-field" key={key}>
      <span>{configuredFieldLabel(settings, workflowStep, group, key, key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()))}</span>
      <b>{displayAdminValue(value)}</b>
    </div>) : <p className="field-help">No information provided.</p>}
    {note && <p className="field-help">{note}</p>}
  </section>;
}

function AdminApplicationReview() {
  const params = useParams<{ applicationId?: string }>();
  const id = params.applicationId ?? '';
  const review = useGetAdminApplication(id);
  const pinQuery = useGetAdminApplicationPin(id, {
    query: { queryKey: getGetAdminApplicationPinQueryKey(id), enabled: false, gcTime: 0 },
    request: { cache: 'no-store' },
  });
  const portalSettings = useGetPortalSettings();
  const history = useGetAdminApplicationHistory(id);
  const guestHistory = useGetAdminGuestApplicationHistory(id, {
    query: {
      queryKey: getGetAdminGuestApplicationHistoryQueryKey(id),
      enabled: Boolean(id),
    },
  });
  const decide = useDecideApplication();
  const addNote = useAddAdminApplicationNote();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [requestedSections, setRequestedSections] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [pinRevealed, setPinRevealed] = useState(false);
  const [pinFeedback, setPinFeedback] = useState('');
  const revealOrHidePin = async () => {
    if (pinRevealed) {
      setPinRevealed(false);
      setPinFeedback('');
      queryClient.removeQueries({ queryKey: getGetAdminApplicationPinQueryKey(id) });
      return;
    }
    setPinFeedback('');
    const result = await pinQuery.refetch();
    if (result.data?.available && result.data.pin) setPinRevealed(true);
    else if (result.isError) setPinFeedback('The PIN could not be retrieved. Please try again.');
    else setPinFeedback('This PIN was saved before reviewer reveal was available and cannot be recovered. The applicant must set a new PIN.');
  };
  if (review.isLoading) return <AdminShell><LoadingPanel /></AdminShell>;
  if (review.isError) return <AdminShell><AccessError retry={() => void review.refetch()} /></AdminShell>;
  const application = review.data;
  if (!application) return <AdminShell><section className="state-card"><span className="state-icon"><FileText size={20} /></span><h2>Application not in this review queue</h2><p>It may have changed status or may not be available to this staff account.</p><Link href="/admin" className="button button-primary" data-testid="link-back-review">Back to review queue</Link></section></AdminShell>;
  const categoryTitle = configuredCategoryTitle(portalSettings.data, application.categoryId, application.categoryName);
  const entryScreen = categoryEntryScreenId(application.categoryId);
  const categoryEntryTitle = copyText(portalSettings.data, entryScreen, 'title', categoryTitle);
  const evidence = application.evidence;
  const identity = readAnswerGroup(application.answers, 'proofOfIdentity');
  const requiredEvidenceSlots = [
    { slot: 'identity_front', label: 'Identity document front' },
    ...(['National ID', 'Driver license', 'Passport card'].includes(String(identity.documentType))
      ? [{ slot: 'identity_back', label: 'Identity document back' }]
      : []),
    { slot: 'verification_video', label: 'Verification video' },
  ];
  const makeDecision = (decision: ApplicationDecision['decision']) => {
    setError('');
    if (decision === 'reject' && !note.trim()) { setError('Add the reason for rejecting this application.'); return; }
    if (decision === 'request_information' && (!note.trim() || requestedSections.length === 0)) { setError('Specify what the applicant must correct and select at least one section.'); return; }
    if (!window.confirm(`Confirm ${decision.replaceAll('_', ' ')} for application ${application.reference}?`)) return;
    decide.mutate({ applicationId: id, data: {
      decision,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(decision === 'request_information' ? { reopenSections: requestedSections } : {}),
    } }, {
      onSuccess: (saved) => {
        queryClient.invalidateQueries({ queryKey: getListApplicationsForReviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetApplicationQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetAdminApplicationQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetAdminApplicationHistoryQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
        setNote('');
        setRequestedSections([]);
        setError(`Decision recorded: ${saved.status.replaceAll('_', ' ')}.`);
      },
      onError: () => setError('The service could not record this decision. Please try again.'),
    });
  };
  const saveInternalNote = () => {
    if (!internalNote.trim()) return;
    addNote.mutate({ applicationId: id, data: { note: internalNote.trim() } }, {
      onSuccess: () => {
        setInternalNote('');
        queryClient.invalidateQueries({ queryKey: getGetAdminApplicationHistoryQueryKey(id) });
        setError('Internal note saved.');
      },
      onError: () => setError('The internal note could not be saved.'),
    });
  };
  return <AdminShell active="review">
    <div className="admin-review-page">
      <Link href="/admin/review" className="back-link" data-testid="link-review-back"><ArrowLeft size={16} /> Applicants</Link>
      <div className="review-title-row"><div><div className="eyebrow">{copyText(portalSettings.data, 'admin-review', 'sectionIdLabel', 'APPLICATION REVIEW')}</div><h1>{categoryTitle}</h1><p className="mono">{application.reference}</p></div><StatusPill status={application.status} testId={`status-review-detail-${application.id}`} /></div>
      <div className="review-detail-grid">
        <section className="detail-card applicant-record">
          <div className="detail-card-title"><FileText size={17} /><h2>Applicant record</h2></div>
          <div className="review-field"><span>Applicant</span><b>{application.applicantName || 'Not provided'}</b></div>
          <div className="review-field"><span>Email</span><b>{application.applicantEmail || 'Not provided'}</b></div>
          {getCategoryEntryFields(application.answers, application.categoryId, portalSettings.data).map((field) =>
            <div className="review-field" key={field.label}><span>{field.label}</span><b>{field.value}</b></div>)}
          <div className="review-field"><span>Created</span><b>{formatDate(application.createdAt)}</b></div>
          <div className="review-field"><span>Submitted</span><b>{formatDate(application.submittedAt)}</b></div>
          {application.status === 'draft' && <div className="review-field" data-testid="text-draft-progress"><span>Saved progress</span><b>{draftProgressLabel(application)}</b></div>}
          <div className="review-field review-context"><span>Additional context</span><b>{String(application.answers?.additionalContext ?? 'No additional context provided')}</b></div>
          {application.reviewNote && <div className="review-note"><b>Previous review note</b><p>{application.reviewNote}</p></div>}
        </section>
        <section className="decision-card">
          <div className="decision-head"><span className="decision-icon"><BadgeCheck size={19} /></span><div><h2>Record a decision</h2><p>{application.status === 'draft' ? 'This application is still in progress. Saved answers are available for review; decisions unlock after submission.' : 'This update will be visible to the applicant.'}</p></div></div>
          <label className="field-label" htmlFor="decision-note">Applicant-facing reason or instructions <span>Required for rejection or additional information</span></label>
          <textarea id="decision-note" className="text-input form-textarea decision-note" rows={4} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain the decision or specify exactly what the applicant should correct." data-testid="input-decision-note" />
          <fieldset className="requested-sections"><legend>Sections to reopen for additional information</legend>
            {['Personal information', 'Next of kin', 'Education', 'Work information', 'Proof of identity', 'Live video', 'Bank details'].map((label, index) => <label key={label}><input type="checkbox" checked={requestedSections.includes(index)} onChange={(event) => setRequestedSections((current) => event.target.checked ? [...new Set([...current, index])] : current.filter((item) => item !== index))} /> {label}</label>)}
          </fieldset>
          {error && <p className={error.startsWith('Decision recorded') ? 'success-message' : 'inline-error'} role="status" data-testid="text-decision-feedback">{error}</p>}
          <div className="decision-actions">
            <button className="decision-button request" onClick={() => makeDecision('mark_under_review')} disabled={decide.isPending || ['draft', 'approved', 'rejected'].includes(application.status)} data-testid="button-decision-under-review">Mark under review</button>
            <button className="decision-button approve" onClick={() => makeDecision('approve')} disabled={decide.isPending || ['draft', 'approved', 'rejected'].includes(application.status)} data-testid="button-decision-approve"><CheckCircle2 size={16} /> Approve</button>
            <button className="decision-button request" onClick={() => makeDecision('request_information')} disabled={decide.isPending || ['draft', 'approved', 'rejected'].includes(application.status)} data-testid="button-decision-request">Request additional information</button>
            <button className="decision-button reject" onClick={() => makeDecision('reject')} disabled={decide.isPending || ['draft', 'approved', 'rejected'].includes(application.status)} data-testid="button-decision-reject">Reject</button>
          </div>
        </section>
      </div>
      <section className="review-category-selection">
        <div className="detail-card-title"><FileText size={17} /><h2>Contact details</h2></div>
        <div className="review-field"><span>Contact name</span><b>{String(readAnswerGroup(application.answers, 'contactDetails').fullName ?? application.applicantName ?? 'Not provided')}</b></div>
        <div className="review-field"><span>Contact email</span><b>{String(readAnswerGroup(application.answers, 'contactDetails').email ?? application.applicantEmail ?? 'Not provided')}</b></div>
        <div className="review-field"><span>Contact phone</span><b>{String(readAnswerGroup(application.answers, 'contactDetails').phone ?? readAnswerGroup(application.answers, 'personalInformation').phone ?? 'Not provided')}</b></div>
        <div className="review-field"><span>Email verification</span><b>{typeof readAnswerGroup(application.answers, 'contactDetails').emailVerified === 'boolean' ? readAnswerGroup(application.answers, 'contactDetails').emailVerified === true ? 'Verified before submission' : 'Not verified' : 'Managed by the applicant account'}</b></div>
      </section>
      <section className="review-category-selection">
        <div className="detail-card-title"><CheckCircle2 size={17} /><h2>{categoryEntryTitle}</h2></div>
        <div className="review-field"><span>{copyText(portalSettings.data, entryScreen, 'sectionIdLabel', 'Selected card')}</span><b>{categoryTitle}</b></div>
        {getCategoryEntryFields(application.answers, application.categoryId, portalSettings.data).map((field) =>
          <div className="review-field" key={field.label}><span>{field.label}</span><b>{field.value}</b></div>)}
        <div className="review-field"><span>Category PIN</span><b>{pinRevealed ? pinQuery.data?.pin : application.hasPin ? 'Set (hidden)' : 'Not set'}</b></div>
        {application.hasPin && <button type="button" className="text-action" onClick={() => void revealOrHidePin()} disabled={pinQuery.isFetching} data-testid="button-reveal-application-pin">
          {pinQuery.isFetching ? 'Loading PIN…' : pinRevealed ? 'Hide PIN' : 'Reveal PIN'}
        </button>}
        {pinFeedback && <p className="field-help" role="status" data-testid="application-pin-feedback">{pinFeedback}</p>}
        <div className="review-field"><span>Enrollment date</span><b>{formatDate(application.createdAt)}</b></div>
      </section>
      {evidence !== undefined && <section className="detail-card submitted-evidence-panel" data-testid="submitted-guest-evidence">
        <div className="detail-card-title"><LockKeyhole size={17} /><h2>{copyText(portalSettings.data, 'workflow-step-5', 'title', 'Private identity evidence')}</h2></div>
        <p className="field-help">Files are available only to authorized enrollment reviewers. Each download is served through a secure, non-cached link.</p>
        <ul className="guest-evidence-list" aria-label="Submitted application evidence">
          {evidence.map((item) => <li key={item.id} data-testid={`submitted-evidence-${item.id}`}>
            <span>
              <b>{item.evidenceSlot === 'identity_front' ? 'Identity document front' : item.evidenceSlot === 'identity_back' ? 'Identity document back' : item.evidenceSlot === 'education_certificate' ? 'Education certificate' : item.evidenceSlot === 'verification_video' ? 'Verification video' : 'Identity document'}</b>
              <small>{item.fileName}{item.uploadedAt ? ` · ${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : ''}</small>
            </span>
            {item.uploadedAt && item.downloadUrl
              ? <a href={item.downloadUrl} className="guest-evidence-download" data-testid={`link-submitted-evidence-${item.id}`}>Download securely</a>
              : <small className="submitted-evidence-state">Pending — upload verification</small>}
          </li>)}
          {requiredEvidenceSlots.filter((required) =>
            !evidence.some((item) => item.evidenceSlot === required.slot),
          ).map((required) => <li key={required.slot} data-testid={`missing-submitted-evidence-${required.slot}`}>
            <span><b>{required.label}</b><small>Missing — no file was attached</small></span>
          </li>)}
        </ul>
      </section>}
      <div className="admin-record-sections">
        <AdminAnswerSection title="Section 2 · Personal information" settings={portalSettings.data} workflowStep={1} group="personalInformation" data={readAnswerGroup(application.answers, 'personalInformation')} />
        <AdminAnswerSection title="Section 3 · Next of kin" settings={portalSettings.data} workflowStep={2} group="nextOfKin" data={readAnswerGroup(application.answers, 'nextOfKin')} note="Applicant was asked to share these details with the contact’s permission." />
        <AdminAnswerSection title="Section 4 · Education" settings={portalSettings.data} workflowStep={3} group="education" data={readAnswerGroup(application.answers, 'education')} />
        <AdminAnswerSection title="Section 5 · Work information" settings={portalSettings.data} workflowStep={4} group="workInformation" data={readAnswerGroup(application.answers, 'workInformation')} />
        <AdminAnswerSection title="Section 6 · Proof of identity" settings={portalSettings.data} workflowStep={5} group="proofOfIdentity" data={readAnswerGroup(application.answers, 'proofOfIdentity')} note="Uploaded private identity files are listed in the evidence panel above." />
        <AdminAnswerSection title="Section 7 · Video recording" settings={portalSettings.data} workflowStep={6} group="liveVideoRecording" data={readAnswerGroup(application.answers, 'liveVideoRecording')} note="No identity or liveness conclusion is made from this recording. The uploaded file is listed in the evidence panel above." />
        <AdminAnswerSection title="Section 8 · Bank details" settings={portalSettings.data} workflowStep={7} group="bankDetails" data={readAnswerGroup(application.answers, 'bankDetails')} note="Shown to authorized reviewers only; the account number is encrypted in storage." />
      </div>
      <section className="detail-card admin-history-card">
        <div className="detail-card-title"><Activity size={17} /><h2>Section 9 · Submission metadata and review history</h2></div>
        <div className="review-field"><span>Application reference</span><b className="mono">{application.reference}</b></div>
        <div className="review-field"><span>Submission date</span><b>{formatDate(application.submittedAt)}</b></div>
        <div className="review-field"><span>Last update</span><b>{formatDate(application.updatedAt)}</b></div>
        <div className="review-field"><span>Current status</span><b><StatusPill status={application.status} /></b></div>
        <h3>Previous decisions and audit events</h3>
        {history.isLoading ? <LoadingPanel label="Loading review history" /> : (history.data ?? []).length === 0 ? <p className="field-help">No previous decisions or notes.</p> :
          <div className="admin-history-list">{history.data?.map((event: ApplicationEvent) => <article key={event.id}><b>{event.eventType.replaceAll('_', ' ')}</b><span>{formatDate(event.createdAt)} · {event.actorUserId}</span><p>{event.note || 'No reason recorded.'}</p></article>)}</div>}
        <h3>Applicant saved entries and corrections</h3>
        {guestHistory.isLoading ? <LoadingPanel label="Loading applicant changes" /> : (guestHistory.data ?? []).length === 0
          ? <p className="field-help">No guest draft changes were recorded before submission.</p>
          : <div className="admin-history-list" data-testid="guest-application-revisions">
            {guestHistory.data?.map((revision) => <article key={revision.id}>
              <b>{`Saved at step ${revision.currentStep + 1}`}</b><span>{formatDate(revision.createdAt)}</span>
              <ul>{revision.changes.map((change, index) => <li key={`${revision.id}-${index}`}>
                <strong>{change.field.replace(/^answers\./, '').replaceAll('.', ' ').replaceAll('_', ' ')}</strong>: {change.before || '—'} → {change.after || '—'}
              </li>)}</ul>
            </article>)}
          </div>}
      </section>
      <section className="detail-card internal-note-card">
        <div className="detail-card-title"><LockKeyhole size={17} /><h2>Add internal note</h2></div>
        <p className="field-help">Internal notes are visible to authorized staff, not to the applicant.</p>
        <textarea className="text-input form-textarea" rows={3} maxLength={4000} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} data-testid="input-internal-note" />
        <button className="button button-quiet" onClick={saveInternalNote} disabled={!internalNote.trim() || addNote.isPending} data-testid="button-save-internal-note">{addNote.isPending ? 'Saving…' : 'Save internal note'}</button>
      </section>
    </div>
  </AdminShell>;
}

function AdminSupport() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const filters = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter as 'open' | 'in_progress' | 'resolved' } : {}),
  }), [search, statusFilter]);
  const tickets = useListSupportTicketsForAdmin(filters);
  const reply = useReplyToSupportTicket();
  const assign = useAssignSupportTicket();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [assignee, setAssignee] = useState('');
  if (tickets.isError) return <AdminShell active="support"><AccessError retry={() => void tickets.refetch()} /></AdminShell>;
  const records = tickets.data ?? [];
  const activeTicket = records.find((ticket) => ticket.id === selected) ?? records[0];
  const respond = (ticket: SupportTicket, status: 'in_progress' | 'resolved') => {
    const response = (drafts[ticket.id] ?? ticket.response ?? '').trim();
    if (!response) { setFeedback('Add a reply before updating this ticket.'); return; }
    setFeedback('');
    reply.mutate({ ticketId: ticket.id, data: { response, status } }, {
      onSuccess: (saved) => {
        queryClient.invalidateQueries({ queryKey: getListSupportTicketsForAdminQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListMySupportTicketsQueryKey() });
        setFeedback('Support ticket updated.');
      },
      onError: () => setFeedback('The reply could not be saved. Please try again.'),
    });
  };
  const assignTicket = (ticket: SupportTicket) => {
    const assigneeUserId = assignee.trim() || null;
    assign.mutate({ ticketId: ticket.id, data: { assigneeUserId } }, {
      onSuccess: () => {
        setFeedback(assigneeUserId ? 'Support request assigned.' : 'Support request unassigned.');
        queryClient.invalidateQueries({ queryKey: getListSupportTicketsForAdminQueryKey() });
      },
      onError: () => setFeedback('Assign this request to an authorized staff account.'),
    });
  };
  return <AdminShell active="support">
    <div className="support-admin-page">
      <PageHeading eyebrow="SECURE STAFF WORKSPACE" title="Support inbox" detail="Manage applicant messages and send a considered reply." />
      <div className="admin-toolbar">
        <label className="searchbox"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference or user" aria-label="Search support requests" data-testid="input-support-search" /></label>
        <label className="filter-select"><span className="sr-only">Filter support status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} data-testid="select-support-status"><option value="">All request statuses</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option></select><ChevronDown size={15} /></label>
      </div>
      {tickets.isLoading ? <LoadingPanel /> : records.length === 0 ? <EmptyPanel title="No support messages" message="Applicant requests will appear in this inbox." /> :
        <div className="inbox-layout">
          <section className="inbox-list" aria-label="Support requests">
            <div className="inbox-list-head"><b>Messages</b><span>{records.length}</span></div>
            {records.map((ticket) => <button className={`inbox-ticket ${activeTicket?.id === ticket.id ? 'inbox-ticket-active' : ''}`} key={ticket.id} onClick={() => { setSelected(ticket.id); setFeedback(''); }} data-testid={`button-ticket-${ticket.id}`}>
              <span className="inbox-ticket-top"><b>{ticket.subject}</b><StatusPill status={ticket.status} testId={`status-inbox-${ticket.id}`} /></span><span>{ticket.message}</span><small>{formatDate(ticket.createdAt)}</small>
            </button>)}
          </section>
          {activeTicket && <section className="inbox-detail">
            <div className="inbox-detail-heading"><div><div className="eyebrow">APPLICANT MESSAGE</div><h2>{activeTicket.subject}</h2></div><StatusPill status={activeTicket.status} testId={`status-inbox-detail-${activeTicket.id}`} /></div>
            <div className="inbox-conversation">{(activeTicket.messages ?? []).map((message) => <div className="inbox-message" key={message.id}><span className="message-avatar">{message.actorRole === 'administrator' ? 'ST' : 'AP'}</span><div><div className="message-meta">{message.actorRole === 'administrator' ? 'Staff' : 'Applicant'} <span>{formatDate(message.createdAt)}</span></div><p>{message.body}</p></div></div>)}</div>
            {activeTicket.applicationId && <div className="related-application"><FileText size={15} /><span>Related application</span><span className="mono">{activeTicket.applicationId}</span></div>}
            <div className="support-assignment">
              <label className="field-label" htmlFor="support-assignee">Assign to authorized staff by user ID</label>
              <div className="settings-inline-fields"><input id="support-assignee" className="text-input" value={assignee || activeTicket.assignedToUserId || ''} onChange={(event) => setAssignee(event.target.value)} placeholder="Staff user ID (leave blank to unassign)" data-testid="input-support-assignee" />
                <button className="button button-quiet" onClick={() => assignTicket(activeTicket)} disabled={assign.isPending} data-testid="button-support-assign">{assign.isPending ? 'Saving…' : 'Save assignment'}</button></div>
            </div>
            <label className="field-label" htmlFor="admin-reply">Your reply</label>
            <textarea id="admin-reply" className="text-input form-textarea admin-reply-input" maxLength={5000} value={drafts[activeTicket.id] ?? activeTicket.response ?? ''} onChange={(e) => setDrafts((prev) => ({ ...prev, [activeTicket.id]: e.target.value }))} placeholder="Write a clear, helpful response." data-testid="input-admin-reply" />
            {feedback && <p className="success-message" role="status" data-testid="text-reply-feedback">{feedback}</p>}
            <div className="reply-actions"><button className="button button-quiet" onClick={() => respond(activeTicket, 'resolved')} disabled={reply.isPending} data-testid="button-close-ticket">Reply & resolve</button>
              <button className="button button-primary" onClick={() => respond(activeTicket, 'in_progress')} disabled={reply.isPending} data-testid="button-send-reply">{reply.isPending ? 'Saving…' : 'Send reply'} <ArrowRight size={15} /></button></div>
          </section>}
        </div>}
    </div>
  </AdminShell>;
}

const emailAlertOptions: Array<{
  key: keyof AdminEmailAlertEvents;
  label: string;
  detail: string;
}> = [
  { key: 'contact_received', label: 'New applicant', detail: 'After contact details and category are saved.' },
  { key: 'step_saved', label: 'Enrollment step saved', detail: 'When an applicant saves meaningful progress.' },
  { key: 'contact_updated', label: 'Applicant contact changed', detail: 'When the applicant changes their contact details.' },
  { key: 'evidence_saved', label: 'Evidence uploaded', detail: 'When an applicant adds identity evidence.' },
  { key: 'application_submitted', label: 'Application submitted', detail: 'When an applicant submits an enrollment.' },
];

const defaultEmailBranding: AdminEmailBranding = {
  logoUrl: null,
  logoObjectPath: null,
  accentColor: '#49b8aa',
  headerColor: '#102b46',
  senderName: 'Security Verification',
  senderEmail: 'notifications@vu-gov.cc',
  bannerMark: 'SV',
  bannerTitle: 'Security Verification',
  bannerSubtitle: 'ENROLLMENT PORTAL',
  preheaderText: 'A message from the Security Verification Enrollment Portal team.',
  messageEyebrow: 'STAFF MESSAGE',
  footerText: 'Enrollment Portal staff communications',
  footerLinkText: 'Visit the enrollment portal',
  footerLinkUrl: null,
  footerLinkColor: '#287d8b',
  footerBackgroundColor: '#f1f5f8',
  footerTextColor: '#738392',
  footerBackgroundUrl: null,
  footerBackgroundObjectPath: null,
};

function readableEmailHeaderText(hex: string) {
  const channels = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!channels) return '#ffffff';
  const luminance = channels.slice(1).map((channel) => {
    const value = parseInt(channel!, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  return luminance > 0.225 ? '#102b46' : '#ffffff';
}

function AdminEmailCenter() {
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const { user, isLoaded: userLoaded } = useUser();
  const isAdmin = user?.publicMetadata?.role === 'admin';
  const requestedEmailSection = location.split('/').filter(Boolean).at(-1);
  const emailSection = ['alerts', 'templates', 'send', 'activity', 'sms', 'sms-activity'].includes(requestedEmailSection ?? '')
    ? requestedEmailSection as 'alerts' | 'templates' | 'send' | 'activity' | 'sms' | 'sms-activity'
    : 'alerts';
  const logoInputRef = useRef<HTMLInputElement>(null);
  const footerImageInputRef = useRef<HTMLInputElement>(null);
  const settings = useGetAdminEmailSettings();
  const smsSettings = useGetAdminSmsSettings({
    query: {
      queryKey: getGetAdminSmsSettingsQueryKey(),
      enabled: emailSection === 'sms',
    },
  });
  const outbox = useListAdminEmailOutbox({
    query: {
      queryKey: getListAdminEmailOutboxQueryKey(),
      refetchInterval: 15_000,
      enabled: emailSection === 'activity',
    },
  });
  const smsActivity = useListAdminSmsActivity({
    query: {
      queryKey: getListAdminSmsActivityQueryKey(),
      refetchInterval: 15_000,
      enabled: emailSection === 'sms-activity',
    },
  });
  const templates = useListAdminEmailTemplates();
  const saveSettings = useUpdateAdminEmailSettings();
  const sendEmail = useSendAdminEmail();
  const saveSmsSettings = useUpdateAdminSmsSettings();
  const sendSms = useSendAdminSms();
  const retryEmail = useRetryAdminEmail();
  const requestLogoUpload = useRequestAdminEmailLogoUpload();
  const completeLogoUpload = useCompleteAdminEmailLogoUpload();
  const createTemplate = useCreateAdminEmailTemplate();
  const updateTemplate = useUpdateAdminEmailTemplate();
  const deleteTemplate = useDeleteAdminEmailTemplate();
  const [recipientDraft, setRecipientDraft] = useState('');
  const [alertsDraft, setAlertsDraft] = useState<AdminEmailAlertEvents>({
    contact_received: true,
    step_saved: true,
    contact_updated: true,
    evidence_saved: true,
    application_submitted: true,
  });
  const [brandingDraft, setBrandingDraft] = useState<AdminEmailBranding>(defaultEmailBranding);
  const [settingsFeedback, setSettingsFeedback] = useState('');
  const [composeRecipients, setComposeRecipients] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeRequestId, setComposeRequestId] = useState(() => crypto.randomUUID());
  const [composeFeedback, setComposeFeedback] = useState('');
  const [smsBaseUrlDraft, setSmsBaseUrlDraft] = useState('');
  const [smsSenderIdDraft, setSmsSenderIdDraft] = useState('');
  const [smsDailyLimitDraft, setSmsDailyLimitDraft] = useState('100');
  const [smsSettingsFeedback, setSmsSettingsFeedback] = useState('');
  const [smsRecipientDraft, setSmsRecipientDraft] = useState('');
  const [smsMessageDraft, setSmsMessageDraft] = useState('');
  const [smsFeedback, setSmsFeedback] = useState('');
  const [lastSmsResult, setLastSmsResult] = useState<AdminSmsSendResponse | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateDraftId, setTemplateDraftId] = useState<string | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templateSubjectDraft, setTemplateSubjectDraft] = useState('');
  const [templateBodyDraft, setTemplateBodyDraft] = useState('');
  const [templateFeedback, setTemplateFeedback] = useState('');
  const [logoUploadFeedback, setLogoUploadFeedback] = useState('');
  const [footerImageUploadFeedback, setFooterImageUploadFeedback] = useState('');
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [footerImagePreviewUrl, setFooterImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const previewUrls = [logoPreviewUrl, footerImagePreviewUrl].filter((url): url is string => Boolean(url));
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [footerImagePreviewUrl, logoPreviewUrl]);

  useEffect(() => {
    if (!settings.data) return;
    setRecipientDraft(settings.data.recipients.join('\n'));
    setAlertsDraft(settings.data.alerts);
    setBrandingDraft({ ...defaultEmailBranding, ...settings.data.branding });
  }, [settings.data]);

  useEffect(() => {
    if (!smsSettings.data) return;
    setSmsBaseUrlDraft(smsSettings.data.baseUrl);
    setSmsSenderIdDraft(smsSettings.data.senderId);
    setSmsDailyLimitDraft(String(smsSettings.data.dailyLimit));
  }, [smsSettings.data]);

  useEffect(() => {
    if (userLoaded && !isAdmin && emailSection === 'alerts') {
      setLocation('/admin/email/send', { replace: true });
    }
  }, [emailSection, isAdmin, setLocation, userLoaded]);

  const invalidateEmailData = () => {
    void queryClient.invalidateQueries({ queryKey: getListAdminEmailOutboxQueryKey() });
  };
  const invalidateTemplates = () => {
    void queryClient.invalidateQueries({ queryKey: getListAdminEmailTemplatesQueryKey() });
  };

  const saveSmsConfiguration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSmsSettingsFeedback('');
    const canConfigure = smsSettings.data?.canConfigure === true;
    saveSmsSettings.mutate({
      data: {
        ...(canConfigure ? {
          baseUrl: smsBaseUrlDraft.trim(),
          dailyLimit: Number(smsDailyLimitDraft),
        } : {}),
        senderId: smsSenderIdDraft.trim(),
      },
    }, {
      onSuccess: (saved: AdminSmsSettings) => {
        setSmsBaseUrlDraft(saved.baseUrl);
        setSmsSenderIdDraft(saved.senderId);
        setSmsSettingsFeedback('Infobip sender settings saved.');
        void queryClient.invalidateQueries({ queryKey: getGetAdminSmsSettingsQueryKey() });
      },
      onError: (error: unknown) => {
        const apiError = error as { data?: { error?: string } };
        setSmsSettingsFeedback(apiError.data?.error ?? 'Settings could not be saved. Check the Infobip base URL, sender ID, and daily limit.');
      },
    });
  };

  const sendSmsMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const recipientPhone = smsRecipientDraft.trim();
    const messageText = smsMessageDraft.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(recipientPhone)) {
      setSmsFeedback('Enter one phone number in international format, for example +2348012345678.');
      return;
    }
    if (!messageText || messageText.length > 1600) {
      setSmsFeedback('Enter a message between 1 and 1,600 characters.');
      return;
    }
    setSmsFeedback('');
    setLastSmsResult(null);
    sendSms.mutate({
      data: { recipientPhone, messageText },
    }, {
      onSuccess: (result: AdminSmsSendResponse) => {
        setLastSmsResult(result);
        setSmsFeedback(result.status === 'delivered'
          ? 'The SMS was delivered.'
          : 'Infobip accepted the SMS request. Delivery results will appear in SMS activity.');
        setSmsRecipientDraft('');
        setSmsMessageDraft('');
        void queryClient.invalidateQueries({ queryKey: getListAdminSmsActivityQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetAdminSmsSettingsQueryKey() });
      },
      onError: (error: unknown) => {
        const apiError = error as { data?: { error?: string } };
        setSmsFeedback(apiError.data?.error ?? 'The SMS could not be sent. Check provider activity before retrying.');
        void queryClient.invalidateQueries({ queryKey: getListAdminSmsActivityQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetAdminSmsSettingsQueryKey() });
      },
    });
  };

  const selectEmailTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setComposeFeedback('');
  };

  const useSelectedEmailTemplate = () => {
    const template = templates.data?.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    setComposeSubject(template.subject);
    setComposeBody(template.messageText);
    setComposeRequestId(crypto.randomUUID());
    setComposeFeedback(`“${template.name}” is filled in. Add recipients, review it, then send.`);
  };

  const uploadEmailBrandImage = async (file: File | undefined, target: 'logo' | 'footer') => {
    if (!file) return;
    const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type) || file.size < 1 || file.size > 2 * 1024 * 1024) {
      const message = 'Choose a PNG, JPEG, WebP, or GIF image no larger than 2 MB.';
      if (target === 'logo') setLogoUploadFeedback(message);
      else setFooterImageUploadFeedback(message);
      return;
    }
    const setFeedback = target === 'logo' ? setLogoUploadFeedback : setFooterImageUploadFeedback;
    setFeedback('Uploading and checking the image…');
    try {
      const prepared = await requestLogoUpload.mutateAsync({
        data: { contentType: file.type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', sizeBytes: file.size },
      });
      const upload = await fetch(prepared.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!upload.ok) throw new Error('The image upload did not finish.');
      const verified = await completeLogoUpload.mutateAsync({ data: { objectPath: prepared.objectPath } });
      const previewUrl = URL.createObjectURL(file);
      if (target === 'logo') setLogoPreviewUrl(previewUrl);
      else setFooterImagePreviewUrl(previewUrl);
      setBrandingDraft((current) => ({
        ...current,
        ...(target === 'logo'
          ? {
              logoUrl: `${window.location.origin}/api/public/email/logo`,
              logoObjectPath: verified.objectPath,
            }
          : {
              footerBackgroundUrl: `${window.location.origin}/api/public/email/footer-background`,
              footerBackgroundObjectPath: verified.objectPath,
            }),
      }));
      setFeedback(`${target === 'logo' ? 'Header logo' : 'Footer background'} uploaded. Save email branding to apply it to new messages.`);
    } catch {
      setFeedback(`The ${target === 'logo' ? 'logo' : 'footer image'} could not be uploaded. Try another image or retry.`);
    } finally {
      const inputRef = target === 'logo' ? logoInputRef : footerImageInputRef;
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const startTemplateEdit = () => {
    const template = templates.data?.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    setTemplateDraftId(template.id);
    setTemplateNameDraft(template.name);
    setTemplateSubjectDraft(template.subject);
    setTemplateBodyDraft(template.messageText);
    setTemplateFeedback(`Editing “${template.name}”.`);
  };

  const startNewTemplate = () => {
    setTemplateDraftId(null);
    setTemplateNameDraft('');
    setTemplateSubjectDraft('');
    setTemplateBodyDraft('');
    setTemplateFeedback('Enter a name, subject, and message for the new template.');
  };

  const saveEmailTemplate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = {
      name: templateNameDraft.trim(),
      subject: templateSubjectDraft.trim(),
      messageText: templateBodyDraft.trim(),
    };
    if (!data.name || !data.subject || !data.messageText) {
      setTemplateFeedback('Add a name, subject, and message before saving.');
      return;
    }
    const onSuccess = (saved: AdminEmailTemplate) => {
      setTemplateDraftId(saved.id);
      setSelectedTemplateId(saved.id);
      setTemplateNameDraft(saved.name);
      setTemplateSubjectDraft(saved.subject);
      setTemplateBodyDraft(saved.messageText);
      setTemplateFeedback('Template saved.');
      invalidateTemplates();
    };
    if (templateDraftId) {
      updateTemplate.mutate({ templateId: templateDraftId, data }, {
        onSuccess,
        onError: () => setTemplateFeedback('Template could not be updated. Try again.'),
      });
    } else {
      createTemplate.mutate({ data }, {
        onSuccess,
        onError: () => setTemplateFeedback('Template could not be saved. Try again.'),
      });
    }
  };

  const removeEmailTemplate = () => {
    if (!templateDraftId) return;
    const templateId = templateDraftId;
    if (!window.confirm('Remove this saved email template? This cannot be undone.')) return;
    deleteTemplate.mutate({ templateId }, {
      onSuccess: () => {
        setSelectedTemplateId((current) => current === templateId ? '' : current);
        setTemplateDraftId(null);
        setTemplateNameDraft('');
        setTemplateSubjectDraft('');
        setTemplateBodyDraft('');
        setTemplateFeedback('Template removed.');
        invalidateTemplates();
      },
      onError: () => setTemplateFeedback('Template could not be removed. Refresh and try again.'),
    });
  };

  const recipientList = (value: string) => [...new Set(
    value.split(/[\n,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean),
  )];

  const saveEmailSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const recipients = recipientList(recipientDraft);
    if (recipients.length > 10) {
      setSettingsFeedback('Add no more than 10 alert recipients.');
      return;
    }
    setSettingsFeedback('');
    saveSettings.mutate({
      data: {
        recipients,
        alerts: alertsDraft,
        branding: {
          ...brandingDraft,
          logoUrl: brandingDraft.logoUrl?.trim() || null,
          senderName: brandingDraft.senderName.trim(),
          senderEmail: brandingDraft.senderEmail.trim().toLowerCase(),
          bannerTitle: brandingDraft.bannerTitle.trim(),
          bannerSubtitle: brandingDraft.bannerSubtitle.trim(),
          preheaderText: brandingDraft.preheaderText.trim(),
          messageEyebrow: brandingDraft.messageEyebrow.trim(),
          footerText: brandingDraft.footerText.trim(),
          footerLinkText: brandingDraft.footerLinkText.trim(),
          footerLinkUrl: brandingDraft.footerLinkUrl?.trim() || null,
          footerBackgroundUrl: brandingDraft.footerBackgroundUrl?.trim() || null,
        },
      },
    }, {
      onSuccess: (saved) => {
        setRecipientDraft(saved.recipients.join('\n'));
        setAlertsDraft(saved.alerts);
        setBrandingDraft(saved.branding);
        setLogoPreviewUrl(null);
        setFooterImagePreviewUrl(null);
        setSettingsFeedback('Email settings saved.');
        void queryClient.invalidateQueries({ queryKey: getGetAdminEmailSettingsQueryKey() });
      },
      onError: () => setSettingsFeedback('Email settings could not be saved. Check each address and branding value, then try again.'),
    });
  };

  const sendOneOffEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const recipients = recipientList(composeRecipients);
    if (!recipients.length || recipients.length > 20) {
      setComposeFeedback('Enter between 1 and 20 valid recipient addresses.');
      return;
    }
    setComposeFeedback('');
    sendEmail.mutate({
      data: {
        requestId: composeRequestId,
        recipients,
        subject: composeSubject.trim(),
        messageText: composeBody.trim(),
      },
    }, {
      onSuccess: (messages: AdminEmailMessage[]) => {
        const allAccepted = messages.every((message) => message.status === 'sent');
        setComposeFeedback(allAccepted
          ? 'Accepted by the email provider. The delivery outcome will appear in recent email activity.'
          : 'Email attempts were saved. Review failed messages below and retry them.');
        setComposeRecipients('');
        setComposeSubject('');
        setComposeBody('');
        setComposeRequestId(crypto.randomUUID());
        invalidateEmailData();
      },
      onError: () => setComposeFeedback('The email request could not be recorded. Try again.'),
    });
  };

  const retry = (message: AdminEmailMessage) => {
    retryEmail.mutate({ messageId: message.id }, {
      onSuccess: () => invalidateEmailData(),
      onError: () => setComposeFeedback('The message could not be retried. Refresh the outbox and try again.'),
    });
  };

  if (settings.isError) {
    return <AdminShell active="email"><AccessError retry={() => {
      void settings.refetch();
    }} /></AdminShell>;
  }

  const messages = outbox.data ?? [];
  return <AdminShell active="email">
    <div className="admin-page admin-email-page">
      <PageHeading
        eyebrow="SECURE STAFF WORKSPACE"
        title="Mail center"
        detail="Manage reviewer email alerts, reusable templates, one-off messages, and staff SMS."
      />
      <nav className="admin-email-navigation" aria-label="Email center pages">
        {[
          ...(isAdmin ? [{ href: '/admin/email/alerts', key: 'alerts', label: 'Automated alerts', icon: Mail }] : []),
          { href: '/admin/email/templates', key: 'templates', label: 'Template settings', icon: FileText },
          { href: '/admin/email/send', key: 'send', label: 'One-off email', icon: Send },
          { href: '/admin/email/sms', key: 'sms', label: 'SMS sender', icon: Smartphone },
          { href: '/admin/email/sms-activity', key: 'sms-activity', label: 'SMS activity', icon: Activity },
          { href: '/admin/email/activity', key: 'activity', label: 'Email activity', icon: Activity },
        ].map(({ href, key, label, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className={`admin-email-navigation-link ${emailSection === key ? 'active' : ''}`}
            aria-current={emailSection === key ? 'page' : undefined}
            data-testid={`link-email-section-${key}`}
          >
            <Icon size={15} /> {label}
          </Link>
        ))}
      </nav>
      <div className="admin-email-grid admin-email-section">
        {isAdmin && emailSection === 'alerts' && <>
        <section className="detail-card admin-email-settings">
          <div className="detail-card-title"><Mail size={17} /><h2>Automated reviewer alerts</h2></div>
          <p className="field-help">Alerts contain an application reference and a secure reviewer link, not applicant answers, PINs, or evidence files.</p>
          <form onSubmit={saveEmailSettings} className="admin-email-form">
            <label className="field-label" htmlFor="email-alert-recipients">External recipient addresses</label>
            <textarea
              id="email-alert-recipients"
              className="text-input form-textarea admin-email-recipient-input"
              rows={3}
              maxLength={4000}
              value={recipientDraft}
              onChange={(event) => setRecipientDraft(event.target.value)}
              placeholder="reviewer@example.com"
              data-testid="input-email-alert-recipients"
            />
            <small className="field-help">Separate addresses with a comma or a new line. Maximum 10 recipients.</small>
            <div className="admin-email-alert-options">
              {emailAlertOptions.map(({ key, label, detail }) => (
                <label className="admin-email-alert-option" key={key}>
                  <input
                    type="checkbox"
                    checked={alertsDraft[key]}
                    onChange={(event) => setAlertsDraft((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))}
                    data-testid={`toggle-email-alert-${key}`}
                  />
                  <span><b>{label}</b><small>{detail}</small></span>
                </label>
              ))}
            </div>
            {settingsFeedback && <p className="admin-email-feedback" role="status" data-testid="text-email-settings-feedback">{settingsFeedback}</p>}
            <button className="button button-primary" type="submit" disabled={settings.isLoading || saveSettings.isPending} data-testid="button-save-email-settings">
              {saveSettings.isPending ? 'Saving…' : 'Save alert settings'}
            </button>
          </form>
          <div className="admin-email-sender"><span>Sender</span><b>{settings.data?.senderAddress ?? 'Loading sender…'}</b></div>
        </section>
        </>}

        {emailSection === 'templates' && <>
        <section className="detail-card admin-email-compose">
          <div className="detail-card-title"><FileText size={17} /><h2>Reusable message templates</h2></div>
          <p className="field-help">Save common subject and message text here. Choosing “Use template” on the One-off email page fills those fields for review before sending.</p>
          <div className="admin-email-template-manager" aria-label="Reusable email templates">
            <label className="field-label" htmlFor="email-template-select">Saved templates</label>
            <div className="admin-email-template-select-row">
              <select
                id="email-template-select"
                className="text-input"
                value={selectedTemplateId}
                onChange={(event) => selectEmailTemplate(event.target.value)}
                disabled={templates.isLoading}
                data-testid="select-email-template"
              >
                <option value="">{templates.isLoading ? 'Loading templates…' : 'Choose a template to edit'}</option>
                {(templates.data ?? []).map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
              <button type="button" className="button button-quiet" onClick={startTemplateEdit} disabled={!selectedTemplateId} data-testid="button-edit-email-template">
                Edit selected
              </button>
              <button type="button" className="button button-quiet" onClick={startNewTemplate} data-testid="button-new-email-template">
                New template
              </button>
            </div>
            {templates.isError && <p className="admin-email-feedback admin-email-error" role="alert">Saved templates could not be loaded. Refresh the page and try again.</p>}
            {templates.data?.length === 0 && <small className="field-help">No saved templates yet. Create one below.</small>}
            <form onSubmit={saveEmailTemplate} className="admin-email-template-editor">
              <div className="admin-email-template-editor-heading">
                <b>{templateDraftId ? 'Edit saved template' : 'Create reusable template'}</b>
                <small>Saving a template does not send an email.</small>
              </div>
              <label className="field-label" htmlFor="email-template-name">Template name</label>
              <input id="email-template-name" className="text-input" maxLength={80} value={templateNameDraft} onChange={(event) => setTemplateNameDraft(event.target.value)} required data-testid="input-email-template-name" />
              <label className="field-label" htmlFor="email-template-subject">Template subject</label>
              <input id="email-template-subject" className="text-input" maxLength={200} value={templateSubjectDraft} onChange={(event) => setTemplateSubjectDraft(event.target.value)} required data-testid="input-email-template-subject" />
              <label className="field-label" htmlFor="email-template-body">Template message</label>
              <textarea id="email-template-body" className="text-input form-textarea" rows={4} maxLength={10000} value={templateBodyDraft} onChange={(event) => setTemplateBodyDraft(event.target.value)} required data-testid="input-email-template-body" />
              {templateFeedback && <p className="admin-email-feedback" role="status" data-testid="text-email-template-feedback">{templateFeedback}</p>}
              <div className="admin-email-template-actions">
                <button className="button button-primary" type="submit" disabled={createTemplate.isPending || updateTemplate.isPending || !templateNameDraft.trim() || !templateSubjectDraft.trim() || !templateBodyDraft.trim()} data-testid="button-save-email-template">
                  {createTemplate.isPending || updateTemplate.isPending ? 'Saving…' : templateDraftId ? 'Save changes' : 'Save template'}
                </button>
                {templateDraftId && <button className="button button-quiet admin-email-template-delete" type="button" onClick={removeEmailTemplate} disabled={deleteTemplate.isPending} data-testid="button-delete-email-template">
                  <Trash2 size={14} /> {deleteTemplate.isPending ? 'Removing…' : 'Remove template'}
                </button>}
              </div>
            </form>
          </div>
        </section>
        <section className="detail-card admin-email-settings">
          <div className="detail-card-title"><Settings size={17} /><h2>Email banner and footer branding</h2></div>
          <p className="field-help">Branding applies to automated alerts and staff emails. Changes apply to future messages after saving.</p>
          <form onSubmit={saveEmailSettings} className="admin-email-form">
            <div className="admin-email-branding-fields">
              <div className="admin-email-branding-heading">
                <b>Header logo</b>
                <small>Upload a PNG, JPEG, WebP, or GIF logo. Maximum size is 2 MB.</small>
              </div>
              <div className="admin-email-logo-controls">
                <input
                  ref={logoInputRef}
                  className="admin-email-logo-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void uploadEmailBrandImage(event.target.files?.[0], 'logo')}
                  data-testid="input-email-logo-upload"
                />
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={requestLogoUpload.isPending || completeLogoUpload.isPending}
                  data-testid="button-upload-email-logo"
                >
                  <Upload size={14} /> {requestLogoUpload.isPending || completeLogoUpload.isPending ? 'Uploading…' : 'Upload or replace logo'}
                </button>
                {(brandingDraft.logoUrl || logoPreviewUrl) && <button type="button" className="text-action" onClick={() => { setLogoPreviewUrl(null); setBrandingDraft((current) => ({ ...current, logoUrl: null, logoObjectPath: null })); }} data-testid="button-remove-email-logo">Remove logo</button>}
                {logoUploadFeedback && <small className="admin-email-feedback" role="status" data-testid="text-email-logo-feedback">{logoUploadFeedback}</small>}
              </div>
              <label className="field-label" htmlFor="email-brand-logo">Or use a public HTTPS image URL</label>
              <input
                id="email-brand-logo"
                className="text-input"
                type="url"
                maxLength={2048}
                value={brandingDraft.logoObjectPath ? '' : brandingDraft.logoUrl ?? ''}
                onChange={(event) => setBrandingDraft((current) => ({
                  ...current,
                  logoUrl: event.target.value || null,
                  logoObjectPath: null,
                }))}
                onInput={() => setLogoPreviewUrl(null)}
                placeholder="https://example.com/logo.png"
                data-testid="input-email-brand-logo"
              />
              {(logoPreviewUrl || brandingDraft.logoUrl) && <img className="admin-email-logo-current" src={logoPreviewUrl ?? brandingDraft.logoUrl ?? ''} alt="Current email header logo preview" />}
              <label className="field-label" htmlFor="email-brand-sender-name">Sender display name</label>
              <input id="email-brand-sender-name" className="text-input" maxLength={80} value={brandingDraft.senderName} onChange={(event) => setBrandingDraft((current) => ({ ...current, senderName: event.target.value }))} required data-testid="input-email-brand-sender-name" />
              <label className="field-label" htmlFor="email-brand-sender-email">Sender email address</label>
              <input id="email-brand-sender-email" className="text-input" type="email" maxLength={254} value={brandingDraft.senderEmail} onChange={(event) => setBrandingDraft((current) => ({ ...current, senderEmail: event.target.value }))} required data-testid="input-email-brand-sender-email" />
              <small className="field-help">Use an address ending in @vu-gov.cc, the domain configured for this portal. Other sender domains are blocked. Confirm the domain shows as Verified in Resend; inbox placement also depends on recipient filters and sender reputation.</small>
              <label className="field-label" htmlFor="email-brand-banner-title">Banner title</label>
              <input id="email-brand-banner-title" className="text-input" maxLength={100} value={brandingDraft.bannerTitle} onChange={(event) => setBrandingDraft((current) => ({ ...current, bannerTitle: event.target.value }))} required data-testid="input-email-brand-banner-title" />
              <label className="field-label" htmlFor="email-brand-banner-mark">Fallback logo mark</label>
              <input id="email-brand-banner-mark" className="text-input" maxLength={12} value={brandingDraft.bannerMark} onChange={(event) => setBrandingDraft((current) => ({ ...current, bannerMark: event.target.value }))} data-testid="input-email-brand-banner-mark" />
              <label className="field-label" htmlFor="email-brand-banner-subtitle">Banner subtitle</label>
              <input id="email-brand-banner-subtitle" className="text-input" maxLength={120} value={brandingDraft.bannerSubtitle} onChange={(event) => setBrandingDraft((current) => ({ ...current, bannerSubtitle: event.target.value }))} data-testid="input-email-brand-banner-subtitle" />
              <label className="field-label" htmlFor="email-brand-preheader">Inbox preview text</label>
              <input id="email-brand-preheader" className="text-input" maxLength={200} value={brandingDraft.preheaderText} onChange={(event) => setBrandingDraft((current) => ({ ...current, preheaderText: event.target.value }))} data-testid="input-email-brand-preheader" />
              <label className="field-label" htmlFor="email-brand-message-eyebrow">Message label</label>
              <input id="email-brand-message-eyebrow" className="text-input" maxLength={80} value={brandingDraft.messageEyebrow} onChange={(event) => setBrandingDraft((current) => ({ ...current, messageEyebrow: event.target.value }))} data-testid="input-email-brand-message-eyebrow" />
              <div className="admin-email-color-fields">
                <label><span>Accent color</span><input type="color" value={brandingDraft.accentColor} onChange={(event) => setBrandingDraft((current) => ({ ...current, accentColor: event.target.value }))} aria-label="Email banner accent color" data-testid="input-email-brand-accent-color" /></label>
                <label><span>Header color</span><input type="color" value={brandingDraft.headerColor} onChange={(event) => setBrandingDraft((current) => ({ ...current, headerColor: event.target.value }))} aria-label="Email banner header color" data-testid="input-email-brand-header-color" /></label>
              </div>
              <label className="field-label" htmlFor="email-brand-footer-text">Footer text</label>
              <input id="email-brand-footer-text" className="text-input" maxLength={300} value={brandingDraft.footerText} onChange={(event) => setBrandingDraft((current) => ({ ...current, footerText: event.target.value }))} data-testid="input-email-brand-footer-text" />
              <label className="field-label" htmlFor="email-brand-footer-link-text">Highlighted link label</label>
              <input id="email-brand-footer-link-text" className="text-input" maxLength={80} value={brandingDraft.footerLinkText} onChange={(event) => setBrandingDraft((current) => ({ ...current, footerLinkText: event.target.value }))} data-testid="input-email-brand-footer-link-text" />
              <label className="field-label" htmlFor="email-brand-footer-link-url">Highlighted link URL</label>
              <input id="email-brand-footer-link-url" className="text-input" type="url" maxLength={2048} value={brandingDraft.footerLinkUrl ?? ''} onChange={(event) => setBrandingDraft((current) => ({ ...current, footerLinkUrl: event.target.value || null }))} placeholder="https://example.com" data-testid="input-email-brand-footer-link-url" />
              <small className="field-help">The footer link is rendered as a highlighted, clickable button. Use an HTTPS destination.</small>
              <div className="admin-email-color-fields">
                <label><span>Footer link color</span><input type="color" value={brandingDraft.footerLinkColor} onChange={(event) => setBrandingDraft((current) => ({ ...current, footerLinkColor: event.target.value }))} aria-label="Footer highlighted link color" data-testid="input-email-brand-footer-link-color" /></label>
                <label><span>Footer background</span><input type="color" value={brandingDraft.footerBackgroundColor} onChange={(event) => setBrandingDraft((current) => ({ ...current, footerBackgroundColor: event.target.value }))} aria-label="Footer background color" data-testid="input-email-brand-footer-background-color" /></label>
                <label><span>Footer text color</span><input type="color" value={brandingDraft.footerTextColor} onChange={(event) => setBrandingDraft((current) => ({ ...current, footerTextColor: event.target.value }))} aria-label="Footer text color" data-testid="input-email-brand-footer-text-color" /></label>
              </div>
              <div className="admin-email-branding-heading">
                <b>Footer background image</b>
                <small>Optional image behind the footer. Use a PNG, JPEG, WebP, or GIF up to 2 MB; the background color remains the fallback.</small>
              </div>
              <div className="admin-email-logo-controls">
                <input
                  ref={footerImageInputRef}
                  className="admin-email-logo-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void uploadEmailBrandImage(event.target.files?.[0], 'footer')}
                  data-testid="input-email-footer-image-upload"
                />
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => footerImageInputRef.current?.click()}
                  disabled={requestLogoUpload.isPending || completeLogoUpload.isPending}
                  data-testid="button-upload-email-footer-image"
                >
                  <Upload size={14} /> {requestLogoUpload.isPending || completeLogoUpload.isPending ? 'Uploading…' : 'Upload or replace footer image'}
                </button>
                {(brandingDraft.footerBackgroundUrl || footerImagePreviewUrl) && <button type="button" className="text-action" onClick={() => { setFooterImagePreviewUrl(null); setBrandingDraft((current) => ({ ...current, footerBackgroundUrl: null, footerBackgroundObjectPath: null })); }} data-testid="button-remove-email-footer-image">Remove footer image</button>}
                {footerImageUploadFeedback && <small className="admin-email-feedback" role="status" data-testid="text-email-footer-image-feedback">{footerImageUploadFeedback}</small>}
              </div>
              <label className="field-label" htmlFor="email-brand-footer-image-url">Or use a public HTTPS background image URL</label>
              <input
                id="email-brand-footer-image-url"
                className="text-input"
                type="url"
                maxLength={2048}
                value={brandingDraft.footerBackgroundObjectPath ? '' : brandingDraft.footerBackgroundUrl ?? ''}
                onChange={(event) => {
                  setFooterImagePreviewUrl(null);
                  setBrandingDraft((current) => ({
                    ...current,
                    footerBackgroundUrl: event.target.value || null,
                    footerBackgroundObjectPath: null,
                  }));
                }}
                placeholder="https://example.com/footer-background.jpg"
                data-testid="input-email-brand-footer-image-url"
              />
            </div>
            <div className="admin-email-preview-wrap">
              <div className="admin-email-preview-label">Branding preview</div>
              <div className="admin-email-template-preview">
                <div className="admin-email-template-preview-banner" style={{ borderTopColor: brandingDraft.accentColor, backgroundColor: brandingDraft.headerColor }}>
                  {logoPreviewUrl || brandingDraft.logoUrl ? <img className="admin-email-template-preview-logo" src={logoPreviewUrl ?? brandingDraft.logoUrl ?? ''} alt="" /> : <span className="admin-email-template-preview-mark">{brandingDraft.bannerMark || ' '}</span>}
                  <span className="admin-email-template-preview-brand"><b style={{ color: readableEmailHeaderText(brandingDraft.headerColor) }}>{brandingDraft.bannerTitle || 'Banner title'}</b>{brandingDraft.bannerSubtitle && <small style={{ color: readableEmailHeaderText(brandingDraft.headerColor) }}>{brandingDraft.bannerSubtitle}</small>}</span>
                </div>
                <div className="admin-email-template-preview-footer" style={{ backgroundColor: brandingDraft.footerBackgroundColor, color: brandingDraft.footerTextColor }}>
                  {(footerImagePreviewUrl || brandingDraft.footerBackgroundUrl) && <img className="admin-email-template-preview-footer-image" src={footerImagePreviewUrl ?? brandingDraft.footerBackgroundUrl ?? ''} alt="" />}
                  <div className="admin-email-template-preview-footer-content">
                    {brandingDraft.footerText && <span>{brandingDraft.senderName || 'Sender name'} · {brandingDraft.footerText}</span>}
                    {brandingDraft.footerLinkUrl && <a href={brandingDraft.footerLinkUrl} target="_blank" rel="noreferrer" style={{ backgroundColor: brandingDraft.footerLinkColor, color: readableEmailHeaderText(brandingDraft.footerLinkColor) }}>{brandingDraft.footerLinkText || brandingDraft.footerLinkUrl}</a>}
                  </div>
                </div>
              </div>
            </div>
            {settingsFeedback && <p className="admin-email-feedback" role="status" data-testid="text-email-settings-feedback">{settingsFeedback}</p>}
            <button className="button button-primary" type="submit" disabled={settings.isLoading || saveSettings.isPending} data-testid="button-save-email-settings">{saveSettings.isPending ? 'Saving…' : 'Save email branding'}</button>
          </form>
          <div className="admin-email-sender"><span>Sender</span><b>{settings.data?.senderAddress ?? 'Loading sender…'}</b></div>
        </section>
        </>}

        {emailSection === 'send' && <section className="detail-card admin-email-compose">
          <div className="detail-card-title"><Send size={17} /><h2>Send a one-off email</h2></div>
          <p className="field-help">Messages are sent separately to each address so recipients cannot see one another.</p>
          <div className="admin-email-sender"><span>From</span><b>{brandingDraft.senderName} &lt;{brandingDraft.senderEmail}&gt;</b></div>
          <div className="admin-email-template-manager" aria-label="Reusable email templates">
            <label className="field-label" htmlFor="email-template-select">Saved message template</label>
            <div className="admin-email-template-select-row">
              <select
                id="email-template-select"
                className="text-input"
                value={selectedTemplateId}
                onChange={(event) => selectEmailTemplate(event.target.value)}
                disabled={templates.isLoading}
                data-testid="select-email-template"
              >
                <option value="">{templates.isLoading ? 'Loading templates…' : 'Choose a saved template'}</option>
                {(templates.data ?? []).map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
              <button type="button" className="button button-primary" onClick={useSelectedEmailTemplate} disabled={!selectedTemplateId || templates.isLoading} data-testid="button-use-email-template">
                Use template
              </button>
            </div>
            {templates.isError && <p className="admin-email-feedback admin-email-error" role="alert">Saved templates could not be loaded. Try again later.</p>}
            {templates.data?.length === 0 && <small className="field-help">No saved templates yet. Add one in Template settings.</small>}
          </div>
          <form onSubmit={sendOneOffEmail} className="admin-email-form">
            <label className="field-label" htmlFor="email-compose-recipients">To</label>
            <textarea id="email-compose-recipients" className="text-input form-textarea admin-email-recipient-input" rows={2} maxLength={4000} value={composeRecipients} disabled={sendEmail.isPending} onChange={(event) => { setComposeRecipients(event.target.value); setComposeRequestId(crypto.randomUUID()); }} placeholder="person@example.com" data-testid="input-email-compose-recipients" />
            <small className="field-help">Separate addresses with a comma or a new line. Maximum 20 recipients.</small>
            <label className="field-label" htmlFor="email-compose-subject">Subject</label>
            <input id="email-compose-subject" className="text-input" maxLength={200} value={composeSubject} disabled={sendEmail.isPending} onChange={(event) => { setComposeSubject(event.target.value); setComposeRequestId(crypto.randomUUID()); }} required data-testid="input-email-compose-subject" />
            <label className="field-label" htmlFor="email-compose-body">Message</label>
            <textarea id="email-compose-body" className="text-input form-textarea" rows={7} maxLength={10000} value={composeBody} disabled={sendEmail.isPending} onChange={(event) => { setComposeBody(event.target.value); setComposeRequestId(crypto.randomUUID()); }} required data-testid="input-email-compose-body" />
            <div className="admin-email-preview-wrap">
              <div className="admin-email-preview-label">Live email preview</div>
              <div className="admin-email-template-preview" role="region" aria-label="Preview of outgoing email" data-testid="email-template-preview">
                <div
                  className="admin-email-template-preview-banner"
                  style={{
                    borderTopColor: brandingDraft.accentColor,
                    backgroundColor: brandingDraft.headerColor,
                    color: readableEmailHeaderText(brandingDraft.headerColor),
                  }}
                >
                  {logoPreviewUrl || brandingDraft.logoUrl
                    ? <img
                        className="admin-email-template-preview-logo"
                        src={logoPreviewUrl ?? brandingDraft.logoUrl ?? ''}
                        alt={brandingDraft.senderName || 'Email logo'}
                        onError={(event) => { event.currentTarget.style.display = 'none'; }}
                      />
                    : <span className="admin-email-template-preview-mark">{brandingDraft.bannerMark || ' '}</span>}
                  <span className="admin-email-template-preview-brand">
                    <b style={{ color: readableEmailHeaderText(brandingDraft.headerColor) }}>{brandingDraft.bannerTitle || 'Banner title'}</b>
                    {brandingDraft.bannerSubtitle && <small style={{ color: readableEmailHeaderText(brandingDraft.headerColor) }}>{brandingDraft.bannerSubtitle}</small>}
                  </span>
                </div>
                <div className="admin-email-template-preview-content">
                  {brandingDraft.messageEyebrow && <small style={{ color: brandingDraft.accentColor }}>{brandingDraft.messageEyebrow}</small>}
                  <h3>{composeSubject.trim() || 'Your email subject'}</h3>
                  <p>{composeBody.trim() || 'Your message will appear here.'}</p>
                </div>
                <div className="admin-email-template-preview-footer" style={{ backgroundColor: brandingDraft.footerBackgroundColor, color: brandingDraft.footerTextColor }}>
                  {(footerImagePreviewUrl || brandingDraft.footerBackgroundUrl) && <img className="admin-email-template-preview-footer-image" src={footerImagePreviewUrl ?? brandingDraft.footerBackgroundUrl ?? ''} alt="" />}
                  <div className="admin-email-template-preview-footer-content">
                    {brandingDraft.footerText && <span>{brandingDraft.senderName || 'Sender name'} · {brandingDraft.footerText}</span>}
                    {brandingDraft.footerLinkUrl && <a href={brandingDraft.footerLinkUrl} target="_blank" rel="noreferrer" style={{ backgroundColor: brandingDraft.footerLinkColor, color: readableEmailHeaderText(brandingDraft.footerLinkColor) }}>{brandingDraft.footerLinkText || brandingDraft.footerLinkUrl}</a>}
                  </div>
                </div>
              </div>
            </div>
            {composeFeedback && <p className="admin-email-feedback" role="status" data-testid="text-email-compose-feedback">{composeFeedback}</p>}
            <button className="button button-primary" type="submit" disabled={sendEmail.isPending || !composeSubject.trim() || !composeBody.trim()} data-testid="button-send-email">
              {sendEmail.isPending ? 'Sending…' : 'Send email'} <ArrowRight size={15} />
            </button>
          </form>
        </section>
        }

        {emailSection === 'sms' && <section className="detail-card admin-email-compose admin-sms-page">
          <div className="detail-card-title"><Smartphone size={17} /><h2>Custom SMS sender</h2></div>
          <p className="field-help">Send one text at a time through Infobip. The API key stays on the server and is never shown in this page.</p>
          <section className="admin-sms-setup" aria-labelledby="admin-sms-setup-title">
            <div>
              <h3 id="admin-sms-setup-title">Provider and sender ID</h3>
              <p className="field-help">Use the personalized HTTPS base URL shown in your Infobip account. The sender ID must be approved for the destination country before sending.</p>
            </div>
            <div className={`admin-sms-credential-status ${smsSettings.data?.credentialConfigured ? 'is-ready' : 'is-missing'}`} role="status" data-testid="text-sms-credential-status">
              <span className="status-dot" />
              {smsSettings.isLoading
                ? 'Checking provider connection…'
                : smsSettings.data?.credentialConfigured
                  ? 'Infobip API key is configured'
                  : 'Infobip API key is not configured'}
            </div>
            {!smsSettings.data?.credentialConfigured && !smsSettings.isLoading && (
              <p className="field-help admin-sms-secret-note">Add <code>INFOBIP_API_KEY</code> in Replit Secrets to enable sending. Never paste the key into this form.</p>
            )}
            <div className={`admin-sms-credential-status ${smsSettings.data?.deliveryReportsConfigured ? 'is-ready' : 'is-missing'}`} role="status" data-testid="text-sms-delivery-report-status">
              <span className="status-dot" />
              {smsSettings.data?.deliveryReportsConfigured
                ? 'Delivery report signing secret is configured'
                : 'Delivery report signing setup is required'}
            </div>
            <div className="admin-sms-webhook-help">
              <b>Delivery report callback</b>
              {smsSettings.data?.deliveryReportUrl
                ? <code data-testid="text-sms-delivery-report-url">{smsSettings.data.deliveryReportUrl}</code>
                : <p className="field-help">A public app domain is not available yet, so the callback URL cannot be generated.</p>}
              <p className="field-help">
                In Infobip, create a notification profile for this exact URL and enable HMAC-SHA256 signing. Save the same signing key in Replit Secrets as <code>INFOBIP_DLR_WEBHOOK_SECRET</code>. Never put it in this form.
              </p>
            </div>
            {smsSettings.isError && <p className="admin-email-feedback admin-email-error" role="alert">SMS settings could not be loaded. Refresh the page and try again.</p>}
            <form className="admin-email-form" onSubmit={saveSmsConfiguration}>
              <label className="field-label" htmlFor="sms-infobip-base-url">Infobip base URL</label>
              <input
                id="sms-infobip-base-url"
                className="text-input"
                type="url"
                maxLength={255}
                value={smsBaseUrlDraft}
                onChange={(event) => setSmsBaseUrlDraft(event.target.value)}
                placeholder="https://xxxxx.api.infobip.com"
                required={smsSettings.data?.canConfigure === true}
                readOnly={smsSettings.data?.canConfigure !== true}
                aria-readonly={smsSettings.data?.canConfigure !== true}
                data-testid="input-sms-infobip-base-url"
              />
              {smsSettings.data?.canConfigure !== true && <small className="field-help">Only an administrator can change the Infobip base URL.</small>}
              <label className="field-label" htmlFor="sms-sender-id">Custom sender ID</label>
              <input
                id="sms-sender-id"
                className="text-input"
                maxLength={11}
                minLength={3}
                pattern="[A-Za-z0-9]{3,11}"
                value={smsSenderIdDraft}
                onChange={(event) => setSmsSenderIdDraft(event.target.value)}
                placeholder="SECVERIFY"
                required
                data-testid="input-sms-sender-id"
              />
              <small className="field-help">3–11 letters or numbers, no spaces or punctuation. Country-specific approval may be required.</small>
              <label className="field-label" htmlFor="sms-daily-limit">Daily messaging limit</label>
              <input
                id="sms-daily-limit"
                className="text-input"
                type="number"
                min={0}
                max={100000}
                step={1}
                value={smsDailyLimitDraft}
                onChange={(event) => setSmsDailyLimitDraft(event.target.value)}
                readOnly={smsSettings.data?.canConfigure !== true}
                aria-readonly={smsSettings.data?.canConfigure !== true}
                required={smsSettings.data?.canConfigure === true}
                data-testid="input-sms-daily-limit"
              />
              {smsSettings.data?.canConfigure === true
                ? <small className="field-help">Messages per day for all staff combined. Set to 0 to pause SMS sending. The limit resets at 00:00 UTC.</small>
                : <small className="field-help">Only an administrator can change the daily messaging limit.</small>}
              <p className="field-help" data-testid="text-sms-daily-usage">
                Attempts today: {smsSettings.data?.dailyUsageCount ?? 0} / {smsSettings.data?.dailyLimit ?? 100} (UTC)
              </p>
              {smsSettingsFeedback && <p className="admin-email-feedback" role="status" data-testid="text-sms-settings-feedback">{smsSettingsFeedback}</p>}
              <button className="button button-primary" type="submit" disabled={smsSettings.isLoading || saveSmsSettings.isPending} data-testid="button-save-sms-settings">
                {saveSmsSettings.isPending ? 'Saving…' : 'Save SMS settings'}
              </button>
            </form>
          </section>
          <section className="admin-sms-compose" aria-labelledby="admin-sms-compose-title">
            <h3 id="admin-sms-compose-title">Compose message</h3>
            <div className="admin-email-sender"><span>From</span><b>{smsSettings.data?.senderId || smsSenderIdDraft || 'Sender ID not set'}</b></div>
            <form className="admin-email-form" onSubmit={sendSmsMessage}>
              <label className="field-label" htmlFor="sms-recipient-phone">Recipient phone number</label>
              <input
                id="sms-recipient-phone"
                className="text-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={16}
                value={smsRecipientDraft}
                onChange={(event) => setSmsRecipientDraft(event.target.value)}
                placeholder="+2348012345678"
                required
                data-testid="input-sms-recipient"
              />
              <small className="field-help">Enter one number in international E.164 format, including the leading +.</small>
              <label className="field-label" htmlFor="sms-message-body">Message</label>
              <textarea
                id="sms-message-body"
                className="text-input form-textarea"
                rows={5}
                maxLength={1600}
                value={smsMessageDraft}
                onChange={(event) => setSmsMessageDraft(event.target.value)}
                required
                data-testid="input-sms-message"
              />
              <div className="admin-sms-message-count" aria-live="polite">{smsMessageDraft.length}/1,600 characters</div>
              {smsFeedback && <p className={`admin-email-feedback ${lastSmsResult ? '' : 'admin-email-error'}`} role={lastSmsResult ? 'status' : 'alert'} data-testid="text-sms-send-feedback">{smsFeedback}</p>}
              {lastSmsResult?.providerMessageId && <small className="field-help" data-testid="text-sms-provider-message-id">Infobip message ID: {lastSmsResult.providerMessageId}</small>}
              <button
                className="button button-primary"
                type="submit"
                disabled={
                  sendSms.isPending ||
                  !smsSettings.data?.credentialConfigured ||
                  !smsSettings.data?.deliveryReportsConfigured ||
                  !smsSettings.data?.deliveryReportUrl ||
                  !smsSettings.data.baseUrl ||
                  !smsSettings.data.senderId ||
                  smsSettings.data.dailyUsageCount >= smsSettings.data.dailyLimit
                }
                data-testid="button-send-sms"
              >
                {sendSms.isPending ? 'Sending…' : 'Send SMS'} <ArrowRight size={15} />
              </button>
              <small className="field-help">Infobip acceptance does not confirm delivery. If the request times out, check Infobip message logs before sending again.</small>
            </form>
          </section>
        </section>}
      </div>

      {emailSection === 'sms-activity' && <section className="admin-email-outbox detail-card" aria-labelledby="admin-sms-activity-title">
        <div className="admin-email-outbox-heading">
          <div className="detail-card-title"><Activity size={17} /><h2 id="admin-sms-activity-title">Recent SMS activity</h2></div>
          <span>Delivery reports refresh automatically. Messages are never resent automatically.</span>
        </div>
        {smsActivity.isLoading ? <LoadingPanel label="Loading SMS activity" />
          : smsActivity.isError ? <p className="admin-email-feedback admin-email-error" role="alert">SMS activity could not be loaded. Refresh the page and try again.</p>
          : !smsActivity.data?.length ? <EmptyPanel title="No SMS activity yet" message="Staff SMS attempts and delivery results will appear here." />
          : <div className="admin-email-outbox-list" data-testid="admin-sms-activity-list">
            {smsActivity.data.map((message) => (
              <article className="admin-email-outbox-row" key={message.id} data-testid={`sms-activity-row-${message.id}`}>
                <div className="admin-email-outbox-main">
                  <div className="admin-email-outbox-title">
                    <b>{message.recipientPhone}</b>
                    <span className={`admin-email-status admin-email-status-${message.status}`}>
                      {message.status === 'sending' ? 'In progress' : message.status[0]!.toUpperCase() + message.status.slice(1)}
                    </span>
                  </div>
                  <p>{message.senderId}<span>·</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></p>
                  {message.providerMessageId && <small>Infobip message ID: {message.providerMessageId}</small>}
                  {message.providerStatus && <small>{message.providerStatusGroup ? `${message.providerStatusGroup} · ` : ''}{message.providerStatus}</small>}
                  {message.errorMessage && <p className="admin-email-error">{message.errorMessage}</p>}
                  <details>
                    <summary>View message text</summary>
                    <pre>{message.messageText}</pre>
                  </details>
                </div>
              </article>
            ))}
          </div>}
      </section>}

      {emailSection === 'activity' && <section className="admin-email-outbox detail-card" aria-labelledby="admin-email-outbox-title">
        <div className="admin-email-outbox-heading">
          <div className="detail-card-title"><Activity size={17} /><h2 id="admin-email-outbox-title">Recent email activity</h2></div>
          <span>Delivery outcomes update here after the provider reports them.</span>
        </div>
        {outbox.isLoading ? <LoadingPanel label="Loading email activity" />
          : messages.length === 0 ? <EmptyPanel title="No email activity yet" message="Automated alerts and one-off emails will appear here." />
          : <div className="admin-email-outbox-list" data-testid="admin-email-outbox-list">
            {messages.map((message) => (
              <article className="admin-email-outbox-row" key={message.id} data-testid={`email-outbox-row-${message.id}`}>
                <div className="admin-email-outbox-main">
                  <div className="admin-email-outbox-title">
                    <b>{message.subject}</b>
                    <span className={`admin-email-status admin-email-status-${message.deliveryStatus ?? message.status}`}>{message.deliveryStatus === 'accepted' ? 'Accepted' : message.deliveryStatus === 'delivered' ? 'Delivered' : message.deliveryStatus === 'bounced' ? 'Bounced' : message.deliveryStatus === 'complained' ? 'Complained' : message.status}</span>
                    {message.providerEventAt && <time dateTime={message.providerEventAt} data-testid={`email-provider-event-at-${message.id}`}>· {formatDateTime(message.providerEventAt)}</time>}
                  </div>
                  {message.providerEvents.length > 0 && <ol className="admin-email-provider-timeline" aria-label="Provider delivery history" data-testid={`email-provider-timeline-${message.id}`}>
                    {message.providerEvents.map((event, index) => (
                      <li key={`${event.providerEventAt}-${event.deliveryStatus}-${index}`}>
                        <span className={`admin-email-status admin-email-status-${event.deliveryStatus}`}>
                          {event.deliveryStatus === 'delivered' ? 'Delivered' : event.deliveryStatus === 'bounced' ? 'Bounced' : 'Complained'}
                        </span>
                        <time dateTime={event.providerEventAt}>{formatDateTime(event.providerEventAt)}</time>
                      </li>
                    ))}
                  </ol>}
                  <p><strong>To:</strong> {message.recipientEmail} <span>·</span> {message.eventKind?.replaceAll('_', ' ') ?? 'manual email'}</p>
                  <small>{formatDate(message.createdAt)}{message.applicationReference ? ` · ${message.applicationReference}` : ''} · {message.attemptCount} attempt{message.attemptCount === 1 ? '' : 's'}</small>
                  {message.errorMessage && <p className="admin-email-error">{message.errorMessage}</p>}
                  <details><summary>View message</summary><pre>{message.messageText}</pre></details>
                </div>
                {message.status === 'failed' && <button type="button" className="button button-quiet admin-email-retry" onClick={() => retry(message)} disabled={retryEmail.isPending} data-testid={`button-retry-email-${message.id}`}>
                  <RefreshCw size={14} /> {retryEmail.isPending ? 'Retrying…' : 'Retry'}
                </button>}
              </article>
            ))}
          </div>}
      </section>}
    </div>
  </AdminShell>;
}

const guestContactSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(160, 'Name must be 160 characters or fewer.'),
  email: z.string().trim().email('Enter a valid email address.').max(320),
});
const guestApplicationSchema = guestContactSchema.extend({
  categoryId: z.string().min(1, 'Choose an enrollment category.'),
});
type GuestApplicationValues = z.infer<typeof guestApplicationSchema>;
const guestDashboardStartSchema = guestApplicationSchema;
const GUEST_DASHBOARD_CONTACT_KEY = 'guest-dashboard-contact';
const GUEST_DASHBOARD_START_KEY = 'guest-dashboard-start';
const GUEST_DASHBOARD_PENDING_CATEGORY_KEY = 'guest-dashboard-pending-category';
const GUEST_CONTACT_STEP_PASSED_KEY = 'guest-contact-step-passed';
const GUEST_APPLICATION_RESUME_KEY = 'guest-application-resume';
const GUEST_APPLICATION_AUTH_CONTEXT_KEY = 'guest-application-auth-context';
const guestAuthContextSchema = z.object({
  applicationId: z.string().uuid(),
  reference: z.string().min(8).max(32),
  accessKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  email: z.string().email(),
});

function readGuestAuthContext() {
  try {
    const stored = window.sessionStorage.getItem(GUEST_APPLICATION_AUTH_CONTEXT_KEY);
    if (!stored) return null;
    const context = guestAuthContextSchema.safeParse(JSON.parse(stored));
    return context.success ? context.data : null;
  } catch {
    return null;
  }
}

function saveGuestResume(reference: string, accessKey: string) {
  window.sessionStorage.setItem(GUEST_APPLICATION_RESUME_KEY, JSON.stringify({ reference, accessKey }));
}

function saveGuestAuthContext(context: z.infer<typeof guestAuthContextSchema>) {
  window.sessionStorage.setItem(GUEST_APPLICATION_RESUME_KEY, JSON.stringify({
    reference: context.reference,
    accessKey: context.accessKey,
  }));
  window.sessionStorage.setItem(GUEST_APPLICATION_AUTH_CONTEXT_KEY, JSON.stringify(context));
}

function readGuestDashboardContact() {
  try {
    const stored = window.sessionStorage.getItem(GUEST_DASHBOARD_CONTACT_KEY);
    if (!stored) return null;
    const contact = guestContactSchema.safeParse(JSON.parse(stored));
    return contact.success ? contact.data : null;
  } catch {
    return null;
  }
}

function guestContactStepPassed() {
  try {
    return window.sessionStorage.getItem(GUEST_CONTACT_STEP_PASSED_KEY) === '1';
  } catch {
    return false;
  }
}

const guestLookupSchema = z.object({
  reference: z.string().trim().min(8, 'Enter the reference from your confirmation.').max(32),
  accessKey: z.string().min(1, 'Enter your private tracking key.'),
});
type GuestLookupValues = z.infer<typeof guestLookupSchema>;

function GuestPublicHeader() {
  return <header className="guest-public-header">
    <Link href="/" className="guest-brand-link" aria-label="Enrollment portal home" data-testid="link-guest-home">
      <PortalWordmark />
    </Link>
    <nav aria-label="Public navigation">
      <Link href="/guest/track" className="guest-header-link" data-testid="link-guest-track">Track an application <ArrowRight size={14} /></Link>
    </nav>
  </header>;
}

function PublicApplicantDashboard() {
  const categories = useListEnrollmentCategories();
  const portalSettings = useGetPortalSettings();
  const [, setLocation] = useLocation();
  const [contact] = useState(readGuestDashboardContact);
  const [startError, setStartError] = useState('');
  const palette = ['#0EAD46', '#0C4DA1', '#0072AE', '#FFFFFF'];
  const iconColors = ['#168341', '#244fc7', '#087eaf', '#174d80'];
  const orderedCategories = useMemo(() => {
    const items = (categories.data ?? []).slice(0, 4);
    const order = portalSettings.data?.cards;
    if (!order?.length) return items;
    return items.sort((left, right) => {
      const leftOrder = order.findIndex((card) => card.id === left.id);
      const rightOrder = order.findIndex((card) => card.id === right.id);
      return (leftOrder < 0 ? Number.MAX_SAFE_INTEGER : leftOrder)
        - (rightOrder < 0 ? Number.MAX_SAFE_INTEGER : rightOrder);
    });
  }, [categories.data, portalSettings.data?.cards]);

  const chooseCategory = (categoryId: string) => {
    setStartError('');
    if (!contact) {
      try {
        window.sessionStorage.setItem(GUEST_DASHBOARD_PENDING_CATEGORY_KEY, categoryId);
        setLocation('/guest/apply');
      } catch {
        setStartError('Your category could not be saved in this browser. Enable session storage and try again.');
      }
      return;
    }
    const start = guestDashboardStartSchema.safeParse({ ...contact, categoryId });
    if (!start.success) {
      setStartError('Your contact details need to be re-entered before starting an application.');
      setLocation('/guest/apply');
      return;
    }
    try {
      window.sessionStorage.setItem(GUEST_DASHBOARD_START_KEY, JSON.stringify(start.data));
      setLocation('/guest/apply?dashboardStart=1');
    } catch {
      setStartError('Your details could not be saved in this browser. Enable session storage and try again.');
    }
  };

  return <AppFrame active="dashboard" fitDashboard publicDashboard>
    <div className="dashboard-layout guest-applicant-dashboard-content" data-testid="guest-applicant-dashboard-content">
      <div className="dashboard-main">
        <PageHeading
          eyebrow={copyText(portalSettings.data, 'dashboard', 'sectionIdLabel', 'APPLICANT DASHBOARD')}
          title={copyText(portalSettings.data, 'dashboard', 'title', 'Choose an enrollment category.')}
          detail={copyText(portalSettings.data, 'dashboard', 'description', 'Start or continue your application without creating an account. Identity files and verification video are collected later.')}
        />
        {contact && <div className="guest-dashboard-contact">
          <div><span>CONTACT DETAILS</span><strong>{contact.fullName}</strong><small>{contact.email}</small></div>
        </div>}
        {startError && <p className="guest-inline-error" role="alert" data-testid="guest-dashboard-start-error">{startError}</p>}
        <section className="selection-section rise-delay">
          <div className="section-line">
            <div><h2>Enrollment categories</h2><p>Select a category to continue.</p></div>
            <span className="step-indicator">START HERE</span>
          </div>
          {categories.isLoading ? <div className="guest-category-skeleton" data-testid="guest-dashboard-loading"><div /><div /><div /><div /></div> :
            categories.isError ? <div className="guest-inline-error" role="alert" data-testid="guest-dashboard-error">
              <p>Enrollment categories could not be loaded.</p>
              <button type="button" className="text-action" onClick={() => void categories.refetch()} data-testid="button-retry-dashboard-categories">Try again <ArrowRight size={14} /></button>
            </div> : categories.data?.length === 0 ? <div className="guest-inline-error" role="status">No enrollment categories are available right now.</div> :
              <div className={`category-grid${orderedCategories.length > 2 ? ' category-grid--with-row-divider' : ''}`}>
                {orderedCategories.map((category, index) => {
                  const categoryIndex = Math.max(0, Number(category.id.split('-')[1]) - 1);
                  const cardSettings = portalSettings.data?.cards.find((card) => card.id === category.id);
                  const cardTitle = cardSettings?.title ?? category.name;
                  const categoryDescription = cardSettings?.description?.trim() || category.description;
                  return <button type="button" key={category.id} onClick={() => chooseCategory(category.id)}
                    className={`category-card category-${categoryIndex + 1}`} style={categoryCardStyle(cardSettings, palette[categoryIndex])}
                    aria-label={`${cardTitle}. ${categoryDescription}. ${contact ? 'Start an application' : 'Choose category'}`} data-testid={`guest-dashboard-category-${category.id}`}>
                    <span className="category-number">0{index + 1}</span>
                    {cardSettings?.logoDataUrl
                      ? <img src={cardSettings.logoDataUrl} alt="" className="category-logo" style={cardLogoPositionStyle(cardSettings.cardLogoAlignment, cardSettings.cardLogoVerticalOffset)} />
                      : category.id === 'category-1'
                        ? <img src={categoryOneLogo} alt="National Bank Vanuatu" className="category-logo category-one-default-logo" style={cardLogoPositionStyle(cardSettings?.cardLogoAlignment, cardSettings?.cardLogoVerticalOffset)} />
                        : category.id === 'category-2'
                          ? <img src={categoryTwoLogo} alt="BRED Bank Vanuatu" className="category-logo category-two-default-logo" style={cardLogoPositionStyle(cardSettings?.cardLogoAlignment, cardSettings?.cardLogoVerticalOffset)} />
                          : category.id === 'category-3'
                            ? <img src={categoryThreeLogo} alt="ANZ" className="category-logo category-three-default-logo" style={cardLogoPositionStyle(cardSettings?.cardLogoAlignment, cardSettings?.cardLogoVerticalOffset)} />
                            : category.id === 'category-4'
                              ? <img src={categoryFourLogo} alt="BSP" className="category-logo category-four-default-logo" style={cardLogoPositionStyle(cardSettings?.cardLogoAlignment, cardSettings?.cardLogoVerticalOffset)} />
                              : <span className="category-symbol" style={{ color: iconColors[categoryIndex] }}><FileCheck2 size={22} strokeWidth={1.75} /></span>}
                    <span className="category-title">{cardTitle}</span>
                    <span className="category-description">{categoryDescription}</span>
                    <span className="category-select">{contact ? 'Start application' : 'Choose category'} <ArrowUpRight size={15} /></span>
                  </button>;
                })}
              </div>}
        </section>
      </div>
      <aside className="dashboard-aside guest-applicant-dashboard-aside">
        <div className="summary-card" data-testid="guest-dashboard-overview">
          <div className="summary-head"><span className="summary-label">GUEST ENROLLMENT</span><ShieldCheck size={17} /></div>
          <div className="summary-total">Open<span> applicant access</span></div>
          <div className="summary-list">
            <div className="summary-line"><span><i className="summary-dot green" />No account required</span></div>
            <div className="summary-line"><span><i className="summary-dot blue" />Save as you progress</span></div>
          </div>
          <div className="summary-foot">Email confirmation is requested before final submission.</div>
        </div>
        <div className="help-card">
          <div className="help-icon"><FileCheck2 size={17} /></div>
          <div><b>Already started?</b><p>Use your private tracking key to view saved progress.</p><Link href="/guest/track" className="text-action" data-testid="link-dashboard-track">Track application <ArrowRight size={14} /></Link></div>
        </div>
        <div className="aside-note"><LockKeyhole size={15} /><span>Your progress stays private and secure.</span></div>
      </aside>
    </div>
  </AppFrame>;
}

function ApplicantDashboardRoute() {
  return <PublicApplicantDashboard />;
}

function clerkMessage(error: unknown) {
  if (error && typeof error === 'object' && 'errors' in error) {
    const first = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0];
    if (first?.longMessage || first?.message) return first.longMessage || first.message || '';
  }
  return error instanceof Error ? error.message : 'The email code could not be sent. Please try again.';
}

function isExistingClerkEmail(error: unknown) {
  if (!error || typeof error !== 'object' || !('errors' in error)) return false;
  return ((error as { errors?: Array<{ code?: string }> }).errors ?? []).some((item) =>
    ['form_identifier_exists', 'identifier_already_exists'].includes(item.code ?? ''),
  );
}

function GuestEmailVerificationDialog({
  email,
  fullName,
  ready = true,
  onClose,
  onVerified,
}: {
  email: string;
  fullName: string;
  ready?: boolean;
  onClose: () => void;
  onVerified: () => void | Promise<void>;
}) {
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { isLoaded: userLoaded, user } = useUser();
  const clerk = useClerk();
  const [flow, setFlow] = useState<'sign-up' | 'sign-in' | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emailCodeVerified, setEmailCodeVerified] = useState(false);
  const started = useRef(false);

  const startVerification = async () => {
    if (!signUp || !signIn) return;
    setBusy(true);
    setError('');
    try {
      const parts = fullName.trim().split(/\s+/).filter(Boolean);
      try {
        await signUp.create({
          emailAddress: email,
          ...(parts[0] ? { firstName: parts[0] } : {}),
          ...(parts.length > 1 ? { lastName: parts.slice(1).join(' ') } : {}),
        });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setFlow('sign-up');
      } catch (signUpError) {
        if (!isExistingClerkEmail(signUpError)) throw signUpError;
        await signIn.create({ identifier: email, strategy: 'email_code' });
        setFlow('sign-in');
      }
    } catch (sendError) {
      setError(clerkMessage(sendError));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (busy) return;
    if (!flow) {
      await startVerification();
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (flow === 'sign-up' && signUp) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      } else if (flow === 'sign-in' && signIn) {
        const emailFactor = signIn.supportedFirstFactors?.find((factor) => factor.strategy === 'email_code');
        if (!emailFactor || !('emailAddressId' in emailFactor)) {
          throw new Error('Clerk does not currently offer an email-code retry for this account.');
        }
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailFactor.emailAddressId,
        });
      } else {
        throw new Error('The email code cannot be resent right now. Close this window and try again.');
      }
    } catch (resendError) {
      setError(clerkMessage(resendError));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!ready || !userLoaded || started.current) return;
    const activeEmail = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
    if (activeEmail === email.trim().toLowerCase() && user?.primaryEmailAddress?.verification?.status === 'verified') {
      started.current = true;
      setEmailCodeVerified(true);
      void Promise.resolve(onVerified()).catch((linkError) => {
        setError(linkError instanceof Error ? linkError.message : 'Your email is verified, but status access could not be opened.');
      });
      return;
    }
    if (user) {
      started.current = true;
      setError('Sign out of the other account before verifying this application email.');
      return;
    }
    if (!signUpLoaded || !signInLoaded || !signUp || !signIn) return;
    started.current = true;
    void startVerification();
  }, [ready, userLoaded, user, email, signUpLoaded, signInLoaded, signUp, signIn]);

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || busy) return;
    if (emailCodeVerified) {
      setBusy(true);
      setError('');
      try {
        await onVerified();
      } catch (linkError) {
        setError(linkError instanceof Error ? linkError.message : 'Your email is verified, but status access could not be opened.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (code.trim().length < 4) return;
    setBusy(true);
    setError('');
    try {
      if (flow === 'sign-up' && signUp) {
        const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (result.status !== 'complete' || !result.createdSessionId) {
          throw new Error('Clerk needs another account step before email verification can finish. Your application draft is still saved.');
        }
        await clerk.setActive({ session: result.createdSessionId });
      } else if (flow === 'sign-in' && signIn) {
        const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code: code.trim() });
        if (result.status !== 'complete' || !result.createdSessionId) {
          throw new Error('This account requires another verification step. Your application draft is still saved.');
        }
        await clerk.setActive({ session: result.createdSessionId });
      } else {
        throw new Error('The email code has not been sent yet. Try sending it again.');
      }
      setEmailCodeVerified(true);
      await onVerified();
    } catch (verifyError) {
      setError(clerkMessage(verifyError));
    } finally {
      setBusy(false);
    }
  };

  return <div className="otp-dialog-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget && ready && !busy) onClose();
  }}>
    <section className="success-dialog otp-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-otp-title" data-testid="modal-guest-email-otp">
      <button type="button" className="modal-close" onClick={onClose} disabled={!ready || busy} aria-label="Close email verification"><span aria-hidden="true">×</span></button>
      <div className="success-dialog-icon"><ShieldCheck size={25} /></div>
      <span className="eyebrow">EMAIL VERIFICATION</span>
      <h2 id="guest-otp-title">{ready ? 'Check your inbox' : 'Submitting your application'}</h2>
      <p>{ready
        ? <>Your application has been submitted. We sent a one-time code to <strong>{email}</strong>. Verify this address to open the enrollment status page. If verification fails, your submitted record remains available to authorized reviewers.</>
        : 'Your saved details are being submitted. We’ll send the email verification code as soon as submission is confirmed.'}</p>
      <form onSubmit={(event) => void verifyCode(event)} className="otp-entry-form">
        <label className="field-label" htmlFor="guest-email-otp">Email code</label>
        <input id="guest-email-otp" className="text-input otp-entry-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" autoFocus disabled={!ready} data-testid="input-guest-email-otp" />
        {error && <p className="inline-error" role="alert" data-testid="text-guest-otp-error">{error}</p>}
        {ready && !flow && !error && <p className="field-help" role="status">Sending your verification code…</p>}
        <button type="submit" className="button button-primary" disabled={!ready || busy || (!emailCodeVerified && (!flow || code.trim().length < 4))} data-testid="button-verify-guest-email">
          {busy ? 'Working…' : emailCodeVerified ? 'Open status page' : 'Verify email'} <ArrowRight size={15} />
        </button>
      </form>
      {ready && !emailCodeVerified && <button type="button" className="text-action otp-resend" onClick={() => void resendCode()} disabled={busy} data-testid="button-resend-guest-otp">
        {busy ? 'Sending…' : 'Send a new code'}
      </button>}
    </section>
  </div>;
}

function GuestApplicationPage() {
  const categories = useListEnrollmentCategories();
  const portalSettings = useGetPortalSettings();
  const createGuest = useCreateGuestPreapplication();
  const updateGuest = useUpdateGuestPreapplicationProgress();
  const updateGuestEmail = useUpdateGuestPreapplicationEmail();
  const lookupGuest = useLookupGuestPreapplication();
  const requestEvidenceUpload = useRequestGuestApplicantEvidenceUpload();
  const completeEvidenceUpload = useCompleteGuestApplicantEvidenceUpload();
  const submitGuest = useSubmitGuestPreapplication();
  const linkGuest = useLinkGuestPreapplicationAccount();
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [created, setCreated] = useState<{ application: GuestPreapplicationCreated; accessKey: string } | null>(null);
  const categoryEntryScreenId = created ? `category-entry-${created.application.categoryId.replace('category-', '')}` : '';
  const categoryEntryCopy = categoryEntryScreenId ? portalSettings.data?.screenCopy?.[categoryEntryScreenId] ?? {} : {};
  const categoryEntryCard = created
    ? portalSettings.data?.cards.find((card) => card.id === created.application.categoryId)
    : undefined;
  const [applicationAnswers, setApplicationAnswers] = useState<Record<string, unknown>>({});
  const [copied, setCopied] = useState(false);
  const [stage, setStage] = useState<'contact' | 'category' | 'categoryEntry' | 'application' | 'complete' | 'closed'>('contact');
  const [isContinuing, setIsContinuing] = useState(false);
  const [contactSaveError, setContactSaveError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationReady, setVerificationReady] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const resumeStarted = useRef(false);
  const dashboardStartStarted = useRef(false);
  const [dashboardStartValues, setDashboardStartValues] = useState<GuestApplicationValues | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<{
    fingerprint: string;
    input: GuestPreapplicationInput;
  } | null>(null);
  const form = useForm<GuestApplicationValues>({
    resolver: zodResolver(guestApplicationSchema),
    defaultValues: {
      categoryId: '',
      fullName: readGuestDashboardContact()?.fullName ?? '',
      email: readGuestDashboardContact()?.email ?? '',
    },
  });

  useEffect(() => {
    if (resumeStarted.current) return;
    if (new URLSearchParams(window.location.search).get('resume') !== '1') return;
    resumeStarted.current = true;
    setResumeLoading(true);
    const stored = window.sessionStorage.getItem('guest-application-resume');
    if (!stored) {
      setResumeError('To continue a saved application, return to status lookup and enter your reference and private key.');
      setResumeLoading(false);
      return;
    }
    let credentials: { reference?: unknown; accessKey?: unknown };
    try {
      credentials = JSON.parse(stored) as { reference?: unknown; accessKey?: unknown };
    } catch {
      credentials = {};
    }
    if (typeof credentials.reference !== 'string' || typeof credentials.accessKey !== 'string') {
      setResumeError('The saved application details could not be restored. Return to status lookup and try again.');
      setResumeLoading(false);
      return;
    }
    void lookupGuest.mutateAsync({
      data: { reference: credentials.reference, accessKey: credentials.accessKey },
    }).then((application) => {
      setCreated({ application, accessKey: credentials.accessKey as string });
      setApplicationAnswers(application.answers);
      saveGuestResume(application.reference, credentials.accessKey as string);
      setStage(application.submissionStatus === 'submitted'
        ? 'complete'
        : application.status === 'closed'
        ? 'closed'
        : application.detailsComplete
          ? 'application'
          : application.answers.categoryEntryComplete === true
            ? 'application'
            : 'categoryEntry');
    }).catch(() => {
      setResumeError('The reference and private key could not be verified. Return to status lookup and try again.');
    }).finally(() => setResumeLoading(false));
  }, []);

  const saveGuestProgress = async (
    answers: Record<string, unknown>,
    currentStep: number,
    complete = false,
    pin?: string,
  ): Promise<boolean> => {
    if (!created) return false;
    setProgressError('');
    try {
      const saved = await updateGuest.mutateAsync({
        applicationId: created.application.id,
        data: {
          reference: created.application.reference,
          accessKey: created.accessKey,
          currentStep,
          answers,
          complete,
          ...(pin ? { pin } : {}),
        },
      });
      setCreated((current) => current ? {
        ...current,
        application: {
          ...current.application,
          status: saved.status,
          submissionStatus: saved.submissionStatus,
          emailVerified: saved.emailVerified,
          hasPin: saved.hasPin,
          linkedApplicationId: saved.linkedApplicationId,
          currentStep: saved.currentStep,
          detailsComplete: saved.detailsComplete,
          updatedAt: saved.updatedAt,
        },
      } : current);
      setApplicationAnswers(saved.answers);
      return true;
    } catch {
      setProgressError('Your progress could not be saved. Check your connection and try again.');
      return false;
    }
  };

  const saveGuestContactEmail = async (email: string): Promise<boolean> => {
    if (!created) return false;
    setProgressError('');
    try {
      const updated = await updateGuestEmail.mutateAsync({
        applicationId: created.application.id,
        data: {
          reference: created.application.reference,
          accessKey: created.accessKey,
          email,
        },
      });
      setCreated((current) => current ? {
        ...current,
        application: {
          ...current.application,
          email: updated.email,
          updatedAt: updated.updatedAt,
        },
      } : current);
      setApplicationAnswers(updated.answers);
      return true;
    } catch {
      setProgressError('The contact email could not be updated. Check your connection and try again.');
      return false;
    }
  };

  const continueToCategory = async () => {
    setIsContinuing(true);
    let startAfterContact = false;
    const contactDetails = guestContactSchema.safeParse({
      fullName: form.getValues('fullName'),
      email: form.getValues('email'),
    });
    if (!contactDetails.success) {
      await form.trigger(['fullName', 'email']);
      setIsContinuing(false);
      return;
    }
    try {
      window.sessionStorage.setItem(GUEST_DASHBOARD_CONTACT_KEY, JSON.stringify(contactDetails.data));
      window.sessionStorage.setItem(GUEST_CONTACT_STEP_PASSED_KEY, '1');
      const pendingCategoryId = window.sessionStorage.getItem(GUEST_DASHBOARD_PENDING_CATEGORY_KEY);
      if (pendingCategoryId) {
        const start = guestDashboardStartSchema.safeParse({ ...contactDetails.data, categoryId: pendingCategoryId });
        if (!start.success) {
          window.sessionStorage.removeItem(GUEST_DASHBOARD_PENDING_CATEGORY_KEY);
          setContactSaveError('Your selected category could not be restored. Return to the dashboard and choose it again.');
          setIsContinuing(false);
          return;
        }
        window.sessionStorage.setItem(GUEST_DASHBOARD_START_KEY, JSON.stringify(start.data));
        window.sessionStorage.removeItem(GUEST_DASHBOARD_PENDING_CATEGORY_KEY);
        dashboardStartStarted.current = false;
        setDashboardStartValues(start.data);
        startAfterContact = true;
      } else {
        window.sessionStorage.removeItem(GUEST_DASHBOARD_START_KEY);
      }
    } catch {
      setContactSaveError('Your details could not be saved in this browser. Enable session storage and try again.');
      setIsContinuing(false);
      return;
    }
    setContactSaveError('');
    setIsContinuing(false);
    if (startAfterContact) {
      setStage('category');
      setLocation('/guest/apply?dashboardStart=1', { replace: true });
    } else {
      setLocation('/dashboard', { replace: true });
    }
  };

  const onSubmit = async (values: GuestApplicationValues) => {
    const details = {
      categoryId: values.categoryId as GuestPreapplicationInput['categoryId'],
      fullName: values.fullName.trim(),
      email: values.email.trim(),
    };
    const fingerprint = JSON.stringify(details);
    let input = pendingSubmission?.input;
    let accessKey = input?.accessKey;
    if (!input || !accessKey) {
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
      accessKey = window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      input = {
        submissionId: window.crypto.randomUUID(),
        accessKey,
        categoryId: details.categoryId,
        fullName: details.fullName,
        email: details.email,
      };
      setPendingSubmission({ fingerprint, input });
    }

    try {
      const application = await createGuest.mutateAsync({ data: input });
      try {
        window.sessionStorage.removeItem(GUEST_DASHBOARD_START_KEY);
        window.sessionStorage.removeItem(GUEST_DASHBOARD_PENDING_CATEGORY_KEY);
      } catch {
        // Keep the successful application visible even if browser storage cleanup fails.
      }
      setCreated({ application, accessKey });
      try {
        saveGuestResume(application.reference, accessKey);
      } catch {
        setProgressError('Your private key could not be saved for this session. Copy it before continuing.');
      }
      setApplicationAnswers({});
      setStage('categoryEntry');
      setPendingSubmission(null);
      setDashboardStartValues(null);
      dashboardStartStarted.current = false;
    } catch {
      // Keep the same key and submission ID in memory so a retry is idempotent.
    }
  };

  useEffect(() => {
    if (dashboardStartStarted.current) return;
    if (new URLSearchParams(window.location.search).get('dashboardStart') !== '1') return;
    let storedStart: unknown;
    try {
      storedStart = JSON.parse(window.sessionStorage.getItem(GUEST_DASHBOARD_START_KEY) ?? 'null');
    } catch {
      storedStart = null;
    }
    const start = guestDashboardStartSchema.safeParse(storedStart);
    if (!start.success) {
      setResumeError('Your selected category could not be restored. Return to the dashboard and choose it again.');
      return;
    }
    setDashboardStartValues(start.data);
  }, []);

  useEffect(() => {
    if (!dashboardStartValues || dashboardStartStarted.current) return;
    dashboardStartStarted.current = true;
    setStage('category');
    void onSubmit(dashboardStartValues);
  }, [dashboardStartValues]);

  const uploadGuestEvidence = async (
    file: File,
    evidenceSlot: 'identity_front' | 'identity_back' | 'verification_video' | 'education_certificate',
  ): Promise<{ objectPath: string; fileName: string }> => {
    if (!created) throw new Error('Your application session could not be restored.');
    const contentType = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
    const evidenceType = evidenceSlot === 'verification_video'
      ? 'verification_video'
      : evidenceSlot === 'education_certificate'
        ? 'education_certificate'
        : 'identity_document';
    if (!contentType) throw new Error('The selected file type could not be identified. Choose a PDF, JPEG, PNG, WebP, MP4, or WebM file.');
    const { evidenceId, uploadUrl } = await requestEvidenceUpload.mutateAsync({
      applicationId: created.application.id,
      data: {
        reference: created.application.reference,
        accessKey: created.accessKey,
        evidenceType,
        evidenceSlot,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      },
    });
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!put.ok) throw new Error('The selected file could not be stored securely.');
    const uploaded = await completeEvidenceUpload.mutateAsync({
      applicationId: created.application.id,
      evidenceId,
      data: { reference: created.application.reference, accessKey: created.accessKey },
    });
    return { objectPath: uploaded.objectPath, fileName: uploaded.fileName };
  };

  const submitGuestApplication = async (answers: Record<string, unknown>): Promise<boolean> => {
    if (!created || !created.application.hasPin) return false;
    setVerificationReady(false);
    setVerificationOpen(true);
    if (!(await saveGuestProgress(answers, 7, false))) {
      setVerificationOpen(false);
      return false;
    }
    try {
      await submitGuest.mutateAsync({
        applicationId: created.application.id,
        data: { reference: created.application.reference, accessKey: created.accessKey },
      });
      setStage('complete');
      setVerificationReady(true);
      return true;
    } catch (error) {
      setVerificationOpen(false);
      setProgressError(error instanceof Error
        ? error.message
        : 'The application could not be submitted. Your saved details remain available.');
      return false;
    }
  };

  const onGuestDeclarationChange = async (
    accepted: boolean,
    answers: Record<string, unknown>,
  ) => {
    if (!(await saveGuestProgress(answers, 7, false))) return;
    void accepted;
  };

  const linkGuestStatus = async () => {
    if (!created) throw new Error('The submitted application is no longer available in this session.');
    const linked = await linkGuest.mutateAsync({
      applicationId: created.application.id,
      data: { reference: created.application.reference, accessKey: created.accessKey },
    });
    window.sessionStorage.removeItem(GUEST_APPLICATION_AUTH_CONTEXT_KEY);
    window.sessionStorage.removeItem(GUEST_APPLICATION_RESUME_KEY);
    setLocation(`/applications/${linked.id}`, { replace: true });
  };

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.accessKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (stage === 'complete' && created) {
    return <>
      <main className="guest-page portal-frame">
        <GuestPublicHeader />
        <section className="guest-form-card guest-submit-confirmation" data-testid="guest-submission-confirmation">
          <div className="success-dialog-icon"><ShieldCheck size={25} /></div>
          <span className="eyebrow">APPLICATION SUBMITTED</span>
          <h1>Your application was submitted.</h1>
          <p>Your saved details are available to authorized reviewers now. Verify <strong>{created.application.email}</strong> to open the enrollment status page and follow review updates.</p>
          <div className="review-field"><span>Application reference</span><b className="mono">{created.application.reference}</b></div>
          <button type="button" className="button button-primary guest-submit" onClick={() => setVerificationOpen(true)} data-testid="button-open-status-verification">
            Verify email and view status <ArrowRight size={16} />
          </button>
          <p className="guest-track-back"><Link href="/guest/status">I’ll verify later — go to status lookup</Link></p>
        </section>
      </main>
      {verificationOpen && <GuestEmailVerificationDialog
        email={created.application.email}
        fullName={created.application.fullName}
        ready={verificationReady}
        onClose={() => setVerificationOpen(false)}
        onVerified={linkGuestStatus}
      />}
    </>;
  }

  if (stage === 'application' && created) {
    const wizardApplication: EnrollmentApplication = {
      id: created.application.id,
      reference: created.application.reference,
      categoryId: created.application.categoryId,
      categoryName: created.application.categoryName,
      status: 'draft',
      currentStep: created.application.currentStep,
      hasPin: created.application.hasPin,
      answers: applicationAnswers,
      applicantName: created.application.fullName,
      applicantEmail: created.application.email,
      reviewNote: null,
      createdAt: created.application.createdAt,
      updatedAt: created.application.updatedAt,
      submittedAt: null,
    };
    return <>
      <EnrollmentWizard
      application={wizardApplication}
      categories={categories.data ?? []}
      status={created.application.status}
      storageAvailable
      maxUploadBytes={20 * 1024 * 1024}
      isSaving={updateGuest.isPending || updateGuestEmail.isPending || requestEvidenceUpload.isPending || completeEvidenceUpload.isPending}
      isSubmitting={updateGuest.isPending || submitGuest.isPending}
      error={progressError}
      reopenedSections={[]}
      privateTrackingKey={created.accessKey}
      onDeclarationChange={(accepted, answers) => void onGuestDeclarationChange(accepted, answers)}
      updateContactEmail={saveGuestContactEmail}
      uploadEvidence={uploadGuestEvidence}
      saveStep={(answers, currentStep) => saveGuestProgress(answers, currentStep)}
      submit={submitGuestApplication}
      onChangeCategory={() => undefined}
      onBackToCategoryEntry={(answers) => saveGuestProgress(answers, 0).then((saved) => {
        if (saved) setStage('categoryEntry');
        return saved;
      })}
      screenCopy={portalSettings.data?.screenCopy}
      categoryCards={portalSettings.data?.cards}
      pageThemes={portalSettings.data?.pageThemes}
      />
      {verificationOpen && <GuestEmailVerificationDialog
        email={created.application.email}
        fullName={created.application.fullName}
        ready={verificationReady}
        onClose={() => setVerificationOpen(false)}
        onVerified={linkGuestStatus}
      />}
    </>;
  }

  return <main className="guest-page portal-frame">
    <GuestPublicHeader />
    <div className="guest-page-grid">
      <section className="guest-form-card rise-delay" aria-labelledby="guest-apply-heading">
        {resumeLoading && <div className="guest-form-subtitle" role="status">Restoring your saved application…</div>}
        {resumeError && <p className="guest-inline-error" role="alert" data-testid="guest-resume-error">{resumeError}</p>}
        {stage === 'complete' && created ? <div className="guest-success" data-testid="guest-application-success">
          <span className="guest-success-mark"><Check size={22} /></span>
          <div className="eyebrow">{created.application.submissionStatus === 'submitted' ? 'APPLICATION SUBMITTED' : 'APPLICATION DRAFT SAVED'}</div>
          <h2 id="guest-apply-heading">{created.application.submissionStatus === 'submitted' ? 'Your application was submitted.' : 'Your details are saved.'}</h2>
          <p>{created.application.submissionStatus === 'submitted'
            ? 'Your verified account is linked to this application. You can follow its review status from your dashboard.'
            : 'Your saved draft is available to authorized reviewers. Resume it later to complete your details, evidence, and email verification.'}</p>
          <div className="guest-reference-box">
            <span>APPLICATION REFERENCE</span>
            <strong data-testid="text-guest-reference">{created.application.reference}</strong>
          </div>
          <div className="guest-key-box">
            <div className="guest-key-heading"><span>PRIVATE TRACKING KEY</span><LockKeyhole size={15} /></div>
            <code data-testid="text-guest-tracking-key">{created.accessKey}</code>
            <button type="button" className="button button-quiet guest-copy-button" onClick={() => void copyKey()} data-testid="button-copy-tracking-key">
              {copied ? <><Check size={15} /> Copied</> : <><FileText size={15} /> Copy key</>}
            </button>
          </div>
          <p className="guest-key-warning">Save this key now. It is not emailed and cannot be recovered if lost. Keep it separate from your reference.</p>
          <Link href="/guest/track" className="button button-primary guest-success-track" data-testid="link-track-created-application">Track or resume application <ArrowRight size={16} /></Link>
        </div> : stage === 'closed' && created ? <div className="guest-success" data-testid="guest-application-closed">
          <span className="guest-success-mark"><LockKeyhole size={20} /></span>
          <div className="eyebrow">APPLICATION CLOSED</div>
          <h2 id="guest-apply-heading">This application is closed.</h2>
          <p>Contact the enrollment team if you believe this was closed in error.</p>
          <Link href="/guest/track" className="button button-primary guest-success-track">Return to status lookup <ArrowRight size={16} /></Link>
        </div> : stage === 'categoryEntry' && created ? <>
          <div className="guest-form-topline"><span>CATEGORY DETAILS</span><span>STEP 3 OF 4</span></div>
          {progressError && <p className="guest-inline-error" role="alert">{progressError}</p>}
          <CategoryEntryForm
            categoryId={created.application.categoryId}
            reference={created.application.reference}
            savedAnswers={applicationAnswers}
            isSaving={updateGuest.isPending}
            error={progressError}
            guestMode
            pinScreenBackground={portalSettings.data?.theme.pinScreenBackground}
            categoryInputTransparent={portalSettings.data?.theme.categoryInputTransparent}
            screenCopy={categoryEntryCopy}
            pageTheme={categoryEntryScreenId ? portalSettings.data?.pageThemes?.[categoryEntryScreenId] : undefined}
            entryLogoDataUrl={categoryEntryCard?.entryLogoDataUrl ?? categoryEntryCard?.logoDataUrl}
            pinLogoDataUrl={categoryEntryCard?.pinLogoDataUrl ?? categoryEntryCard?.entryLogoDataUrl ?? categoryEntryCard?.logoDataUrl}
            entryLogoAlignment={categoryEntryCard?.entryLogoAlignment ?? categoryEntryCopy.entryLogoAlignment}
            entryLogoVerticalOffset={categoryEntryCard?.entryLogoVerticalOffset ?? categoryEntryCopy.entryLogoVerticalOffset}
            pinLogoAlignment={categoryEntryCard?.pinLogoAlignment ?? categoryEntryCopy.entryLogoAlignment}
            pinLogoVerticalOffset={categoryEntryCard?.pinLogoVerticalOffset ?? categoryEntryCopy.entryLogoVerticalOffset}
            onComplete={async (entryAnswers, pin) => {
              const personal = applicationAnswers.personalInformation &&
                typeof applicationAnswers.personalInformation === 'object' &&
                !Array.isArray(applicationAnswers.personalInformation)
                ? applicationAnswers.personalInformation as Record<string, unknown>
                : {};
              const nameParts = created.application.fullName.trim().split(/\s+/);
              const nextAnswers = {
                ...applicationAnswers,
                ...entryAnswers,
                categoryEntryComplete: true,
                personalInformation: {
                  ...personal,
                  firstName: personal.firstName || nameParts[0] || '',
                  surname: personal.surname || nameParts.slice(1).join(' '),
                  email: personal.email || created.application.email,
                },
              };
              if (await saveGuestProgress(nextAnswers, 0, false, pin)) setStage('application');
            }}
          />
        </> : stage === 'category' ? <div className="guest-starting-category" role="status" data-testid="guest-application-starting">
          <span className="guest-success-mark">{createGuest.isError ? <LockKeyhole size={20} /> : <ArrowRight size={20} />}</span>
          <div className="eyebrow">{createGuest.isError ? 'APPLICATION NOT STARTED' : 'OPENING YOUR APPLICATION'}</div>
          <h2 id="guest-apply-heading">{createGuest.isError ? 'We couldn’t start this application.' : 'Preparing your category form…'}</h2>
          <p>{createGuest.isError
            ? 'Your category selection and contact details are saved. Retry to continue without creating a duplicate.'
            : 'Your secure application is being prepared. This usually takes a moment.'}</p>
          {createGuest.isError && dashboardStartValues && <button type="button" className="button button-primary guest-success-track" onClick={() => void onSubmit(dashboardStartValues)} disabled={createGuest.isPending}>
            Retry application setup <ArrowRight size={16} />
          </button>}
          {createGuest.isError && <button type="button" className="text-action" onClick={() => setLocation('/dashboard')}>Choose another category</button>}
        </div> : <>
          <div className="guest-form-topline"><span>APPLICATION</span><span>STEP 1 OF 4</span></div>
            <h2 id="guest-apply-heading">Your contact details</h2>
            <p className="guest-form-subtitle">Start with only your name and email. You’ll continue to the public category dashboard.</p>
            {contactSaveError && <p className="guest-inline-error" role="alert" data-testid="guest-contact-save-error">{contactSaveError}</p>}
            <Form {...form}>
              <form className="guest-form" onSubmit={(event) => {
                event.preventDefault();
                void continueToCategory();
              }} noValidate>
                <FormField control={form.control} name="fullName" render={({ field }) => <FormItem className="guest-field">
                  <FormLabel>Full name</FormLabel><FormControl><Input {...field} autoComplete="name" placeholder="As shown on your identity document" data-testid="input-guest-full-name" /></FormControl><FormMessage />
                </FormItem>} />
                <FormField control={form.control} name="email" render={({ field }) => <FormItem className="guest-field">
                  <FormLabel>Email address</FormLabel><FormControl><Input {...field} type="email" autoComplete="email" placeholder="you@example.com" data-testid="input-guest-email" /></FormControl><FormMessage />
                </FormItem>} />
                <button type="submit" className="button button-primary guest-submit" disabled={isContinuing} data-testid="button-continue-guest-contact">
                  {isContinuing ? 'Checking details…' : 'Continue to categories'} <ArrowRight size={16} />
                </button>
                <p className="guest-form-privacy"><LockKeyhole size={14} /> Your details are shared only with enrollment staff.</p>
              </form>
            </Form>
        </>}
      </section>
    </div>
    <footer className="guest-footer"><span>SECURE ENROLLMENT PORTAL</span><Link href="/guest/track" data-testid="link-guest-footer-track">Already started? Track your application</Link></footer>
  </main>;
}

function GuestApplicationRoute() {
  const [, setLocation] = useLocation();
  const search = new URLSearchParams(window.location.search);
  const isResumeOrCategoryStart = search.get('resume') === '1' || search.get('dashboardStart') === '1';
  const skipContactStep = !isResumeOrCategoryStart && guestContactStepPassed();

  useEffect(() => {
    if (skipContactStep) setLocation('/dashboard', { replace: true });
  }, [skipContactStep, setLocation]);

  if (skipContactStep) return <main className="guest-page portal-frame" aria-busy="true">
    <GuestPublicHeader />
    <div className="guest-track-wrap"><p role="status" data-testid="guest-contact-step-skipped">Returning to your categories…</p></div>
  </main>;

  return <GuestApplicationPage />;
}

function GuestTrackingPage() {
  const lookup = useLookupGuestPreapplication();
  const linkGuest = useLinkGuestPreapplicationAccount();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<GuestPreapplicationStatus | null>(null);
  const [lastAccessKey, setLastAccessKey] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [verificationOpen, setVerificationOpen] = useState(false);
  const form = useForm<GuestLookupValues>({
    resolver: zodResolver(guestLookupSchema),
    defaultValues: { reference: '', accessKey: '' },
  });
  const onSubmit = async (values: GuestLookupValues) => {
    setLookupError('');
    setStatus(null);
    try {
      const result = await lookup.mutateAsync({ data: { reference: values.reference.trim(), accessKey: values.accessKey } });
      setStatus(result);
      setLastAccessKey(values.accessKey);
      form.reset({ reference: values.reference.trim(), accessKey: '' });
      if (result.emailVerificationRequired) setVerificationOpen(true);
    } catch {
      setLookupError('We couldn’t find a matching application with those details. Check your reference and private key, then try again.');
    }
  };
  const openVerifiedStatus = async () => {
    if (!status || !lastAccessKey) {
      throw new Error('Look up your submitted application again before verifying email.');
    }
    const linked = await linkGuest.mutateAsync({
      applicationId: status.id,
      data: { reference: status.reference, accessKey: lastAccessKey },
    });
    setLocation(`/applications/${linked.id}`, { replace: true });
  };
  return <main className="guest-page guest-track-page portal-frame">
    <GuestPublicHeader />
    <div className="guest-track-wrap">
      <div className="guest-track-heading rise">
        <div className="eyebrow"><span className="eyebrow-rule" />PRIVATE STATUS LOOKUP</div>
        <h1>Your progress, clearly.</h1>
        <p>Use your reference and private tracking key to resume a draft or verify your email for a submitted application. Email verification unlocks the enrollment status page.</p>
      </div>
      <section className="guest-track-card rise-delay">
        <Form {...form}><form className="guest-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField control={form.control} name="reference" render={({ field }) => <FormItem className="guest-field">
            <FormLabel>Application reference</FormLabel><FormControl><Input {...field} autoComplete="off" placeholder="PRE-..." data-testid="input-track-reference" /></FormControl><FormMessage />
          </FormItem>} />
          <FormField control={form.control} name="accessKey" render={({ field }) => <FormItem className="guest-field">
            <FormLabel>Private tracking key</FormLabel><FormControl><Input {...field} type="password" autoComplete="new-password" placeholder="Paste the key you saved" data-testid="input-track-key" /></FormControl><FormMessage />
          </FormItem>} />
          {lookupError && <p className="guest-inline-error" role="alert" data-testid="track-lookup-error">{lookupError}</p>}
          <button type="submit" className="button button-primary guest-submit" disabled={lookup.isPending} data-testid="button-lookup-guest-status">
            {lookup.isPending ? 'Checking status…' : 'Look up status'} <ArrowRight size={16} />
          </button>
        </form></Form>
        <p className="guest-track-security"><LockKeyhole size={14} /> Your private key is never included in a link. Keep your own copy to return later.</p>
      </section>
      {status?.emailVerificationRequired ? <section className="guest-status-card rise" aria-live="polite" data-testid="guest-status-verification-required">
        <div className="guest-status-head"><div><span className="eyebrow">APPLICATION SUBMITTED</span><h2>{status.reference}</h2></div></div>
        <div className="guest-status-next"><ShieldCheck size={17} /><p>Your application has been submitted and is available to authorized reviewers. Verify the email address on the application to unlock its status and follow review updates.</p></div>
        <button type="button" className="button button-primary guest-submit" onClick={() => setVerificationOpen(true)} data-testid="button-verify-email-for-status">
          Verify email to view status <ArrowRight size={16} />
        </button>
      </section> : status && <section className="guest-status-card rise" aria-live="polite" data-testid="guest-public-status">
        <div className="guest-status-head"><div><span className="eyebrow">APPLICATION STATUS</span><h2>{status.reference}</h2></div><StatusPill status={status.reviewStatus ?? status.status} testId="status-guest-application" /></div>
        <div className="guest-status-details">
          <div><span>Enrollment category</span><strong>{status.categoryName}</strong></div>
          <div><span>Current status</span><strong className="guest-status-capitalize">{(status.reviewStatus ?? status.status).replaceAll('_', ' ')}</strong></div>
          <div><span>Email verification</span><strong>{status.emailVerified ? 'Verified' : 'Not verified'}</strong></div>
          <div><span>Last updated</span><strong>{formatDate(status.updatedAt)}</strong></div>
        </div>
        <div className="guest-status-next"><ShieldCheck size={17} /><p>{status.status === 'closed'
          ? 'This application is closed. Contact the enrollment team if you need help.'
          : status.submissionStatus === 'submitted'
            ? `Your email-verified application has been submitted. Current review status: ${(status.reviewStatus ?? 'submitted').replaceAll('_', ' ')}. Check this page for progress and follow-up.`
            : status.detailsComplete
              ? 'Your details and PIN are saved. Confirm the declaration and submit when ready; verify your email afterward to access the status page.'
              : 'Your progress is saved as an unsubmitted draft. Continue when ready; incomplete fields and failed email verification do not remove saved progress.'}</p></div>
        {status.submissionStatus === 'submitted' && status.outstandingRequirements.length > 0 && <div className="review-note" data-testid="guest-outstanding-requirements">
          <b>Items still needed</b><ul>{status.outstandingRequirements.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>}
        {status.submissionStatus === 'submitted' && status.applicantFollowup && <div className="review-note" data-testid="guest-reviewer-followup">
          <b>Update from the review team</b><p>{status.applicantFollowup}</p>
        </div>}
        {status.submissionStatus !== 'submitted' && status.status !== 'closed' && <button type="button" className="button button-primary guest-submit"
          disabled={!lastAccessKey} onClick={() => {
            if (!lastAccessKey) {
              setLookupError('Look up the application again to continue it.');
              return;
            }
            saveGuestResume(status.reference, lastAccessKey);
            setLocation('/guest/apply?resume=1');
          }} data-testid="button-resume-guest-application">
          {status.detailsComplete ? 'Review saved application' : 'Continue application'} <ArrowRight size={16} />
        </button>}
      </section>}
      {verificationOpen && status?.emailVerificationRequired && <GuestEmailVerificationDialog
        email={status.email}
        fullName={status.fullName}
        onClose={() => setVerificationOpen(false)}
        onVerified={openVerifiedStatus}
      />}
      <p className="guest-track-back"><Link href="/guest/apply" data-testid="link-track-start-application">Need to start an application? <span>Begin here <ArrowRight size={14} /></span></Link></p>
    </div>
  </main>;
}

function AdminGuestApplicationReview() {
  const params = useParams<{ applicationId?: string }>();
  const id = params.applicationId ?? '';
  const { user } = useUser();
  const queryClient = useQueryClient();
  const portalSettings = useGetPortalSettings();
  const applications = useListAdminGuestPreapplications({
    query: {
      queryKey: getListAdminGuestPreapplicationsQueryKey(),
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
      enabled: Boolean(id),
    },
    request: { cache: 'no-store' },
  });
  const pinQuery = useGetAdminGuestPreapplicationPin(id, {
    query: { queryKey: getGetAdminGuestPreapplicationPinQueryKey(id), enabled: false, gcTime: 0 },
    request: { cache: 'no-store' },
  });
  const update = useUpdateAdminGuestPreapplication();
  const requestEvidenceUpload = useRequestGuestPreapplicationEvidenceUpload();
  const completeEvidenceUpload = useCompleteGuestPreapplicationEvidenceUpload();
  const [feedback, setFeedback] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState<string | null>(null);
  const [pinRevealed, setPinRevealed] = useState(false);
  const [pinFeedback, setPinFeedback] = useState('');
  const role = String(user?.publicMetadata?.role);
  const canReview = role === 'sub_admin' || role === 'admin';
  const application = applications.data?.find((record) => record.id === id);
  const revealOrHidePin = async () => {
    if (pinRevealed) {
      setPinRevealed(false);
      setPinFeedback('');
      queryClient.removeQueries({ queryKey: getGetAdminGuestPreapplicationPinQueryKey(id) });
      return;
    }
    setPinFeedback('');
    const result = await pinQuery.refetch();
    if (result.data?.available && result.data.pin) setPinRevealed(true);
    else if (result.isError) setPinFeedback('The PIN could not be retrieved. Please try again.');
    else setPinFeedback('This PIN was saved before reviewer reveal was available and cannot be recovered. The applicant must set a new PIN.');
  };

  const progressLabel = (record: AdminGuestPreapplication) => {
    const uploaded = record.evidence.filter((item) => item.uploadedAt);
    const hasFront = uploaded.some((item) => item.evidenceSlot === 'identity_front');
    const hasVideo = uploaded.some((item) => item.evidenceSlot === 'verification_video');
    const stepLabels: Record<number, string> = {
      0: 'Personal information',
      1: 'Next of kin',
      2: 'Education',
      3: 'Work information',
      6: 'Bank details',
      7: 'Application review',
    };
    if (record.reviewReady) return 'Ready for review · applicant has not submitted';
    const missing = [
      !record.hasPin && 'category PIN',
      !hasFront && 'identity front',
      !hasVideo && 'verification video',
    ].filter(Boolean);
    const details = record.detailsComplete
      ? 'Details complete'
      : `Saved through: ${copyText(
        portalSettings.data,
        `workflow-step-${Math.min(8, Math.max(1, record.currentStep + 1))}`,
        'title',
        stepLabels[record.currentStep] ?? 'Category details',
      )}`;
    return `${details} · email ${record.emailVerified ? 'verified' : 'not verified'} · ${missing.length ? `missing ${missing.join(', ')}` : 'not submitted'}`;
  };

  const setApplicationStatus = (nextStatus: 'contacted' | 'closed') => {
    if (!application) return;
    setFeedback('');
    setFeedbackIsError(false);
    update.mutate({ applicationId: application.id, data: { status: nextStatus } }, {
      onSuccess: () => {
        setFeedback(`${application.reference} marked ${nextStatus}.`);
        void queryClient.invalidateQueries({ queryKey: getListAdminGuestPreapplicationsQueryKey() });
      },
      onError: () => {
        setFeedbackIsError(true);
        setFeedback(`The status for ${application.reference} could not be updated. Please try again.`);
      },
    });
  };

  const uploadEvidence = async (
    evidenceType: 'identity_document' | 'verification_video',
    file: File,
  ) => {
    if (!application) return;
    const busyKey = `${application.id}:${evidenceType}`;
    setEvidenceBusy(busyKey);
    setFeedback('');
    try {
      const { evidenceId, uploadUrl } = await requestEvidenceUpload.mutateAsync({
        applicationId: application.id,
        data: {
          evidenceType,
          evidenceSlot: evidenceType === 'verification_video' ? 'verification_video' : 'identity_front',
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        },
      });
      const result = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!result.ok) throw new Error('The file could not be stored securely.');
      await completeEvidenceUpload.mutateAsync({ applicationId: application.id, evidenceId });
      await queryClient.invalidateQueries({ queryKey: getListAdminGuestPreapplicationsQueryKey() });
      setFeedbackIsError(false);
      setFeedback(`${file.name} was uploaded and verified.`);
    } catch (error) {
      setFeedbackIsError(true);
      setFeedback(error instanceof Error ? error.message : `Could not upload ${file.name}. Please try again.`);
    } finally {
      setEvidenceBusy(null);
    }
  };

  const handleEvidenceFile = (
    evidenceType: 'identity_document' | 'verification_video',
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void uploadEvidence(evidenceType, file);
  };

  if (!canReview) return <main className="signedout-page portal-frame"><PortalWordmark /><div className="signedout-card">
    <span className="state-icon"><LockKeyhole size={21} /></span><div className="eyebrow">RESTRICTED WORKSPACE</div>
    <h1>Reviewer access required</h1><p>Applicant records are available only to authorized administrators and sub-administrators.</p>
    <Link href="/admin/review" className="button button-primary" data-testid="link-guest-detail-review-return">Return to Applicants <ArrowRight size={15} /></Link>
  </div></main>;

  if (applications.isLoading) return <AdminShell active="review"><LoadingPanel label="Loading applicant record" /></AdminShell>;
  if (applications.isError) return <AdminShell active="review"><div className="admin-review-page">
    <Link href="/admin/review" className="back-link"><ArrowLeft size={16} /> Applicants</Link>
    <AccessError retry={() => void applications.refetch()} />
  </div></AdminShell>;
  if (!application) return <AdminShell active="review"><div className="admin-review-page">
    <Link href="/admin/review" className="back-link"><ArrowLeft size={16} /> Applicants</Link>
    <section className="state-card"><span className="state-icon"><FileText size={20} /></span><h2>Applicant record not found</h2>
      <p>This guest application may have been removed or is no longer available in the reviewer workspace.</p>
      <Link href="/admin/review" className="button button-primary" data-testid="link-guest-detail-not-found">Back to Applicants</Link>
    </section>
  </div></AdminShell>;
  const categoryTitle = configuredCategoryTitle(portalSettings.data, application.categoryId, application.categoryName);
  const entryScreen = categoryEntryScreenId(application.categoryId);

  return <AdminShell active="review">
    <div className="admin-review-page guest-applicant-review-page">
      <Link href="/admin/review" className="back-link" data-testid="link-guest-review-back"><ArrowLeft size={16} /> Applicants</Link>
      <div className="review-title-row">
        <div><div className="eyebrow">ACCOUNT-FREE APPLICANT REVIEW</div><h1>{application.fullName || 'Applicant'}</h1>
          <p className="mono">{application.reference} · {categoryTitle}</p></div>
        <StatusPill status={application.status} testId={`status-guest-review-detail-${application.id}`} />
      </div>
      {feedback && <p className={feedbackIsError ? 'inline-error' : 'inline-success'} role="status" data-testid="guest-detail-feedback">{feedback}</p>}
      <div className="review-detail-grid">
        <section className="detail-card applicant-record">
          <div className="detail-card-title"><FileText size={17} /><h2>Applicant record</h2></div>
          <div className="review-field"><span>Name</span><b>{application.fullName || 'Not provided'}</b></div>
          <div className="review-field"><span>Email</span><b>{application.email || 'Not provided'}</b></div>
          <div className="review-field"><span>Phone</span><b>{application.phone || 'Not provided'}</b></div>
          <div className="review-field"><span>Email verification</span><b>{application.emailVerified ? 'Verified' : 'Not verified'}</b></div>
          <div className="review-field"><span>{copyText(portalSettings.data, entryScreen, 'sectionIdLabel', 'Selected category')}</span><b>{categoryTitle}</b></div>
          <div className="review-field"><span>Application progress</span><b>{progressLabel(application)}</b></div>
          <div className="review-field"><span>Created</span><b>{formatDate(application.createdAt)}</b></div>
          <div className="review-field"><span>Last updated</span><b>{formatDate(application.updatedAt)}</b></div>
          <div className="review-field"><span>Submission</span><b>{application.submissionStatus === 'submitted' ? 'Submitted' : 'Not submitted'}</b></div>
        </section>
        <section className="decision-card guest-review-actions">
          <div className="decision-head"><span className="decision-icon"><Activity size={19} /></span><div><h2>Reviewer actions</h2><p>Update the guest follow-up status or complete the private evidence file when supplied by the applicant.</p></div></div>
          <div className="decision-actions guest-detail-actions">
            {application.status === 'received' && <button type="button" className="decision-button approve" onClick={() => setApplicationStatus('contacted')} disabled={update.isPending} data-testid={`button-guest-detail-contacted-${application.id}`}>Mark contacted</button>}
            {application.status !== 'closed' && <button type="button" className="decision-button reject" onClick={() => setApplicationStatus('closed')} disabled={update.isPending} data-testid={`button-guest-detail-close-${application.id}`}>Close application</button>}
            {application.status === 'closed' && <span className="guest-admin-closed">This guest record is closed.</span>}
          </div>
        </section>
      </div>
      <section className="detail-card guest-evidence-panel guest-review-detail-evidence">
        <div className="detail-card-title"><LockKeyhole size={17} /><h2>Private identity evidence</h2></div>
        <div className={`guest-review-readiness ${application.reviewReady ? 'is-ready' : ''}`} role="status">
          <span>{application.reviewReady ? 'Ready for full review' : 'Not ready for submission'}</span>
          <small>{application.detailsComplete ? 'Application details are complete.' : 'Application details are incomplete.'} Required for submission: PIN, identity front, and verification video.</small>
        </div>
        <div className="guest-evidence-upload-actions">
          <label className="guest-evidence-upload"><Upload size={15} />
            <span>{evidenceBusy === `${application.id}:identity_document` ? 'Uploading identity file…' : 'Add identity file'}</span>
            <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" disabled={evidenceBusy !== null}
              onChange={(event) => handleEvidenceFile('identity_document', event)} data-testid={`input-guest-detail-identity-${application.id}`} />
          </label>
          <label className="guest-evidence-upload"><Upload size={15} />
            <span>{evidenceBusy === `${application.id}:verification_video` ? 'Uploading verification video…' : 'Add verification video'}</span>
            <input type="file" accept="video/mp4,video/webm" disabled={evidenceBusy !== null}
              onChange={(event) => handleEvidenceFile('verification_video', event)} data-testid={`input-guest-detail-video-${application.id}`} />
          </label>
        </div>
        {application.evidence.length > 0 ? <ul className="guest-evidence-list" aria-label="Private evidence files">
          {application.evidence.map((item) => <li key={item.id}>
            <span><b>{item.evidenceSlot === 'identity_front' ? 'Identity document front' : item.evidenceSlot === 'identity_back' ? 'Identity document back' : item.evidenceSlot === 'education_certificate' ? 'Education certificate' : item.evidenceSlot === 'verification_video' ? 'Verification video' : 'Identity document'}</b>
              <small>{item.fileName} · {item.uploadedAt ? `${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : 'Upload pending verification'}</small></span>
            {item.downloadUrl && <a href={item.downloadUrl} className="guest-evidence-download" data-testid={`link-guest-detail-evidence-${item.id}`}>Download securely</a>}
          </li>)}
        </ul> : <p className="field-help">No private evidence files have been received yet.</p>}
      </section>
      <section className="review-category-selection">
        <div className="detail-card-title"><CheckCircle2 size={17} /><h2>{copyText(portalSettings.data, entryScreen, 'title', categoryTitle)}</h2></div>
        <div className="review-field"><span>{copyText(portalSettings.data, entryScreen, 'sectionIdLabel', 'Selected category')}</span><b>{categoryTitle}</b></div>
        <div className="review-field"><span>Category PIN</span><b>{pinRevealed ? pinQuery.data?.pin : application.hasPin ? 'Set (hidden)' : 'Not set'}</b></div>
        {application.hasPin && <button type="button" className="text-action" onClick={() => void revealOrHidePin()} disabled={pinQuery.isFetching} data-testid={`button-reveal-guest-pin-${application.id}`}>
          {pinQuery.isFetching ? 'Loading PIN…' : pinRevealed ? 'Hide PIN' : 'Reveal PIN'}
        </button>}
        {pinFeedback && <p className="field-help" role="status" data-testid="guest-pin-feedback">{pinFeedback}</p>}
        {getCategoryEntryFields(application.answers, application.categoryId, portalSettings.data).map((field) =>
          <div className="review-field" key={field.label}><span>{field.label}</span><b>{field.value}</b></div>)}
        <div className="review-field"><span>Applicant declaration</span><b>{application.answers.reviewDeclarationAccepted === true ? 'Accepted' : 'Not accepted'}</b></div>
      </section>
      <div className="admin-record-sections">
        <AdminAnswerSection title="Personal information" settings={portalSettings.data} workflowStep={1} group="personalInformation" data={readAnswerGroup(application.answers, 'personalInformation')} />
        <AdminAnswerSection title="Next of kin" settings={portalSettings.data} workflowStep={2} group="nextOfKin" data={readAnswerGroup(application.answers, 'nextOfKin')} note="Applicants are asked to share these details with the contact’s permission." />
        <AdminAnswerSection title="Education" settings={portalSettings.data} workflowStep={3} group="education" data={readAnswerGroup(application.answers, 'education')} />
        <AdminAnswerSection title="Work information" settings={portalSettings.data} workflowStep={4} group="workInformation" data={readAnswerGroup(application.answers, 'workInformation')} />
        <AdminAnswerSection title="Proof of identity details" settings={portalSettings.data} workflowStep={5} group="proofOfIdentity" data={readAnswerGroup(application.answers, 'proofOfIdentity')} note="Uploaded private identity files are listed in the evidence panel above." />
        <AdminAnswerSection title="Video verification details" settings={portalSettings.data} workflowStep={6} group="liveVideoRecording" data={readAnswerGroup(application.answers, 'liveVideoRecording')} note="The uploaded video is listed in the evidence panel above." />
        <AdminAnswerSection title="Optional bank details" settings={portalSettings.data} workflowStep={7} group="bankDetails" data={readAnswerGroup(application.answers, 'bankDetails')} note="Shown only to authorized reviewers." />
      </div>
      <section className="detail-card admin-history-card" data-testid={`guest-preapplication-history-${application.id}`}>
        <div className="detail-card-title"><Activity size={17} /><h2>Saved entries and corrections</h2></div>
        {application.history.length === 0 ? <p className="field-help">No changes have been recorded yet.</p> :
          <div className="admin-history-list">{application.history.map((revision) => <article key={revision.id}>
            <b>{`Saved at step ${revision.currentStep + 1}`}</b><span>{formatDate(revision.createdAt)}</span>
            <ul>{revision.changes.map((change, index) => <li key={`${revision.id}-${index}`}>
              <strong>{change.field.replace(/^answers\./, '').replaceAll('.', ' ').replaceAll('_', ' ')}</strong>: {change.before || '—'} → {change.after || '—'}
            </li>)}</ul>
          </article>)}</div>}
      </section>
    </div>
  </AdminShell>;
}

function ApplicantsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const portalSettings = useGetPortalSettings();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearSearch, setClearSearch] = useState('');
  const [selectedClearIds, setSelectedClearIds] = useState<string[]>([]);
  const applicationFilters = useMemo(
    () => ({
      ...(status && ['draft', 'submitted', 'under_review', 'needs_information', 'approved', 'rejected'].includes(status)
        ? { status: status as 'draft' | 'submitted' | 'under_review' | 'needs_information' | 'approved' | 'rejected' }
        : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [search, status],
  );
  const submittedApplications = useListApplicationsForReview(applicationFilters);
  const allApplicationsForClear = useListApplicationsForReview();
  const applications = useListAdminGuestPreapplications({
    query: {
      queryKey: getListAdminGuestPreapplicationsQueryKey(),
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
    },
    request: { cache: 'no-store' },
  });
  const update = useUpdateAdminGuestPreapplication();
  const clearApplicantRecords = useClearApplicantRecords();
  const role = String(user?.publicMetadata?.role);
  const canReview = role === 'sub_admin' || role === 'admin';
  const searchTerm = search.trim().toLowerCase();
  const matchingGuestApplications = useMemo(() => {
    const records = applications.data ?? [];
    return records.filter((application) => {
      const matchesSearch = !searchTerm || [
        application.fullName,
        application.email,
        application.phone ?? '',
        application.categoryName,
        configuredCategoryTitle(portalSettings.data, application.categoryId, application.categoryName),
        application.reference,
      ].join(' ').toLowerCase().includes(searchTerm);
      const matchesStatus = !status ||
        (status === 'draft' && application.status !== 'closed') ||
        application.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [applications.data, portalSettings.data, searchTerm, status]);
  const guestStatusFilter = ['received', 'contacted', 'closed'].includes(status);
  const matchingEnrollmentApplications = guestStatusFilter ? [] : submittedApplications.data ?? [];
  const clearableApplicants = useMemo(() => [
    ...(allApplicationsForClear.data ?? []).map((application) => ({
      id: application.id,
      type: 'enrollment_application' as const,
      fullName: application.applicantName || 'Applicant',
      email: application.applicantEmail || 'No email',
      categoryName: configuredCategoryTitle(portalSettings.data, application.categoryId, application.categoryName),
      reference: application.reference,
      status: application.status === 'draft' ? 'Draft' : application.status.replaceAll('_', ' '),
      updatedAt: application.updatedAt,
    })),
    ...(applications.data ?? []).map((application) => ({
      id: application.id,
      type: 'guest_preapplication' as const,
      fullName: application.fullName || 'Applicant',
      email: application.email || 'No email',
      categoryName: configuredCategoryTitle(portalSettings.data, application.categoryId, application.categoryName),
      reference: application.reference,
      status: application.submissionStatus === 'submitted'
        ? 'Submitted'
        : application.status.replaceAll('_', ' '),
      updatedAt: application.updatedAt,
    })),
  ], [allApplicationsForClear.data, applications.data, portalSettings.data]);
  const clearSearchTerm = clearSearch.trim().toLowerCase();
  const visibleClearApplicants = clearableApplicants.filter((applicant) => [
    applicant.fullName,
    applicant.email,
    applicant.categoryName,
    applicant.reference,
    applicant.status,
  ].join(' ').toLowerCase().includes(clearSearchTerm));
  const selectedClearSet = new Set(selectedClearIds);
  const visibleClearIds = visibleClearApplicants.map((applicant) => `${applicant.type}:${applicant.id}`);
  const allVisibleClearSelected = visibleClearIds.length > 0 &&
    visibleClearIds.every((id) => selectedClearSet.has(id));
  const [feedback, setFeedback] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const guestStepLabel: Record<number, string> = {
    0: 'Personal information',
    1: 'Next of kin',
    2: 'Education',
    3: 'Work information',
    6: 'Bank details',
    7: 'Application review',
  };
  const progressLabel = (application: AdminGuestPreapplication) => {
    const uploaded = application.evidence.filter((item) => item.uploadedAt);
    const hasFront = uploaded.some((item) => item.evidenceSlot === 'identity_front');
    const hasVideo = uploaded.some((item) => item.evidenceSlot === 'verification_video');
    if (application.reviewReady) return 'Ready for review · applicant has not submitted';
    const missing = [
      !application.hasPin && 'category PIN',
      !hasFront && 'identity front',
      !hasVideo && 'verification video',
    ].filter(Boolean);
    const detailStatus = application.detailsComplete
      ? 'Details complete'
      : `Saved through: ${copyText(
        portalSettings.data,
        `workflow-step-${Math.min(8, Math.max(1, application.currentStep + 1))}`,
        'title',
        guestStepLabel[application.currentStep] ?? 'Category details',
      )}`;
    return `${detailStatus} · email not verified · ${missing.length ? `missing ${missing.join(', ')}` : 'not submitted'}`;
  };

  const setApplicationStatus = (application: AdminGuestPreapplication, nextStatus: 'contacted' | 'closed') => {
    setFeedback('');
    setFeedbackIsError(false);
    update.mutate({ applicationId: application.id, data: { status: nextStatus } }, {
      onSuccess: () => {
        setFeedback(`${application.reference} marked ${nextStatus}.`);
        void queryClient.invalidateQueries({ queryKey: getListAdminGuestPreapplicationsQueryKey() });
      },
      onError: () => {
        setFeedbackIsError(true);
        setFeedback(`The status for ${application.reference} could not be updated. Please try again.`);
      },
    });
  };

  const openClearRecords = () => {
    setClearSearch('');
    setSelectedClearIds([]);
    setFeedback('');
    setFeedbackIsError(false);
    setClearDialogOpen(true);
  };

  const toggleClearApplicant = (key: string) => {
    setSelectedClearIds((current) =>
      current.includes(key) ? current.filter((id) => id !== key) : [...current, key],
    );
  };

  const toggleVisibleClearApplicants = () => {
    setSelectedClearIds((current) => {
      if (allVisibleClearSelected) return current.filter((id) => !visibleClearIds.includes(id));
      return [...new Set([...current, ...visibleClearIds])];
    });
  };

  const clearSelectedApplicants = () => {
    const selectedRecords = clearableApplicants.filter((applicant) =>
      selectedClearSet.has(`${applicant.type}:${applicant.id}`),
    );
    const data: ClearApplicantRecordsInput = {
      guestPreapplicationIds: selectedRecords
        .filter((record) => record.type === 'guest_preapplication')
        .map((record) => record.id),
      enrollmentApplicationIds: selectedRecords
        .filter((record) => record.type === 'enrollment_application')
        .map((record) => record.id),
    };
    if (!data.guestPreapplicationIds.length && !data.enrollmentApplicationIds.length) return;
    clearApplicantRecords.mutate({ data }, {
      onSuccess: (result) => {
        const failedIds = new Set(result.failedRecords.map((record) => `${record.type}:${record.id}`));
        void queryClient.invalidateQueries({ queryKey: getListApplicationsForReviewQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListAdminGuestPreapplicationsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
        if (result.failedRecords.length) {
          setSelectedClearIds([...failedIds]);
          setFeedback(`${result.clearedCount} applicant record${result.clearedCount === 1 ? '' : 's'} cleared. ${result.failedRecords.length} could not be cleared; retry or deselect them.`);
          setFeedbackIsError(true);
          return;
        }
        setFeedback(`${result.clearedCount} applicant record${result.clearedCount === 1 ? '' : 's'} cleared.`);
        setFeedbackIsError(false);
        setSelectedClearIds([]);
        setClearDialogOpen(false);
      },
      onError: () => {
        setFeedback('The selected applicant records could not be cleared. Please retry.');
        setFeedbackIsError(true);
      },
    });
  };

  if (!canReview) return <main className="signedout-page portal-frame"><PortalWordmark /><div className="signedout-card">
    <span className="state-icon"><LockKeyhole size={21} /></span><div className="eyebrow">RESTRICTED WORKSPACE</div>
    <h1>Reviewer access required</h1><p>Guest application review is available to authorized administrators and sub-administrators.</p>
    <Link href="/admin/support" className="button button-primary" data-testid="link-guest-followup-return">Return to staff workspace <ArrowRight size={15} /></Link>
  </div></main>;

  return <AdminShell active="review">
    <div className="admin-page guest-admin-page">
      <PageHeading
        eyebrow={copyText(portalSettings.data, 'admin-review', 'sectionIdLabel', 'SECURE STAFF WORKSPACE')}
        title={copyText(portalSettings.data, 'admin-review', 'title', 'Applicants')}
        detail={copyText(portalSettings.data, 'admin-review', 'description', 'Review submitted enrollments and saved guest drafts in one place.')}
        action={<div className="server-access"><span className="server-dot" /> Service access</div>}
      />
      <div className="admin-toolbar">
        <label className="searchbox"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicant, email, category, or reference" aria-label="Search all applicants" data-testid="input-applicants-search" /><span className="search-shortcut">⌘ K</span></label>
        <label className="filter-select"><span className="sr-only">Filter applicants by status</span><select value={status} onChange={(event) => setStatus(event.target.value)} data-testid="select-applicants-status">
          <option value="">All statuses</option><option value="draft">In progress</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="needs_information">Needs information</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="received">Guest draft: received</option><option value="contacted">Guest draft: contacted</option><option value="closed">Guest draft: closed</option>
         </select><ChevronDown size={15} /></label>
        <button type="button" className="button button-quiet clear-record-trigger" onClick={openClearRecords} data-testid="button-clear-records">
          <Trash2 size={15} /> Clear record
        </button>
      </div>
      {clearDialogOpen && <div className="clear-record-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !clearApplicantRecords.isPending) setClearDialogOpen(false);
      }}>
        <section className="clear-record-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-record-title" data-testid="dialog-clear-records">
          <header className="clear-record-dialog-head">
            <div><span className="eyebrow">RECORD MANAGEMENT</span><h2 id="clear-record-title">Select applicant records</h2></div>
            <button type="button" className="modal-close" onClick={() => setClearDialogOpen(false)} disabled={clearApplicantRecords.isPending} aria-label="Close applicant selection">×</button>
          </header>
          <p className="clear-record-warning"><Trash2 size={16} /> Clearing permanently deletes selected applicant details and their private evidence. This cannot be undone.</p>
          <label className="searchbox clear-record-search"><Search size={16} /><input type="search" value={clearSearch} onChange={(event) => setClearSearch(event.target.value)} placeholder="Search applicants, email, category, or reference" aria-label="Search records to clear" data-testid="input-clear-record-search" /></label>
          <div className="clear-record-select-all">
            <label><input type="checkbox" checked={allVisibleClearSelected} onChange={toggleVisibleClearApplicants} disabled={!visibleClearApplicants.length || clearApplicantRecords.isPending} /> Select all shown</label>
            <span>{selectedClearIds.length} selected · {clearableApplicants.length} total</span>
          </div>
          <div className="clear-record-list" data-testid="clear-record-list">
            {allApplicationsForClear.isLoading || applications.isLoading
              ? <LoadingPanel label="Loading applicant records" />
              : !clearableApplicants.length
                ? <EmptyPanel title="No applicant records" message="There are no records available to clear." />
                : !visibleClearApplicants.length
                  ? <EmptyPanel title="No matching records" message="Try a different search term." />
                  : visibleClearApplicants.map((applicant) => {
                    const key = `${applicant.type}:${applicant.id}`;
                    return <label className="clear-record-row" key={key} data-testid={`clear-record-row-${applicant.id}`}>
                      <input type="checkbox" checked={selectedClearSet.has(key)} onChange={() => toggleClearApplicant(key)} disabled={clearApplicantRecords.isPending} />
                      <span className="clear-record-row-info"><strong>{applicant.fullName}</strong><small>{applicant.email} · {applicant.categoryName}</small></span>
                      <span className="clear-record-row-status"><strong>{applicant.status}</strong><small>{applicant.reference}</small></span>
                    </label>;
                  })}
          </div>
          {feedback && <p className={feedbackIsError ? 'inline-error' : 'inline-success'} role="status" data-testid="clear-record-feedback">{feedback}</p>}
          <footer className="clear-record-dialog-actions">
            <button type="button" className="button button-quiet" onClick={() => setClearDialogOpen(false)} disabled={clearApplicantRecords.isPending}>Cancel</button>
            <button type="button" className="button button-danger" onClick={clearSelectedApplicants} disabled={!selectedClearIds.length || clearApplicantRecords.isPending} data-testid="button-confirm-clear-records">
              <Trash2 size={15} /> {clearApplicantRecords.isPending ? 'Clearing…' : `Clear selected (${selectedClearIds.length})`}
            </button>
          </footer>
        </section>
      </div>}
      <section className="queue-card" aria-label="Submitted and account-based applications" data-testid="applicants-enrollment-list">
        <div className="queue-card-head"><div><b>Enrollment applications</b><span>Submitted applications and signed-in drafts</span></div><span className="queue-count" data-testid="text-applicants-enrollment-count">{submittedApplications.isLoading ? '…' : matchingEnrollmentApplications.length}</span></div>
        {submittedApplications.isLoading ? <LoadingPanel label="Loading enrollment applications" /> :
          submittedApplications.isError ? <section className="state-card" role="alert"><h2>Enrollment applications unavailable</h2><p>Submitted applications could not be loaded.</p><button className="text-action" type="button" onClick={() => void submittedApplications.refetch()}>Try again <ArrowRight size={15} /></button></section> :
            matchingEnrollmentApplications.length === 0 ? <EmptyPanel title={searchTerm || status ? 'No matching applications' : 'No enrollment applications yet'} message={searchTerm || status ? 'Try changing the search or status filter.' : 'Submitted applications and signed-in drafts will appear here.'} /> :
               <div className="queue-list">{matchingEnrollmentApplications.map((application) => {
                 const categoryTitle = configuredCategoryTitle(portalSettings.data, application.categoryId, application.categoryName);
                 const entryTitle = copyText(portalSettings.data, categoryEntryScreenId(application.categoryId), 'title', 'Category entry');
                 const categoryFields = getCategoryEntryFields(application.answers, application.categoryId, portalSettings.data)
                   .map((field) => `${field.label}: ${field.value}`).join(' · ');
                 return <Link href={`/admin/applications/${application.id}`} className="queue-row" key={application.id} data-testid={`row-applicant-enrollment-${application.id}`}>
                  <span className="queue-file"><FileCheck2 size={18} /></span><span className="queue-info"><b>{application.applicantName || 'Applicant'}</b><small>{application.applicantEmail || 'No email'} · {categoryTitle} · {entryTitle} · {application.reference} · {application.status === 'draft' ? draftProgressLabel(application) : formatDate(application.submittedAt)}{categoryFields ? ` · ${categoryFields}` : ''}</small></span>
                <StatusPill status={application.status} testId={`status-applicant-enrollment-${application.id}`} /><ArrowRight size={16} className="row-arrow" />
               </Link>;
               })}</div>}
      </section>
      <section aria-labelledby="guest-drafts-heading" data-testid="applicants-guest-drafts">
      <div className="admin-section-heading"><div><span className="eyebrow">ACCOUNT-FREE APPLICATIONS</span><h2 id="guest-drafts-heading">Saved guest drafts</h2></div><span className="queue-count" data-testid="text-applicants-guest-count">{applications.isLoading ? '…' : matchingGuestApplications.length}</span></div>
      <div className="guest-admin-notice"><ShieldCheck size={18} /><div><b>Unverified drafts remain reviewable</b><p>Applicants can save all details and private evidence before account verification. Files are available only through this reviewer workspace.</p></div></div>
      {feedback && <p className={feedbackIsError ? 'inline-error' : 'inline-success'} role="status" data-testid="guest-admin-feedback">{feedback}</p>}
      {applications.isLoading ? <div className="guest-admin-loading" data-testid="guest-admin-loading"><div /><div /><div /></div> :
        applications.isError ? <section className="state-card" role="alert" data-testid="guest-admin-error">
          <span className="state-icon error-icon"><Activity size={19} /></span><h2>Follow-up list unavailable</h2>
          <p>Guest pre-applications could not be loaded. Your access has not changed.</p>
          <button className="text-action" type="button" onClick={() => void applications.refetch()} data-testid="button-retry-guest-admin">Try again <ArrowRight size={15} /></button>
        </section> : matchingGuestApplications.length === 0 ? <EmptyPanel title={searchTerm || status ? 'No matching guest drafts' : 'No guest applications yet'} message={searchTerm || status ? 'Try changing the search or status filter.' : 'New account-free applications will appear here for staff review.'} /> :
          <section className="guest-admin-list" aria-label="Guest application follow-up list" data-testid="guest-admin-list">
            <div className="guest-admin-list-head"><span>APPLICANT</span><span>CONTACT</span><span>CATEGORY / REFERENCE</span><span>STATUS</span><span>FOLLOW-UP</span></div>
            {matchingGuestApplications.map((application) => <article className="guest-admin-row" key={application.id} data-testid={`row-guest-preapplication-${application.id}`}>
              <div className="guest-admin-name"><strong>{application.fullName}</strong><small>Received {formatDate(application.createdAt)}</small></div>
              <div className="guest-admin-contact"><a href={`mailto:${application.email}`} data-testid={`link-guest-email-${application.id}`}>{application.email}</a>{application.phone
                ? <a href={`tel:${application.phone.replace(/[^\d+]/g, '')}`} data-testid={`link-guest-phone-${application.id}`}>{application.phone}</a>
                : <small>No phone provided</small>}</div>
               <div className="guest-admin-category"><strong>{configuredCategoryTitle(portalSettings.data, application.categoryId, application.categoryName)}</strong>
                 <small>{copyText(portalSettings.data, categoryEntryScreenId(application.categoryId), 'title', 'Category entry')}</small>
                 <small>{application.reference}</small>
                 <small>{getCategoryEntryFields(application.answers, application.categoryId, portalSettings.data).map((field) => `${field.label}: ${field.value}`).join(' · ')}</small>
               </div>
              <div className="guest-admin-status"><StatusPill status={application.status} testId={`status-guest-preapplication-${application.id}`} /><small>NOT SUBMITTED · EMAIL {application.emailVerified ? 'VERIFIED' : 'NOT VERIFIED'}</small><small>{progressLabel(application)}</small></div>
              <div className="guest-admin-actions">
                <Link href={`/admin/guest-applications/${application.id}`} className="button button-primary guest-admin-action" data-testid={`link-guest-applicant-review-${application.id}`}>Review applicant</Link>
                {application.status === 'received' && <button type="button" className="button button-primary guest-admin-action" onClick={() => setApplicationStatus(application, 'contacted')} disabled={update.isPending} data-testid={`button-guest-contacted-${application.id}`}>Mark contacted</button>}
                {application.status !== 'closed' && <button type="button" className="guest-admin-close" onClick={() => setApplicationStatus(application, 'closed')} disabled={update.isPending} data-testid={`button-guest-close-${application.id}`}>Close</button>}
                {application.status === 'closed' && <span className="guest-admin-closed">Closed</span>}
              </div>
            </article>)}
          </section>}
      </section>
    </div>
  </AdminShell>;
}

function NotFound() {
  return <main className="not-found portal-frame"><div className="not-found-card"><PortalWordmark /><span className="not-found-code">404</span><h1>This page isn’t here.</h1><p>The address may have changed. Return to the enrollment portal to continue.</p><Link href="/" className="button button-primary" data-testid="link-not-found-home">Return to portal <ArrowRight size={15} /></Link></div></main>;
}

function RetiredApplicantRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/dashboard', { replace: true });
  }, [setLocation]);
  return <main className="portal-frame auth-loading"><LoadingPanel label="Opening the shared applicant dashboard" /></main>;
}

function RoutedPages() {
  const [location, setLocation] = useLocation();
  const portalSettings = useGetPortalSettings();
  const themeKey = pageThemeKeyForRoute(location);
  const pageTheme = portalSettings.data?.pageThemes?.[themeKey];
  const [reloadGuestPageToHome, setReloadGuestPageToHome] = useState(() => {
    const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const path = stripBase(window.location.pathname);
    return navigation?.type === 'reload' && ['/dashboard', '/guest/apply', '/guest/track'].includes(path);
  });
  useEffect(() => {
    if (!reloadGuestPageToHome) return;
    setLocation('/', { replace: true });
    setReloadGuestPageToHome(false);
  }, [reloadGuestPageToHome, setLocation]);
  useEffect(() => {
    const theme = portalSettings.data?.theme;
    if (!theme) return;
    document.documentElement.dataset.portalButtonSize = theme.buttonSize;
    document.documentElement.dataset.portalButtonPlacement = theme.buttonPlacement;
  }, [portalSettings.data?.theme.buttonSize, portalSettings.data?.theme.buttonPlacement]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.portalPageThemeKey = themeKey;
    const background = pageThemeBackground(pageTheme);
    if (!background || !pageTheme) {
      delete root.dataset.portalPageThemeMode;
      root.style.removeProperty('--portal-page-background');
      return;
    }
    root.dataset.portalPageThemeMode = pageTheme.mode;
    root.style.setProperty('--portal-page-background', background);
  }, [themeKey, pageTheme?.mode, pageTheme?.color, pageTheme?.blendColor, pageTheme?.angle]);
  if (reloadGuestPageToHome) return <PublicLanding />;
  return <Switch>
    <Route path="/" component={PublicLanding} />
    <Route path="/guest/apply" component={GuestApplicationRoute} />
    <Route path="/guest/track" component={GuestTrackingPage} />
    <Route path="/staff/sign-up/*?" component={StaffSignUpPage} />
    <Route path="/sign-in/*?" component={() => <AuthPage mode="in" />} />
    <Route path="/sign-up/*?" component={() => <AuthPage mode="up" />} />
    <Route path="/auth/complete" component={AuthComplete} />
    <Route path="/dashboard" component={ApplicantDashboardRoute} />
    <Route path="/apply/:applicationId" component={RetiredApplicantRoute} />
    <Route path="/applications/:applicationId" component={RetiredApplicantRoute} />
    <Route path="/support" component={() => <AuthGate><SupportPage /></AuthGate>} />
    <Route path="/admin" component={() => <AdminGate><AdminLanding /></AdminGate>} />
    <Route path="/admin/review" component={() => <AdminGate><ApplicantsPage /></AdminGate>} />
    <Route path="/admin/users" component={() => <AdminGate><AdminUsers /></AdminGate>} />
    <Route path="/admin/settings" component={() => <AdminGate><AdminSettings /></AdminGate>} />
    <Route path="/admin/email/:section?" component={() => <AdminGate><AdminEmailCenter /></AdminGate>} />
    <Route path="/admin/applications/:applicationId" component={() => <AdminGate><AdminApplicationReview /></AdminGate>} />
    <Route path="/admin/guest-applications/:applicationId" component={() => <AdminGate><AdminGuestApplicationReview /></AdminGate>} />
    <Route path="/admin/support" component={() => <AdminGate><AdminSupport /></AdminGate>} />
    <Route path="/admin/pre-applications" component={() => <AdminGate><ApplicantsPage /></AdminGate>} />
    <Route component={NotFound} />
  </Switch>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const client = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  const activeUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && userId) {
      if (activeUserId.current && activeUserId.current !== userId) {
        clearSessionDrafts(activeUserId.current);
      }
      activeUserId.current = userId;
      return;
    }
    if (activeUserId.current) clearSessionDrafts(activeUserId.current);
    activeUserId.current = null;
  }, [isLoaded, isSignedIn, userId]);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUser.current !== undefined && previousUser.current !== userId) {
        if (previousUser.current) clearSessionDrafts(previousUser.current);
        client.clear();
      }
      previousUser.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your account' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Begin your enrollment securely' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}><PortalSettingsLiveSync /><ClerkQueryClientCacheInvalidator /><RoutedPages /></QueryClientProvider>
  </ClerkProvider>;
}

function PortalSettingsLiveSync() {
  useGetPortalSettings({
    query: {
      queryKey: getGetPortalSettingsQueryKey(),
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
    request: { cache: 'no-store' },
  });
  return null;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>;
}

export default App;
