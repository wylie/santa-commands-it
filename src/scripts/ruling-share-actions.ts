function fallbackCopyText(text: string): boolean {
  const legacyClipboardDocument = document as {
    execCommand?: (
      commandId: string,
      showUi?: boolean,
      value?: string,
    ) => boolean;
  };
  const copyTarget = document.createElement('textarea');
  copyTarget.value = text;
  copyTarget.setAttribute('readonly', '');
  copyTarget.style.position = 'absolute';
  copyTarget.style.left = '-9999px';

  document.body.append(copyTarget);
  copyTarget.select();
  copyTarget.setSelectionRange(0, copyTarget.value.length);

  try {
    return legacyClipboardDocument.execCommand?.('copy') ?? false;
  } finally {
    copyTarget.remove();
  }
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);

      return true;
    } catch {
      return fallbackCopyText(text);
    }
  }

  return fallbackCopyText(text);
}

function selectCopyInput(input: HTMLInputElement): void {
  window.requestAnimationFrame(() => {
    input.hidden = false;
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
  });
}

function isShareSupported(shareData: ShareData): boolean {
  if (typeof navigator.share !== 'function') {
    return false;
  }

  if (typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare(shareData);
    } catch {
      return false;
    }
  }

  return true;
}

export function initRulingShareActions(): void {
  const shareRoots = document.querySelectorAll('[data-ruling-share]');

  for (const shareRoot of shareRoots) {
    if (!(shareRoot instanceof HTMLElement)) {
      continue;
    }

    const copyButton = shareRoot.querySelector('[data-copy-link]');
    const shareButton = shareRoot.querySelector('[data-native-share]');
    const status = shareRoot.querySelector('[data-share-status]');
    const manualCopy = shareRoot.querySelector('[data-manual-copy]');
    const manualCopyInput = shareRoot.querySelector('[data-manual-copy-input]');
    const shareUrl = shareRoot.dataset.url;
    const shareTitle = shareRoot.dataset.title ?? 'Santa Commands It!';
    const shareText = shareRoot.dataset.text ?? '';

    if (
      !(copyButton instanceof HTMLButtonElement) ||
      !(shareButton instanceof HTMLButtonElement) ||
      !(status instanceof HTMLElement) ||
      !(manualCopy instanceof HTMLElement) ||
      !(manualCopyInput instanceof HTMLInputElement) ||
      !shareUrl
    ) {
      continue;
    }

    const shareData: ShareData = {
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    };
    const copyDefaultLabel =
      copyButton.dataset.defaultLabel ??
      copyButton.textContent?.trim() ??
      'COPY LINK';
    const copyPendingLabel = copyButton.dataset.pendingLabel ?? 'COPYING...';
    const copySuccessLabel = copyButton.dataset.successLabel ?? 'LINK COPIED';
    const shareDefaultLabel =
      shareButton.dataset.defaultLabel ??
      shareButton.textContent?.trim() ??
      'SHARE';
    const sharePendingLabel = shareButton.dataset.pendingLabel ?? 'SHARING...';
    const copyFailureMessage =
      'Could not copy the link automatically. Copy the link shown below.';
    const shareFailureMessage =
      'Could not open sharing. Copy the ruling link instead.';
    let busyAction: 'copy' | 'share' | null = null;
    let resetTimer: number | undefined;

    const setButtonState = (
      button: HTMLButtonElement,
      label: string,
      disabled: boolean,
      state: 'idle' | 'pending' | 'copied',
    ) => {
      button.textContent = label;
      button.disabled = disabled;
      button.dataset.state = state;
    };

    const announce = (message: string) => {
      status.textContent = message;
    };

    const setManualCopyVisible = (visible: boolean) => {
      manualCopy.hidden = !visible;
    };

    const resetButtons = () => {
      busyAction = null;
      setButtonState(copyButton, copyDefaultLabel, false, 'idle');
      setButtonState(shareButton, shareDefaultLabel, false, 'idle');
    };

    const beginAction = (action: 'copy' | 'share') => {
      if (busyAction) {
        return false;
      }

      busyAction = action;
      window.clearTimeout(resetTimer);
      setButtonState(
        copyButton,
        action === 'copy' ? copyPendingLabel : copyDefaultLabel,
        true,
        action === 'copy' ? 'pending' : 'idle',
      );
      setButtonState(
        shareButton,
        action === 'share' ? sharePendingLabel : shareDefaultLabel,
        true,
        action === 'share' ? 'pending' : 'idle',
      );
      return true;
    };

    if (isShareSupported(shareData)) {
      shareButton.hidden = false;
    } else {
      shareButton.hidden = true;
    }

    manualCopyInput.addEventListener('focus', () => {
      manualCopyInput.select();
    });

    copyButton.addEventListener('click', async () => {
      if (!beginAction('copy')) {
        return;
      }

      const copied = await copyText(shareUrl);

      if (!copied) {
        resetButtons();
        setManualCopyVisible(true);
        announce(copyFailureMessage);
        selectCopyInput(manualCopyInput);
        return;
      }

      setManualCopyVisible(false);
      setButtonState(copyButton, copySuccessLabel, true, 'copied');
      setButtonState(shareButton, shareDefaultLabel, false, 'idle');
      announce('Ruling link copied.');
      busyAction = null;
      resetTimer = window.setTimeout(resetButtons, 2200);
    });

    shareButton.addEventListener('click', async () => {
      if (!beginAction('share')) {
        return;
      }

      try {
        await navigator.share(shareData);
        setManualCopyVisible(false);
        announce('Share options opened.');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          announce('');
          resetButtons();
          return;
        }

        setManualCopyVisible(true);
        announce(shareFailureMessage);
        selectCopyInput(manualCopyInput);
      }

      resetButtons();
    });
  }
}
