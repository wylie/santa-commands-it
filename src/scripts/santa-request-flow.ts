import { santaResponses } from '@/config/responses';
import { REQUEST_LIMITS } from '@/config/request';
import { santaSettings } from '@/config/santa-settings';
import { TimedRequestError, fetchJsonWithTimeout } from '@/scripts/fetch-json';
import {
  formatCharacterCount,
  getCharacterCountState,
} from '@/utils/characterCount';
import {
  formatRulingTimestamp,
  getDecisionLabel,
  getDecisionPanelTitle,
  isSubmitRulingResponse,
  type CreatedRulingResponse,
  type FocusField,
  type PublicRuling,
  type SubmitRulingResponse,
} from '@/utils/rulings';
import { buildRulingPath } from '@/utils/rulingPages';
import { validateName, validateRequest } from '@/utils/validation';

type PanelMode =
  | 'opening'
  | 'considering'
  | 'approved'
  | 'random-coal'
  | 'blocked'
  | 'rate-limited'
  | 'error';

const SUBMIT_LABEL = 'ASK SANTA';
const CONSIDERING_LABEL = 'SANTA IS CONSIDERING...';
const RESET_LABEL = 'ASK SANTA SOMETHING ELSE';
const ERROR_MESSAGE = "Santa's workshop had a small mishap. Please try again.";
const TIMEOUT_MESSAGE =
  "Santa's workshop is taking longer than usual. Please try again.";

function generateIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function getDelayOverride(): number | undefined {
  const override = window.__SANTA_TEST__?.consideringDelayMs;

  if (typeof override === 'number' && override >= 0) {
    return override;
  }

  return undefined;
}

function getMinimumConsideringDelay(): number {
  return getDelayOverride() ?? santaSettings.consideringDelay.minimum;
}

function setDisabledState(
  controls: Array<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>,
  disabled: boolean,
): void {
  controls.forEach((control) => {
    control.disabled = disabled;
  });
}

function focusElement(element: HTMLElement): void {
  window.requestAnimationFrame(() => {
    element.focus();
  });
}

function createRecentRulingItem(ruling: PublicRuling): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'recent-rulings__item';
  item.dataset.rulingId = ruling.publicId;

  const meta = document.createElement('div');
  meta.className = 'recent-rulings__meta';

  const decision = document.createElement('p');
  decision.className = 'recent-rulings__decision';
  decision.dataset.decision = ruling.decision;
  decision.textContent = getDecisionLabel(ruling.decision);

  const time = document.createElement('time');
  time.className = 'recent-rulings__time';
  time.dateTime = ruling.createdAt;
  time.textContent = formatRulingTimestamp(ruling.createdAt);

  const name = document.createElement('p');
  name.className = 'recent-rulings__name';
  name.textContent = ruling.displayName;

  const request = document.createElement('p');
  request.className = 'recent-rulings__request';
  request.textContent = ruling.requestText;

  const response = document.createElement('p');
  response.className = 'recent-rulings__response';
  response.textContent = ruling.santaResponse;

  const action = document.createElement('p');
  action.className = 'recent-rulings__action';

  const link = document.createElement('a');
  link.className = 'recent-rulings__link';
  link.href = buildRulingPath(ruling.publicId);
  link.textContent = 'VIEW & SHARE';
  link.setAttribute(
    'aria-label',
    `View and share Santa's ruling for ${ruling.displayName}`,
  );

  meta.append(decision, time);
  action.append(link);
  item.append(meta, name, request, response, action);

  return item;
}

export function initSantaRequestFlow(): void {
  const form = document.querySelector('[data-request-form]');
  const responsePanel = document.querySelector('[data-response-panel]');
  const responseTitle = document.querySelector('[data-response-title]');
  const responseSupporting = document.querySelector(
    '[data-response-supporting]',
  );
  const responseRequest = document.querySelector('[data-response-request]');
  const recentRulingsSection = document.querySelector('[data-recent-rulings]');

  if (
    !(form instanceof HTMLFormElement) ||
    !(responsePanel instanceof HTMLElement) ||
    !(responseTitle instanceof HTMLElement) ||
    !(responseSupporting instanceof HTMLElement) ||
    !(responseRequest instanceof HTMLElement) ||
    !(recentRulingsSection instanceof HTMLElement)
  ) {
    return;
  }

  const nameInput = form.querySelector('[data-request-name]');
  const requestInput = form.querySelector('[data-request-input]');
  const requestCounter = form.querySelector('[data-request-counter]');
  const submitButton = form.querySelector('[data-request-submit]');
  const permalink = form.querySelector('[data-request-permalink]');
  const trapInput = form.querySelector('[data-request-trap]');
  const status = form.querySelector('[data-request-status]');
  const nameError = form.querySelector('[data-field-error="name"]');
  const requestError = form.querySelector('[data-field-error="request"]');
  const recentList = recentRulingsSection.querySelector('[data-recent-list]');
  const recentEmptyState = recentRulingsSection.querySelector(
    '[data-recent-empty]',
  );
  const recentUnavailableState = recentRulingsSection.querySelector(
    '[data-recent-unavailable]',
  );
  const recentAnnouncement = recentRulingsSection.querySelector(
    '[data-recent-announcement]',
  );

  if (
    !(nameInput instanceof HTMLInputElement) ||
    !(requestInput instanceof HTMLTextAreaElement) ||
    !(requestCounter instanceof HTMLElement) ||
    !(submitButton instanceof HTMLButtonElement) ||
    !(permalink instanceof HTMLAnchorElement) ||
    !(trapInput instanceof HTMLInputElement) ||
    !(status instanceof HTMLElement) ||
    !(nameError instanceof HTMLElement) ||
    !(requestError instanceof HTMLElement) ||
    !(recentAnnouncement instanceof HTMLElement)
  ) {
    return;
  }

  const controls = [nameInput, requestInput, submitButton];
  const recentLimit = Number(
    recentRulingsSection.dataset.limit ??
      santaSettings.recentRulings.visibleLimit,
  );
  let successfulRuling: CreatedRulingResponse['ruling'] | null = null;
  let activeSubmission = false;
  let currentSubmissionKey: string | null = null;
  let formStartedAt = Date.now();

  const clearFieldError = (
    input: HTMLInputElement | HTMLTextAreaElement,
    errorElement: HTMLElement,
  ) => {
    input.removeAttribute('aria-invalid');
    errorElement.hidden = true;
    errorElement.textContent = '';
  };

  const setFieldError = (
    input: HTMLInputElement | HTMLTextAreaElement,
    errorElement: HTMLElement,
    message: string,
  ) => {
    input.setAttribute('aria-invalid', 'true');
    errorElement.hidden = false;
    errorElement.textContent = message;
  };

  const updateCounter = () => {
    const countText = formatCharacterCount(
      requestInput.value.length,
      REQUEST_LIMITS.requestMaxLength,
    );
    requestCounter.textContent = countText;
    requestCounter.dataset.state = getCharacterCountState(
      requestInput.value.length,
      REQUEST_LIMITS.requestMaxLength,
    );
  };

  const announce = (message: string) => {
    status.textContent = message;
  };

  const setPanelContent = (
    mode: PanelMode,
    title: string,
    supporting = '',
    requestText?: string,
  ) => {
    responsePanel.dataset.mode = mode;
    responseTitle.textContent = title;
    responseSupporting.textContent = supporting;

    if (requestText) {
      responseRequest.hidden = false;
      responseRequest.textContent = requestText;
    } else {
      responseRequest.hidden = true;
      responseRequest.textContent = '';
    }
  };

  const resetPanel = () => {
    setPanelContent(
      'opening',
      santaResponses.opening.title,
      santaResponses.opening.supporting,
    );
    announce('');
  };

  const focusBlockedField = (focusField: FocusField) => {
    if (focusField === 'name' || focusField === 'both') {
      focusElement(nameInput);
      return;
    }

    focusElement(requestInput);
  };

  const handleRecoverableError = (
    message = ERROR_MESSAGE,
    options: { preserveSubmissionKey?: boolean } = {},
  ) => {
    successfulRuling = null;
    activeSubmission = false;

    if (!options.preserveSubmissionKey) {
      currentSubmissionKey = null;
    }
    setPanelContent(
      'error',
      santaResponses.error.title,
      santaResponses.error.supporting ?? '',
    );
    setDisabledState(controls, false);
    submitButton.textContent = SUBMIT_LABEL;
    form.removeAttribute('aria-busy');
    announce(message);
  };

  const updateRecentRulings = (ruling: PublicRuling) => {
    recentUnavailableState?.remove();
    recentEmptyState?.remove();

    let list =
      recentList instanceof HTMLOListElement
        ? recentList
        : recentRulingsSection.querySelector('[data-recent-list]');

    if (!(list instanceof HTMLOListElement)) {
      list = document.createElement('ol');
      list.className = 'recent-rulings__list';
      list.setAttribute('data-recent-list', '');
      recentRulingsSection.append(list);
    }

    const existingItem = list.querySelector(
      `[data-ruling-id="${ruling.publicId}"]`,
    );

    if (!existingItem) {
      list.prepend(createRecentRulingItem(ruling));
    }

    while (list.children.length > recentLimit) {
      list.lastElementChild?.remove();
    }

    recentAnnouncement.textContent = `${ruling.displayName} now has a public Santa ruling.`;
  };

  const resetForAnotherRequest = () => {
    successfulRuling = null;
    activeSubmission = false;
    requestInput.value = '';
    trapInput.value = '';
    formStartedAt = Date.now();
    clearFieldError(nameInput, nameError);
    clearFieldError(requestInput, requestError);
    setDisabledState(controls, false);
    submitButton.textContent = SUBMIT_LABEL;
    form.removeAttribute('aria-busy');
    permalink.hidden = true;
    permalink.removeAttribute('href');
    resetPanel();
    updateCounter();
    focusElement(requestInput);
  };

  const handleCreatedRuling = (
    ruling: CreatedRulingResponse['ruling'],
    duplicateMessage?: string,
  ) => {
    successfulRuling = ruling;
    activeSubmission = false;
    currentSubmissionKey = null;
    setPanelContent(
      ruling.decision,
      getDecisionPanelTitle(ruling.decision),
      ruling.santaResponse,
      ruling.requestText,
    );
    setDisabledState([nameInput, requestInput], true);
    submitButton.disabled = false;
    submitButton.textContent = RESET_LABEL;
    form.removeAttribute('aria-busy');
    permalink.href = buildRulingPath(ruling.publicId);
    permalink.hidden = false;
    announce(
      duplicateMessage ??
        `${getDecisionPanelTitle(ruling.decision)} ${ruling.santaResponse}`,
    );
    updateRecentRulings(ruling);
    focusElement(submitButton);
  };

  const applyInvalidResponse = (
    response: Extract<SubmitRulingResponse, { status: 'invalid' }>,
  ) => {
    activeSubmission = false;
    currentSubmissionKey = null;
    setDisabledState(controls, false);
    submitButton.textContent = SUBMIT_LABEL;
    form.removeAttribute('aria-busy');

    let firstInvalidField: HTMLInputElement | HTMLTextAreaElement | null = null;

    if (response.fieldErrors.name) {
      setFieldError(nameInput, nameError, response.fieldErrors.name);
      firstInvalidField = nameInput;
    }

    if (response.fieldErrors.request) {
      setFieldError(requestInput, requestError, response.fieldErrors.request);
      firstInvalidField ??= requestInput;
    }

    if (firstInvalidField) {
      focusElement(firstInvalidField);
    }
  };

  updateCounter();
  resetPanel();

  nameInput.addEventListener('input', () => {
    clearFieldError(nameInput, nameError);
  });

  requestInput.addEventListener('input', () => {
    clearFieldError(requestInput, requestError);
    updateCounter();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (activeSubmission) {
      return;
    }

    if (successfulRuling) {
      resetForAnotherRequest();
      return;
    }

    clearFieldError(nameInput, nameError);
    clearFieldError(requestInput, requestError);
    announce('');

    const validatedName = validateName(
      nameInput.value,
      REQUEST_LIMITS.nameMaxLength,
    );
    const validatedRequest = validateRequest(
      requestInput.value,
      REQUEST_LIMITS.requestMaxLength,
    );

    let firstInvalidField: HTMLInputElement | HTMLTextAreaElement | null = null;

    if (!validatedName.valid) {
      setFieldError(nameInput, nameError, validatedName.error);
      firstInvalidField = nameInput;
    }

    if (!validatedRequest.valid) {
      setFieldError(requestInput, requestError, validatedRequest.error);
      firstInvalidField ??= requestInput;
    }

    if (firstInvalidField) {
      focusElement(firstInvalidField);
      return;
    }

    nameInput.value = validatedName.value;
    requestInput.value = validatedRequest.value;
    updateCounter();

    activeSubmission = true;
    currentSubmissionKey ??= generateIdempotencyKey();
    form.setAttribute('aria-busy', 'true');
    setPanelContent(
      'considering',
      santaResponses.considering.title,
      santaResponses.considering.supporting,
    );
    setDisabledState(controls, true);
    submitButton.textContent = CONSIDERING_LABEL;
    announce('Santa is considering your request.');

    const minimumDelay = new Promise((resolve) => {
      window.setTimeout(resolve, getMinimumConsideringDelay());
    });

    let response: Response;

    try {
      response = await fetchJsonWithTimeout('/api/rulings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': currentSubmissionKey,
        },
        body: JSON.stringify({
          name: validatedName.value,
          request: validatedRequest.value,
          website: trapInput.value,
          formElapsedMs:
            window.__SANTA_TEST__?.formElapsedMs ?? Date.now() - formStartedAt,
        }),
      });
    } catch (error) {
      handleRecoverableError(
        error instanceof TimedRequestError ? TIMEOUT_MESSAGE : ERROR_MESSAGE,
        { preserveSubmissionKey: true },
      );
      return;
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch {
      handleRecoverableError(ERROR_MESSAGE, { preserveSubmissionKey: true });
      return;
    }

    if (!isSubmitRulingResponse(responseBody)) {
      handleRecoverableError(ERROR_MESSAGE, { preserveSubmissionKey: true });
      return;
    }

    if (responseBody.status === 'invalid') {
      applyInvalidResponse(responseBody);
      return;
    }

    if (responseBody.status === 'duplicate') {
      if (responseBody.ruling) {
        handleCreatedRuling(responseBody.ruling, responseBody.message);
      } else {
        activeSubmission = false;
        currentSubmissionKey = null;
        resetPanel();
        setDisabledState(controls, false);
        submitButton.textContent = SUBMIT_LABEL;
        form.removeAttribute('aria-busy');
        announce(responseBody.message);
      }
      return;
    }

    if (responseBody.status === 'blocked') {
      activeSubmission = false;
      currentSubmissionKey = null;
      setPanelContent(
        'blocked',
        responseBody.message,
        responseBody.supportingMessage ?? '',
      );
      setDisabledState(controls, false);
      submitButton.textContent = SUBMIT_LABEL;
      form.removeAttribute('aria-busy');
      announce(
        `${responseBody.message} ${responseBody.supportingMessage ?? ''}`.trim(),
      );
      focusBlockedField(responseBody.focusField);
      return;
    }

    if (
      responseBody.status === 'rate-limited' ||
      responseBody.status === 'bot-rejected'
    ) {
      activeSubmission = false;
      currentSubmissionKey = null;
      const supportingMessage =
        'supportingMessage' in responseBody
          ? (responseBody.supportingMessage ?? '')
          : '';
      setPanelContent('rate-limited', responseBody.message, supportingMessage);
      setDisabledState(controls, false);
      submitButton.textContent = SUBMIT_LABEL;
      form.removeAttribute('aria-busy');
      announce(`${responseBody.message} ${supportingMessage}`.trim());
      focusElement(submitButton);
      return;
    }

    if (
      responseBody.status === 'unsupported-media' ||
      responseBody.status === 'payload-too-large' ||
      responseBody.status === 'forbidden'
    ) {
      handleRecoverableError(responseBody.message);
      return;
    }

    if (responseBody.status === 'error') {
      handleRecoverableError(responseBody.message);
      return;
    }

    if (!response.ok) {
      handleRecoverableError();
      return;
    }

    await minimumDelay;
    handleCreatedRuling(responseBody.ruling);
  });
}
