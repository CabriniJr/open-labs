#!/bin/sh
# Volume, e só volume: linhas de log sintéticas o bastante para encher baldes em
# minutos em vez de dias.
#
# O conteúdo é propositalmente repetitivo — o que se mede aqui é o disco, e
# dado repetitivo comprime melhor, o que é por si uma lição: o que os limites de
# tamanho contam é o balde no disco, e não o volume que a licença contou.
set -eu

ARQUIVO=/var/log/bulk/bulk.log
mkdir -p "$(dirname "$ARQUIVO")"
n=0

while true; do
  i=0
  while [ $i -lt 2000 ]; do
    n=$((n + 1))
    i=$((i + 1))
    echo "$(date -u +%Y-%m-%dT%H:%M:%S.000+0000) INFO  request id=$n path=/checkout status=200 bytes=$((512 + n % 4096)) upstream=payments-$((n % 7))" >>"$ARQUIVO"
  done
  sleep 1
done
