// Motivo do cancelamento: atalhos de um toque e "Outro" com texto livre. Usado pelo cliente e pela casa;
// quem está do outro lado vê o motivo na agenda ou no histórico.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Campo, Chip } from '../ui';
import { space, type } from '../../theme';
import type { Agendamento } from '../../types/models';

const ATALHOS = {
  cliente: ['Imprevisto', 'Vou remarcar', 'Estou doente', 'Problema com transporte'],
  casa: ['Barbeiro indisponível', 'Barbearia fechada', 'Cliente pediu', 'Imprevisto na barbearia'],
} as const;

/** Mostra os atalhos e devolve o motivo escolhido (vazio enquanto nada foi escolhido). */
export function MotivoCancelamento({ por, onChange }: { por: 'cliente' | 'casa'; onChange: (motivo: string) => void }) {
  const [atalho, setAtalho] = useState<string | null>(null);
  const [outro, setOutro] = useState('');
  const escolher = (a: string) => { setAtalho(a); onChange(a === 'Outro' ? outro.trim() : a); };

  return (
    <View style={{ gap: space(2) }}>
      <Text style={type.caption}>Motivo (quem está do outro lado vê)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {[...ATALHOS[por], 'Outro'].map(a => <Chip key={a} rotulo={a} ativo={atalho === a} onPress={() => escolher(a)} />)}
      </View>
      {atalho === 'Outro' ? (
        <Campo rotulo="Conte rapidinho" value={outro} maxLength={200} placeholder="Ex.: mudei de cidade"
          onChangeText={t => { setOutro(t); onChange(t.trim()); }} />
      ) : null}
    </View>
  );
}

/** "Cancelado por você · Imprevisto", "Cancelado pela barbearia · Barbeiro indisponível". */
export function textoCancelamento(a: Pick<Agendamento, 'cancelamento'>, quemVe: 'cliente' | 'casa'): string | null {
  const c = a.cancelamento;
  if (!c) return null;
  const quem = c.por === quemVe ? 'por você' : c.por === 'casa' ? 'pela barbearia' : 'pelo cliente';
  return `Cancelado ${quem} · ${c.motivo}`;
}
