// Playwright assertions reused by the isolated F1 synthetic browser harness.
// The caller supplies an already-open synthetic conversation; no sends or live API calls.
export async function assertAvailableHeight(page) {
  // Cover the legacy delayed smooth scroll, which could move hidden app ancestors.
  await page.waitForTimeout(650);
  const sizes = await page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing layout element: ${selector}`);
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    };
    return {
      main: box('main'), page: box('[data-testid="whatsapp-page"]'),
      workspace: box('[data-testid="whatsapp-workspace"]'),
      composer: box('[data-testid="whatsapp-composer"]'), header: box('header'),
      shellScrollTop: document.querySelector('header').parentElement.parentElement.scrollTop,
      documentScrollTop: document.scrollingElement.scrollTop, viewport: innerHeight,
    };
  });
  if (sizes.header.top < 0 || sizes.shellScrollTop !== 0 || sizes.documentScrollTop !== 0 ||
      Math.abs(sizes.main.bottom - sizes.page.bottom) > 2 ||
      sizes.viewport - sizes.composer.bottom > 20 || sizes.composer.bottom > sizes.viewport ||
      sizes.workspace.height <= sizes.main.height * .55) {
    throw new Error(`WhatsApp does not fill available height: ${JSON.stringify(sizes)}`);
  }
  return sizes;
}

export async function assertLightboxDownload(page) {
  await page.getByLabel('Message history', { exact: true }).evaluate(e => e.scrollTop = e.scrollHeight);
  const photo = page.getByAltText('Photo', { exact: true });
  await photo.waitFor(); await photo.click();
  const dialog = page.getByRole('dialog', { name: 'Image preview' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Load attachment', exact: true }).click();
  const link = dialog.getByRole('link', { name: 'Download', exact: true });
  await link.waitFor();
  if (!await dialog.isVisible()) throw new Error('Load attachment dismissed the lightbox');
  const pending = page.waitForEvent('download'); await link.click();
  const download = await pending;
  if (!await dialog.isVisible()) throw new Error('Download dismissed the lightbox');
  await dialog.getByRole('button', { name: 'Close image preview' }).click();
  if (await dialog.count()) throw new Error('Explicit close failed');
  return { loadStayedOpen: true, downloadStayedOpen: true, filename: download.suggestedFilename() };
}

export async function assertOuterScrollContainment(page) {
  // Simulate constrained/late-growing content, then the legacy ancestor-scroll mechanism.
  const style = await page.addStyleTag({ content: 'main { min-height: 840px !important; flex-shrink: 0 !important; }' });
  try {
    await page.getByLabel('Message history', { exact: true }).evaluate(history =>
      history.lastElementChild.scrollIntoView({ block: 'end', behavior: 'instant' }));
    const state = await page.evaluate(() => ({
      headerTop: document.querySelector('header').getBoundingClientRect().top,
      shellScrollTop: document.querySelector('header').parentElement.parentElement.scrollTop,
      documentScrollTop: document.scrollingElement.scrollTop,
    }));
    if (state.headerTop < 0 || state.shellScrollTop !== 0 || state.documentScrollTop !== 0)
      throw new Error(`Outer application scrolled: ${JSON.stringify(state)}`);
    return state;
  } finally {
    await style.evaluate(element => element.remove());
  }
}
