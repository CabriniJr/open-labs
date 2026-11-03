import { ModosDoLab } from "./ModosDoLab";
import { ProtobufEtapas } from "./ProtobufEtapas";
import { ProtobufLab } from "./ProtobufLab";

/**
 * O protobuf não é um fluxo: nada viaja, um buffer cresce. O showcase é a
 * codificação em etapas (o formato reagindo a cada campo); a simulação é o
 * analisador, onde o leitor muda o span e lê os bytes.
 */
export function ProtobufModos() {
  return <ModosDoLab showcase={() => <ProtobufEtapas />} simulation={() => <ProtobufLab />} />;
}
