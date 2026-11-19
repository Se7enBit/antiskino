/** Downloads a text file in the browser (CSV exports). saveFile.native.ts shares it instead. */
export function saveTextFile(filename: string, content: string, type: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Promise.resolve();
}
