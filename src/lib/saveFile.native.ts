import { Share } from 'react-native';

/** On phones the text goes to the share sheet (mail, notes, drive…). */
export async function saveTextFile(filename: string, content: string): Promise<void> {
  await Share.share({ title: filename, message: content });
}
