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

export function initRulingShareActions(): void {
  const shareRoot = document.querySelector('[data-ruling-share]');

  if (!(shareRoot instanceof HTMLElement)) {
    return;
  }

  const copyButton = shareRoot.querySelector('[data-copy-link]');
  const shareButton = shareRoot.querySelector('[data-native-share]');
  const status = shareRoot.querySelector('[data-share-status]');
  const shareUrl = shareRoot.dataset.url;
  const shareTitle = shareRoot.dataset.title ?? 'Santa Commands It!';
  const shareText = shareRoot.dataset.text ?? '';

  if (
    !(copyButton instanceof HTMLButtonElement) ||
    !(shareButton instanceof HTMLButtonElement) ||
    !(status instanceof HTMLElement) ||
    !shareUrl
  ) {
    return;
  }

  const initialCopyLabel = copyButton.textContent?.trim() || 'COPY LINK';
  const successLabel = copyButton.dataset.successLabel ?? 'LINK COPIED';
  const copyFailureMessage =
    'Could not copy the link. You can copy it from your browser address bar.';
  let resetTimer: number | undefined;

  const announce = (message: string) => {
    status.textContent = message;
  };

  const resetCopyButton = () => {
    copyButton.textContent = initialCopyLabel;
    copyButton.dataset.state = 'idle';
  };

  if (typeof navigator.share === 'function') {
    shareButton.hidden = false;
  } else {
    shareButton.hidden = true;
  }

  copyButton.addEventListener('click', async () => {
    const copied = await copyText(shareUrl);

    if (!copied) {
      announce(copyFailureMessage);
      return;
    }

    window.clearTimeout(resetTimer);
    copyButton.textContent = successLabel;
    copyButton.dataset.state = 'copied';
    announce('Link copied.');
    resetTimer = window.setTimeout(resetCopyButton, 2200);
  });

  shareButton.addEventListener('click', async () => {
    if (typeof navigator.share !== 'function') {
      return;
    }

    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      announce('Could not open sharing. You can still copy the link.');
    }
  });
}
