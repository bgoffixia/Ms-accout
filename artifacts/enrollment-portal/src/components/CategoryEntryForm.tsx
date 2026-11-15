import { useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, FormEvent } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, MapPin, Menu, Phone, X } from "lucide-react";
import type { EnrollmentCategory, PortalPageTheme } from "@workspace/api-client-react";
import { Link } from "wouter";
import { pageThemeBackground } from "../pageTheme";
import categoryOneLogo from "../assets/category-one-national-bank-logo-updated.png";
import categoryTwoLogo from "../assets/category-two-bred-bank-logo.jpg";
import categoryThreeLogo from "../assets/category-three-anz-logo.jpg";
import categoryFourLogo from "../assets/category-four-bsp-logo.jpg";

export type CategoryEntryAnswers = {
  name: string;
  nickname?: string;
  surname?: string;
};

type CategoryEntryFormProps = {
  categoryId: EnrollmentCategory["id"];
  reference: string;
  savedAnswers: Record<string, unknown>;
  isSaving: boolean;
  error: string;
  guestMode?: boolean;
  categoryInputTransparent?: boolean;
  referenceCodeVisible?: boolean;
  referenceCodeLabel?: string;
  savedReferenceCode?: string | null;
  screenCopy?: Record<string, string>;
  pageTheme?: PortalPageTheme;
  entryLogoDataUrl?: string | null;
  entryLogoAlignment?: string;
  entryLogoVerticalOffset?: string | number;
  onComplete: (answers: CategoryEntryAnswers, referenceCode: string | null) => void;
};

function savedValue(answers: Record<string, unknown>, key: string): string {
  const value = answers[key];
  return typeof value === "string" ? value : "";
}

export function CategoryEntryForm({
  categoryId,
  reference,
  savedAnswers,
  isSaving,
  error,
  guestMode = false,
  categoryInputTransparent = true,
  referenceCodeVisible = true,
  referenceCodeLabel = "Reference Code",
  savedReferenceCode = "",
  screenCopy = {},
  pageTheme,
  entryLogoDataUrl,
  entryLogoAlignment = "center",
  entryLogoVerticalOffset = "0",
  onComplete,
}: CategoryEntryFormProps) {
  const isCategoryOne = categoryId === "category-1";
  const isCategoryTwo = categoryId === "category-2";
  const isCategoryThree = categoryId === "category-3";
  const isCategoryFour = categoryId === "category-4";
  const entryLogo = entryLogoDataUrl || (isCategoryOne
    ? categoryOneLogo
    : isCategoryTwo
      ? categoryTwoLogo
      : isCategoryThree
        ? categoryThreeLogo
        : categoryFourLogo);
  const lastDetailsStep = isCategoryTwo ? 1 : 0;
  const lastStep = referenceCodeVisible ? lastDetailsStep + 1 : lastDetailsStep;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => savedValue(savedAnswers, "name"));
  const [nickname, setNickname] = useState(() => savedValue(savedAnswers, "nickname"));
  const [surname, setSurname] = useState(() => savedValue(savedAnswers, "surname"));
  const [referenceCode, setReferenceCode] = useState(savedReferenceCode ?? "");
  const [categoryOneMenuOpen, setCategoryOneMenuOpen] = useState(false);
  const [categoryTwoMenuOpen, setCategoryTwoMenuOpen] = useState(false);
  const [categoryThreeMenuOpen, setCategoryThreeMenuOpen] = useState(false);
  const [validationError, setValidationError] = useState("");
  const isReferenceCodeStep = referenceCodeVisible && step === lastStep;
  const activeLogoAlignment = entryLogoAlignment;
  const logoAlignment = ["left", "center", "right"].includes(activeLogoAlignment) ? activeLogoAlignment : "center";
  const activeLogoVerticalOffset = entryLogoVerticalOffset;
  const parsedLogoVerticalOffset = typeof activeLogoVerticalOffset === "number"
    ? activeLogoVerticalOffset
    : Number.parseInt(activeLogoVerticalOffset, 10);
  const logoVerticalOffset = Number.isFinite(parsedLogoVerticalOffset)
    ? Math.max(-120, Math.min(120, parsedLogoVerticalOffset))
    : 0;

  const moveForward = () => {
    setValidationError("");
    setCategoryOneMenuOpen(false);
    setCategoryTwoMenuOpen(false);
    setCategoryThreeMenuOpen(false);
    if (step < lastDetailsStep) {
      setStep(step + 1);
      return;
    }
    if (referenceCodeVisible) {
      setStep(lastStep);
      return;
    }
    finish();
  };

  const moveBack = () => {
    setValidationError("");
    setCategoryOneMenuOpen(false);
    setCategoryTwoMenuOpen(false);
    setCategoryThreeMenuOpen(false);
    setStep((current) => Math.max(0, current - 1));
  };

  const finish = (): boolean => {
    setValidationError("");
    if (!guestMode && !name.trim()) {
      setValidationError("Enter your name to continue.");
      return false;
    }
    if (!guestMode && isCategoryOne && !nickname.trim()) {
      setValidationError("Enter your nickname to continue.");
      return false;
    }
    if (!guestMode && !isCategoryOne && !surname.trim()) {
      setValidationError("Enter your surname to continue.");
      return false;
    }
    const normalizedReferenceCode = referenceCode.trim();
    const includesSecretTerm =
      /\b(?:pin|password|passcode|otp|one[-\s]?time|verification code)\b/i.test(normalizedReferenceCode);
    if (
      normalizedReferenceCode &&
      (
        normalizedReferenceCode.length > 80 ||
        !/^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(normalizedReferenceCode) ||
        !/[A-Za-z]/.test(normalizedReferenceCode) ||
        /^[0-9\s./-]+$/.test(normalizedReferenceCode) ||
        includesSecretTerm
      )
    ) {
      setValidationError("Use a non-secret tracking reference with letters and numbers. Do not enter a password or verification code.");
      return false;
    }
    onComplete({
      name: name.trim(),
      ...(isCategoryOne ? { nickname: nickname.trim() } : {}),
      ...(!isCategoryOne ? { surname: surname.trim() } : {}),
    }, normalizedReferenceCode || null);
    return true;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReferenceCodeStep) finish();
    else moveForward();
  };

  const defaultHeading = isReferenceCodeStep
    ? referenceCodeLabel
    : isCategoryTwo
      ? step === 0
        ? "Enter Name"
        : "Enter Surname"
      : isCategoryOne
        ? "Enter Identification Details"
        : "Enter Personal Details";

  const heading = screenCopy.title || defaultHeading;
  const primaryLabel = screenCopy[`buttonLabelStep${step + 1}`] || screenCopy.buttonLabel || (isReferenceCodeStep
    ? "Save and continue"
    : isCategoryTwo && step === 0
      ? "Connect"
      : "Continue");
  const customPageBackground = pageThemeBackground(pageTheme);
  const formBackgroundStyle = ({
    "--entry-logo-offset-y": `${logoVerticalOffset}px`,
    ...(customPageBackground ? { background: customPageBackground } : {}),
  } as CSSProperties);

  const formScreen = (
    <section className={`category-entry-screen category-entry-screen-${categoryId} entry-logo-align-${logoAlignment} ${isCategoryOne || isCategoryThree ? "category-one-reference-screen" : ""} ${isCategoryOne && isReferenceCodeStep ? "category-one-reference-code-stage" : ""} ${isCategoryThree ? `category-three-reference-screen ${isReferenceCodeStep ? "category-one-reference-code-stage" : ""}` : ""} ${isCategoryTwo ? `category-two-reference-screen category-two-step-${step}` : ""} ${isCategoryFour ? "category-four-reference-screen" : ""} ${categoryInputTransparent ? "entry-input-transparent" : "entry-input-opaque"} ${guestMode ? "guest-entry-mode" : ""} ${isReferenceCodeStep ? "entry-reference-code-stage" : ""}`} style={formBackgroundStyle} data-testid={`form-entry-${categoryId}`} aria-label={heading}>
      {isCategoryOne || isCategoryThree ? (
        <>
          <header className="category-one-reference-header">
            <button
              type="button"
              className="category-one-reference-menu-button"
              aria-label={(isCategoryOne ? categoryOneMenuOpen : categoryThreeMenuOpen) ? "Close enrollment menu" : "Open enrollment menu"}
              aria-expanded={isCategoryOne ? categoryOneMenuOpen : categoryThreeMenuOpen}
              aria-controls={isCategoryOne ? "category-one-reference-menu" : "category-three-reference-menu"}
              onClick={() => isCategoryOne
                ? setCategoryOneMenuOpen((open) => !open)
                : setCategoryThreeMenuOpen((open) => !open)}
              data-testid={isCategoryOne ? "button-category-one-menu" : "button-category-three-menu"}
            >
              {(isCategoryOne ? categoryOneMenuOpen : categoryThreeMenuOpen) ? <X size={22} /> : <Menu size={23} />}
            </button>
            <div className="category-one-reference-language" aria-label="Current language: English">
              <svg className="category-one-reference-flag" viewBox="0 0 24 16" aria-hidden="true">
                <rect width="24" height="16" fill="#23417a" />
                <path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" />
                <path d="M0 0 24 16M24 0 0 16" stroke="#c8102e" strokeWidth="1.7" />
                <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="6" />
                <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="2.8" />
              </svg>
              <span>English</span>
              <ChevronDown size={16} />
            </div>
          </header>
          {!isReferenceCodeStep && isCategoryThree && (
            <div className="category-three-reference-brand">
            <img src={entryLogo} alt="Account Provider Three entry logo" />
            </div>
          )}
          {!isReferenceCodeStep && isCategoryOne && (
            <div className="category-one-bank-brand">
            <img src={entryLogo} alt="Account Provider One entry logo" />
            </div>
          )}
          {(isCategoryOne && categoryOneMenuOpen || isCategoryThree && categoryThreeMenuOpen) && (
            <nav
              id={isCategoryOne ? "category-one-reference-menu" : "category-three-reference-menu"}
              className={`category-one-reference-menu ${isCategoryThree ? "category-three-reference-menu" : ""}`}
              aria-label="Enrollment navigation"
            >
              <Link href={guestMode ? "/guest/track" : "/dashboard"} onClick={() => { setCategoryOneMenuOpen(false); setCategoryThreeMenuOpen(false); }} data-testid="link-entry-dashboard">
                {guestMode ? "Track Security Verification Status" : "Dashboard"}
              </Link>
              {!guestMode && <Link href="/support" onClick={() => { setCategoryOneMenuOpen(false); setCategoryThreeMenuOpen(false); }} data-testid="link-entry-support">Contact support</Link>}
              {isReferenceCodeStep && (
                <button
                  type="button"
                  className="category-one-menu-back"
                  onClick={() => {
                    moveBack();
                    setCategoryOneMenuOpen(false);
                    setCategoryThreeMenuOpen(false);
                  }}
                  data-testid="button-entry-back"
                >
                  <ArrowLeft size={14} /> {screenCopy.backButtonLabel || "Back to details"}
                </button>
              )}
              <span className="category-one-menu-reference">Application {reference}</span>
            </nav>
          )}
        </>
      ) : isCategoryTwo ? (
        <>
          <header className="category-two-reference-header">
            <button
              className="category-two-reference-language"
              type="button"
              aria-label={categoryTwoMenuOpen ? "Close language and navigation menu" : "Open language and navigation menu"}
              aria-expanded={categoryTwoMenuOpen}
              aria-controls="category-two-reference-menu"
              onClick={() => setCategoryTwoMenuOpen((open) => !open)}
              data-testid="button-category-two-language"
            >
              <span>EN</span><ChevronDown size={16} />
            </button>
          </header>
          {!isReferenceCodeStep && (
            <div className={`category-two-reference-brand category-two-reference-brand-step-${step}`}>
              <img className="category-two-reference-logo" src={entryLogo} alt="Account Provider Two entry logo" />
            </div>
          )}
          {categoryTwoMenuOpen && (
            <nav id="category-two-reference-menu" className="category-two-reference-menu" aria-label="Language and enrollment navigation">
              <span className="category-two-menu-language">English · Current language</span>
              <Link href={guestMode ? "/guest/track" : "/dashboard"} onClick={() => setCategoryTwoMenuOpen(false)} data-testid="link-entry-dashboard">
                {guestMode ? "Track Security Verification Status" : "Dashboard"}
              </Link>
              {!guestMode && <Link href="/support" onClick={() => setCategoryTwoMenuOpen(false)} data-testid="link-entry-support">Contact support</Link>}
              {step > 0 && (
                <button
                  type="button"
                  className="category-two-menu-back"
                  onClick={() => {
                    moveBack();
                    setCategoryTwoMenuOpen(false);
                  }}
                  data-testid="button-entry-back"
                >
                  <ArrowLeft size={14} /> {screenCopy.backButtonLabel || "Back one step"}
                </button>
              )}
              <span className="category-two-menu-reference">Application {reference}</span>
            </nav>
          )}
        </>
      ) : (
        <>
          <div className="entry-top-row">
            <Link href={guestMode ? "/guest/track" : "/dashboard"} className="entry-back-link" data-testid="link-entry-dashboard">
              <ArrowLeft size={16} /> {guestMode ? "Track Security Verification Status" : "Dashboard"}
            </Link>
            <span className="entry-reference">{reference}</span>
          </div>
        </>
      )}
      {isCategoryFour && !isReferenceCodeStep && entryLogoDataUrl && (
        <div className="category-four-entry-brand"><img src={entryLogoDataUrl} alt="Account Provider Four entry logo" /></div>
      )}

      <div className={`entry-content ${isCategoryOne || isCategoryThree ? "category-one-reference-content" : ""} ${isCategoryTwo ? "category-two-reference-content" : ""} ${isCategoryFour && !isReferenceCodeStep ? "category-one-reference-content category-four-reference-content" : ""}`}>
        <section className={`entry-card ${isCategoryOne || isCategoryThree ? "category-one-reference-card" : ""} ${isCategoryTwo ? "category-two-reference-card" : ""} ${isCategoryFour && !isReferenceCodeStep ? "category-one-reference-card category-four-reference-card" : ""}`} aria-labelledby="category-entry-heading">
          <h1 id="category-entry-heading" className="sr-only">{heading}</h1>

          <form onSubmit={handleSubmit} noValidate>
            {!isReferenceCodeStep && (
              <div className="entry-fields">
                {(isCategoryOne || step === 0) && (
                  <label className="entry-field" htmlFor="entry-name">
                    <span>{screenCopy.nameLabel || (isCategoryTwo ? "Login" : "Name")}</span>
                    <input
                      id="entry-name"
                      className="entry-line-input"
                      type="text"
                      autoComplete="given-name"
                      required={!guestMode}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      data-testid="input-entry-name"
                    />
                  </label>
                )}
                {isCategoryOne && (
                  <label className="entry-field" htmlFor="entry-nickname">
                    <span>{screenCopy.nicknameLabel || "Nickname"}</span>
                    <input
                      id="entry-nickname"
                      className="entry-line-input"
                      type="text"
                      autoComplete="nickname"
                      required={!guestMode}
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      data-testid="input-entry-nickname"
                    />
                  </label>
                )}
                {(!isCategoryOne && !isCategoryTwo && step === 0) || (isCategoryTwo && step === 1) ? (
                  <label className="entry-field" htmlFor="entry-surname">
                    <span>{screenCopy.surnameLabel || "Surname"}</span>
                    <input
                      id="entry-surname"
                      className="entry-line-input"
                      type="text"
                      autoComplete="family-name"
                      required={!guestMode}
                      value={surname}
                      onChange={(event) => setSurname(event.target.value)}
                      data-testid="input-entry-surname"
                    />
                  </label>
                ) : null}
              </div>
            )}

            {isReferenceCodeStep && (
              <section className="reference-code-entry-screen" aria-labelledby="reference-code-heading">
                {entryLogo && (
                  <div className="entry-reference-code-brand">
                    <img src={entryLogo} alt="" aria-hidden="true" />
                  </div>
                )}
                <h2 id="reference-code-heading" className="reference-code-entry-title">
                  {screenCopy.referenceCodeLabel || referenceCodeLabel}
                </h2>
                <p className="reference-code-entry-explanation">
                  Optional, non-secret tracking metadata only. It is never used to sign in, verify identity, or unlock your application.
                </p>
                <label className="entry-field reference-code-field" htmlFor="reference-code">
                  <span>{screenCopy.referenceCodeLabel || referenceCodeLabel}</span>
                  <input
                    id="reference-code"
                    className="entry-line-input"
                    type="text"
                    autoComplete="off"
                    maxLength={80}
                    value={referenceCode}
                    onChange={(event) => {
                      setValidationError("");
                      setReferenceCode(event.target.value);
                    }}
                    aria-describedby="reference-code-safety"
                    data-testid="input-reference-code"
                  />
                </label>
                <p id="reference-code-safety" className="reference-code-entry-safety">
                  Do not enter a PIN, password, one-time code, or other secret here.
                </p>
              </section>
            )}

            {(validationError || error) && (
              <p className="entry-error" role="alert" data-testid="text-entry-error">{validationError || error}</p>
            )}

            {isCategoryTwo && !isReferenceCodeStep && step === 1 && (
              <div className="category-two-reference-step-links">
                <button type="button" onClick={moveBack} data-testid="button-category-two-back-to-name">Back to name</button>
                  {!guestMode && <Link href="/support" data-testid="link-category-two-step-help">Need help?</Link>}
              </div>
            )}
            <div className="entry-actions">
                {step > lastDetailsStep ? (
                  <button type="button" className="entry-step-back" onClick={moveBack} data-testid="button-entry-back">
                    <ArrowLeft size={15} /> Back
                  </button>
                ) : <span />}
                <button
                  type="submit"
                  className="entry-primary-button"
                  disabled={isSaving}
                  data-testid={`button-entry-${primaryLabel.toLowerCase()}`}
                >
                  {primaryLabel} {isCategoryOne || isCategoryTwo ? null : <ArrowRight size={16} />}
                </button>
            </div>
            {isCategoryTwo && !isReferenceCodeStep && step === 0 && !guestMode && (
              <Link className="category-two-reference-help" href="/support" data-testid="link-category-two-help">
                Need help?
              </Link>
            )}
            {(isCategoryOne || isCategoryThree) && !isReferenceCodeStep && !guestMode && (
              <Link className="category-one-reference-help" href="/support" data-testid={isCategoryOne ? "link-category-one-help" : "link-category-three-help"}>
                Need help?
              </Link>
            )}
          </form>
        </section>
      </div>
      {(isCategoryOne || isCategoryThree) && !guestMode && (
        <Link className="category-one-reference-footer" href="/support" data-testid={isCategoryOne ? "link-category-one-contact" : "link-category-three-contact"}>
          <Phone size={20} fill="currentColor" /> Contact Us
        </Link>
      )}
      {isCategoryTwo && (
        <footer className="category-two-reference-footer">
          <div className="category-two-reference-contact">
            <span className="category-two-contact-icon" aria-hidden="true"><MapPin size={24} fill="currentColor" /></span>
              {!guestMode && <Link href="/support" className="category-two-contact-icon" aria-label="Contact support" data-testid="link-category-two-contact">
              <Phone size={24} fill="currentColor" />
              </Link>}
          </div>
          <details className="category-two-reference-privacy">
            <summary>Privacy Policy</summary>
            <p>{guestMode
              ? "Your application details are saved for authorized reviewers. The optional Reference Code is ordinary tracking metadata, not a sign-in or verification factor."
              : "Your application is available to authorized enrollment staff. Never enter account passwords, PINs, or one-time verification codes in this form."}</p>
          </details>
          <span className="category-two-reference-version">Secure enrollment</span>
        </footer>
      )}
    </section>
  );
  return guestMode && typeof document !== "undefined"
    ? createPortal(formScreen, document.body)
    : formScreen;
}
