// Small helpers that behave reliably in iPad Safari.

export async function copyText(text, notify, successMessage = 'Copied to clipboard.') {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard is not available in this browser');
    await navigator.clipboard.writeText(String(text || ''));
    notify?.(successMessage);
    return true;
  } catch (error) {
    notify?.(`Could not copy (${error.message}). Press and hold the text to select and copy it.`);
    return false;
  }
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari needs the URL to stay valid for a moment after the click.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text, fileName, notify, successMessage = 'File downloaded.') {
  try {
    downloadBlob(new Blob([String(text || '')], { type: 'text/plain;charset=utf-8' }), fileName);
    notify?.(`${successMessage} On iPad it goes to Files > Downloads.`);
    return true;
  } catch (error) {
    notify?.(`The file could not be downloaded: ${error.message}`);
    return false;
  }
}
