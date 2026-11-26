// Run against the synthetic local fixture only; every API call must be intercepted.
export async function assertMobileLabelAccess(page, chatName) {
  await page.getByText(chatName, { exact: true }).first().click();
  const panel = page.getByLabel('Conversation phone labels', { exact: true });
  if (!await panel.isVisible()) throw new Error('Selected-chat labels are hidden on mobile');
  const composer = page.getByPlaceholder('Type a message or paste an image... (Enter to send)', { exact: true });
  await composer.fill('Synthetic unsent label-check draft');
  await panel.getByRole('button', { name: 'Phone labels', exact: true }).click();
  await panel.getByRole('button', { name: 'Check this conversation', exact: true }).waitFor();
  await panel.getByRole('button', { name: 'Check this conversation', exact: true }).click();
  await panel.getByText('Evolution has no stored chat record for this exact conversation. Check the label on the phone and refresh after provider synchronization.', { exact: true }).waitFor();
  if (await panel.locator('input[type="checkbox"]').count()) throw new Error('Unknown membership rendered as unchecked assignments');
  if (await panel.getByLabel('Filter by phone label').count()) throw new Error('Mobile conversation panel duplicates the inbox filter');
  const box = await page.getByTestId('whatsapp-composer').boundingBox();
  const viewport = page.viewportSize();
  const history = await page.getByLabel('Message history', { exact: true }).boundingBox();
  if (!box || box.y + box.height > viewport.height || !history || history.height <= 0) throw new Error('Labels displaced composer or history outside mobile workspace');
  await panel.getByRole('button', { name: 'Phone labels', exact: true }).click();
  if (await composer.inputValue() !== 'Synthetic unsent label-check draft') throw new Error('Label panel lost the unsent draft');
  await page.getByRole('button', { name: 'Back to conversations', exact: true }).click();
  if (!await page.getByLabel('Conversations', { exact: true }).isVisible()) throw new Error('Mobile back lost conversation list');
  return { composerBottom: box.y + box.height, viewportHeight: viewport.height, historyHeight: history.height };
}

export async function assertDesktopLabelAccess(page, chatName) {
  await page.getByText(chatName, { exact: true }).first().click();
  const controls = page.getByRole('button', { name: 'Phone labels', exact: true });
  const visible = await Promise.all((await controls.all()).map(control => control.isVisible()));
  if (visible.filter(Boolean).length !== 1) throw new Error('Desktop renders duplicate visible phone-label menus');
  if (await page.getByLabel('Conversation phone labels', { exact: true }).isVisible()) throw new Error('Mobile label panel is visible on desktop');
  return { visiblePhoneLabelMenus: 1 };
}
