import { santaResponses } from '@/config/responses';
import { publicSantaUiSettings } from '@/config/public-santa-ui';
import { REQUEST_LIMITS } from '@/config/request';
import { TimedRequestError, fetchJsonWithTimeout } from '@/scripts/fetch-json';
import {
  createPublicExcerpt,
  PUBLIC_RULING_CARD_EXCERPT_LIMITS,
} from '@/utils/publicCommands';
import {
  formatCharacterCount,
  getCharacterCountState,
} from '@/utils/characterCount';
import {
  formatPublicCardTimestamp,
  getDecisionPanelTitle,
  getPublicDecisionLabel,
  getPublicDecisionSupportingText,
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
const ERROR_MESSAGE =
  'Your request was not submitted. Please try again in a little while.';
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
  return getDelayOverride() ?? publicSantaUiSettings.consideringDelay.minimum;
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

  const article = document.createElement('article');
  article.className = 'public-ruling-card public-ruling-card--compact';
  article.dataset.publicRulingCard = '';
  article.dataset.rulingId = ruling.publicId;
  article.dataset.decision = ruling.decision;

  const headingId = `public-ruling-card-title-${ruling.publicId}`;
  const responseLabelId = `public-ruling-card-response-${ruling.publicId}`;
  article.setAttribute('aria-labelledby', headingId);

  const header = document.createElement('header');
  header.className = 'public-ruling-card__header';

  const statusRow = document.createElement('div');
  statusRow.className = 'public-ruling-card__status-row';

  const statusLine = document.createElement('div');
  statusLine.className = 'public-ruling-card__status-line';

  const statusIcon = document.createElement('span');
  statusIcon.className = 'public-ruling-card__status-icon';
  statusIcon.setAttribute('aria-hidden', 'true');
  statusIcon.innerHTML =
    ruling.decision === 'approved'
      ? '<svg viewBox="0 0 20 20" focusable="false"><circle cx="10" cy="10" r="9"></circle><path d="M5.25 10.2 8.45 13.4 14.75 7.1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"></path></svg>'
      : '<svg viewBox="0 0 20 20" focusable="false"><circle cx="10" cy="10" r="9"></circle><path d="m10 5.6 1.95 1.45 2.42.46-.74 2.35.74 2.35-2.42.46L10 14.12l-1.95-1.45-2.42-.46.74-2.35-.74-2.35 2.42-.46Z" fill="currentColor" stroke="none"></path></svg>';

  const decision = document.createElement('p');
  decision.className = 'public-ruling-card__decision';
  decision.dataset.decision = ruling.decision;
  decision.textContent = getPublicDecisionLabel(ruling.decision);
  statusLine.append(statusIcon, decision);

  const statusSeparator = document.createElement('span');
  statusSeparator.className = 'public-ruling-card__status-separator';
  statusSeparator.setAttribute('aria-hidden', 'true');
  statusSeparator.textContent = '•';

  if (ruling.isFeatured) {
    const badge = document.createElement('p');
    badge.className = 'public-ruling-card__badge';
    badge.dataset.featuredBadge = '';
    badge.textContent = 'Featured';
    statusLine.append(badge);
  }

  const statusNote = document.createElement('p');
  statusNote.className = 'public-ruling-card__status-note';
  statusNote.textContent = getPublicDecisionSupportingText(ruling.decision);
  statusLine.append(statusSeparator, statusNote);

  const time = document.createElement('time');
  time.className = 'public-ruling-card__time';
  time.dateTime = ruling.createdAt;
  time.textContent = formatPublicCardTimestamp(ruling.createdAt);

  const body = document.createElement('div');
  body.className = 'public-ruling-card__body';

  const visitor = document.createElement('div');
  visitor.className = 'public-ruling-card__visitor';

  const visitorIcon = document.createElement('span');
  visitorIcon.className = 'public-ruling-card__visitor-icon';
  visitorIcon.setAttribute('aria-hidden', 'true');
  visitorIcon.innerHTML =
    '<svg viewBox="0 0 20 20" focusable="false"><path d="M6.1 15.9h7.8m-6.4-3.2h5m-6.5-5.7c0-2.1 1.7-3.8 3.8-3.8S13.6 4.9 13.6 7m2.1 1.4v2.7c0 1.2-.8 2.3-1.9 2.6l-.2 1.5H6.4l-.2-1.5a2.77 2.77 0 0 1-1.9-2.6V8.4m2.8 0h5.8M4.8 8.4h10.4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"></path><path d="M7.7 9.8h.01M12.3 9.8h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path></svg>';

  const context = document.createElement('h3');
  context.className = 'public-ruling-card__context';
  context.id = headingId;
  context.dataset.publicRulingContext = '';

  const name = document.createElement('span');
  name.className = 'public-ruling-card__name';
  name.textContent = ruling.displayName;
  context.append(name, ' asked Santa...');
  visitor.append(visitorIcon, context);

  const requestBlock = document.createElement('div');
  requestBlock.className = 'public-ruling-card__request-block';
  requestBlock.dataset.publicRulingRequest = '';

  const request = document.createElement('p');
  request.className = 'public-ruling-card__request';
  request.textContent = createPublicExcerpt(
    ruling.requestText,
    PUBLIC_RULING_CARD_EXCERPT_LIMITS.compact.request,
  );
  requestBlock.append(request);

  const responseBlock = document.createElement('section');
  responseBlock.className = 'public-ruling-card__response-block';
  responseBlock.setAttribute('aria-labelledby', responseLabelId);
  responseBlock.dataset.publicRulingResponse = '';

  const responseLabel = document.createElement('p');
  responseLabel.className = 'public-ruling-card__response-label';
  responseLabel.id = responseLabelId;
  responseLabel.textContent = 'Santa answered';

  const response = document.createElement('p');
  response.className = 'public-ruling-card__response';
  response.textContent = createPublicExcerpt(
    ruling.santaResponse,
    PUBLIC_RULING_CARD_EXCERPT_LIMITS.compact.response,
  );
  responseBlock.append(responseLabel, response);

  const action = document.createElement('p');
  action.className = 'public-ruling-card__action';

  const link = document.createElement('a');
  link.className = 'public-ruling-card__link';
  link.href = buildRulingPath(ruling.publicId);
  link.setAttribute(
    'aria-label',
    `Read Santa's answer to ${ruling.displayName}'s request`,
  );
  const linkIcon = document.createElement('span');
  linkIcon.className = 'public-ruling-card__link-icon';
  linkIcon.setAttribute('aria-hidden', 'true');
  linkIcon.innerHTML =
    '<svg viewBox="0 0 20 20" focusable="false"><path d="M3.8 5.2c0-.7.5-1.2 1.2-1.2h4.2c.3 0 .6.1.8.3l.5.5.5-.5c.2-.2.5-.3.8-.3H16c.7 0 1.2.5 1.2 1.2v9.4c0 .7-.5 1.2-1.2 1.2h-4.2c-.3 0-.6-.1-.8-.3l-.5-.5-.5.5c-.2.2-.5.3-.8.3H5c-.7 0-1.2-.5-1.2-1.2Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.6"></path><path d="M10 4.5v10.7M5.8 6.7h2.4M11.8 6.7h2.4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.6"></path></svg>';
  link.append(linkIcon, "READ SANTA'S ANSWER");

  statusRow.append(statusLine);
  header.append(statusRow, time);
  action.append(link);
  body.append(visitor, requestBlock, responseBlock);
  article.append(header, body, action);
  item.append(article);

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
      publicSantaUiSettings.recentRulings.visibleLimit,
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
      handleRecoverableError();
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
