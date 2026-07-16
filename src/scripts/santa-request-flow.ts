import { santaResponses } from '@/config/responses';
import { REQUEST_LIMITS } from '@/config/request';
import { santaSettings } from '@/config/santa-settings';
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
import { validateName, validateRequest } from '@/utils/validation';

type PanelMode =
  'opening' | 'considering' | 'approved' | 'random-coal' | 'blocked' | 'error';

const SUBMIT_LABEL = 'ASK SANTA';
const CONSIDERING_LABEL = 'SANTA IS CONSIDERING...';
const RESET_LABEL = 'ASK SANTA SOMETHING ELSE';
const ERROR_MESSAGE = "Santa's workshop had a small mishap. Please try again.";

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

  meta.append(decision, time);
  item.append(meta, name, request, response);

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

  const handleRecoverableError = (message = ERROR_MESSAGE) => {
    successfulRuling = null;
    activeSubmission = false;
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

    recentAnnouncement.textContent = `${ruling.displayName} has a new public ruling.`;
  };

  const resetForAnotherRequest = () => {
    successfulRuling = null;
    activeSubmission = false;
    requestInput.value = '';
    clearFieldError(nameInput, nameError);
    clearFieldError(requestInput, requestError);
    setDisabledState(controls, false);
    submitButton.textContent = SUBMIT_LABEL;
    form.removeAttribute('aria-busy');
    resetPanel();
    updateCounter();
    focusElement(requestInput);
  };

  const handleCreatedRuling = (ruling: CreatedRulingResponse['ruling']) => {
    successfulRuling = ruling;
    activeSubmission = false;
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
    announce(
      `${getDecisionPanelTitle(ruling.decision)} ${ruling.santaResponse}`,
    );
    updateRecentRulings(ruling);
    focusElement(submitButton);
  };

  const applyInvalidResponse = (
    response: Extract<SubmitRulingResponse, { status: 'invalid' }>,
  ) => {
    activeSubmission = false;
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
      response = await fetch('/api/rulings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: validatedName.value,
          request: validatedRequest.value,
        }),
      });
    } catch {
      handleRecoverableError();
      return;
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch {
      handleRecoverableError();
      return;
    }

    if (!isSubmitRulingResponse(responseBody)) {
      handleRecoverableError();
      return;
    }

    if (responseBody.status === 'invalid') {
      applyInvalidResponse(responseBody);
      return;
    }

    if (responseBody.status === 'blocked') {
      activeSubmission = false;
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
