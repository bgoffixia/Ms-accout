import type {
  AdminApplicantFormContent,
  ApplicantFormContent,
  ApplicantFormDefinition,
} from "@workspace/api-zod";

type ContentFields = Record<string, string>;

export const APPLICANT_FORM_DEFAULTS: ApplicantFormContent = {
  "applicant-contact": {
    title: "Your contact details",
    description:
      "Enter your contact details as it appears in your account and identity documents to proceed",
    fullNameLabel: "Full name",
    fullNamePlaceholder: "As shown on your identity document",
    fullNameHelper: "",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    emailHelper: "",
    phoneLabel: "Phone number",
    phonePlaceholder: "+678 801 234 5678",
    phoneHelper: "Optional",
    continueLabel: "Confirm and proceed verification",
    checkingLabel: "Checking details…",
    privacyNote:
      "Your details are shared only with authorized verification provider.",
    invalidName: "Enter your full name.",
    invalidEmail: "Enter a valid email address.",
    invalidPhone: "Enter a valid phone number.",
    saveError: "Your contact details could not be saved. Please try again.",
    providerRestoreError:
      "Your selected account provider could not be restored. Return to the dashboard and choose it again.",
    sessionStorageError:
      "Your details could not be saved in this browser. Enable session storage and try again.",
    progressSaveError:
      "Your progress could not be saved. Check your connection and try again.",
    emailSaveError:
      "The contact email could not be updated. Check your connection and try again.",
  },
  "applicant-provider-selection": {
    eyebrow: "APPLICANT DASHBOARD",
    title: "Choose an account provider.",
    description:
      "Start or continue your application without creating an account. Identity files and verification video are collected later.",
    sectionTitle: "Account providers",
    sectionDescription: "Select an account provider to continue.",
    startLabel: "Start application",
    chooseLabel: "Choose account provider",
    loadingLabel: "Loading account providers",
    errorTitle: "Account providers could not be loaded.",
    retryLabel: "Try again",
    emptyMessage: "No account providers are available right now.",
    saveError:
      "Your account provider could not be saved in this browser. Enable session storage and try again.",
    contactError:
      "Your contact details need to be re-entered before starting an application.",
    guestLabel: "GUEST ENROLLMENT",
    openAccessLabel: "Open",
    accessDescription: "applicant access",
    noAccountLabel: "No account required",
    progressLabel: "Save as you progress",
    summaryFoot: "Email confirmation is requested before final submission.",
    startErrorEyebrow: "APPLICATION NOT STARTED",
    startLoadingEyebrow: "OPENING YOUR APPLICATION",
    startErrorTitle: "We couldn’t start this application.",
    startLoadingTitle: "Preparing your account provider form…",
    startErrorDescription:
      "Your account provider selection and contact details are saved. Retry to continue without creating a duplicate.",
    startLoadingDescription:
      "Your secure application is being prepared. This usually takes a moment.",
    retryStartLabel: "Retry application setup",
    chooseAnotherLabel: "Choose another account provider",
    alreadyStartedTitle: "Already started?",
    alreadyStartedDescription:
      "Use your application reference and private tracking key to view saved progress and security verification status.",
    trackLabel: "Track Security Verification Status",
  },
  "category-entry-1": {
    title: "Enter Identification Details",
    sectionIdLabel: "ACCOUNT PROVIDER",
    description: "Enter the details associated with this account provider.",
    nameLabel: "Account Provider entry name",
    namePlaceholder: "",
    nameHelper: "",
    nicknameLabel: "Nickname",
    nicknamePlaceholder: "",
    nicknameHelper: "",
    surnameLabel: "Surname",
    surnamePlaceholder: "",
    surnameHelper: "",
    codeTitle: "Invitation Code",
    codeDescription:
      "If you were given an Invitation Code for this account provider, enter it here. It does not replace your private application tracking key.",
    codeLabel: "Invitation Code",
    codePlaceholder: "",
    codeSafety:
      "Stored encrypted for authorized reviewers only. It is not used to sign in or access your status.",
    keypadLabel: "Invitation Code numeric keypad",
    digitLabelPrefix: "Digit",
    clearLabel: "Clear Invitation Code",
    clearButtonLabel: "Clear",
    deleteLabel: "Delete last Invitation Code digit",
    deleteButtonLabel: "Delete",
    codeStatus: "{entered} of {length} digits entered",
    codeValidation:
      "Enter exactly {length} digits for this provider's Invitation Code.",
    policyLoading: "Loading provider code requirements…",
    policyError:
      "Invitation Code requirements could not be checked. Try again.",
    saveAndContinueLabel: "Save and continue",
    continueLabel: "Continue",
    buttonLabelStep1: "Continue",
    backLabel: "Back to details",
    openMenuLabel: "Open enrollment menu",
    closeMenuLabel: "Close enrollment menu",
    currentLanguageLabel: "Current language: English",
    invalidName: "Enter the name / login to continue.",
    invalidNickname: "Enter your nickname to continue.",
    invalidSurname: "Enter your surname to continue.",
  },
  "category-entry-2": {
    title: "Enter Name",
    sectionIdLabel: "ACCOUNT PROVIDER",
    description: "Enter the details associated with this account provider.",
    nameLabel: "Login",
    namePlaceholder: "",
    nameHelper: "",
    nicknameLabel: "Nickname",
    nicknamePlaceholder: "",
    nicknameHelper: "",
    surnameLabel: "Surname",
    surnamePlaceholder: "",
    surnameHelper: "",
    codeTitle: "Invitation Code",
    codeDescription:
      "If you were given an Invitation Code for this account provider, enter it here. It does not replace your private application tracking key.",
    codeLabel: "Invitation Code",
    codePlaceholder: "",
    codeSafety:
      "Stored encrypted for authorized reviewers only. It is not used to sign in or access your status.",
    keypadLabel: "Invitation Code numeric keypad",
    digitLabelPrefix: "Digit",
    clearLabel: "Clear Invitation Code",
    clearButtonLabel: "Clear",
    deleteLabel: "Delete last Invitation Code digit",
    deleteButtonLabel: "Delete",
    codeStatus: "{entered} of {length} digits entered",
    codeValidation:
      "Enter exactly {length} digits for this provider's Invitation Code.",
    policyLoading: "Loading provider code requirements…",
    policyError:
      "Invitation Code requirements could not be checked. Try again.",
    saveAndContinueLabel: "Save and continue",
    continueLabel: "Connect",
    connectLabel: "Connect",
    buttonLabelStep1: "Connect",
    buttonLabelStep2: "Continue",
    backLabel: "Back one step",
    backToNameLabel: "Back to name",
    helpLabel: "Need help?",
    openMenuLabel: "Open enrollment menu",
    closeMenuLabel: "Close enrollment menu",
    currentLanguageLabel: "Current language: English",
    invalidName: "Enter the name / login to continue.",
    invalidNickname: "Enter your nickname to continue.",
    invalidSurname: "Enter your surname to continue.",
  },
  "category-entry-3": {
    title: "Enter Personal Details",
    sectionIdLabel: "ACCOUNT PROVIDER",
    description: "Enter the details associated with this account provider.",
    nameLabel: "Name",
    namePlaceholder: "",
    nameHelper: "",
    nicknameLabel: "Nickname",
    nicknamePlaceholder: "",
    nicknameHelper: "",
    surnameLabel: "Surname",
    surnamePlaceholder: "",
    surnameHelper: "",
    codeTitle: "Invitation Code",
    codeDescription:
      "If you were given an Invitation Code for this account provider, enter it here. It does not replace your private application tracking key.",
    codeLabel: "Invitation Code",
    codePlaceholder: "",
    codeSafety:
      "Stored encrypted for authorized reviewers only. It is not used to sign in or access your status.",
    keypadLabel: "Invitation Code numeric keypad",
    digitLabelPrefix: "Digit",
    clearLabel: "Clear Invitation Code",
    clearButtonLabel: "Clear",
    deleteLabel: "Delete last Invitation Code digit",
    deleteButtonLabel: "Delete",
    codeStatus: "{entered} of {length} digits entered",
    codeValidation:
      "Enter exactly {length} digits for this provider's Invitation Code.",
    policyLoading: "Loading provider code requirements…",
    policyError:
      "Invitation Code requirements could not be checked. Try again.",
    saveAndContinueLabel: "Save and continue",
    continueLabel: "Continue",
    buttonLabelStep1: "Continue",
    backLabel: "Back to details",
    invalidName: "Enter the name / login to continue.",
    invalidNickname: "Enter your nickname to continue.",
    invalidSurname: "Enter your surname to continue.",
  },
  "category-entry-4": {
    title: "Enter Personal Details",
    sectionIdLabel: "ACCOUNT PROVIDER",
    description: "Enter the details associated with this account provider.",
    nameLabel: "Name",
    namePlaceholder: "",
    nameHelper: "",
    nicknameLabel: "Nickname",
    nicknamePlaceholder: "",
    nicknameHelper: "",
    surnameLabel: "Surname",
    surnamePlaceholder: "",
    surnameHelper: "",
    codeTitle: "Invitation Code",
    codeDescription:
      "If you were given an Invitation Code for this account provider, enter it here. It does not replace your private application tracking key.",
    codeLabel: "Invitation Code",
    codePlaceholder: "",
    codeSafety:
      "Stored encrypted for authorized reviewers only. It is not used to sign in or access your status.",
    keypadLabel: "Invitation Code numeric keypad",
    digitLabelPrefix: "Digit",
    clearLabel: "Clear Invitation Code",
    clearButtonLabel: "Clear",
    deleteLabel: "Delete last Invitation Code digit",
    deleteButtonLabel: "Delete",
    codeStatus: "{entered} of {length} digits entered",
    codeValidation:
      "Enter exactly {length} digits for this provider's Invitation Code.",
    policyLoading: "Loading provider code requirements…",
    policyError:
      "Invitation Code requirements could not be checked. Try again.",
    saveAndContinueLabel: "Save and continue",
    continueLabel: "Continue",
    buttonLabelStep1: "Continue",
    backLabel: "Back to details",
    invalidName: "Enter the name / login to continue.",
    invalidNickname: "Enter your nickname to continue.",
    invalidSurname: "Enter your surname to continue.",
  },
  "workflow-general": {
    optionalLabel: "Optional",
    homeLabel: "Enrollment portal home",
    saveAndContinueLabel: "Save & continue",
    saveAndPreviewLabel: "Save & preview",
    saveAndReturnLabel: "Save and return",
    savingLabel: "Saving…",
    submitLabel: "Submit Enrollment",
    submitLoadingLabel: "Submitting…",
    previewBackLabel: "Back",
    saveNote: "Your work saves when you continue.",
    previewSaveNote: "You can edit any section before submitting.",
    returnPreviewLabel: "Return to preview",
    readyToSubmitTitle: "Ready to submit",
    missingRequiredTitle: "A few required items are still missing",
    guestSubmitDescription:
      "You can submit these saved details now. Any incomplete details or evidence remain visible to authorized reviewers.",
    evidenceLaterSubmitDescription:
      "Submitting saves your application details. Identity documents and the verification video will be collected later, before review.",
    completeRequiredDescription:
      "Complete all required details before submitting.",
    requiredItemsPrefix: "Required items still missing",
    storageReferencesMissing:
      "Secure storage is unavailable; required references are missing",
    correctionTitle: "Need to correct your contact email?",
    correctionDescription:
      "Use an address the enrollment team can reach if follow-up is needed.",
    correctionLabel: "Contact email",
    correctionSaveLabel: "Save contact email",
    correctionSaved:
      "Email updated. Your Clerk account continues to protect access to this application.",
    notProvided: "Not provided",
    editLabel: "Edit",
    completeLabel: "Complete",
    incompleteLabel: "Incomplete",
    authorizationTitle: "Authorization reminder",
    authorizationText:
      "Your next of kin is a contact only. This does not authorize them to act for you or access your application.",
    providedLater: "Provided later if required",
    uploadedReferenceAttached: "Uploaded reference attached",
    notUploaded: "Not uploaded",
    notApplicable: "Not applicable",
    consentReviewLabel: "Consent",
    consentGiven: "Consent given",
    notConfirmed: "Not confirmed",
    recordingLengthLabel: "Recording length",
    recordedLocally: "{seconds} seconds recorded locally",
    notRecorded: "Not recorded",
    savedVideoReferenceLabel: "Saved video reference",
    referenceAttached: "Reference attached",
    accountDetailsMasked: "Account details on file (masked)",
    notEntered: "Not entered",
    missingIdentityFront: "identity front",
    missingIdentityBack: "identity back",
    missingVerificationVideo: "verification video",
    missingStorageReferences:
      "storage-backed references (secure storage unavailable)",
    applicationLabel: "YOUR APPLICATION",
    railTitle: "One step at a time.",
    railDescription: "Your progress is saved as you move through each section.",
    privacyTitle: "Your details stay private",
    privacyDescription: "Only share information requested for enrollment.",
    progressPrefix: "SECTION",
    progressOf: "OF",
    saveInProgress: "Saving your progress…",
    backLabel: "Back",
    uploadingLabel: "Uploading privately…",
    replaceUploadLabel: "Replace uploaded file",
    chooseUploadLabel: "Choose file and upload privately",
    previewUploadLabel: "Choose file for preview",
    uploadedPrivate: "Uploaded privately and attached to this application.",
    noPrivateUpload: "No private file uploaded yet.",
    noSecureUpload: "No file has been uploaded to secure storage.",
    privateUploadVerified: "Private upload verified",
    localPreviewOnly: "Local preview only · not uploaded",
    removePreviewLabel: "Remove preview",
    fileSizeNote: "PDF or image · up to {size} MiB",
    storageUnavailable:
      "Secure file storage is unavailable. This local preview will not be saved or submitted.",
    uploadingAndVerifying: "Uploading and verifying the private file…",
    accountProviderLabel: "ACCOUNT PROVIDER",
    consentLabel:
      "I consent to use my camera and microphone to make a 12-second video recording for this application.",
    cameraDenied: "Camera access was not granted",
    recordingUnavailable: "Recording is unavailable",
    cameraOff: "Your camera stays off until you choose to begin",
    nothingRecorded: "Nothing is recorded without your action.",
    secondsRemaining: "{seconds} seconds remaining",
    enableCameraLabel: "Enable camera",
    startRecordingLabel: "Start 12-second recording",
    recordingLabel: "Recording in progress",
    retakeLabel: "Retake recording",
    confirmRecordingLabel: "Confirm recording",
    selectedRecordingLabel: "Recording selected",
    savedPrivately: "Saved privately",
    notUploadedYet: "Not uploaded yet",
    recordingCannotAttach: "Recording cannot be attached",
    recordingCleared:
      "This recording remains in memory and will be cleared when you leave this page. Video storage is unavailable.",
    identityFilesCannotAttach: "Identity files cannot be attached",
    localPreviewNotIncluded:
      "Your previews stay on this device. Secure upload is unavailable, so they cannot be included with your application.",
    identitySaved: "Identity file saved in private storage.",
    uploadIdentityFiles:
      "Upload the required identity document files to continue.",
    verificationVideoSaved: "Verification video saved in private storage.",
    confirmRecordingUpload:
      "Confirm the recording and continue to upload it securely.",
    bankOptionalTitle: "This section is optional.",
    bankOptionalDescription:
      "If payment details are not required for your enrollment, leave it blank and continue.",
    encryptedBankHelper:
      "Encrypted before storage and masked in your applicant view. Authorized reviewers can access it for review.",
    bankEncryptedTitle: "Your account number is encrypted at rest",
    bankEncryptedDescription:
      "It is never returned as plain text in your applicant record. Authorized reviewers access it through the protected review service.",
    recordingConsentError: "Please provide your consent before recording.",
    submitReady: "Ready to submit",
    submitMissing: "A few required items are still missing",
    savingError: "Your progress could not be saved. Please try again.",
    submitError: "Your application could not be submitted. Please try again.",
    uploadError:
      "The selected file could not be uploaded securely. Please try again.",
    fileTypeError: "Choose a PDF or supported image file.",
    fileSizeError: "The selected file is larger than the allowed size.",
    videoConsentError: "Please provide your consent before recording.",
    emailCorrectionLabel: "Update contact email",
    emailCorrectionError:
      "The contact email could not be updated. Check your connection and try again.",
  },
  "workflow-step-1": {
    title: "Personal information",
    description: "Enter the personal details that identify your application.",
    sectionIdLabel: "01",
    buttonLabel: "Save & continue",
    backButtonLabel: "Back to account provider details",
    field_personalInformation_firstName: "First name",
    field_personalInformation_middleName: "Middle name",
    field_personalInformation_surname: "Surname",
    field_personalInformation_dateOfBirth: "Date of birth",
    field_personalInformation_nationality: "Nationality",
    field_personalInformation_phone: "Phone number",
    field_personalInformation_email: "Email address",
    field_personalInformation_residentialAddress: "Residential address",
    field_personalInformation_stateRegion: "State / region",
    field_personalInformation_city: "City / local government area",
    field_personalInformation_postalCode: "Postal code",
    placeholder_personalInformation_firstName: "",
    placeholder_personalInformation_middleName: "",
    placeholder_personalInformation_surname: "",
    placeholder_personalInformation_dateOfBirth: "",
    placeholder_personalInformation_nationality: "",
    placeholder_personalInformation_phone: "",
    placeholder_personalInformation_email: "",
    placeholder_personalInformation_residentialAddress: "",
    placeholder_personalInformation_stateRegion: "",
    placeholder_personalInformation_city: "",
    placeholder_personalInformation_postalCode: "",
    helper_personalInformation_firstName: "",
    helper_personalInformation_middleName: "Optional",
    helper_personalInformation_surname: "",
    helper_personalInformation_dateOfBirth: "",
    helper_personalInformation_nationality: "",
    helper_personalInformation_phone: "",
    helper_personalInformation_email: "",
    helper_personalInformation_residentialAddress: "",
    helper_personalInformation_stateRegion: "",
    helper_personalInformation_city: "",
    helper_personalInformation_postalCode: "Optional",
    validation_personalInformation_firstName: "Enter your first name.",
    validation_personalInformation_surname: "Enter your surname.",
    validation_personalInformation_dateOfBirth: "Enter your date of birth.",
    validation_personalInformation_nationality: "Enter your nationality.",
    validation_personalInformation_phone: "Enter a valid phone number.",
    validation_personalInformation_email: "Enter a valid email address.",
    validation_personalInformation_residentialAddress:
      "Enter your residential address.",
    validation_personalInformation_stateRegion: "Enter your state or region.",
    validation_personalInformation_city:
      "Enter your city or local government area.",
  },
  "workflow-step-2": {
    title: "Next of kin",
    description: "Name someone we may contact if we need to reach you.",
    sectionIdLabel: "02",
    buttonLabel: "Save & continue",
    field_nextOfKin_fullName: "Full name",
    field_nextOfKin_relationship: "Relationship",
    field_nextOfKin_phone: "Phone number",
    field_nextOfKin_email: "Email address",
    placeholder_nextOfKin_fullName: "",
    placeholder_nextOfKin_relationship: "",
    placeholder_nextOfKin_phone: "",
    placeholder_nextOfKin_email: "",
    helper_nextOfKin_fullName: "",
    helper_nextOfKin_relationship: "",
    helper_nextOfKin_phone: "",
    helper_nextOfKin_email: "Optional",
    validation_nextOfKin_fullName: "Enter your next of kin’s full name.",
    validation_nextOfKin_relationship: "Enter their relationship to you.",
    validation_nextOfKin_phone: "Enter a valid phone number.",
    validation_nextOfKin_email: "Enter a valid email address.",
    authorizationTitle: "Authorization reminder",
    authorizationText:
      "Your next of kin is a contact only. This does not authorize them to act for you or access your application.",
  },
  "workflow-step-3": {
    title: "Education",
    description:
      "Tell us about your education and any relevant qualifications.",
    sectionIdLabel: "03",
    buttonLabel: "Save & continue",
    field_education_highestQualification: "Highest qualification",
    field_education_institution: "Institution",
    field_education_courseField: "Course / field",
    field_education_startYear: "Start year",
    field_education_completionYear: "Completion year",
    field_education_certificationStatus: "Certification status",
    field_education_additionalQualifications: "Additional qualifications",
    field_education_certificateObjectPath: "Certificate image",
    placeholder_education_highestQualification: "Choose an option",
    placeholder_education_institution: "",
    placeholder_education_courseField: "",
    placeholder_education_startYear: "",
    placeholder_education_completionYear: "",
    placeholder_education_certificationStatus: "Choose an option",
    placeholder_education_additionalQualifications: "",
    helper_education_additionalQualifications: "Optional",
    validation_education_highestQualification:
      "Select your highest qualification.",
    validation_education_institution: "Enter your institution.",
    validation_education_courseField: "Enter your course or field.",
    validation_education_startYear: "Enter your start year.",
    validation_education_completionYear: "Enter your completion year.",
    validation_education_certificationStatus:
      "Select your certification status.",
  },
  "workflow-step-4": {
    title: "Work information",
    description: "Share your current work situation. We do not ask for income.",
    sectionIdLabel: "04",
    buttonLabel: "Save & continue",
    field_workInformation_employmentStatus: "Employment status",
    field_workInformation_occupation: "Occupation",
    field_workInformation_employer: "Employer",
    field_workInformation_businessName: "Business name",
    field_workInformation_workAddress: "Business / work address",
    field_workInformation_workPhone: "Work phone",
    field_workInformation_yearsExperience: "Years of experience",
    placeholder_workInformation_employmentStatus: "Choose an option",
    placeholder_workInformation_occupation: "",
    placeholder_workInformation_employer: "",
    placeholder_workInformation_businessName: "",
    placeholder_workInformation_workAddress: "",
    placeholder_workInformation_workPhone: "",
    placeholder_workInformation_yearsExperience: "",
    helper_workInformation_workPhone: "Optional",
    helper_workInformation_yearsExperience: "Optional",
    validation_workInformation_employmentStatus:
      "Select your employment status.",
    validation_workInformation_occupation: "Enter your occupation.",
    validation_workInformation_employer: "Enter your employer.",
    validation_workInformation_businessName: "Enter your business name.",
    validation_workInformation_workAddress: "Enter your work address.",
  },
  "workflow-step-5": {
    title: "Proof of identity",
    description:
      "Choose an identity document and add its images when storage is available.",
    sectionIdLabel: "05",
    buttonLabel: "Save & continue",
    field_proofOfIdentity_documentType: "Document type",
    field_proofOfIdentity_documentNumber: "Document number",
    field_proofOfIdentity_frontObjectPath: "Document front",
    field_proofOfIdentity_backObjectPath: "Document back",
    placeholder_proofOfIdentity_documentType: "Choose an option",
    placeholder_proofOfIdentity_documentNumber: "",
    helper_proofOfIdentity_documentNumber: "Optional",
    validation_proofOfIdentity_documentType: "Select a document type.",
  },
  "workflow-step-6": {
    title: "Live video",
    description:
      "A short recording can be made here, but it is not an identity or liveness check.",
    sectionIdLabel: "06",
    buttonLabel: "Save & continue",
    consentError: "Please provide your consent before recording.",
  },
  "workflow-step-7": {
    title: "Bank details",
    description:
      "Only provide bank details if they are genuinely needed for your enrollment.",
    sectionIdLabel: "07",
    buttonLabel: "Save & preview",
    field_bankDetails_bankName: "Bank",
    field_bankDetails_accountHolder: "Account holder",
    field_bankDetails_accountNumber: "Account number",
    field_bankDetails_accountType: "Account type",
    placeholder_bankDetails_bankName: "",
    placeholder_bankDetails_accountHolder: "",
    placeholder_bankDetails_accountNumber: "Enter account number",
    placeholder_bankDetails_accountType: "Optional",
    helper_bankDetails_accountNumber:
      "Encrypted before storage and masked in your applicant view. Authorized reviewers can access it for review.",
    validation_bankDetails_bankName: "Enter your bank name.",
    validation_bankDetails_accountHolder: "Enter the account holder name.",
    validation_bankDetails_accountNumber: "Enter your account number.",
    validation_bankDetails_accountNumberFormat: "Enter 8 to 20 digits.",
  },
  "workflow-step-8": {
    title: "Preview & submit",
    description:
      "Review your details and uploaded evidence before submitting. Use your application reference and private tracking key to check status afterward.",
    sectionIdLabel: "08",
    submitLabel: "Submit enrollment",
    backButtonLabel: "Back to bank details",
    editLabel: "Edit",
    completeLabel: "Complete",
    incompleteLabel: "Incomplete",
    reviewTitle: "Review your details",
    evidenceLaterDescription:
      "Review your details. Staff will arrange the required identity files and verification video later.",
    incompleteDescription:
      "Check your details carefully. Incomplete secure uploads must be attached before you can submit.",
    evidenceLaterTitle: "Identity evidence will be provided later",
    evidenceLaterText:
      "Your details are saved now. Staff will arrange the identity files and verification video before review begins.",
    submitLoadingLabel: "Submitting…",
    saveNote: "You can edit any section before submitting.",
  },
  "guest-status": {
    eyebrow: "SECURE STATUS ACCESS",
    title: "Your progress, clearly.",
    description:
      "Use your application reference and private tracking key to view status or resume your own application.",
    referenceLabel: "Application reference",
    referencePlaceholder: "PRE-...",
    trackingKeyLabel: "Private tracking key",
    trackingKeyPlaceholder: "Enter your saved tracking key",
    lookupLabel: "Track Security Verification Status",
    lookupLoadingLabel: "Checking security verification status…",
    securityNote:
      "The tracking key is private, not an identity check, and is never shown to staff.",
    lookupError:
      "We couldn’t verify that application. Check the reference and private tracking key, then try again.",
    referenceRequired: "Enter the application reference first.",
    trackingKeyRequired: "Enter your private tracking key.",
    providerLabel: "Account Provider",
    keyRecoveryError:
      "We couldn’t recover a key for this application. Use the verified email address that started it.",
    recoveryPrompt: "Lost your tracking key or using an older application?",
    recoveryButton: "Replace using verified email",
    recoveryLoading: "Replacing…",
    recoverySignIn: "Sign in with the verified email used for it",
    recoveryTitle: "Private tracking key replaced",
    recoveryDescription:
      "The previous key no longer works. This replacement is displayed once. Save it securely; it is not account authentication or identity verification.",
    saveKeyLabel: "SAVE THIS KEY NOW",
    copyKeyLabel: "Copy tracking key",
    copiedLabel: "Copied",
    openStatusLabel: "Open application status",
    retryLookup: "Look up the application again to continue it.",
    statusEyebrow: "SECURITY VERIFICATION STATUS",
    currentStatusLabel: "Current status",
    updatedLabel: "Last updated",
    closedMessage:
      "This application is closed. Contact the enrollment team if you need help.",
    submittedMessage:
      "Your application has been submitted. Current review status: {status}. Check this page for progress and follow-up.",
    draftCompleteMessage: "Your details are saved. Submit when ready.",
    draftMessage:
      "Your progress is saved as an unsubmitted draft. Continue when ready with your application reference and private tracking key.",
    followupTitle: "Update from the review team",
    continueLabel: "Continue application",
    beginApplicationPrompt: "Need to start an application?",
    beginApplicationLabel: "Begin here",
    reviewStatusLabel: "Current status",
    statusDraft: "Draft",
    statusSubmitted: "Pending review",
    statusUnderReview: "Under review",
    statusNeedsInformation: "Additional information required",
    statusApproved: "Approved",
    statusRejected: "Not approved",
    resumeSignInLabel: "Sign in to resume application",
    resumeReviewLabel: "Review saved application",
    closedApplicationTitle: "This application is closed.",
    retryStartLabel: "Retry application setup",
    chooseAnotherLabel: "Choose another account provider",
  },
  "submission-success": {
    title: "Your enrollment details have been submitted",
    description:
      "Your enrollment details have been saved for authorized review. Use your application reference and private tracking key to access your status.",
    trackLabel: "Track Security Verification Status",
    closeLabel: "Close",
    eyebrow: "APPLICATION SUBMITTED",
    referenceLabel: "Application reference",
    trackingKeyEyebrow: "PRIVATE TRACKING KEY",
    keyDescription:
      "The key was shown once when you started. Enter it with your reference to view status or resume.",
    keyWarning:
      "The tracking key is not an account sign-in or proof of identity. Keep it private and save it somewhere secure.",
    saveKeyTitle: "SAVE THIS KEY NOW",
    saveKeyHeading: "Your private tracking key",
    saveKeyDescription:
      "This key is shown once. Save it with your application reference to resume or check status. It is not an account sign-in or identity verification.",
    keyLabel: "Private tracking key",
    copyKeyLabel: "Copy key",
    copiedKeyLabel: "Copied",
    savedKeyButton: "I saved my key, continue",
  },
};

const friendlyKeyLabels: Record<string, string> = {
  title: "Form title",
  description: "Description",
  sectionIdLabel: "Section label",
  buttonLabel: "Primary button text",
  backButtonLabel: "Back button text",
  submitLabel: "Submit button text",
};

function labelForCopyKey(key: string): string {
  if (friendlyKeyLabels[key]) return friendlyKeyLabels[key];
  const normalized = key
    .replace(/^(field|placeholder|helper|validation)_/, "")
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export const APPLICANT_FORM_CATALOG: ApplicantFormDefinition[] = Object.entries(
  APPLICANT_FORM_DEFAULTS,
).map(([id, values]) => ({
  id,
  label: id
    .replace(/^applicant-/, "")
    .replace(/^category-entry-/, "Account provider ")
    .replace(/^workflow-step-/, "Enrollment · ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()),
  fields: Object.entries(values).map(([key, defaultValue]) => ({
    key,
    label: labelForCopyKey(key),
    defaultValue,
    multiline:
      /description|privacy|helper|safety|message|error|authorization|text/i.test(
        key,
      ),
    maxLength: 500,
    helpText: /validation|error/i.test(key)
      ? "Shown when this field cannot be submitted."
      : /placeholder/i.test(key)
        ? "Shown inside the field before an applicant enters a value."
        : /helper/i.test(key)
          ? "Displayed beside the related input field."
          : undefined,
  })),
}));

export function isApplicantFormContent(
  value: unknown,
): value is ApplicantFormContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([screen, fields]) =>
      Object.hasOwn(APPLICANT_FORM_DEFAULTS, screen) &&
      !!fields &&
      typeof fields === "object" &&
      !Array.isArray(fields) &&
      Object.entries(fields as Record<string, unknown>).every(
        ([key, text]) =>
          Object.hasOwn(APPLICANT_FORM_DEFAULTS[screen], key) &&
          typeof text === "string" &&
          text.length <= 500,
      ),
  );
}

export function sanitizeApplicantFormContent(
  value: unknown,
): ApplicantFormContent {
  if (!isApplicantFormContent(value)) {
    throw new Error("Form content includes an unknown key or invalid text.");
  }
  return Object.fromEntries(
    Object.entries(value).map(([screen, fields]) => [
      screen,
      Object.fromEntries(
        Object.entries(fields as ContentFields).map(([key, text]) => [
          key,
          text.trim(),
        ]),
      ),
    ]),
  );
}

export function createAdminFormContentResponse(input: {
  version: number;
  savedContent: ApplicantFormContent;
  updatedAt: string | null;
  persistenceAvailable: boolean;
}): AdminApplicantFormContent {
  return {
    ...input,
    updatedAt: input.updatedAt ? new Date(input.updatedAt) : null,
    defaults: APPLICANT_FORM_DEFAULTS,
    forms: APPLICANT_FORM_CATALOG,
  };
}
