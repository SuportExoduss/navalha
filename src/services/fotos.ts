// Escolher foto da galeria ou tirar com a câmera e enviar ao R2.
import * as ImagePicker from 'expo-image-picker';
import { enviarFoto, type TipoFoto } from './upload';

export async function escolherEEnviar(
  tipo: TipoFoto, refId: string, origem: 'galeria' | 'camera' = 'galeria', aspecto: [number, number] = [4, 5],
): Promise<string | null> {
  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: aspecto, quality: 1 };
  if (origem === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('Permita o uso da câmera para fotografar o corte.');
  }
  const r = origem === 'camera'
    ? await ImagePicker.launchCameraAsync(opcoes)
    : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (r.canceled || !r.assets[0]) return null;
  return enviarFoto(r.assets[0].uri, tipo, refId);
}
