import { securitySettings } from '@/config/security';
import { isSubmitReportResponse } from '@/utils/reports';

function focusElement(element: HTMLElement): void {
  window.requestAnimationFrame(() => {
    element.focus();
  });
}

export function initRulingReportFlow(): void {
  const root = document.querySelector('[data-report-root]');

  if (!(root instanceof HTMLElement)) {
    return;
  }

  const toggle = root.querySelector('[data-report-toggle]');
  const panel = root.querySelector('[data-report-panel]');
  const form = root.querySelector('[data-report-form]');
  const reasonField = root.querySelector('[data-report-reason]');
  const noteField = root.querySelector('[data-report-note]');
  const submitButton = root.querySelector('[data-report-submit]');
  const cancelButton = root.querySelector('[data-report-cancel]');
  const reasonError = root.querySelector('[data-report-error="reason"]');
  const noteError = root.querySelector('[data-report-error="note"]');
  const status = root.querySelector('[data-report-status]');
  const counter = root.querySelector('[data-report-counter]');
  const publicId = root.dataset.publicId;

  if (
    !(toggle instanceof HTMLButtonElement) ||
    !(panel instanceof HTMLElement) ||
    !(form instanceof HTMLFormElement) ||
    !(reasonField instanceof HTMLSelectElement) ||
    !(noteField instanceof HTMLTextAreaElement) ||
    !(submitButton instanceof HTMLButtonElement) ||
    !(cancelButton instanceof HTMLButtonElement) ||
    !(reasonError instanceof HTMLElement) ||
    !(noteError instanceof HTMLElement) ||
    !(status instanceof HTMLElement) ||
    !(counter instanceof HTMLElement) ||
    !publicId
  ) {
    return;
  }

  const controls = [reasonField, noteField, submitButton, cancelButton];

  const setHidden = (element: HTMLElement, hidden: boolean) => {
    element.hidden = hidden;
  };

  const clearFieldError = (
    field: HTMLSelectElement | HTMLTextAreaElement,
    errorElement: HTMLElement,
  ) => {
    field.removeAttribute('aria-invalid');
    errorElement.textContent = '';
    errorElement.hidden = true;
  };

  const setFieldError = (
    field: HTMLSelectElement | HTMLTextAreaElement,
    errorElement: HTMLElement,
    message: string,
  ) => {
    field.setAttribute('aria-invalid', 'true');
    errorElement.textContent = message;
    errorElement.hidden = false;
  };

  const updateCounter = () => {
    counter.textContent = `${Math.min(
      noteField.value.length,
      securitySettings.reports.noteMaxLength,
    )} / ${securitySettings.reports.noteMaxLength}`;
  };

  const closePanel = () => {
    setHidden(panel, true);
    toggle.setAttribute('aria-expanded', 'false');
    focusElement(toggle);
  };

  const openPanel = () => {
    setHidden(panel, false);
    toggle.setAttribute('aria-expanded', 'true');
    focusElement(reasonField);
  };

  const setBusy = (busy: boolean) => {
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    controls.forEach((control) => {
      control.disabled = busy;
    });
  };

  toggle.addEventListener('click', () => {
    if (panel.hidden) {
      openPanel();
      return;
    }

    closePanel();
  });

  cancelButton.addEventListener('click', () => {
    closePanel();
  });

  reasonField.addEventListener('input', () => {
    clearFieldError(reasonField, reasonError);
  });

  noteField.addEventListener('input', () => {
    clearFieldError(noteField, noteError);
    updateCounter();
  });

  updateCounter();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearFieldError(reasonField, reasonError);
    clearFieldError(noteField, noteError);
    status.textContent = '';

    if (!reasonField.value) {
      setFieldError(
        reasonField,
        reasonError,
        'Please choose a reason for the report.',
      );
      focusElement(reasonField);
      return;
    }

    setBusy(true);

    let response: Response;

    try {
      response = await fetch(`/api/rulings/${publicId}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reasonField.value,
          note: noteField.value,
        }),
      });
    } catch {
      setBusy(false);
      status.textContent =
        "Santa's workshop had a small mishap. Please try again.";
      return;
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch {
      setBusy(false);
      status.textContent =
        "Santa's workshop had a small mishap. Please try again.";
      return;
    }

    if (!isSubmitReportResponse(responseBody)) {
      setBusy(false);
      status.textContent =
        "Santa's workshop had a small mishap. Please try again.";
      return;
    }

    if (responseBody.status === 'invalid') {
      setBusy(false);

      if (responseBody.fieldErrors.reason) {
        setFieldError(
          reasonField,
          reasonError,
          responseBody.fieldErrors.reason,
        );
      }

      if (responseBody.fieldErrors.note) {
        setFieldError(noteField, noteError, responseBody.fieldErrors.note);
      }

      focusElement(responseBody.fieldErrors.reason ? reasonField : noteField);
      return;
    }

    if (responseBody.status === 'reported') {
      setBusy(false);
      status.textContent =
        `${responseBody.message} ${responseBody.supportingMessage ?? ''}`.trim();
      setHidden(panel, true);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.disabled = true;
      return;
    }

    if (responseBody.status === 'duplicate') {
      setBusy(false);
      status.textContent =
        `${responseBody.message} ${responseBody.supportingMessage ?? ''}`.trim();
      return;
    }

    if (responseBody.status === 'rate-limited') {
      setBusy(false);
      status.textContent =
        `${responseBody.message} ${responseBody.supportingMessage ?? ''}`.trim();
      return;
    }

    setBusy(false);
    status.textContent = responseBody.message;
  });
}
