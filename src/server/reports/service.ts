import { reportReasons, type ReportReason } from '@/config/reports';
import { securitySettings } from '@/config/security';
import type {
  InvalidReportResponse,
  SubmitReportResponse,
} from '@/utils/reports';
import { isValidPublicRulingId } from '@/utils/rulingPages';
import { validateOptionalNote } from '@/utils/validation';
import type { RulingReportsRepository } from '@/server/reports/repository';
import type { RulingsRepository } from '@/server/rulings/repository';

export const REPORT_SUCCESS_MESSAGE =
  "THANK YOU. SANTA'S WORKSHOP HAS RECEIVED YOUR REPORT.";
export const REPORT_SUCCESS_SUPPORTING_MESSAGE =
  'The command will remain visible unless it is reviewed and removed later.';
export const REPORT_DUPLICATE_MESSAGE =
  "Santa's workshop already has a recent report from here about this command.";
export const REPORT_RATE_LIMITED_MESSAGE =
  'SANTA NEEDS A MOMENT. PLEASE TRY AGAIN LATER.';
export const REPORT_RATE_LIMITED_SUPPORTING_MESSAGE =
  'The workshop has already received several reports from here recently.';
export const REPORT_NOT_FOUND_MESSAGE = 'SANTA CANNOT FIND THAT REQUEST.';
export const REPORT_GENERIC_ERROR_MESSAGE =
  "Santa's workshop had a small mishap. Please try again.";

export type SubmitRulingReportDependencies = {
  rulingsRepository: RulingsRepository;
  reportsRepository: RulingReportsRepository;
  nowProvider: () => Date;
  scenario: 'normal' | 'report-error';
};

export type SubmitRulingReportContext = {
  publicId: string;
  clientKeyHash: string;
};

type ReportPayload = {
  reason: ReportReason | '';
  note: string;
};

function coerceReportPayload(input: unknown): ReportPayload {
  if (typeof input !== 'object' || input === null) {
    return {
      reason: '',
      note: '',
    };
  }

  const record = input as Record<string, unknown>;
  const reasonValue = typeof record.reason === 'string' ? record.reason : '';
  const reason = reportReasons.some((option) => option.value === reasonValue)
    ? (reasonValue as ReportReason)
    : '';

  return {
    reason,
    note: typeof record.note === 'string' ? record.note : '',
  };
}

function buildInvalidResponse(
  reason: ReportReason | '',
  note: ReturnType<typeof validateOptionalNote>,
): InvalidReportResponse {
  return {
    status: 'invalid',
    fieldErrors: {
      reason: reason ? undefined : 'Please choose a reason for the report.',
      note: note.valid ? undefined : note.error,
    },
  };
}

export async function submitRulingReport(
  input: unknown,
  context: SubmitRulingReportContext,
  dependencies: SubmitRulingReportDependencies,
): Promise<SubmitReportResponse> {
  if (dependencies.scenario === 'report-error') {
    throw new Error('Simulated test report failure.');
  }

  if (!isValidPublicRulingId(context.publicId)) {
    return {
      status: 'not-found',
      message: REPORT_NOT_FOUND_MESSAGE,
    };
  }

  const payload = coerceReportPayload(input);
  const validatedNote = validateOptionalNote(
    payload.note,
    securitySettings.reports.noteMaxLength,
  );

  if (!payload.reason || !validatedNote.valid) {
    return buildInvalidResponse(payload.reason, validatedNote);
  }

  const rulingReference =
    await dependencies.rulingsRepository.getRulingReferenceByPublicId(
      context.publicId,
    );

  if (!rulingReference) {
    return {
      status: 'not-found',
      message: REPORT_NOT_FOUND_MESSAGE,
    };
  }

  const now = dependencies.nowProvider();
  const perRulingWindowStart = new Date(
    now.getTime() -
      securitySettings.reports.rateLimits.perRulingWindow.windowMs,
  );
  const alreadyReported =
    await dependencies.reportsRepository.hasRecentReportForRuling(
      rulingReference.id,
      context.clientKeyHash,
      perRulingWindowStart,
    );

  if (alreadyReported) {
    return {
      status: 'duplicate',
      message: REPORT_DUPLICATE_MESSAGE,
    };
  }

  const hourlyWindowStart = new Date(
    now.getTime() - securitySettings.reports.rateLimits.hourlyWindow.windowMs,
  );
  const reportCount = await dependencies.reportsRepository.countReportsSince(
    context.clientKeyHash,
    hourlyWindowStart,
  );

  if (
    reportCount >= securitySettings.reports.rateLimits.hourlyWindow.maxAttempts
  ) {
    return {
      status: 'rate-limited',
      message: REPORT_RATE_LIMITED_MESSAGE,
      supportingMessage: REPORT_RATE_LIMITED_SUPPORTING_MESSAGE,
      retryAfterSeconds: Math.ceil(
        securitySettings.reports.rateLimits.hourlyWindow.windowMs / 1000,
      ),
    };
  }

  await dependencies.reportsRepository.createReport({
    rulingId: rulingReference.id,
    clientKeyHash: context.clientKeyHash,
    reason: payload.reason,
    note: validatedNote.value,
    createdAt: now,
  });

  return {
    status: 'reported',
    message: REPORT_SUCCESS_MESSAGE,
    supportingMessage: REPORT_SUCCESS_SUPPORTING_MESSAGE,
  };
}
