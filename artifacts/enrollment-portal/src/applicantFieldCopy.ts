export type ApplicantFieldCopy = {
  path: string;
  label: string;
  placeholderDefault?: string;
  validationDefault?: string;
};

export const guestContactFieldCopy: ApplicantFieldCopy[] = [
  {
    path: 'fullName',
    label: 'Full name',
    placeholderDefault: 'As shown on your identity document',
    validationDefault: 'Enter your full name.',
  },
  {
    path: 'email',
    label: 'Email address',
    placeholderDefault: 'you@example.com',
    validationDefault: 'Enter a valid email address.',
  },
];

export const applicantFieldCopy: Record<string, ApplicantFieldCopy[]> = {
  'workflow-step-1': [
    { path: 'personalInformation.firstName', label: 'First name', placeholderDefault: '', validationDefault: 'Enter your first name.' },
    { path: 'personalInformation.middleName', label: 'Middle name', placeholderDefault: '' },
    { path: 'personalInformation.surname', label: 'Surname', placeholderDefault: '', validationDefault: 'Enter your surname.' },
    { path: 'personalInformation.dateOfBirth', label: 'Date of birth', placeholderDefault: '', validationDefault: 'Enter your date of birth.' },
    { path: 'personalInformation.nationality', label: 'Nationality', placeholderDefault: '', validationDefault: 'Enter your nationality.' },
    { path: 'personalInformation.phone', label: 'Phone number', placeholderDefault: '', validationDefault: 'Enter a valid phone number.' },
    { path: 'personalInformation.email', label: 'Email address', placeholderDefault: '', validationDefault: 'Enter a valid email address.' },
    { path: 'personalInformation.residentialAddress', label: 'Residential address', placeholderDefault: '', validationDefault: 'Enter your residential address.' },
    { path: 'personalInformation.stateRegion', label: 'State / region', placeholderDefault: '', validationDefault: 'Enter your state or region.' },
    { path: 'personalInformation.city', label: 'City / local government area', placeholderDefault: '', validationDefault: 'Enter your city or local government area.' },
    { path: 'personalInformation.postalCode', label: 'Postal code', placeholderDefault: '' },
  ],
  'workflow-step-2': [
    { path: 'nextOfKin.fullName', label: 'Full name', placeholderDefault: '', validationDefault: 'Enter your next of kin’s full name.' },
    { path: 'nextOfKin.relationship', label: 'Relationship', placeholderDefault: '', validationDefault: 'Enter their relationship to you.' },
    { path: 'nextOfKin.phone', label: 'Phone number', placeholderDefault: '', validationDefault: 'Enter a valid phone number.' },
    { path: 'nextOfKin.email', label: 'Email address', placeholderDefault: '', validationDefault: 'Enter a valid email address.' },
    { path: 'nextOfKin.residentialAddress', label: 'Residential address', placeholderDefault: '', validationDefault: 'Enter their residential address.' },
    { path: 'nextOfKin.city', label: 'City', placeholderDefault: '', validationDefault: 'Enter their city.' },
    { path: 'nextOfKin.stateRegion', label: 'State / region', placeholderDefault: '', validationDefault: 'Enter their state or region.' },
  ],
  'workflow-step-3': [
    { path: 'education.highestQualification', label: 'Highest qualification', placeholderDefault: 'Choose an option', validationDefault: 'Select your highest qualification.' },
    { path: 'education.institution', label: 'Institution', placeholderDefault: '', validationDefault: 'Enter your institution.' },
    { path: 'education.courseField', label: 'Course / field', placeholderDefault: '', validationDefault: 'Enter your course or field.' },
    { path: 'education.startYear', label: 'Start year', placeholderDefault: '', validationDefault: 'Enter your start year.' },
    { path: 'education.completionYear', label: 'Completion year', placeholderDefault: '', validationDefault: 'Enter your completion year.' },
    { path: 'education.certificationStatus', label: 'Certification status', placeholderDefault: 'Choose an option', validationDefault: 'Select your certification status.' },
    { path: 'education.additionalQualifications', label: 'Additional qualifications', placeholderDefault: '' },
  ],
  'workflow-step-4': [
    { path: 'workInformation.employmentStatus', label: 'Employment status', placeholderDefault: 'Choose an option', validationDefault: 'Select your employment status.' },
    { path: 'workInformation.occupation', label: 'Occupation', placeholderDefault: '', validationDefault: 'Enter your occupation.' },
    { path: 'workInformation.employer', label: 'Employer', placeholderDefault: '', validationDefault: 'Enter your employer.' },
    { path: 'workInformation.businessName', label: 'Business name', placeholderDefault: '', validationDefault: 'Enter your business name.' },
    { path: 'workInformation.workAddress', label: 'Business / work address', placeholderDefault: '', validationDefault: 'Enter your work address.' },
    { path: 'workInformation.workPhone', label: 'Work phone', placeholderDefault: '' },
    { path: 'workInformation.yearsExperience', label: 'Years of experience', placeholderDefault: '' },
  ],
  'workflow-step-5': [
    { path: 'proofOfIdentity.documentType', label: 'Document type', placeholderDefault: 'Choose an option', validationDefault: 'Select a document type.' },
    { path: 'proofOfIdentity.documentNumber', label: 'Document number', placeholderDefault: '' },
  ],
  'workflow-step-6': [
    { path: 'liveVideoRecording.consentAccepted', label: 'Video recording consent', validationDefault: 'Please provide your consent before recording.' },
  ],
  'workflow-step-7': [
    { path: 'bankDetails.bankName', label: 'Bank', placeholderDefault: '', validationDefault: 'Enter your bank name.' },
    { path: 'bankDetails.accountHolder', label: 'Account holder', placeholderDefault: '', validationDefault: 'Enter the account holder name.' },
    { path: 'bankDetails.accountNumber', label: 'Account number', placeholderDefault: 'Enter account number', validationDefault: 'Enter your account number.' },
    { path: 'bankDetails.accountType', label: 'Account type', placeholderDefault: 'Optional' },
  ],
  'workflow-step-8': [
    { path: 'reviewDeclarationAccepted', label: 'Declaration', validationDefault: 'Confirm the declaration before submitting.' },
  ],
};

export function applicantPlaceholderKey(path: string) {
  return `placeholder_${path.replaceAll('.', '_')}`;
}

export function applicantValidationKey(path: string) {
  return `validation_${path.replaceAll('.', '_')}`;
}
