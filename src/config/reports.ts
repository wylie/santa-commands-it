export const reportReasons = [
  {
    value: 'bullying',
    label: 'Bullying or harassment',
  },
  {
    value: 'hate',
    label: 'Hate or abusive language',
  },
  {
    value: 'personal-information',
    label: 'Personal information',
  },
  {
    value: 'inappropriate',
    label: 'Sexual or inappropriate content',
  },
  {
    value: 'threats',
    label: 'Threats or dangerous content',
  },
  {
    value: 'spam',
    label: 'Spam',
  },
  {
    value: 'other',
    label: 'Something else',
  },
] as const;

export type ReportReason = (typeof reportReasons)[number]['value'];

export const REPORT_REASON_VALUES = reportReasons.map((reason) => reason.value);

export function isReportReason(value: unknown): value is ReportReason {
  return (
    typeof value === 'string' &&
    REPORT_REASON_VALUES.includes(value as ReportReason)
  );
}
