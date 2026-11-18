import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  EnrollmentApplication,
  EnrollmentCategory,
  PortalPageTheme,
  PortalSettingsCardsItem,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileImage,
  FileVideo2,
  LockKeyhole,
  ShieldCheck,
  Upload,
  Video,
  X,
} from "lucide-react";
import "./EnrollmentWizard.css";
import { pageThemeBackground } from "../pageTheme";
import { PortalWordmark } from "./PortalWordmark";
import { Link } from "wouter";

type WizardAnswers = Record<string, unknown>;

export type EnrollmentWizardProps = {
  application: EnrollmentApplication;
  categories: EnrollmentCategory[];
  status: string;
  storageAvailable: boolean;
  maxUploadBytes: number;
  isSaving: boolean;
  isSubmitting: boolean;
  error: string;
  reopenedSections: number[];
  screenCopy?: Record<string, Record<string, string>>;
  categoryCards?: PortalSettingsCardsItem[];
  pageThemes?: Record<string, PortalPageTheme>;
  evidenceLater?: boolean;
  guestMode?: boolean;
  previewMode?: boolean;
  uploadEvidence?: (
    file: File,
    evidenceSlot:
      | "identity_front"
      | "identity_back"
      | "verification_video"
      | "education_certificate",
  ) => Promise<{ objectPath: string; fileName: string }>;
  saveStep: (
    answers: Record<string, unknown>,
    currentStep: number,
  ) => Promise<boolean>;
  updateContactEmail?: (email: string) => Promise<boolean>;
  submit: (answers: Record<string, unknown>) => Promise<boolean>;
  onBackToCategoryEntry: (answers: Record<string, unknown>) => Promise<boolean>;
};

const stageTitles = [
  "Personal information",
  "Next of kin",
  "Education",
  "Work information",
  "Proof of identity",
  "Live video",
  "Bank details",
  "Preview & submit",
];

const categoryEntryLabels: Record<string, string> = {
  name: "Account Provider entry name",
  nickname: "Nickname",
  surname: "Surname",
};
const categoryEntryFieldsByCategory: Record<string, string[]> = {
  "category-1": ["name", "nickname"],
  "category-2": ["name", "surname"],
  "category-3": ["name", "surname"],
  "category-4": ["name", "surname"],
};

const stageSchemas: z.ZodType<WizardAnswers>[] = [
  z.object({
    personalInformation: z.object({
      firstName: z.string().trim().min(1, "Enter your first name."),
      middleName: z.string().optional(),
      surname: z.string().trim().min(1, "Enter your surname."),
      dateOfBirth: z.string().min(1, "Enter your date of birth."),
      nationality: z.string().trim().min(1, "Enter your nationality."),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9][0-9\s().-]{6,19}$/, "Enter a valid phone number."),
      email: z.string().trim().email("Enter a valid email address."),
      residentialAddress: z
        .string()
        .trim()
        .min(1, "Enter your residential address."),
      stateRegion: z.string().trim().min(1, "Enter your state or region."),
      city: z
        .string()
        .trim()
        .min(1, "Enter your city or local government area."),
      postalCode: z.string().optional(),
    }),
  }),
  z.object({
    nextOfKin: z.object({
      fullName: z.string().trim().min(1, "Enter your next of kin’s full name."),
      relationship: z
        .string()
        .trim()
        .min(1, "Enter their relationship to you."),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9][0-9\s().-]{6,19}$/, "Enter a valid phone number."),
      email: z
        .string()
        .optional()
        .refine(
          (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
          "Enter a valid email address.",
        ),
    }),
  }),
  z.object({
    education: z.object({
      highestQualification: z
        .string()
        .trim()
        .min(1, "Select your highest qualification."),
      institution: z.string().trim().min(1, "Enter your institution."),
      courseField: z.string().trim().min(1, "Enter your course or field."),
      startYear: z.string().trim().min(1, "Enter your start year."),
      completionYear: z.string().trim().min(1, "Enter your completion year."),
      certificationStatus: z
        .string()
        .trim()
        .min(1, "Select your certification status."),
      additionalQualifications: z.string().optional(),
      certificateObjectPath: z.string().optional(),
    }),
  }),
  z.object({
    workInformation: z
      .object({
        employmentStatus: z.string().min(1, "Select your employment status."),
        occupation: z.string().optional(),
        employer: z.string().optional(),
        businessName: z.string().optional(),
        workAddress: z.string().optional(),
        workPhone: z.string().optional(),
        yearsExperience: z.string().optional(),
      })
      .superRefine((values, context) => {
        if (values.employmentStatus === "Employed") {
          if (!values.occupation?.trim())
            context.addIssue({
              code: "custom",
              path: ["occupation"],
              message: "Enter your occupation.",
            });
          if (!values.employer?.trim())
            context.addIssue({
              code: "custom",
              path: ["employer"],
              message: "Enter your employer.",
            });
          if (!values.workAddress?.trim())
            context.addIssue({
              code: "custom",
              path: ["workAddress"],
              message: "Enter your work address.",
            });
        }
        if (values.employmentStatus === "Self-employed") {
          if (!values.businessName?.trim())
            context.addIssue({
              code: "custom",
              path: ["businessName"],
              message: "Enter your business name.",
            });
          if (!values.workAddress?.trim())
            context.addIssue({
              code: "custom",
              path: ["workAddress"],
              message: "Enter your business or work address.",
            });
        }
      }),
  }),
  z.object({
    proofOfIdentity: z.object({
      documentType: z.string().min(1, "Select a document type."),
      documentNumber: z.string().optional(),
      frontObjectPath: z.string().optional(),
      backObjectPath: z.string().optional(),
    }),
  }),
  z.object({
    liveVideoRecording: z.object({
      consentAccepted: z.literal(true, {
        errorMap: () => ({
          message: "Please provide your consent before recording.",
        }),
      }),
      durationSeconds: z.number().optional(),
      objectPath: z.string().optional(),
    }),
  }),
  z.object({
    bankDetails: z
      .object({
        bankName: z.string().optional(),
        accountHolder: z.string().optional(),
        accountNumber: z.string().optional(),
        accountType: z.string().optional(),
        accountNumberMasked: z.string().optional(),
      })
      .superRefine((values, context) => {
        const anyValue = [
          values.bankName,
          values.accountHolder,
          values.accountNumber,
          values.accountType,
        ].some((value) => Boolean(value?.trim()));
        if (anyValue) {
          if (!values.bankName?.trim())
            context.addIssue({
              code: "custom",
              path: ["bankName"],
              message: "Enter your bank name.",
            });
          if (!values.accountHolder?.trim())
            context.addIssue({
              code: "custom",
              path: ["accountHolder"],
              message: "Enter the account holder name.",
            });
          if (!values.accountNumber?.trim() && !values.accountNumberMasked) {
            context.addIssue({
              code: "custom",
              path: ["accountNumber"],
              message: "Enter your account number.",
            });
          }
          if (
            values.accountNumber?.trim() &&
            !/^\d{8,20}$/.test(values.accountNumber.replace(/\s/g, ""))
          ) {
            context.addIssue({
              code: "custom",
              path: ["accountNumber"],
              message: "Enter 8 to 20 digits.",
            });
          }
        }
      }),
  }),
  z.object({}),
];

const sectionKeys = [
  "personalInformation",
  "nextOfKin",
  "education",
  "workInformation",
  "proofOfIdentity",
  "liveVideoRecording",
  "bankDetails",
];

function section(answers: WizardAnswers, key: string): WizardAnswers {
  const value = answers[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as WizardAnswers)
    : {};
}

function answer(
  answers: WizardAnswers,
  sectionKey: string,
  key: string,
): unknown {
  return section(answers, sectionKey)[key];
}

function resumeAt(currentStep: number, reopenedSections: number[]) {
  const persisted = Math.min(7, Math.max(0, currentStep || 0));
  if (
    reopenedSections.length === 0 ||
    persisted === 7 ||
    reopenedSections.includes(persisted)
  )
    return persisted;
  return Math.min(...reopenedSections);
}

function textValue(answers: WizardAnswers, key: string) {
  const value = answers[key];
  return typeof value === "string" ? value : "";
}

function isFilled(answers: WizardAnswers, key: string) {
  const value = answers[key];
  return (
    value === true || (typeof value === "string" && value.trim().length > 0)
  );
}

function Field({
  label,
  name,
  register,
  error,
  optional,
  optionalLabel = "Optional",
  type = "text",
  placeholder,
  helper,
  autoComplete,
  testId,
  ...props
}: {
  label: string;
  name: string;
  register: ReturnType<typeof useForm<WizardAnswers>>["register"];
  error?: string;
  optional?: boolean;
  optionalLabel?: string;
  type?: string;
  placeholder?: string;
  helper?: string;
  autoComplete?: string;
  testId?: string;
  [key: string]: unknown;
}) {
  const id = `enroll-${name}`;
  return (
    <label className="ew-field" htmlFor={id}>
      <span className="ew-label">
        {label}
        {optional && <small>{optionalLabel}</small>}
      </span>
      <input
        id={id}
        className={`ew-input ${error ? "has-error" : ""}`}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [error && `${id}-error`, helper && `${id}-helper`]
            .filter(Boolean)
            .join(" ") || undefined
        }
        data-testid={testId ?? `input-${name}`}
        {...register(name)}
        {...props}
      />
      {error && (
        <span
          className="ew-field-error"
          id={`${id}-error`}
          role="alert"
          data-testid={`error-${name}`}
        >
          {error}
        </span>
      )}
      {helper && (
        <span className="ew-help" id={`${id}-helper`}>
          {helper}
        </span>
      )}
    </label>
  );
}

function SelectField({
  label,
  name,
  register,
  error,
  options,
  placeholder = "Choose an option",
  helper,
  testId,
}: {
  label: string;
  name: string;
  register: ReturnType<typeof useForm<WizardAnswers>>["register"];
  error?: string;
  options: string[];
  placeholder?: string;
  helper?: string;
  testId?: string;
}) {
  const id = `enroll-${name}`;
  return (
    <label className="ew-field" htmlFor={id}>
      <span className="ew-label">{label}</span>
      <span className="ew-select-wrap">
        <select
          id={id}
          className={`ew-input ew-select ${error ? "has-error" : ""}`}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [error && `${id}-error`, helper && `${id}-helper`]
              .filter(Boolean)
              .join(" ") || undefined
          }
          data-testid={testId ?? `select-${name}`}
          {...register(name)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
      {error && (
        <span
          className="ew-field-error"
          role="alert"
          id={`${id}-error`}
          data-testid={`error-${name}`}
        >
          {error}
        </span>
      )}
      {helper && (
        <span className="ew-help" id={`${id}-helper`}>
          {helper}
        </span>
      )}
    </label>
  );
}

function StageHeading({
  index,
  title,
  detail,
  sectionIdLabel,
  displayIndex,
  totalStages = 8,
}: {
  index: number;
  title: string;
  detail: string;
  sectionIdLabel?: string;
  displayIndex?: number;
  totalStages?: number;
}) {
  return (
    <div className="ew-stage-heading">
      <span className="ew-stage-number">
        {sectionIdLabel || `0${(displayIndex ?? index) + 1}`}{" "}
        <i>/ {String(totalStages).padStart(2, "0")}</i>
      </span>
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}

type LocalImage = { file: File; url: string };

export function EnrollmentWizard({
  application,
  categories,
  status,
  storageAvailable,
  maxUploadBytes,
  isSaving,
  isSubmitting,
  error,
  reopenedSections,
  screenCopy = {},
  categoryCards = [],
  saveStep,
  submit,
  onBackToCategoryEntry,
  pageThemes,
  evidenceLater = false,
  guestMode = false,
  previewMode = false,
  uploadEvidence,
  updateContactEmail,
}: EnrollmentWizardProps) {
  const activeSteps = evidenceLater
    ? [0, 1, 2, 3, 6, 7]
    : stageTitles.map((_title, index) => index);
  const normalizeStep = (candidate: number) => {
    const resolved = resumeAt(candidate, reopenedSections);
    return evidenceLater && !activeSteps.includes(resolved)
      ? (activeSteps.find((index) => index >= resolved) ?? 7)
      : resolved;
  };
  const heading = (
    index: number,
    title: string,
    detail: string,
    sectionIdLabel?: string,
  ) => (
    <StageHeading
      index={index}
      title={title}
      detail={detail}
      sectionIdLabel={sectionIdLabel}
      displayIndex={activeSteps.indexOf(index)}
      totalStages={activeSteps.length}
    />
  );
  const copyForStep = (index: number) =>
    screenCopy[`workflow-step-${index + 1}`] ?? {};
  const generalCopy = screenCopy["workflow-general"] ?? {};
  const configuredText = (index: number, key: string, fallback: string) =>
    copyForStep(index)[key] ?? generalCopy[key] ?? fallback;
  const titleForStep = (index: number) => {
    const copy = copyForStep(index);
    return Object.prototype.hasOwnProperty.call(copy, "title")
      ? copy.title
      : stageTitles[index];
  };
  const fieldLabel = (index: number, path: string, fallback: string) => {
    const copy = copyForStep(index);
    const key = `field_${path.replaceAll(".", "_")}`;
    return Object.prototype.hasOwnProperty.call(copy, key)
      ? copy[key]
      : fallback;
  };
  const fieldCopyProps = (index: number, path: string) => {
    const key = path.replaceAll(".", "_");
    return {
      placeholder: copyForStep(index)[`placeholder_${key}`] || undefined,
      helper: copyForStep(index)[`helper_${key}`] || undefined,
    };
  };
  const saved = application.answers ?? {};
  const [answers, setAnswers] = useState<WizardAnswers>(() => {
    const initial = { ...saved };
    if (initial.bankDetails && typeof initial.bankDetails === "object") {
      const bank = { ...(initial.bankDetails as WizardAnswers) };
      delete bank.accountNumber;
      initial.bankDetails = bank;
    }
    return initial;
  });
  const [step, setStep] = useState(() =>
    normalizeStep(application.currentStep),
  );
  const stageBackground = pageThemeBackground(
    pageThemes?.[`workflow-step-${step + 1}`],
  );
  const [editingFromPreview, setEditingFromPreview] = useState(false);
  const [localImages, setLocalImages] = useState<Record<string, LocalImage>>(
    {},
  );
  const [cameraState, setCameraState] = useState<
    "idle" | "ready" | "recording" | "recorded" | "denied" | "unsupported"
  >("idle");
  const [cameraError, setCameraError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingConfirmed, setRecordingConfirmed] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountNumberProvided, setAccountNumberProvided] = useState(() =>
    Boolean(section(saved, "bankDetails").accountNumberMasked),
  );
  const [submitError, setSubmitError] = useState("");
  const [contactEmailInput, setContactEmailInput] = useState(
    application.applicantEmail ?? "",
  );
  const [emailCorrectionError, setEmailCorrectionError] = useState("");
  const [emailCorrectionSaved, setEmailCorrectionSaved] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingUrlRef = useRef("");
  const recordingBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const imageUrlsRef = useRef<string[]>([]);
  const reopenedSignature = reopenedSections.join(",");
  const allowedSections =
    reopenedSections.length > 0 ? new Set(reopenedSections) : null;
  const readOnly =
    !previewMode &&
    !evidenceLater &&
    !guestMode &&
    status !== "draft" &&
    reopenedSections.length === 0;
  const canEditSection = (sectionIndex: number) =>
    previewMode ||
    (!readOnly && (!allowedSections || allowedSections.has(sectionIndex)));
  const category = categories.find(
    (item) => item.id === application.categoryId,
  );
  const categoryCard = categoryCards.find(
    (card) => card.id === application.categoryId,
  );
  const categoryTitle =
    categoryCard?.title?.trim() || category?.name || application.categoryName;
  const categoryDescription =
    categoryCard?.description?.trim() ||
    category?.description ||
    "The account provider attached to this application.";
  const form = useForm<WizardAnswers>({
    defaultValues: answers,
    resolver: zodResolver(stageSchemas[Math.min(step, 7)]),
    mode: "onSubmit",
  });
  const {
    register,
    handleSubmit,
    formState,
    watch,
    setValue,
    reset,
    getValues,
  } = form;
  const employmentStatus = watch("workInformation.employmentStatus");
  const documentType = watch("proofOfIdentity.documentType");
  const isBackRequired = [
    "National ID",
    "Driver license",
    "Passport card",
  ].includes(String(documentType));

  useEffect(() => {
    const safeSaved = { ...saved };
    if (safeSaved.bankDetails && typeof safeSaved.bankDetails === "object") {
      const bank = { ...(safeSaved.bankDetails as WizardAnswers) };
      delete bank.accountNumber;
      safeSaved.bankDetails = bank;
    }
    setAnswers(safeSaved);
    setContactEmailInput(application.applicantEmail ?? "");
    setAccountNumberProvided(
      Boolean(section(safeSaved, "bankDetails").accountNumberMasked),
    );
    if (section(safeSaved, "bankDetails").accountNumberMasked)
      setAccountNumberProvided(true);
    reset(safeSaved);
    setStep(normalizeStep(application.currentStep));
  }, [
    application.id,
    application.updatedAt,
    application.currentStep,
    application.applicantEmail,
    reopenedSignature,
    reset,
  ]);

  useEffect(
    () => () => {
      imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [application.id],
  );

  useEffect(() => {
    if (cameraState === "ready" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraState]);

  const updateLocalImage = (key: string, file?: File) => {
    setLocalImages((current) => {
      const prior = current[key];
      if (prior?.url) URL.revokeObjectURL(prior.url);
      if (!file) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      const url = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "";
      if (url) imageUrlsRef.current.push(url);
      return { ...current, [key]: { file, url } };
    });
  };

  const onImageChange =
    (key: string) => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > maxUploadBytes) {
        setSubmitError(
          configuredText(
            step,
            "fileSizeError",
            "That file is larger than the displayed {size} MiB limit.",
          ).replaceAll(
            "{size}",
            String(Math.round(maxUploadBytes / 1024 / 1024)),
          ),
        );
        event.target.value = "";
        return;
      }
      if (
        !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
          file.type,
        )
      ) {
        setSubmitError(
          configuredText(
            step,
            "fileTypeError",
            "Choose a PDF, JPEG, PNG, or WebP document.",
          ),
        );
        event.target.value = "";
        return;
      }
      setSubmitError("");
      event.target.value = "";
      const locations: Record<
        string,
        [
          string,
          string,
          "identity_front" | "identity_back" | "education_certificate",
        ]
      > = {
        educationCertificate: [
          "education",
          "certificateObjectPath",
          "education_certificate",
        ],
        identityFront: ["proofOfIdentity", "frontObjectPath", "identity_front"],
        identityBack: ["proofOfIdentity", "backObjectPath", "identity_back"],
      };
      const location = locations[key];
      if (!uploadEvidence || !location) {
        updateLocalImage(key, file);
        return;
      }
      setEvidenceBusy(key);
      try {
        const uploaded = await uploadEvidence(file, location[2]);
        const currentValues = getValues();
        const nextAnswers = {
          ...currentValues,
          [location[0]]: {
            ...section(currentValues, location[0]),
            [location[1]]: uploaded.objectPath,
          },
        };
        setAnswers(nextAnswers);
        reset(nextAnswers);
        updateLocalImage(key, file);
        const saved = await saveStep(nextAnswers, step);
        if (!saved)
          setSubmitError(
            "The file is securely uploaded. Your other application details remain saved; continue to retry saving this section.",
          );
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "The file could not be uploaded securely. Please try again.",
        );
      } finally {
        setEvidenceBusy(null);
      }
    };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const requestCamera = async () => {
    setCameraError("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setCameraState("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      setCameraState("ready");
    } catch {
      setCameraState("denied");
      setCameraError(
        configuredText(
          5,
          "cameraPermissionError",
          "Camera or microphone access was not granted. You can try again in your browser settings.",
        ),
      );
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      setCameraState("unsupported");
      return;
    }
    try {
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      setRecordingConfirmed(false);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "video/webm",
        });
        recordingBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        if (recordingUrlRef.current)
          URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = url;
        setRecordingUrl(url);
        setCameraState("recorded");
        stopCamera();
      };
      recorder.start();
      setRecordingSeconds(0);
      setCameraState("recording");
      const began = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.min(12, Math.floor((Date.now() - began) / 1000));
        setRecordingSeconds(elapsed);
        if (elapsed >= 12) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current);
          timerRef.current = null;
          if (recorder.state !== "inactive") recorder.stop();
        }
      }, 100);
    } catch {
      setCameraError(
        configuredText(
          5,
          "recordingUnavailableError",
          "Recording is not available in this browser. You can try another browser.",
        ),
      );
      setCameraState("unsupported");
    }
  };

  const clearRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive")
      recorderRef.current.stop();
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = "";
    recordingBlobRef.current = null;
    setRecordingUrl("");
    setRecordingConfirmed(false);
    setRecordingSeconds(0);
    setCameraError("");
    setValue("liveVideoRecording.objectPath" as never, "" as never);
    setAnswers((current) => ({
      ...current,
      liveVideoRecording: {
        ...section(current, "liveVideoRecording"),
        objectPath: "",
      },
    }));
    void requestCamera();
  };

  const persistStage = async (data: WizardAnswers) => {
    const sectionKey = sectionKeys[step];
    let values = { ...section(data, sectionKey) };
    if (
      step === 5 &&
      recordingUrl &&
      recordingConfirmed &&
      uploadEvidence &&
      !values.objectPath
    ) {
      const recording = recordingBlobRef.current;
      if (!recording) {
        setSubmitError(
          configuredText(
            5,
            "recordingMissingError",
            "The recording is no longer available. Record it again before continuing.",
          ),
        );
        return;
      }
      setEvidenceBusy("verificationVideo");
      try {
        const contentType =
          recording.type.split(";")[0]?.trim().toLowerCase() || "video/webm";
        const extension = contentType === "video/mp4" ? "mp4" : "webm";
        const file = new File(
          [recording],
          `verification-recording.${extension}`,
          { type: contentType },
        );
        const uploaded = await uploadEvidence(file, "verification_video");
        values = {
          ...values,
          durationSeconds: 12,
          objectPath: uploaded.objectPath,
        };
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "The verification video could not be uploaded securely.",
        );
        setEvidenceBusy(null);
        return;
      } finally {
        setEvidenceBusy(null);
      }
    }
    const outgoing = { ...answers, [sectionKey]: values };
    if (step === 5 && recordingUrl && recordingConfirmed)
      outgoing.liveVideoRecording = { ...values, durationSeconds: 12 };
    if (step === 6) {
      if (accountNumber) outgoing.bankDetails = { ...values, accountNumber };
      else {
        const { accountNumber: _notSubmitted, ...maskedValues } = values;
        outgoing.bankDetails = maskedValues;
      }
    }
    const safeSection = { ...values };
    delete safeSection.accountNumber;
    if (step === 5 && recordingUrl && recordingConfirmed)
      safeSection.durationSeconds = 12;
    const merged = { ...answers, [sectionKey]: safeSection };
    const stepPosition = activeSteps.indexOf(step);
    const targetStep = editingFromPreview
      ? 7
      : activeSteps[Math.min(activeSteps.length - 1, stepPosition + 1)];
    if (previewMode) {
      setStep(targetStep);
      setEditingFromPreview(false);
      return;
    }
    const savedOk = await saveStep(outgoing, targetStep);
    if (!savedOk) return;
    setAnswers(merged);
    if (step === 6) {
      setAccountNumberProvided(
        Boolean(accountNumber) || Boolean(values.accountNumberMasked),
      );
      setAccountNumber("");
      reset(merged);
    }
    if (editingFromPreview) {
      setStep(targetStep);
      setEditingFromPreview(false);
      return;
    }
    setStep(targetStep);
  };

  const saveAndContinue = () => persistStage(getValues());

  const goBack = () => {
    if (editingFromPreview) {
      setStep(7);
      setEditingFromPreview(false);
      return;
    }
    if (step === 0) {
      const values = getValues();
      const currentPersonal = section(values, "personalInformation");
      const backAnswers = { ...answers, personalInformation: currentPersonal };
      void onBackToCategoryEntry(backAnswers);
      return;
    }
    const position = activeSteps.indexOf(step);
    setStep(activeSteps[Math.max(0, position - 1)]);
  };

  const openEdit = (index: number) => {
    if (!canEditSection(index)) return;
    reset({ ...answers });
    setStep(index);
    setEditingFromPreview(true);
  };

  const beginSubmit = async () => {
    setSubmitError("");
    if (previewMode) {
      setSubmitError("Admin preview only — no application will be submitted.");
      return;
    }
    await handleSubmit(async () => {
      const savedOk = await saveStep(answers, 7);
      if (!savedOk) {
        setSubmitError(
          "Your application could not be saved. Please try again.",
        );
        return;
      }
      const ok = await submit(answers);
      if (!ok)
        setSubmitError(
          "We could not submit your application. Your saved details remain available.",
        );
    })();
  };

  const correctContactEmail = async () => {
    setEmailCorrectionError("");
    setEmailCorrectionSaved(false);
    const parsed = z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .max(320)
      .safeParse(contactEmailInput);
    if (!parsed.success) {
      setEmailCorrectionError(
        parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      );
      return;
    }
    if (!updateContactEmail || !(await updateContactEmail(parsed.data))) {
      setEmailCorrectionError(
        "The contact email could not be updated. Please try again.",
      );
      return;
    }
    setContactEmailInput(parsed.data);
    setEmailCorrectionSaved(true);
  };

  const categoryEntryScreenId = `category-entry-${application.categoryId.replace(/^category-/, "")}`;
  const categoryEntryCopy = screenCopy[categoryEntryScreenId] ?? {};
  const categoryEntry = (
    categoryEntryFieldsByCategory[application.categoryId] ??
    Object.keys(categoryEntryLabels)
  ).map((key) => {
    const labelKey =
      key === "name"
        ? "nameLabel"
        : key === "nickname"
          ? "nicknameLabel"
          : "surnameLabel";
    return {
      key,
      label:
        categoryEntryCopy[labelKey]?.trim() || categoryEntryLabels[key] || key,
      value: textValue(answers, key),
    };
  });

  const sectionComplete = (index: number) => {
    const values = section(answers, sectionKeys[index]);
    const required: string[] = [
      [
        "firstName",
        "surname",
        "dateOfBirth",
        "nationality",
        "phone",
        "email",
        "residentialAddress",
        "stateRegion",
        "city",
      ],
      ["fullName", "relationship", "phone"],
      [
        "highestQualification",
        "institution",
        "courseField",
        "startYear",
        "completionYear",
        "certificationStatus",
      ],
      ["employmentStatus"],
      ["documentType"],
      ["consentAccepted"],
      [],
      [],
    ][index];
    if (required.some((key) => !isFilled(values, key))) return false;
    if (index === 3) {
      if (values.employmentStatus === "Employed")
        return (
          isFilled(values, "occupation") &&
          isFilled(values, "employer") &&
          isFilled(values, "workAddress")
        );
      if (values.employmentStatus === "Self-employed")
        return (
          isFilled(values, "businessName") && isFilled(values, "workAddress")
        );
    }
    if (index === 4) {
      const hasFront = Boolean(values.frontObjectPath);
      const requiresBack = [
        "National ID",
        "Driver license",
        "Passport card",
      ].includes(String(values.documentType));
      const hasBack = !requiresBack || Boolean(values.backObjectPath);
      return hasFront && hasBack;
    }
    if (index === 5) return Boolean(values.objectPath);
    if (index === 6) {
      const anyValue =
        ["bankName", "accountHolder", "accountType"].some((key) =>
          isFilled(values, key),
        ) ||
        accountNumberProvided ||
        Boolean(values.accountNumberMasked);
      return (
        !anyValue ||
        (isFilled(values, "bankName") &&
          isFilled(values, "accountHolder") &&
          (accountNumberProvided || Boolean(values.accountNumberMasked)))
      );
    }
    return true;
  };

  const missingUploads = useMemo(() => {
    if (evidenceLater) return [];
    const missing: string[] = [];
    if (!answer(answers, "proofOfIdentity", "frontObjectPath"))
      missing.push(
        configuredText(7, "missingIdentityFront", "identity document front"),
      );
    if (isBackRequired && !answer(answers, "proofOfIdentity", "backObjectPath"))
      missing.push(
        configuredText(7, "missingIdentityBack", "identity document back"),
      );
    if (!answer(answers, "liveVideoRecording", "objectPath"))
      missing.push(
        configuredText(7, "missingVerificationVideo", "video reference"),
      );
    if (!storageAvailable)
      missing.push(
        configuredText(
          7,
          "missingStorageReferences",
          "storage-backed references (secure storage unavailable)",
        ),
      );
    return missing;
  }, [answers, evidenceLater, isBackRequired, storageAvailable, generalCopy]);
  const readyToSubmit =
    previewMode || guestMode
      ? true
      : activeSteps
          .filter((index) => index < 7)
          .every((index) => sectionComplete(index)) &&
        missingUploads.length === 0;

  const stageErrors = formState.errors as Record<string, unknown>;
  const errorFor = (path: string) => {
    const errorObject = path
      .split(".")
      .reduce<unknown>(
        (current, part) =>
          current && typeof current === "object"
            ? (current as Record<string, unknown>)[part]
            : undefined,
        stageErrors,
      );
    if (
      !errorObject ||
      typeof errorObject !== "object" ||
      !("message" in errorObject)
    )
      return undefined;
    const message = String((errorObject as { message: unknown }).message);
    const key = path.replaceAll(".", "_");
    if (
      path === "bankDetails.accountNumber" &&
      message === "Enter 8 to 20 digits."
    ) {
      return (
        copyForStep(6).validation_bankDetails_accountNumberFormat || message
      );
    }
    return copyForStep(step)[`validation_${key}`] || message;
  };

  const renderFileUploader = (
    key: string,
    label: string,
    sectionIndex: number,
  ) => {
    const local = localImages[key];
    const referenceKey: Record<string, [string, string]> = {
      educationCertificate: ["education", "certificateObjectPath"],
      identityFront: ["proofOfIdentity", "frontObjectPath"],
      identityBack: ["proofOfIdentity", "backObjectPath"],
    };
    const reference = referenceKey[key]
      ? answer(answers, ...referenceKey[key])
      : undefined;
    const completedReference = Boolean(reference);
    return (
      <div className="ew-upload-block" data-testid={`state-upload-${key}`}>
        <div className="ew-upload-heading">
          <span className="ew-upload-icon">
            <FileImage size={17} />
          </span>
          <div>
            <b>{label}</b>
            <small>
              {completedReference
                ? configuredText(
                    sectionIndex,
                    "uploadedPrivate",
                    "Uploaded privately and attached to this application.",
                  )
                : uploadEvidence
                  ? configuredText(
                      sectionIndex,
                      "noPrivateUpload",
                      "No private file uploaded yet.",
                    )
                  : configuredText(
                      sectionIndex,
                      "noSecureUpload",
                      "No file has been uploaded to secure storage.",
                    )}
            </small>
          </div>
        </div>
        {local && (
          <div className="ew-image-preview">
            {local.url && (
              <img
                src={local.url}
                alt={`Preview of ${label.toLowerCase()}`}
                data-testid={`preview-${key}`}
              />
            )}
            <div>
              <b>{local.file.name}</b>
              <small>
                {completedReference
                  ? configuredText(
                      sectionIndex,
                      "privateUploadVerified",
                      "Private upload verified",
                    )
                  : configuredText(
                      sectionIndex,
                      "localPreviewOnly",
                      "Local preview only · not uploaded",
                    )}
              </small>
            </div>
            {!completedReference && (
              <button
                type="button"
                className="ew-icon-button"
                onClick={() => updateLocalImage(key)}
                aria-label={`${configuredText(sectionIndex, "removePreviewLabel", "Remove")} ${label.toLowerCase()} preview`}
                data-testid={`button-remove-${key}`}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className="ew-upload-controls">
          <label
            className={`ew-file-button ${!canEditSection(sectionIndex) ? "is-disabled" : ""}`}
          >
            <Upload size={15} />{" "}
            {evidenceBusy === key
              ? configuredText(
                  sectionIndex,
                  "uploadingLabel",
                  "Uploading privately…",
                )
              : completedReference
                ? configuredText(
                    sectionIndex,
                    "replaceUploadLabel",
                    "Replace uploaded file",
                  )
                : uploadEvidence
                  ? configuredText(
                      sectionIndex,
                      "chooseUploadLabel",
                      "Choose file and upload privately",
                    )
                  : configuredText(
                      sectionIndex,
                      "previewUploadLabel",
                      "Choose file for preview",
                    )}
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              disabled={!canEditSection(sectionIndex) || evidenceBusy !== null}
              onChange={onImageChange(key)}
              data-testid={`input-file-${key}`}
            />
          </label>
          <span className="ew-size-note">
            {configuredText(
              sectionIndex,
              "fileSizeNote",
              "PDF or image · up to {size} MiB",
            ).replaceAll(
              "{size}",
              String(Math.round(maxUploadBytes / 1024 / 1024)),
            )}
          </span>
        </div>
        {!storageAvailable && !uploadEvidence && (
          <p className="ew-inline-notice" data-testid={`notice-storage-${key}`}>
            <LockKeyhole size={14} />{" "}
            {configuredText(
              sectionIndex,
              "storageUnavailable",
              "Secure file storage is unavailable. This local preview will not be saved or submitted.",
            )}
          </p>
        )}
        {uploadEvidence && evidenceBusy === key && (
          <p className="ew-inline-notice" role="status">
            {configuredText(
              sectionIndex,
              "uploadingAndVerifying",
              "Uploading and verifying the private file…",
            )}
          </p>
        )}
      </div>
    );
  };

  const renderReviewField = (label: string, value: unknown, testId: string) => {
    const display =
      typeof value === "string" && value.trim()
        ? value
        : configuredText(7, "notProvided", "Not provided");
    return (
      <div
        className="ew-review-row"
        key={testId}
        data-testid={`review-${testId}`}
      >
        <span>{label}</span>
        <b>{display}</b>
      </div>
    );
  };

  const reviewStage = (
    index: number,
    title: string,
    fields: [string, unknown, string][],
  ) => (
    <section
      className={`ew-review-section ${sectionComplete(index) ? "is-complete" : ""}`}
      key={title}
      data-testid={`review-section-${index}`}
    >
      <header>
        <div className="ew-review-title">
          <span className="ew-review-dot">
            {sectionComplete(index) ? <Check size={12} /> : `0${index + 1}`}
          </span>
          <h3>{title}</h3>
        </div>
        <span
          className={`ew-review-status ${sectionComplete(index) ? "complete" : "incomplete"}`}
          data-testid={`status-section-${index}`}
        >
          {sectionComplete(index)
            ? configuredText(7, "completeLabel", "Complete")
            : configuredText(7, "incompleteLabel", "Incomplete")}
        </span>
        {canEditSection(index) && (
          <button
            type="button"
            className="ew-edit-link"
            onClick={() => openEdit(index)}
            data-testid={`button-edit-section-${index}`}
          >
            {configuredText(7, "editLabel", "Edit")}
          </button>
        )}
      </header>
      <div className="ew-review-fields">
        {fields.map(([label, value, key]) =>
          renderReviewField(label, value, key),
        )}
      </div>
    </section>
  );

  const categoryReview = (
    <section className="ew-category-review" data-testid="review-category">
      <div className="ew-category-top">
        <div>
          <span className="ew-mini-label">
            {categoryEntryCopy.sectionIdLabel?.trim() || "ACCOUNT PROVIDER"}
          </span>
          <h3>{categoryTitle}</h3>
          <p>{categoryDescription}</p>
        </div>
      </div>
      {categoryEntry.length > 0 && (
        <div className="ew-category-details">
          {categoryEntry.map((item) =>
            renderReviewField(item.label, item.value, `category-${item.key}`),
          )}
        </div>
      )}
    </section>
  );

  const uploadProgress = Math.min(
    100,
    Math.round((recordingSeconds / 12) * 100),
  );
  const activeStepPosition = Math.max(0, activeSteps.indexOf(step));

  return (
    <main
      className="ew-shell"
      style={stageBackground ? { background: stageBackground } : undefined}
      data-testid="enrollment-wizard"
    >
      <header className="ew-topbar">
        <Link
          href="/"
          className="ew-home-link"
          aria-label={configuredText(
            step,
            "homeLabel",
            "Enrollment portal home",
          )}
          data-testid="link-wizard-home"
        >
          <PortalWordmark />
        </Link>
        <div className="ew-top-meta">
          <span
            className={`ew-draft-status ${status === "draft" ? "" : "submitted"}`}
            data-testid="status-application"
          >
            {evidenceLater
              ? "details in progress"
              : status.replaceAll("_", " ")}
          </span>
          <span
            className="ew-reference"
            data-testid="text-application-reference"
          >
            {application.reference}
          </span>
        </div>
      </header>
      <div className="ew-layout">
        <aside className="ew-rail">
          <div className="ew-rail-intro">
            <span className="ew-mini-label">
              {configuredText(step, "applicationLabel", "YOUR APPLICATION")}
            </span>
            <h1>{configuredText(step, "railTitle", "One step at a time.")}</h1>
            <p>
              {configuredText(
                step,
                "railDescription",
                "Your progress is saved as you move through each section.",
              )}
            </p>
          </div>
          <nav
            className="ew-steps"
            aria-label={configuredText(
              step,
              "sectionsLabel",
              "Application sections",
            )}
          >
            {activeSteps.map((index, visibleIndex) => {
              const title = titleForStep(index);
              const active = step === index;
              const done = index < 7 && sectionComplete(index);
              const available = index === 7 || canEditSection(index);
              return (
                <button
                  key={title}
                  type="button"
                  className={`ew-step-nav ${active ? "active" : ""} ${done ? "done" : ""}`}
                  disabled={!available || readOnly}
                  onClick={() => {
                    if (index === 7) setStep(7);
                    else if (
                      allowedSections
                        ? allowedSections.has(index)
                        : index <= step
                    )
                      setStep(index);
                  }}
                  aria-current={active ? "step" : undefined}
                  data-testid={`button-stage-${index}`}
                >
                  <span className="ew-step-marker">
                    {done ? <Check size={13} /> : `0${visibleIndex + 1}`}
                  </span>
                  <span>{title}</span>
                </button>
              );
            })}
          </nav>
          <div className="ew-rail-security" data-testid="notice-privacy">
            <LockKeyhole size={16} />
            <span>
              <b>
                {configuredText(
                  step,
                  "privacyTitle",
                  "Your details stay private",
                )}
              </b>
              <small>
                {configuredText(
                  step,
                  "privacyDescription",
                  "Only share information requested for enrollment.",
                )}
              </small>
            </span>
          </div>
        </aside>

        <section
          className="ew-main"
          style={stageBackground ? { background: stageBackground } : undefined}
          aria-live="polite"
        >
          <div className="ew-mobile-progress" data-testid="text-progress">
            {configuredText(step, "progressPrefix", "SECTION")}{" "}
            {String(activeStepPosition + 1).padStart(2, "0")}{" "}
            {configuredText(step, "progressOf", "OF")}{" "}
            {String(activeSteps.length).padStart(2, "0")}
          </div>
          {step < 7 ? (
            <form
              className="ew-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveAndContinue();
              }}
              noValidate
            >
              <fieldset className="ew-preview-fields" disabled={previewMode}>
                <div className="ew-content-scroll">
                  <div className="ew-progress-line">
                    <span
                      style={{
                        width: `${((activeStepPosition + 1) / activeSteps.length) * 100}%`,
                      }}
                    />
                  </div>
                  {step === 0 && (
                    <>
                      {heading(
                        step,
                        titleForStep(step),
                        copyForStep(step).description ||
                          "Enter the personal details that identify your application.",
                        copyForStep(step).sectionIdLabel,
                      )}
                      <div className="ew-fields-grid">
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.firstName",
                            "First name",
                          )}
                          name="personalInformation.firstName"
                          register={register}
                          error={errorFor("personalInformation.firstName")}
                          autoComplete="given-name"
                          {...fieldCopyProps(
                            0,
                            "personalInformation.firstName",
                          )}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.middleName",
                            "Middle name",
                          )}
                          name="personalInformation.middleName"
                          register={register}
                          optional
                          optionalLabel={configuredText(
                            0,
                            "optionalLabel",
                            "Optional",
                          )}
                          autoComplete="additional-name"
                          {...fieldCopyProps(
                            0,
                            "personalInformation.middleName",
                          )}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.surname",
                            "Surname",
                          )}
                          name="personalInformation.surname"
                          register={register}
                          error={errorFor("personalInformation.surname")}
                          autoComplete="family-name"
                          {...fieldCopyProps(0, "personalInformation.surname")}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.dateOfBirth",
                            "Date of birth",
                          )}
                          name="personalInformation.dateOfBirth"
                          register={register}
                          error={errorFor("personalInformation.dateOfBirth")}
                          type="date"
                          max={new Date().toISOString().slice(0, 10)}
                          autoComplete="bday"
                          {...fieldCopyProps(
                            0,
                            "personalInformation.dateOfBirth",
                          )}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.nationality",
                            "Nationality",
                          )}
                          name="personalInformation.nationality"
                          register={register}
                          error={errorFor("personalInformation.nationality")}
                          autoComplete="country-name"
                          {...fieldCopyProps(
                            0,
                            "personalInformation.nationality",
                          )}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.phone",
                            "Phone number",
                          )}
                          name="personalInformation.phone"
                          register={register}
                          error={errorFor("personalInformation.phone")}
                          type="tel"
                          autoComplete="tel"
                          {...fieldCopyProps(0, "personalInformation.phone")}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.email",
                            "Email address",
                          )}
                          name="personalInformation.email"
                          register={register}
                          error={errorFor("personalInformation.email")}
                          type="email"
                          autoComplete="email"
                          {...fieldCopyProps(0, "personalInformation.email")}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.residentialAddress",
                            "Residential address",
                          )}
                          name="personalInformation.residentialAddress"
                          register={register}
                          error={errorFor(
                            "personalInformation.residentialAddress",
                          )}
                          autoComplete="street-address"
                          {...fieldCopyProps(
                            0,
                            "personalInformation.residentialAddress",
                          )}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.stateRegion",
                            "State / region",
                          )}
                          name="personalInformation.stateRegion"
                          register={register}
                          error={errorFor("personalInformation.stateRegion")}
                          autoComplete="address-level1"
                          {...fieldCopyProps(
                            0,
                            "personalInformation.stateRegion",
                          )}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.city",
                            "City / local government area",
                          )}
                          name="personalInformation.city"
                          register={register}
                          error={errorFor("personalInformation.city")}
                          autoComplete="address-level2"
                          {...fieldCopyProps(0, "personalInformation.city")}
                        />
                        <Field
                          label={fieldLabel(
                            0,
                            "personalInformation.postalCode",
                            "Postal code",
                          )}
                          name="personalInformation.postalCode"
                          register={register}
                          optional
                          optionalLabel={configuredText(
                            0,
                            "optionalLabel",
                            "Optional",
                          )}
                          autoComplete="postal-code"
                          {...fieldCopyProps(
                            0,
                            "personalInformation.postalCode",
                          )}
                        />
                      </div>
                    </>
                  )}
                  {step === 1 && (
                    <>
                      {heading(
                        step,
                        titleForStep(step),
                        copyForStep(step).description ||
                          "Name someone we may contact if we need to reach you.",
                        copyForStep(step).sectionIdLabel,
                      )}
                      <div className="ew-fields-grid">
                        <Field
                          label={fieldLabel(
                            1,
                            "nextOfKin.fullName",
                            "Full name",
                          )}
                          name="nextOfKin.fullName"
                          register={register}
                          error={errorFor("nextOfKin.fullName")}
                          autoComplete="off"
                          {...fieldCopyProps(1, "nextOfKin.fullName")}
                        />
                        <Field
                          label={fieldLabel(
                            1,
                            "nextOfKin.relationship",
                            "Relationship",
                          )}
                          name="nextOfKin.relationship"
                          register={register}
                          error={errorFor("nextOfKin.relationship")}
                          {...fieldCopyProps(1, "nextOfKin.relationship")}
                        />
                        <Field
                          label={fieldLabel(
                            1,
                            "nextOfKin.phone",
                            "Phone number",
                          )}
                          name="nextOfKin.phone"
                          register={register}
                          error={errorFor("nextOfKin.phone")}
                          type="tel"
                          autoComplete="off"
                          {...fieldCopyProps(1, "nextOfKin.phone")}
                        />
                        <Field
                          label={fieldLabel(
                            1,
                            "nextOfKin.email",
                            "Email address",
                          )}
                          name="nextOfKin.email"
                          register={register}
                          optional
                          optionalLabel={configuredText(
                            1,
                            "optionalLabel",
                            "Optional",
                          )}
                          type="email"
                          autoComplete="off"
                          {...fieldCopyProps(1, "nextOfKin.email")}
                        />
                      </div>
                      <div
                        className="ew-callout"
                        data-testid="notice-next-of-kin"
                      >
                        <ShieldCheck size={17} />
                        <p>
                          <b>
                            {configuredText(
                              1,
                              "authorizationTitle",
                              "Authorization reminder",
                            )}
                          </b>
                          <br />
                          {configuredText(
                            1,
                            "authorizationText",
                            "Your next of kin is a contact only. This does not authorize them to act for you or access your application.",
                          )}
                        </p>
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      {heading(
                        step,
                        titleForStep(step),
                        copyForStep(step).description ||
                          "Tell us about your education and any relevant qualifications.",
                        copyForStep(step).sectionIdLabel,
                      )}
                      <div className="ew-fields-grid">
                        <SelectField
                          label={fieldLabel(
                            2,
                            "education.highestQualification",
                            "Highest qualification",
                          )}
                          name="education.highestQualification"
                          register={register}
                          error={errorFor("education.highestQualification")}
                          options={[
                            "Primary education",
                            "Secondary education",
                            "Certificate",
                            "Diploma",
                            "Bachelor’s degree",
                            "Postgraduate degree",
                            "Other",
                          ]}
                          {...fieldCopyProps(
                            2,
                            "education.highestQualification",
                          )}
                        />
                        <Field
                          label={fieldLabel(
                            2,
                            "education.institution",
                            "Institution",
                          )}
                          name="education.institution"
                          register={register}
                          error={errorFor("education.institution")}
                          {...fieldCopyProps(2, "education.institution")}
                        />
                        <Field
                          label={fieldLabel(
                            2,
                            "education.courseField",
                            "Course / field",
                          )}
                          name="education.courseField"
                          register={register}
                          error={errorFor("education.courseField")}
                          {...fieldCopyProps(2, "education.courseField")}
                        />
                        <Field
                          label={fieldLabel(
                            2,
                            "education.startYear",
                            "Start year",
                          )}
                          name="education.startYear"
                          register={register}
                          error={errorFor("education.startYear")}
                          type="number"
                          min="1900"
                          max={new Date().getFullYear() + 10}
                          inputMode="numeric"
                          {...fieldCopyProps(2, "education.startYear")}
                        />
                        <Field
                          label={fieldLabel(
                            2,
                            "education.completionYear",
                            "Completion year",
                          )}
                          name="education.completionYear"
                          register={register}
                          error={errorFor("education.completionYear")}
                          type="number"
                          min="1900"
                          max={new Date().getFullYear() + 10}
                          inputMode="numeric"
                          {...fieldCopyProps(2, "education.completionYear")}
                        />
                        <SelectField
                          label={fieldLabel(
                            2,
                            "education.certificationStatus",
                            "Certification status",
                          )}
                          name="education.certificationStatus"
                          register={register}
                          error={errorFor("education.certificationStatus")}
                          options={[
                            "Completed",
                            "Awaiting certificate",
                            "In progress",
                          ]}
                          {...fieldCopyProps(
                            2,
                            "education.certificationStatus",
                          )}
                        />
                        <Field
                          label={fieldLabel(
                            2,
                            "education.additionalQualifications",
                            "Additional qualifications",
                          )}
                          name="education.additionalQualifications"
                          register={register}
                          optional
                          optionalLabel={configuredText(
                            2,
                            "optionalLabel",
                            "Optional",
                          )}
                          {...fieldCopyProps(
                            2,
                            "education.additionalQualifications",
                          )}
                        />
                      </div>
                      {!evidenceLater &&
                        renderFileUploader(
                          "educationCertificate",
                          fieldLabel(
                            2,
                            "education.certificateObjectPath",
                            "Certificate image",
                          ),
                          2,
                        )}
                    </>
                  )}
                  {step === 3 && (
                    <>
                      {heading(
                        step,
                        titleForStep(step),
                        copyForStep(step).description ||
                          "Share your current work situation. We do not ask for income.",
                        copyForStep(step).sectionIdLabel,
                      )}
                      <div className="ew-fields-grid">
                        <SelectField
                          label={fieldLabel(
                            3,
                            "workInformation.employmentStatus",
                            "Employment status",
                          )}
                          name="workInformation.employmentStatus"
                          register={register}
                          error={errorFor("workInformation.employmentStatus")}
                          options={[
                            "Employed",
                            "Self-employed",
                            "Not currently employed",
                          ]}
                          {...fieldCopyProps(
                            3,
                            "workInformation.employmentStatus",
                          )}
                        />
                        {employmentStatus === "Employed" && (
                          <>
                            <Field
                              label={fieldLabel(
                                3,
                                "workInformation.occupation",
                                "Occupation",
                              )}
                              name="workInformation.occupation"
                              register={register}
                              error={errorFor("workInformation.occupation")}
                              {...fieldCopyProps(
                                3,
                                "workInformation.occupation",
                              )}
                            />
                            <Field
                              label={fieldLabel(
                                3,
                                "workInformation.employer",
                                "Employer",
                              )}
                              name="workInformation.employer"
                              register={register}
                              error={errorFor("workInformation.employer")}
                              {...fieldCopyProps(3, "workInformation.employer")}
                            />
                          </>
                        )}
                        {employmentStatus === "Self-employed" && (
                          <>
                            <Field
                              label={fieldLabel(
                                3,
                                "workInformation.businessName",
                                "Business name",
                              )}
                              name="workInformation.businessName"
                              register={register}
                              error={errorFor("workInformation.businessName")}
                              {...fieldCopyProps(
                                3,
                                "workInformation.businessName",
                              )}
                            />
                            <Field
                              label={fieldLabel(
                                3,
                                "workInformation.workAddress",
                                "Business / work address",
                              )}
                              name="workInformation.workAddress"
                              register={register}
                              error={errorFor("workInformation.workAddress")}
                              {...fieldCopyProps(
                                3,
                                "workInformation.workAddress",
                              )}
                            />
                            <Field
                              label={fieldLabel(
                                3,
                                "workInformation.workPhone",
                                "Work phone",
                              )}
                              name="workInformation.workPhone"
                              register={register}
                              optional
                              optionalLabel={configuredText(
                                3,
                                "optionalLabel",
                                "Optional",
                              )}
                              type="tel"
                              {...fieldCopyProps(
                                3,
                                "workInformation.workPhone",
                              )}
                            />
                            <Field
                              label={fieldLabel(
                                3,
                                "workInformation.yearsExperience",
                                "Years of experience",
                              )}
                              name="workInformation.yearsExperience"
                              register={register}
                              optional
                              optionalLabel={configuredText(
                                3,
                                "optionalLabel",
                                "Optional",
                              )}
                              type="number"
                              min="0"
                              {...fieldCopyProps(
                                3,
                                "workInformation.yearsExperience",
                              )}
                            />
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {step === 4 && !evidenceLater && (
                    <>
                      {heading(
                        step,
                        titleForStep(step),
                        copyForStep(step).description ||
                          "Choose an identity document and add its images when storage is available.",
                        copyForStep(step).sectionIdLabel,
                      )}
                      <div className="ew-fields-grid ew-fields-single">
                        <SelectField
                          label={fieldLabel(
                            4,
                            "proofOfIdentity.documentType",
                            "Document type",
                          )}
                          name="proofOfIdentity.documentType"
                          register={register}
                          error={errorFor("proofOfIdentity.documentType")}
                          options={[
                            "National ID",
                            "Passport",
                            "Driver license",
                            "Passport card",
                            "Other",
                          ]}
                          {...fieldCopyProps(4, "proofOfIdentity.documentType")}
                        />
                        <Field
                          label={fieldLabel(
                            4,
                            "proofOfIdentity.documentNumber",
                            "Document number",
                          )}
                          name="proofOfIdentity.documentNumber"
                          register={register}
                          optional
                          optionalLabel={configuredText(
                            4,
                            "optionalLabel",
                            "Optional",
                          )}
                          autoComplete="off"
                          {...fieldCopyProps(
                            4,
                            "proofOfIdentity.documentNumber",
                          )}
                        />
                      </div>
                      <div className="ew-upload-grid">
                        {renderFileUploader(
                          "identityFront",
                          fieldLabel(
                            4,
                            "proofOfIdentity.frontObjectPath",
                            "Document front",
                          ),
                          4,
                        )}
                        {isBackRequired &&
                          renderFileUploader(
                            "identityBack",
                            fieldLabel(
                              4,
                              "proofOfIdentity.backObjectPath",
                              "Document back",
                            ),
                            4,
                          )}
                      </div>
                      {!storageAvailable && !uploadEvidence ? (
                        <div
                          className="ew-storage-banner"
                          data-testid="state-identity-incomplete"
                        >
                          <CircleAlert size={17} />
                          <div>
                            <b>
                              {configuredText(
                                4,
                                "identityFilesCannotAttach",
                                "Identity files cannot be attached",
                              )}
                            </b>
                            <p>
                              {configuredText(
                                4,
                                "localPreviewNotIncluded",
                                "Your previews stay on this device. Secure upload is unavailable, so they cannot be included with your application.",
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="ew-inline-notice"
                          data-testid="state-identity-incomplete"
                        >
                          <LockKeyhole size={14} />
                          {answer(answers, "proofOfIdentity", "frontObjectPath")
                            ? configuredText(
                                4,
                                "identitySaved",
                                "Identity file saved in private storage.",
                              )
                            : configuredText(
                                4,
                                "uploadIdentityFiles",
                                "Upload the required identity document files to continue.",
                              )}
                        </div>
                      )}
                    </>
                  )}
                  {step === 5 && !evidenceLater && (
                    <>
                      {heading(
                        step,
                        titleForStep(step),
                        copyForStep(step).description ||
                          "A short recording can be made here, but it is not an identity or liveness check.",
                        copyForStep(step).sectionIdLabel,
                      )}
                      <div className="ew-video-consent">
                        <label className="ew-consent-check">
                          <input
                            type="checkbox"
                            {...register("liveVideoRecording.consentAccepted")}
                            data-testid="check-video-consent"
                          />
                          <span className="ew-checkmark" />
                          <span>
                            {configuredText(
                              5,
                              "consentLabel",
                              "I consent to use my camera and microphone to make a 12-second video recording for this application.",
                            )}
                          </span>
                        </label>
                        {errorFor("liveVideoRecording.consentAccepted") && (
                          <span
                            className="ew-field-error"
                            role="alert"
                            data-testid="error-liveVideoRecording.consentAccepted"
                          >
                            {copyForStep(5).consentError ||
                              configuredText(
                                5,
                                "videoConsentError",
                                "Please provide your consent before recording.",
                              )}
                          </span>
                        )}
                      </div>
                      <div
                        className="ew-video-panel"
                        data-testid="state-video-recording"
                      >
                        {cameraState === "recorded" && recordingUrl ? (
                          <video
                            className="ew-video-preview"
                            src={recordingUrl}
                            controls
                            playsInline
                            data-testid="preview-recorded-video"
                          />
                        ) : cameraState === "ready" ||
                          cameraState === "recording" ? (
                          <video
                            className="ew-video-preview"
                            ref={videoRef}
                            muted
                            playsInline
                            data-testid="preview-camera"
                          />
                        ) : (
                          <div className="ew-video-placeholder">
                            <Video size={28} />
                            <b>
                              {cameraState === "denied"
                                ? configuredText(
                                    5,
                                    "cameraDenied",
                                    "Camera access was not granted",
                                  )
                                : cameraState === "unsupported"
                                  ? configuredText(
                                      5,
                                      "recordingUnavailable",
                                      "Recording is unavailable",
                                    )
                                  : configuredText(
                                      5,
                                      "cameraOff",
                                      "Your camera stays off until you choose to begin",
                                    )}
                            </b>
                            <span>
                              {cameraError ||
                                configuredText(
                                  5,
                                  "nothingRecorded",
                                  "Nothing is recorded without your action.",
                                )}
                            </span>
                          </div>
                        )}
                        {cameraState === "recording" && (
                          <div
                            className="ew-record-progress"
                            role="status"
                            aria-label={`${configuredText(5, "recordingLabel", "Recording in progress")} ${recordingSeconds} of 12 seconds`}
                          >
                            <div className="ew-record-progress-track">
                              <span style={{ width: `${uploadProgress}%` }} />
                            </div>
                            <span data-testid="text-recording-countdown">
                              {configuredText(
                                5,
                                "secondsRemaining",
                                "{seconds} seconds remaining",
                              ).replaceAll(
                                "{seconds}",
                                String(Math.max(0, 12 - recordingSeconds)),
                              )}
                            </span>
                          </div>
                        )}
                        <div className="ew-video-actions">
                          {cameraState === "idle" ||
                          cameraState === "denied" ||
                          cameraState === "unsupported" ? (
                            <button
                              type="button"
                              className="ew-button ew-button-primary"
                              onClick={() => void requestCamera()}
                              data-testid="button-enable-camera"
                            >
                              <Video size={16} />{" "}
                              {configuredText(
                                5,
                                "enableCameraLabel",
                                "Enable camera",
                              )}
                            </button>
                          ) : null}
                          {cameraState === "ready" && (
                            <button
                              type="button"
                              className="ew-button ew-button-primary"
                              disabled={
                                !watch("liveVideoRecording.consentAccepted")
                              }
                              onClick={startRecording}
                              data-testid="button-start-recording"
                            >
                              {configuredText(
                                5,
                                "startRecordingLabel",
                                "Start 12-second recording",
                              )}{" "}
                              <ArrowRight size={15} />
                            </button>
                          )}
                          {cameraState === "recording" && (
                            <span className="ew-recording-label">
                              <i />{" "}
                              {configuredText(
                                5,
                                "recordingLabel",
                                "Recording in progress",
                              )}
                            </span>
                          )}
                          {cameraState === "recorded" && (
                            <>
                              <button
                                type="button"
                                className="ew-button ew-button-quiet"
                                onClick={clearRecording}
                                data-testid="button-retake-video"
                              >
                                {configuredText(
                                  5,
                                  "retakeLabel",
                                  "Retake recording",
                                )}
                              </button>
                              <button
                                type="button"
                                className={`ew-button ${recordingConfirmed ? "ew-button-confirmed" : "ew-button-primary"}`}
                                onClick={() => setRecordingConfirmed(true)}
                                data-testid="button-confirm-recording"
                              >
                                {recordingConfirmed ? (
                                  <>
                                    <Check size={15} />{" "}
                                    {configuredText(
                                      5,
                                      "selectedRecordingLabel",
                                      "Recording selected",
                                    )}
                                  </>
                                ) : (
                                  configuredText(
                                    5,
                                    "confirmRecordingLabel",
                                    "Confirm recording",
                                  )
                                )}
                              </button>
                              <span className="ew-local-tag">
                                <FileVideo2 size={14} />{" "}
                                {answer(
                                  answers,
                                  "liveVideoRecording",
                                  "objectPath",
                                )
                                  ? configuredText(
                                      5,
                                      "savedPrivately",
                                      "Saved privately",
                                    )
                                  : configuredText(
                                      5,
                                      "notUploadedYet",
                                      "Not uploaded yet",
                                    )}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {!storageAvailable && !uploadEvidence ? (
                        <div
                          className="ew-storage-banner"
                          data-testid="state-video-incomplete"
                        >
                          <CircleAlert size={17} />
                          <div>
                            <b>
                              {configuredText(
                                5,
                                "recordingCannotAttach",
                                "Recording cannot be attached",
                              )}
                            </b>
                            <p>
                              {configuredText(
                                5,
                                "recordingCleared",
                                "This recording remains in memory and will be cleared when you leave this page. Video storage is unavailable.",
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="ew-inline-notice"
                          data-testid="state-video-incomplete"
                        >
                          <LockKeyhole size={14} />
                          {answer(answers, "liveVideoRecording", "objectPath")
                            ? configuredText(
                                5,
                                "verificationVideoSaved",
                                "Verification video saved in private storage.",
                              )
                            : configuredText(
                                5,
                                "confirmRecordingUpload",
                                "Confirm the recording and continue to upload it securely.",
                              )}
                        </div>
                      )}
                    </>
                  )}
                  {step === 6 && (
                    <>
                      {heading(
                        step,
                        titleForStep(step),
                        copyForStep(step).description ||
                          "Only provide bank details if they are genuinely needed for your enrollment.",
                        copyForStep(step).sectionIdLabel,
                      )}
                      <p className="ew-inline-notice">
                        <b>
                          {configuredText(
                            6,
                            "bankOptionalTitle",
                            "This section is optional.",
                          )}
                        </b>{" "}
                        {configuredText(
                          6,
                          "bankOptionalDescription",
                          "If payment details are not required for your enrollment, leave it blank and continue.",
                        )}
                      </p>
                      <div className="ew-fields-grid ew-fields-single">
                        <Field
                          label={fieldLabel(6, "bankDetails.bankName", "Bank")}
                          name="bankDetails.bankName"
                          register={register}
                          error={errorFor("bankDetails.bankName")}
                          autoComplete="off"
                          {...fieldCopyProps(6, "bankDetails.bankName")}
                        />
                        <Field
                          label={fieldLabel(
                            6,
                            "bankDetails.accountHolder",
                            "Account holder",
                          )}
                          name="bankDetails.accountHolder"
                          register={register}
                          error={errorFor("bankDetails.accountHolder")}
                          autoComplete="name"
                          {...fieldCopyProps(6, "bankDetails.accountHolder")}
                        />
                        <label
                          className="ew-field"
                          htmlFor="enroll-accountNumber"
                        >
                          <span className="ew-label">
                            {fieldLabel(
                              6,
                              "bankDetails.accountNumber",
                              "Account number",
                            )}
                          </span>
                          <input
                            id="enroll-accountNumber"
                            name="accountNumber"
                            className="ew-input"
                            type="password"
                            inputMode="numeric"
                            autoComplete="off"
                            value={accountNumber}
                            onChange={(event) => {
                              const value = event.target.value
                                .replace(/\D/g, "")
                                .slice(0, 20);
                              setAccountNumber(value);
                              setAccountNumberProvided(value.length > 0);
                              setValue(
                                "bankDetails.accountNumber" as never,
                                value as never,
                                { shouldValidate: true, shouldDirty: true },
                              );
                            }}
                            placeholder={
                              copyForStep(6)
                                .placeholder_bankDetails_accountNumber ||
                              "Enter account number"
                            }
                            data-testid="input-accountNumber"
                          />
                          {errorFor("bankDetails.accountNumber") && (
                            <span
                              className="ew-field-error"
                              role="alert"
                              data-testid="error-accountNumber"
                            >
                              {errorFor("bankDetails.accountNumber")}
                            </span>
                          )}
                          <span className="ew-help">
                            {copyForStep(6).helper_bankDetails_accountNumber ||
                              configuredText(
                                6,
                                "encryptedBankHelper",
                                "Encrypted before storage and masked in your applicant view. Authorized reviewers can access it for review.",
                              )}
                          </span>
                        </label>
                        <SelectField
                          label={fieldLabel(
                            6,
                            "bankDetails.accountType",
                            "Account type",
                          )}
                          name="bankDetails.accountType"
                          register={register}
                          options={["Personal", "Business"]}
                          placeholder={configuredText(
                            6,
                            "accountTypePlaceholder",
                            "Optional",
                          )}
                          helper={copyForStep(6).helper_bankDetails_accountType}
                        />
                      </div>
                      <div
                        className="ew-storage-banner"
                        data-testid="state-bank-privacy"
                      >
                        <LockKeyhole size={17} />
                        <div>
                          <b>
                            {configuredText(
                              6,
                              "bankEncryptedTitle",
                              "Your account number is encrypted at rest",
                            )}
                          </b>
                          <p>
                            {configuredText(
                              6,
                              "bankEncryptedDescription",
                              "It is never returned as plain text in your applicant record. Authorized reviewers access it through the protected review service.",
                            )}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                  {error && (
                    <p
                      className="ew-form-alert"
                      role="alert"
                      data-testid="text-save-error"
                    >
                      {error}
                    </p>
                  )}
                  {submitError && (
                    <p
                      className="ew-form-alert"
                      role="alert"
                      data-testid="text-local-input-error"
                    >
                      {submitError}
                    </p>
                  )}
                </div>
              </fieldset>
              <footer className="ew-form-footer">
                <button
                  type="button"
                  className="ew-button ew-button-quiet"
                  onClick={goBack}
                  disabled={isSaving}
                  data-testid="button-wizard-back"
                >
                  <ArrowLeft size={15} />{" "}
                  {copyForStep(step).backButtonLabel ||
                    (step === 0 && !editingFromPreview
                      ? "Back to account provider details"
                      : configuredText(step, "backLabel", "Back"))}
                </button>
                {editingFromPreview && (
                  <button
                    type="button"
                    className="ew-button ew-button-quiet ew-return-preview"
                    onClick={() => {
                      setStep(7);
                      setEditingFromPreview(false);
                    }}
                    data-testid="button-return-preview"
                  >
                    {configuredText(
                      step,
                      "returnPreviewLabel",
                      "Return to preview",
                    )}
                  </button>
                )}
                <span
                  className="ew-save-note"
                  data-testid="state-save-progress"
                >
                  {isSaving
                    ? configuredText(
                        step,
                        "saveInProgress",
                        "Saving your progress…",
                      )
                    : configuredText(
                        step,
                        "saveNote",
                        "Your work saves when you continue.",
                      )}
                </span>
                <button
                  type="submit"
                  className="ew-button ew-button-primary"
                  disabled={isSaving || readOnly}
                  data-testid="button-save-next"
                >
                  {isSaving
                    ? configuredText(step, "savingLabel", "Saving…")
                    : editingFromPreview
                      ? copyForStep(step).buttonLabel ||
                        configuredText(
                          step,
                          "saveAndReturnLabel",
                          "Save and return",
                        )
                      : copyForStep(step).buttonLabel ||
                        (step === 6
                          ? configuredText(
                              step,
                              "saveAndPreviewLabel",
                              "Save & preview",
                            )
                          : configuredText(
                              step,
                              "saveAndContinueLabel",
                              "Save & continue",
                            ))}{" "}
                  <ArrowRight size={15} />
                </button>
              </footer>
            </form>
          ) : (
            <div className="ew-preview" data-testid="enrollment-preview">
              <div className="ew-content-scroll">
                <div className="ew-progress-line">
                  <span style={{ width: "100%" }} />
                </div>
                {heading(
                  7,
                  titleForStep(7),
                  copyForStep(7).description ||
                    (guestMode
                      ? "Review your details and uploaded evidence before submitting. Use your application reference and private tracking key to check status afterward."
                      : evidenceLater
                        ? "Review your details. Staff will arrange the required identity files and verification video later."
                        : "Check your details carefully. Incomplete secure uploads must be attached before you can submit."),
                  copyForStep(7).sectionIdLabel,
                )}
                {categoryReview}
                {evidenceLater && (
                  <div
                    className="ew-storage-banner ew-evidence-later"
                    data-testid="notice-evidence-later"
                  >
                    <ShieldCheck size={17} />
                    <div>
                      <b>
                        {copyForStep(7).evidenceLaterTitle ||
                          "Identity evidence will be provided later"}
                      </b>
                      <p>
                        {copyForStep(7).evidenceLaterText ||
                          "Your details are saved now. Staff will arrange the identity files and verification video before review begins."}
                      </p>
                    </div>
                  </div>
                )}
                <div className="ew-review-stack">
                  {reviewStage(0, titleForStep(0), [
                    [
                      fieldLabel(
                        0,
                        "personalInformation.firstName",
                        "First name",
                      ),
                      answer(answers, "personalInformation", "firstName"),
                      "firstName",
                    ],
                    [
                      fieldLabel(
                        0,
                        "personalInformation.middleName",
                        "Middle name",
                      ),
                      answer(answers, "personalInformation", "middleName"),
                      "middleName",
                    ],
                    [
                      fieldLabel(0, "personalInformation.surname", "Surname"),
                      answer(answers, "personalInformation", "surname"),
                      "surname",
                    ],
                    [
                      fieldLabel(
                        0,
                        "personalInformation.dateOfBirth",
                        "Date of birth",
                      ),
                      answer(answers, "personalInformation", "dateOfBirth"),
                      "dateOfBirth",
                    ],
                    [
                      fieldLabel(
                        0,
                        "personalInformation.nationality",
                        "Nationality",
                      ),
                      answer(answers, "personalInformation", "nationality"),
                      "nationality",
                    ],
                    [
                      fieldLabel(
                        0,
                        "personalInformation.phone",
                        "Phone number",
                      ),
                      answer(answers, "personalInformation", "phone"),
                      "phone",
                    ],
                    [
                      fieldLabel(
                        0,
                        "personalInformation.email",
                        "Email address",
                      ),
                      answer(answers, "personalInformation", "email"),
                      "email",
                    ],
                    [
                      fieldLabel(
                        0,
                        "personalInformation.residentialAddress",
                        "Residential address",
                      ),
                      answer(
                        answers,
                        "personalInformation",
                        "residentialAddress",
                      ),
                      "residentialAddress",
                    ],
                    [
                      fieldLabel(
                        0,
                        "personalInformation.stateRegion",
                        "State / region",
                      ),
                      answer(answers, "personalInformation", "stateRegion"),
                      "stateRegion",
                    ],
                    [
                      fieldLabel(
                        0,
                        "personalInformation.city",
                        "City / local government area",
                      ),
                      answer(answers, "personalInformation", "city"),
                      "city",
                    ],
                    [
                      fieldLabel(
                        0,
                        "personalInformation.postalCode",
                        "Postal code",
                      ),
                      answer(answers, "personalInformation", "postalCode"),
                      "postalCode",
                    ],
                  ])}
                  {reviewStage(1, titleForStep(1), [
                    [
                      fieldLabel(1, "nextOfKin.fullName", "Full name"),
                      answer(answers, "nextOfKin", "fullName"),
                      "kinFullName",
                    ],
                    [
                      fieldLabel(1, "nextOfKin.relationship", "Relationship"),
                      answer(answers, "nextOfKin", "relationship"),
                      "kinRelationship",
                    ],
                    [
                      fieldLabel(1, "nextOfKin.phone", "Phone number"),
                      answer(answers, "nextOfKin", "phone"),
                      "kinPhone",
                    ],
                    [
                      fieldLabel(1, "nextOfKin.email", "Email address"),
                      answer(answers, "nextOfKin", "email"),
                      "kinEmail",
                    ],
                  ])}
                  {reviewStage(2, titleForStep(2), [
                    [
                      fieldLabel(
                        2,
                        "education.highestQualification",
                        "Highest qualification",
                      ),
                      answer(answers, "education", "highestQualification"),
                      "highestQualification",
                    ],
                    [
                      fieldLabel(2, "education.institution", "Institution"),
                      answer(answers, "education", "institution"),
                      "institution",
                    ],
                    [
                      fieldLabel(2, "education.courseField", "Course / field"),
                      answer(answers, "education", "courseField"),
                      "courseField",
                    ],
                    [
                      fieldLabel(2, "education.startYear", "Start year"),
                      answer(answers, "education", "startYear"),
                      "startYear",
                    ],
                    [
                      fieldLabel(
                        2,
                        "education.completionYear",
                        "Completion year",
                      ),
                      answer(answers, "education", "completionYear"),
                      "completionYear",
                    ],
                    [
                      fieldLabel(
                        2,
                        "education.certificationStatus",
                        "Certification status",
                      ),
                      answer(answers, "education", "certificationStatus"),
                      "certificationStatus",
                    ],
                    [
                      fieldLabel(
                        2,
                        "education.additionalQualifications",
                        "Additional qualifications",
                      ),
                      answer(answers, "education", "additionalQualifications"),
                      "additionalQualifications",
                    ],
                    [
                      fieldLabel(
                        2,
                        "education.certificateObjectPath",
                        "Certificate image",
                      ),
                      evidenceLater
                        ? configuredText(
                            7,
                            "providedLater",
                            "Provided later if required",
                          )
                        : answer(answers, "education", "certificateObjectPath")
                          ? configuredText(
                              7,
                              "uploadedReferenceAttached",
                              "Uploaded reference attached",
                            )
                          : configuredText(7, "notUploaded", "Not uploaded"),
                      "educationCertificate",
                    ],
                  ])}
                  {reviewStage(3, titleForStep(3), [
                    [
                      fieldLabel(
                        3,
                        "workInformation.employmentStatus",
                        "Employment status",
                      ),
                      answer(answers, "workInformation", "employmentStatus"),
                      "employmentStatus",
                    ],
                    [
                      fieldLabel(3, "workInformation.occupation", "Occupation"),
                      answer(answers, "workInformation", "occupation"),
                      "occupation",
                    ],
                    [
                      fieldLabel(3, "workInformation.employer", "Employer"),
                      answer(answers, "workInformation", "employer"),
                      "employer",
                    ],
                    [
                      fieldLabel(
                        3,
                        "workInformation.businessName",
                        "Business name",
                      ),
                      answer(answers, "workInformation", "businessName"),
                      "businessName",
                    ],
                    [
                      fieldLabel(
                        3,
                        "workInformation.workAddress",
                        "Business / work address",
                      ),
                      answer(answers, "workInformation", "workAddress"),
                      "workAddress",
                    ],
                    [
                      fieldLabel(3, "workInformation.workPhone", "Work phone"),
                      answer(answers, "workInformation", "workPhone"),
                      "workPhone",
                    ],
                    [
                      fieldLabel(
                        3,
                        "workInformation.yearsExperience",
                        "Years of experience",
                      ),
                      answer(answers, "workInformation", "yearsExperience"),
                      "yearsExperience",
                    ],
                  ])}
                  {!evidenceLater &&
                    reviewStage(4, titleForStep(4), [
                      [
                        fieldLabel(
                          4,
                          "proofOfIdentity.documentType",
                          "Document type",
                        ),
                        answer(answers, "proofOfIdentity", "documentType"),
                        "identityDocumentType",
                      ],
                      [
                        fieldLabel(
                          4,
                          "proofOfIdentity.documentNumber",
                          "Document number",
                        ),
                        answer(answers, "proofOfIdentity", "documentNumber"),
                        "identityDocumentNumber",
                      ],
                      [
                        fieldLabel(
                          4,
                          "proofOfIdentity.frontObjectPath",
                          "Document front",
                        ),
                        answer(answers, "proofOfIdentity", "frontObjectPath")
                          ? configuredText(
                              7,
                              "uploadedReferenceAttached",
                              "Uploaded reference attached",
                            )
                          : configuredText(7, "notUploaded", "Not uploaded"),
                        "identityFront",
                      ],
                      [
                        fieldLabel(
                          4,
                          "proofOfIdentity.backObjectPath",
                          "Document back",
                        ),
                        isBackRequired
                          ? answer(answers, "proofOfIdentity", "backObjectPath")
                            ? configuredText(
                                7,
                                "uploadedReferenceAttached",
                                "Uploaded reference attached",
                              )
                            : configuredText(7, "notUploaded", "Not uploaded")
                          : configuredText(
                              7,
                              "notApplicable",
                              "Not applicable",
                            ),
                        "identityBack",
                      ],
                    ])}
                  {!evidenceLater &&
                    reviewStage(5, titleForStep(5), [
                      [
                        configuredText(7, "consentReviewLabel", "Consent"),
                        answer(answers, "liveVideoRecording", "consentAccepted")
                          ? configuredText(7, "consentGiven", "Consent given")
                          : configuredText(7, "notConfirmed", "Not confirmed"),
                        "liveVideoConsent",
                      ],
                      [
                        configuredText(
                          7,
                          "recordingLengthLabel",
                          "Recording length",
                        ),
                        answer(answers, "liveVideoRecording", "durationSeconds")
                          ? configuredText(
                              7,
                              "recordedLocally",
                              "{seconds} seconds recorded locally",
                            ).replaceAll(
                              "{seconds}",
                              String(
                                answer(
                                  answers,
                                  "liveVideoRecording",
                                  "durationSeconds",
                                ),
                              ),
                            )
                          : configuredText(7, "notRecorded", "Not recorded"),
                        "liveVideoDuration",
                      ],
                      [
                        configuredText(
                          7,
                          "savedVideoReferenceLabel",
                          "Saved video reference",
                        ),
                        answer(answers, "liveVideoRecording", "objectPath")
                          ? configuredText(
                              7,
                              "referenceAttached",
                              "Reference attached",
                            )
                          : configuredText(7, "notUploaded", "Not uploaded"),
                        "liveVideoReference",
                      ],
                    ])}
                  {reviewStage(6, titleForStep(6), [
                    [
                      fieldLabel(6, "bankDetails.bankName", "Bank"),
                      answer(answers, "bankDetails", "bankName"),
                      "bankName",
                    ],
                    [
                      fieldLabel(
                        6,
                        "bankDetails.accountHolder",
                        "Account holder",
                      ),
                      answer(answers, "bankDetails", "accountHolder"),
                      "accountHolder",
                    ],
                    [
                      fieldLabel(
                        6,
                        "bankDetails.accountNumber",
                        "Account number",
                      ),
                      answer(answers, "bankDetails", "accountNumberMasked") ||
                      accountNumberProvided
                        ? configuredText(
                            7,
                            "accountDetailsMasked",
                            "Account details on file (masked)",
                          )
                        : configuredText(7, "notEntered", "Not entered"),
                      "accountNumber",
                    ],
                    [
                      fieldLabel(6, "bankDetails.accountType", "Account type"),
                      answer(answers, "bankDetails", "accountType"),
                      "accountType",
                    ],
                  ])}
                </div>
                {guestMode && updateContactEmail && (
                  <section
                    className="ew-email-correction"
                    data-testid="section-correct-contact-email"
                  >
                    <div>
                      <b>
                        {configuredText(
                          7,
                          "correctionTitle",
                          "Need to correct your contact email?",
                        )}
                      </b>
                      <p>
                        {configuredText(
                          7,
                          "correctionDescription",
                          "Use an address the enrollment team can reach if follow-up is needed.",
                        )}
                      </p>
                    </div>
                    <label className="ew-field" htmlFor="guest-contact-email">
                      <span className="ew-label">
                        {configuredText(7, "correctionLabel", "Contact email")}
                      </span>
                      <input
                        id="guest-contact-email"
                        className="ew-input"
                        type="email"
                        autoComplete="email"
                        maxLength={320}
                        value={contactEmailInput}
                        onChange={(event) => {
                          setContactEmailInput(event.target.value);
                          setEmailCorrectionError("");
                          setEmailCorrectionSaved(false);
                        }}
                        data-testid="input-correct-contact-email"
                      />
                    </label>
                    {emailCorrectionError && (
                      <p
                        className="ew-field-error"
                        role="alert"
                        data-testid="error-correct-contact-email"
                      >
                        {emailCorrectionError}
                      </p>
                    )}
                    {emailCorrectionSaved && (
                      <p
                        className="ew-email-correction-success"
                        role="status"
                        data-testid="success-correct-contact-email"
                      >
                        {configuredText(
                          7,
                          "correctionSaved",
                          "Email updated. Your Clerk account continues to protect access to this application.",
                        )}
                      </p>
                    )}
                    <button
                      type="button"
                      className="ew-button ew-button-quiet"
                      onClick={() => void correctContactEmail()}
                      disabled={
                        isSaving ||
                        contactEmailInput.trim().toLowerCase() ===
                          (application.applicantEmail ?? "")
                            .trim()
                            .toLowerCase()
                      }
                      data-testid="button-save-contact-email"
                    >
                      {configuredText(
                        7,
                        "correctionSaveLabel",
                        "Save contact email",
                      )}
                    </button>
                  </section>
                )}
                <div
                  className="ew-submit-gate"
                  data-testid="state-submit-readiness"
                >
                  <span className="ew-gate-icon">
                    {readyToSubmit ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <CircleAlert size={18} />
                    )}
                  </span>
                  <div>
                    <b>
                      {readyToSubmit
                        ? configuredText(
                            7,
                            "readyToSubmitTitle",
                            "Ready to submit",
                          )
                        : configuredText(
                            7,
                            "missingRequiredTitle",
                            "A few required items are still missing",
                          )}
                    </b>
                    <p>
                      {guestMode
                        ? configuredText(
                            7,
                            "guestSubmitDescription",
                            "You can submit these saved details now. Any incomplete details or evidence remain visible to authorized reviewers.",
                          )
                        : evidenceLater
                          ? configuredText(
                              7,
                              "evidenceLaterSubmitDescription",
                              "Submitting saves your application details. Identity documents and the verification video will be collected later, before review.",
                            )
                          : missingUploads.length
                            ? `${storageAvailable ? configuredText(7, "requiredItemsPrefix", "Required items still missing") : configuredText(7, "storageReferencesMissing", "Secure storage is unavailable; required references are missing")}: ${missingUploads.join(", ")}.`
                            : configuredText(
                                7,
                                "completeRequiredDescription",
                                "Complete all required details before submitting.",
                              )}
                    </p>
                  </div>
                </div>
                {(error || submitError) && (
                  <p
                    className="ew-form-alert"
                    role="alert"
                    data-testid="text-submit-error"
                  >
                    {submitError || error}
                  </p>
                )}
              </div>
              <footer className="ew-form-footer">
                <button
                  type="button"
                  className="ew-button ew-button-quiet"
                  onClick={() =>
                    setStep(activeSteps[Math.max(0, activeSteps.length - 2)])
                  }
                  data-testid="button-preview-back"
                >
                  <ArrowLeft size={15} />{" "}
                  {configuredText(7, "previewBackLabel", "Back")}
                </button>
                <span className="ew-save-note">
                  {configuredText(
                    7,
                    "previewSaveNote",
                    "You can edit any section before submitting.",
                  )}
                </span>
                <button
                  type="button"
                  className="ew-button ew-button-primary"
                  onClick={() => void beginSubmit()}
                  disabled={
                    previewMode ||
                    !readyToSubmit ||
                    isSaving ||
                    isSubmitting ||
                    readOnly
                  }
                  data-testid="button-submit-enrollment"
                >
                  {previewMode
                    ? "Preview only"
                    : isSubmitting
                      ? configuredText(7, "submitLoadingLabel", "Submitting…")
                      : copyForStep(7).buttonLabel ||
                        copyForStep(7).submitLabel ||
                        configuredText(
                          7,
                          "submitLabel",
                          "Submit Enrollment",
                        )}{" "}
                  <ArrowRight size={15} />
                </button>
              </footer>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default EnrollmentWizard;
