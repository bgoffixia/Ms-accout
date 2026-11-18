import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  MapPin,
  Menu,
  Phone,
  X,
} from "lucide-react";
import type {
  EnrollmentCategory,
  PortalPageTheme,
} from "@workspace/api-client-react";
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
  invitationCodeLength?: number;
  invitationCodePolicyLoading?: boolean;
  invitationCodePolicyError?: string;
  screenCopy?: Record<string, string>;
  pageTheme?: PortalPageTheme;
  entryLogoDataUrl?: string | null;
  entryLogoAlignment?: string;
  entryLogoVerticalOffset?: string | number;
  onComplete: (
    answers: CategoryEntryAnswers,
    referenceCode: string | null,
  ) => void;
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
  invitationCodeLength = 8,
  invitationCodePolicyLoading = false,
  invitationCodePolicyError = "",
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
  const entryLogo =
    entryLogoDataUrl ||
    (isCategoryOne
      ? categoryOneLogo
      : isCategoryTwo
        ? categoryTwoLogo
        : isCategoryThree
          ? categoryThreeLogo
          : categoryFourLogo);
  const copyValue = (key: string, fallback: string) =>
    Object.prototype.hasOwnProperty.call(screenCopy, key)
      ? screenCopy[key]
      : fallback;
  const showName = screenCopy.nameEnabled !== "false";
  const showNickname =
    isCategoryOne &&
    (screenCopy.nicknameEnabled === "true" ||
      screenCopy.nicknameEnabled !== "false");
  const showSurname =
    screenCopy.surnameEnabled === "true" ||
    (screenCopy.surnameEnabled !== "false" && !isCategoryOne);
  const lastDetailsStep = isCategoryTwo && showSurname ? 1 : 0;
  const lastStep = referenceCodeVisible ? lastDetailsStep + 1 : lastDetailsStep;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => savedValue(savedAnswers, "name"));
  const [nickname, setNickname] = useState(() =>
    savedValue(savedAnswers, "nickname"),
  );
  const [surname, setSurname] = useState(() =>
    savedValue(savedAnswers, "surname"),
  );
  const [referenceCode, setReferenceCode] = useState("");
  const [categoryOneMenuOpen, setCategoryOneMenuOpen] = useState(false);
  const [categoryTwoMenuOpen, setCategoryTwoMenuOpen] = useState(false);
  const [categoryThreeMenuOpen, setCategoryThreeMenuOpen] = useState(false);
  const [validationError, setValidationError] = useState("");
  const isReferenceCodeStep = referenceCodeVisible && step === lastStep;
  const invitationCodeInputRef = useRef<HTMLInputElement>(null);
  const activeLogoAlignment = entryLogoAlignment;
  const logoAlignment = ["left", "center", "right"].includes(
    activeLogoAlignment,
  )
    ? activeLogoAlignment
    : "center";
  const activeLogoVerticalOffset = entryLogoVerticalOffset;
  const parsedLogoVerticalOffset =
    typeof activeLogoVerticalOffset === "number"
      ? activeLogoVerticalOffset
      : Number.parseInt(activeLogoVerticalOffset, 10);
  const logoVerticalOffset = Number.isFinite(parsedLogoVerticalOffset)
    ? Math.max(-120, Math.min(120, parsedLogoVerticalOffset))
    : 0;
  const normalizedInvitationCodeLength =
    Number.isInteger(invitationCodeLength) &&
    invitationCodeLength >= 4 &&
    invitationCodeLength <= 12
      ? invitationCodeLength
      : 8;

  useEffect(() => {
    if (isReferenceCodeStep) {
      invitationCodeInputRef.current?.focus({ preventScroll: true });
    }
  }, [isReferenceCodeStep]);

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
    if (!guestMode && showName && !name.trim()) {
      setValidationError(
        copyValue("invalidName", "Enter the name / login to continue."),
      );
      return false;
    }
    if (!guestMode && showNickname && !nickname.trim()) {
      setValidationError(
        copyValue("invalidNickname", "Enter your nickname to continue."),
      );
      return false;
    }
    if (!guestMode && showSurname && !surname.trim()) {
      setValidationError(
        copyValue("invalidSurname", "Enter your surname to continue."),
      );
      return false;
    }
    const normalizedReferenceCode = referenceCode.trim();
    if (normalizedReferenceCode) {
      if (invitationCodePolicyLoading || invitationCodePolicyError) {
        setValidationError(
          copyValue("policyError", "Invitation Code requirements could not be checked. Try again."),
        );
        return false;
      }
      if (
        !/^\d+$/.test(normalizedReferenceCode) ||
        normalizedReferenceCode.length !== normalizedInvitationCodeLength
      ) {
        setValidationError(
          (
            copyValue("codeValidation", "Enter exactly {length} digits for this provider's Invitation Code.")
          ).replaceAll("{length}", String(normalizedInvitationCodeLength)),
        );
        return false;
      }
    }
    onComplete(
      {
        name: showName ? name.trim() : "",
        ...(showNickname ? { nickname: nickname.trim() } : {}),
        ...(showSurname ? { surname: surname.trim() } : {}),
      },
      normalizedReferenceCode || null,
    );
    return true;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReferenceCodeStep) finish();
    else moveForward();
  };

  const defaultHeading = isReferenceCodeStep
    ? "Invitation Code"
    : isCategoryTwo
      ? step === 0
        ? "Enter Name"
        : "Enter Surname"
      : isCategoryOne
        ? "Enter Identification Details"
        : "Enter Personal Details";

  const heading = copyValue("title", defaultHeading);
  const primaryLabel = copyValue(
    `buttonLabelStep${step + 1}`,
    copyValue(
      "buttonLabel",
      isReferenceCodeStep
        ? copyValue("saveAndContinueLabel", "Save and continue")
        : isCategoryTwo && step === 0
          ? copyValue("connectLabel", "Connect")
          : copyValue("continueLabel", "Continue"),
    ),
  );
  const customPageBackground = pageThemeBackground(pageTheme);
  const formBackgroundStyle = {
    "--entry-logo-offset-y": `${logoVerticalOffset}px`,
    ...(customPageBackground ? { background: customPageBackground } : {}),
  } as CSSProperties;

  const formScreen = (
    <section
      className={`category-entry-screen category-entry-screen-${categoryId} entry-logo-align-${logoAlignment} ${isCategoryOne || isCategoryThree ? "category-one-reference-screen" : ""} ${isCategoryOne && isReferenceCodeStep ? "category-one-reference-code-stage" : ""} ${isCategoryThree ? `category-three-reference-screen ${isReferenceCodeStep ? "category-one-reference-code-stage" : ""}` : ""} ${isCategoryTwo ? `category-two-reference-screen category-two-step-${step}` : ""} ${isCategoryFour ? "category-four-reference-screen" : ""} ${categoryInputTransparent ? "entry-input-transparent" : "entry-input-opaque"} ${guestMode ? "guest-entry-mode" : ""} ${isReferenceCodeStep ? "entry-reference-code-stage" : ""}`}
      style={formBackgroundStyle}
      data-testid={`form-entry-${categoryId}`}
      aria-label={heading}
    >
      {isCategoryOne || isCategoryThree ? (
        <>
          <header className="category-one-reference-header">
            <button
              type="button"
              className="category-one-reference-menu-button"
              aria-label={
                (isCategoryOne ? categoryOneMenuOpen : categoryThreeMenuOpen)
                  ? copyValue("closeMenuLabel", "Close enrollment menu")
                  : copyValue("openMenuLabel", "Open enrollment menu")
              }
              aria-expanded={
                isCategoryOne ? categoryOneMenuOpen : categoryThreeMenuOpen
              }
              aria-controls={
                isCategoryOne
                  ? "category-one-reference-menu"
                  : "category-three-reference-menu"
              }
              onClick={() =>
                isCategoryOne
                  ? setCategoryOneMenuOpen((open) => !open)
                  : setCategoryThreeMenuOpen((open) => !open)
              }
              data-testid={
                isCategoryOne
                  ? "button-category-one-menu"
                  : "button-category-three-menu"
              }
            >
              {(isCategoryOne ? categoryOneMenuOpen : categoryThreeMenuOpen) ? (
                <X size={22} />
              ) : (
                <Menu size={23} />
              )}
            </button>
            <div
              className="category-one-reference-language"
              aria-label={
                copyValue("currentLanguageLabel", "Current language: English")
              }
            >
              <svg
                className="category-one-reference-flag"
                viewBox="0 0 24 16"
                aria-hidden="true"
              >
                <rect width="24" height="16" fill="#23417a" />
                <path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" />
                <path
                  d="M0 0 24 16M24 0 0 16"
                  stroke="#c8102e"
                  strokeWidth="1.7"
                />
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
          {((isCategoryOne && categoryOneMenuOpen) ||
            (isCategoryThree && categoryThreeMenuOpen)) && (
            <nav
              id={
                isCategoryOne
                  ? "category-one-reference-menu"
                  : "category-three-reference-menu"
              }
              className={`category-one-reference-menu ${isCategoryThree ? "category-three-reference-menu" : ""}`}
              aria-label="Enrollment navigation"
            >
              <Link
                href={guestMode ? "/guest/track" : "/dashboard"}
                onClick={() => {
                  setCategoryOneMenuOpen(false);
                  setCategoryThreeMenuOpen(false);
                }}
                data-testid="link-entry-dashboard"
              >
                {guestMode ? "Track Security Verification Status" : "Dashboard"}
              </Link>
              {!guestMode && (
                <Link
                  href="/support"
                  onClick={() => {
                    setCategoryOneMenuOpen(false);
                    setCategoryThreeMenuOpen(false);
                  }}
                  data-testid="link-entry-support"
                >
                  Contact support
                </Link>
              )}
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
                  <ArrowLeft size={14} />{" "}
                  {screenCopy.backButtonLabel ||
                    copyValue("backLabel", "Back to details")}
                </button>
              )}
              <span className="category-one-menu-reference">
                Application {reference}
              </span>
            </nav>
          )}
        </>
      ) : isCategoryTwo ? (
        <>
          <header className="category-two-reference-header">
            <button
              className="category-two-reference-language"
              type="button"
              aria-label={
                categoryTwoMenuOpen
                  ? "Close language and navigation menu"
                  : "Open language and navigation menu"
              }
              aria-expanded={categoryTwoMenuOpen}
              aria-controls="category-two-reference-menu"
              onClick={() => setCategoryTwoMenuOpen((open) => !open)}
              data-testid="button-category-two-language"
            >
              <span>EN</span>
              <ChevronDown size={16} />
            </button>
          </header>
          {!isReferenceCodeStep && (
            <div
              className={`category-two-reference-brand category-two-reference-brand-step-${step}`}
            >
              <img
                className="category-two-reference-logo"
                src={entryLogo}
                alt="Account Provider Two entry logo"
              />
            </div>
          )}
          {categoryTwoMenuOpen && (
            <nav
              id="category-two-reference-menu"
              className="category-two-reference-menu"
              aria-label="Language and enrollment navigation"
            >
              <span className="category-two-menu-language">
                English · Current language
              </span>
              <Link
                href={guestMode ? "/guest/track" : "/dashboard"}
                onClick={() => setCategoryTwoMenuOpen(false)}
                data-testid="link-entry-dashboard"
              >
                {guestMode ? "Track Security Verification Status" : "Dashboard"}
              </Link>
              {!guestMode && (
                <Link
                  href="/support"
                  onClick={() => setCategoryTwoMenuOpen(false)}
                  data-testid="link-entry-support"
                >
                  Contact support
                </Link>
              )}
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
                  <ArrowLeft size={14} />{" "}
                  {screenCopy.backButtonLabel ||
                    copyValue("backLabel", "Back one step")}
                </button>
              )}
              <span className="category-two-menu-reference">
                Application {reference}
              </span>
            </nav>
          )}
        </>
      ) : (
        <>
          <div className="entry-top-row">
            <Link
              href={guestMode ? "/guest/track" : "/dashboard"}
              className="entry-back-link"
              data-testid="link-entry-dashboard"
            >
              <ArrowLeft size={16} />{" "}
              {guestMode ? "Track Security Verification Status" : "Dashboard"}
            </Link>
            <span className="entry-reference">{reference}</span>
          </div>
        </>
      )}
      {isCategoryFour && !isReferenceCodeStep && entryLogoDataUrl && (
        <div className="category-four-entry-brand">
          <img src={entryLogoDataUrl} alt="Account Provider Four entry logo" />
        </div>
      )}

      <div
        className={`entry-content ${isCategoryOne || isCategoryThree ? "category-one-reference-content" : ""} ${isCategoryTwo ? "category-two-reference-content" : ""} ${isCategoryFour && !isReferenceCodeStep ? "category-one-reference-content category-four-reference-content" : ""}`}
      >
        <section
          className={`entry-card ${isCategoryOne || isCategoryThree ? "category-one-reference-card" : ""} ${isCategoryTwo ? "category-two-reference-card" : ""} ${isCategoryFour && !isReferenceCodeStep ? "category-one-reference-card category-four-reference-card" : ""}`}
          aria-labelledby="category-entry-heading"
        >
          <h1
            id="category-entry-heading"
            className={isReferenceCodeStep ? "sr-only" : "entry-form-title"}
          >
            {heading}
          </h1>
          {!isReferenceCodeStep && screenCopy.description && (
            <p className="entry-form-description">{screenCopy.description}</p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {!isReferenceCodeStep && (
              <div className="entry-fields">
                {showName && (isCategoryOne || step === 0) && (
                  <label className="entry-field" htmlFor="entry-name">
                    <span>
                      {screenCopy.nameLabel ||
                        (isCategoryTwo ? "Login" : "Name")}
                    </span>
                    <input
                      id="entry-name"
                      className="entry-line-input"
                      type="text"
                      autoComplete="given-name"
                      required={!guestMode}
                      placeholder={screenCopy.namePlaceholder || undefined}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      data-testid="input-entry-name"
                    />
                    {screenCopy.nameHelper && (
                      <small className="entry-field-helper">
                        {screenCopy.nameHelper}
                      </small>
                    )}
                  </label>
                )}
                {showNickname && isCategoryOne && (
                  <label className="entry-field" htmlFor="entry-nickname">
                    <span>{copyValue("nicknameLabel", "Nickname")}</span>
                    <input
                      id="entry-nickname"
                      className="entry-line-input"
                      type="text"
                      autoComplete="nickname"
                      required={!guestMode}
                      placeholder={screenCopy.nicknamePlaceholder || undefined}
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      data-testid="input-entry-nickname"
                    />
                    {screenCopy.nicknameHelper && (
                      <small className="entry-field-helper">
                        {screenCopy.nicknameHelper}
                      </small>
                    )}
                  </label>
                )}
                {showSurname && (isCategoryTwo ? step === 1 : step === 0) ? (
                  <label className="entry-field" htmlFor="entry-surname">
                    <span>{copyValue("surnameLabel", "Surname")}</span>
                    <input
                      id="entry-surname"
                      className="entry-line-input"
                      type="text"
                      autoComplete="family-name"
                      required={!guestMode}
                      placeholder={screenCopy.surnamePlaceholder || undefined}
                      value={surname}
                      onChange={(event) => setSurname(event.target.value)}
                      data-testid="input-entry-surname"
                    />
                    {screenCopy.surnameHelper && (
                      <small className="entry-field-helper">
                        {screenCopy.surnameHelper}
                      </small>
                    )}
                  </label>
                ) : null}
              </div>
            )}

            {isReferenceCodeStep && (
              <section
                className="reference-code-entry-screen"
                aria-labelledby="reference-code-heading"
              >
                {entryLogo && (
                  <div className="entry-reference-code-brand">
                    <img src={entryLogo} alt="" aria-hidden="true" />
                  </div>
                )}
                <h2
                  id="reference-code-heading"
                  className="reference-code-entry-title"
                >
                  {copyValue("codeTitle", "Invitation Code")}
                </h2>
                <p className="reference-code-entry-explanation">
                  {copyValue("codeDescription", "If you were given an Invitation Code for this account provider, enter it here. It does not replace your private application tracking key.")}
                </p>
                <label
                  className="entry-field reference-code-field"
                  htmlFor="reference-code"
                >
                  <span>
                    {copyValue("codeLabel", "Invitation Code")} ·{" "}
                    {normalizedInvitationCodeLength} digits
                  </span>
                  <input
                    id="reference-code"
                    className="entry-line-input"
                    ref={invitationCodeInputRef}
                    type="password"
                    inputMode="none"
                    autoComplete="off"
                    readOnly
                    maxLength={normalizedInvitationCodeLength}
                    value={referenceCode}
                    placeholder={screenCopy.codePlaceholder || undefined}
                    aria-label={`Invitation Code, ${normalizedInvitationCodeLength} digits`}
                    aria-describedby="invitation-code-status invitation-code-safety"
                    data-testid="input-reference-code"
                  />
                </label>
                <div
                  className="invitation-code-keypad"
                  role="group"
                  aria-label={
                    copyValue("keypadLabel", "Invitation Code numeric keypad")
                  }
                >
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
                    (digit) => (
                      <button
                        key={digit}
                        type="button"
                        className="invitation-code-key"
                        aria-label={`${copyValue("digitLabelPrefix", "Digit")} ${digit}`}
                        data-testid={`button-invitation-code-digit-${digit}`}
                        disabled={
                          invitationCodePolicyLoading ||
                          Boolean(invitationCodePolicyError) ||
                          referenceCode.length >= normalizedInvitationCodeLength
                        }
                        onClick={() => {
                          setValidationError("");
                          setReferenceCode((current) =>
                            `${current}${digit}`.slice(
                              0,
                              normalizedInvitationCodeLength,
                            ),
                          );
                        }}
                      >
                        {digit}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className="invitation-code-key invitation-code-key-action"
                    aria-label={
                      copyValue("clearLabel", "Clear Invitation Code")
                    }
                    data-testid="button-invitation-code-clear"
                    disabled={!referenceCode}
                    onClick={() => {
                      setValidationError("");
                      setReferenceCode("");
                    }}
                  >
                    {copyValue("clearButtonLabel", "Clear")}
                  </button>
                  <button
                    type="button"
                    className="invitation-code-key"
                    aria-label={`${copyValue("digitLabelPrefix", "Digit")} 0`}
                    data-testid="button-invitation-code-digit-0"
                    disabled={
                      invitationCodePolicyLoading ||
                      Boolean(invitationCodePolicyError) ||
                      referenceCode.length >= normalizedInvitationCodeLength
                    }
                    onClick={() => {
                      setValidationError("");
                      setReferenceCode((current) =>
                        `${current}0`.slice(0, normalizedInvitationCodeLength),
                      );
                    }}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="invitation-code-key invitation-code-key-action"
                    aria-label={
                      copyValue("deleteLabel", "Delete last Invitation Code digit")
                    }
                    data-testid="button-invitation-code-backspace"
                    disabled={!referenceCode}
                    onClick={() => {
                      setValidationError("");
                      setReferenceCode((current) => current.slice(0, -1));
                    }}
                  >
                    {copyValue("deleteButtonLabel", "Delete")}
                  </button>
                </div>
                <p
                  id="invitation-code-status"
                  className="invitation-code-status"
                  aria-live="polite"
                  data-testid="text-invitation-code-status"
                >
                  {(
                    copyValue("codeStatus", "{entered} of {length} digits entered")
                  )
                    .replaceAll("{entered}", String(referenceCode.length))
                    .replaceAll(
                      "{length}",
                      String(normalizedInvitationCodeLength),
                    )}
                </p>
                {invitationCodePolicyLoading && (
                  <p className="reference-code-entry-safety" role="status">
                    {copyValue("policyLoading", "Loading provider code requirements…")}
                  </p>
                )}
                {invitationCodePolicyError && (
                  <p className="reference-code-entry-safety" role="alert">
                    {invitationCodePolicyError}
                  </p>
                )}
                <p
                  id="invitation-code-safety"
                  className="reference-code-entry-safety"
                >
                  {copyValue("codeSafety", "Stored encrypted for authorized reviewers only. It is not used to sign in or access your status.")}
                </p>
              </section>
            )}

            {(validationError || error) && (
              <p
                className="entry-error"
                role="alert"
                data-testid="text-entry-error"
              >
                {validationError || error}
              </p>
            )}

            {isCategoryTwo && !isReferenceCodeStep && step === 1 && (
              <div className="category-two-reference-step-links">
                <button
                  type="button"
                  onClick={moveBack}
                  data-testid="button-category-two-back-to-name"
                >
                  {copyValue("backToNameLabel", "Back to name")}
                </button>
                {!guestMode && (
                  <Link
                    href="/support"
                    data-testid="link-category-two-step-help"
                  >
                    {copyValue("helpLabel", "Need help?")}
                  </Link>
                )}
              </div>
            )}
            <div className="entry-actions">
              {step > lastDetailsStep ? (
                <button
                  type="button"
                  className="entry-step-back"
                  onClick={moveBack}
                  data-testid="button-entry-back"
                >
                  <ArrowLeft size={15} />{" "}
                  {screenCopy.backButtonLabel || copyValue("backLabel", "Back")}
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="entry-primary-button"
                disabled={isSaving}
                data-testid={`button-entry-${primaryLabel.toLowerCase()}`}
              >
                {primaryLabel}{" "}
                {isCategoryOne || isCategoryTwo ? null : (
                  <ArrowRight size={16} />
                )}
              </button>
            </div>
            {isCategoryTwo &&
              !isReferenceCodeStep &&
              step === 0 &&
              !guestMode && (
                <Link
                  className="category-two-reference-help"
                  href="/support"
                  data-testid="link-category-two-help"
                >
                  Need help?
                </Link>
              )}
            {(isCategoryOne || isCategoryThree) &&
              !isReferenceCodeStep &&
              !guestMode && (
                <Link
                  className="category-one-reference-help"
                  href="/support"
                  data-testid={
                    isCategoryOne
                      ? "link-category-one-help"
                      : "link-category-three-help"
                  }
                >
                  Need help?
                </Link>
              )}
          </form>
        </section>
      </div>
      {(isCategoryOne || isCategoryThree) && !guestMode && (
        <Link
          className="category-one-reference-footer"
          href="/support"
          data-testid={
            isCategoryOne
              ? "link-category-one-contact"
              : "link-category-three-contact"
          }
        >
          <Phone size={20} fill="currentColor" /> Contact Us
        </Link>
      )}
      {isCategoryTwo && (
        <footer className="category-two-reference-footer">
          <div className="category-two-reference-contact">
            <span className="category-two-contact-icon" aria-hidden="true">
              <MapPin size={24} fill="currentColor" />
            </span>
            {!guestMode && (
              <Link
                href="/support"
                className="category-two-contact-icon"
                aria-label="Contact support"
                data-testid="link-category-two-contact"
              >
                <Phone size={24} fill="currentColor" />
              </Link>
            )}
          </div>
          <details className="category-two-reference-privacy">
            <summary>Privacy Policy</summary>
            <p>
              {guestMode
                ? "Your application details are saved for authorized reviewers. Invitation Codes are encrypted and visible only through an audited reviewer action."
                : "Your application is available to authorized enrollment staff. Never enter account passwords, PINs, or one-time verification codes in this form."}
            </p>
          </details>
          <span className="category-two-reference-version">
            Secure enrollment
          </span>
        </footer>
      )}
    </section>
  );
  return guestMode && typeof document !== "undefined"
    ? createPortal(formScreen, document.body)
    : formScreen;
}
