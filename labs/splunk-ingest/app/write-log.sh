#!/bin/sh
# O produtor do arquivo: 19 registros de uma linha e, no vigésimo, um stack
# trace de doze. O formato de data é ISO 8601, que é o que o `LINE_BREAKER` do
# `idx/props.conf` procura no começo de cada evento.
#
# Ele escreve devagar de propósito (um registro por segundo): o bloco de 64 KiB
# do forwarder leva um tempo para fechar, e esse tempo é o atraso entre
# escrever e poder pesquisar. Quem opera Splunk encontra esse atraso antes de
# encontrar a explicação dele.
set -eu

ARQUIVO=/var/log/app/app.log
mkdir -p "$(dirname "$ARQUIVO")"
n=0

agora() {
  date -u +%Y-%m-%dT%H:%M:%S.000+0000
}

while true; do
  n=$((n + 1))
  if [ $((n % 20)) -eq 0 ]; then
    # O registro multilinha. Doze linhas, uma mensagem, um evento — se a quebra
    # estiver na máquina que executa a fase de parsing.
    {
      echo "$(agora) ERROR [http-nio-8080-exec-3] c.o.CheckoutService - order 48123 failed"
      echo "java.lang.NullPointerException: Cannot invoke \"Payment.getId()\" because \"payment\" is null"
      echo "	at com.openlabs.CheckoutService.settle(CheckoutService.java:214)"
      echo "	at com.openlabs.CheckoutService.place(CheckoutService.java:88)"
      echo "	at com.openlabs.CheckoutController.post(CheckoutController.java:41)"
      echo "	at java.base/java.lang.reflect.Method.invoke(Method.java:580)"
      echo "	at org.springframework.web.method.support.InvocableHandlerMethod.doInvoke(InvocableHandlerMethod.java:255)"
      echo "	at org.springframework.web.servlet.FrameworkServlet.doPost(FrameworkServlet.java:914)"
      echo "	at jakarta.servlet.http.HttpServlet.service(HttpServlet.java:547)"
      echo "	at org.apache.catalina.core.StandardWrapperValve.invoke(StandardWrapperValve.java:149)"
      echo "	at org.apache.catalina.connector.CoyoteAdapter.service(CoyoteAdapter.java:357)"
      echo "	at java.base/java.lang.Thread.run(Thread.java:1583)"
    } >>"$ARQUIVO"
  else
    echo "$(agora) INFO  [http-nio-8080-exec-1] c.o.CheckoutService - order $((48100 + n)) settled in $((12 + n % 40))ms" >>"$ARQUIVO"
  fi
  sleep 1
done
