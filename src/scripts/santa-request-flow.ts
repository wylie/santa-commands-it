import { moderationRules } from '@/config/moderation';
import { REQUEST_LIMITS } from '@/config/request';
import { santaResponses } from '@/config/responses';
import { getConsideringDelay } from '@/config/santa-settings';
import {
  formatCharacterCount,
  getCharacterCountState,
} from '@/utils/characterCount';
import {
  evaluateSantaRequest,
  formatResponseTemplate,
  type SantaDecision,
} from '@/utils/santa-decision';
import { validateName, validateRequest } from '@/utils/validation';

type PanelMode =
  'opening' | 'considering' | 'approved' | 'random-coal' | 'blocked' | 'error';

type FinalDecision = Extract<
  SantaDecision,
  { type: 'approved' | 'random-coal' }
>;

const SUBMIT_LABEL = 'ASK SANTA';
const CONSIDERING_LABEL = 'SANTA IS CONSIDERING...';
const RESET_LABEL = 'ASK SANTA SOMETHING ELSE';
const ERROR_MESSAGE = "Santa's workshop had a small mishap. Please try again.";

function getTestRandomValue(): number | undefined {
  const queue = window.__SANTA_TEST__?.randomValues;

  if (!queue?.length) {
    return undefined;
  }

  const nextValue = queue.shift();

  return typeof nextValue === 'number' ? nextValue : undefined;
}

function getRandomValue(): number {
  return getTestRandomValue() ?? Math.random();
}

function getDelay(randomValue: number): number {
  const override = window.__SANTA_TEST__?.consideringDelayMs;

  if (typeof override === 'number' && override >= 0) {
    return override;
  }

  return getConsideringDelay(randomValue);
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

export function initSantaRequestFlow(): void {
  const form = document.querySelector('[data-request-form]');
  const responsePanel = document.querySelector('[data-response-panel]');
  const responseTitle = document.querySelector('[data-response-title]');
  const responseSupporting = document.querySelector(
    '[data-response-supporting]',
  );
  const responseRequest = document.querySelector('[data-response-request]');

  if (
    !(form instanceof HTMLFormElement) ||
    !(responsePanel instanceof HTMLElement) ||
    !(responseTitle instanceof HTMLElement) ||
    !(responseSupporting instanceof HTMLElement) ||
    !(responseRequest instanceof HTMLElement)
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

  if (
    !(nameInput instanceof HTMLInputElement) ||
    !(requestInput instanceof HTMLTextAreaElement) ||
    !(requestCounter instanceof HTMLElement) ||
    !(submitButton instanceof HTMLButtonElement) ||
    !(status instanceof HTMLElement) ||
    !(nameError instanceof HTMLElement) ||
    !(requestError instanceof HTMLElement)
  ) {
    return;
  }

  const controls = [nameInput, requestInput, submitButton];
  let finalDecision: FinalDecision | null = null;

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
    const text = formatCharacterCount(
      requestInput.value.length,
      REQUEST_LIMITS.requestMaxLength,
    );
    const state = getCharacterCountState(
      requestInput.value.length,
      REQUEST_LIMITS.requestMaxLength,
    );

    requestCounter.textContent = text;
    requestCounter.dataset.state = state;
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

  const resetForAnotherRequest = () => {
    finalDecision = null;
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

  const handleBlockedDecision = (
    decision: Extract<SantaDecision, { type: 'blocked' }>,
  ) => {
    const blockedTitle = decision.response.title;
    const blockedSupporting = decision.response.supporting ?? '';

    setPanelContent('blocked', blockedTitle, blockedSupporting);
    setDisabledState(controls, false);
    submitButton.textContent = SUBMIT_LABEL;
    form.removeAttribute('aria-busy');
    announce(`${blockedTitle} ${blockedSupporting}`.trim());

    if (decision.field === 'name' || decision.field === 'both') {
      focusElement(nameInput);
      return;
    }

    focusElement(requestInput);
  };

  const handleFinalDecision = (decision: FinalDecision) => {
    const renderedTitle = formatResponseTemplate(
      decision.response.title,
      decision,
    );
    const renderedSupporting = decision.response.supporting
      ? formatResponseTemplate(decision.response.supporting, decision)
      : '';

    finalDecision = decision;
    setPanelContent(
      decision.type,
      renderedTitle,
      renderedSupporting,
      decision.request,
    );
    setDisabledState([nameInput, requestInput], true);
    submitButton.disabled = false;
    submitButton.textContent = RESET_LABEL;
    form.removeAttribute('aria-busy');
    announce(`${renderedTitle} ${renderedSupporting}`.trim());
    focusElement(submitButton);
  };

  const handleUnexpectedError = () => {
    finalDecision = null;
    setPanelContent(
      'error',
      santaResponses.error.title,
      santaResponses.error.supporting ?? '',
    );
    setDisabledState(controls, false);
    submitButton.textContent = SUBMIT_LABEL;
    form.removeAttribute('aria-busy');
    announce(ERROR_MESSAGE);
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

    if (finalDecision) {
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

    try {
      const decision = evaluateSantaRequest({
        name: validatedName.value,
        request: validatedRequest.value,
        moderation: moderationRules,
        randomValue: getRandomValue(),
        templateValue: getRandomValue(),
      });

      if (decision.type === 'blocked') {
        handleBlockedDecision(decision);
        return;
      }

      form.setAttribute('aria-busy', 'true');
      setPanelContent(
        'considering',
        santaResponses.considering.title,
        santaResponses.considering.supporting,
      );
      announce('Santa is considering your request.');
      setDisabledState(controls, true);
      submitButton.textContent = CONSIDERING_LABEL;

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, getDelay(getRandomValue()));
      });

      handleFinalDecision(decision);
    } catch {
      handleUnexpectedError();
    }
  });
}
