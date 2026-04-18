/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  codEmpresaOrigem: string;
  dsNomeOperador: string;
  dsEmpresaDestino: string;
  ds: string;
  dsNomeEmpresa: string;
  dtTransacao: Date;
  codOperacao: string;
  dsOperacao: string;
  nrTransacao: string;
  codProduto: string;
  dsProduto: string;
  qtSolicitada: number;
  vlUnitbruto: number;
  tpSituacaodes: string;
  dsValorTotal: number;
}

export interface RawTransaction {
  "Cod. Empresa Origem": string;
  "Ds. Nome Operador": string;
  "Ds. Empresa Destino": string;
  "Ds"?: string;
  "Ds. Nome Empresa": string;
  "Dt. Transação": string;
  "Cod. Operação": string;
  "Ds. Operação": string;
  "Nr. Transação": string;
  "Cod. Produto": string;
  "Ds. Produto": string;
  "Qt. Solicitada": string;
  "Vl. Unitbruto": string;
  "Tp. Situaçãodes": string;
  "Ds. Valor Total": string;
}
