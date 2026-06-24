import { PrismaClient } from '../generated/prisma';
import {prismaConfig } from '../src'
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient(prismaConfig);

const estados = [
  { sigla: 'AC', nome: 'Acre', regiao: 'Norte' },
  { sigla: 'AL', nome: 'Alagoas', regiao: 'Nordeste' },
  { sigla: 'AP', nome: 'Amapá', regiao: 'Norte' },
  { sigla: 'AM', nome: 'Amazonas', regiao: 'Norte' },
  { sigla: 'BA', nome: 'Bahia', regiao: 'Nordeste' },
  { sigla: 'CE', nome: 'Ceará', regiao: 'Nordeste' },
  { sigla: 'DF', nome: 'Distrito Federal', regiao: 'Centro-Oeste' },
  { sigla: 'ES', nome: 'Espírito Santo', regiao: 'Sudeste' },
  { sigla: 'GO', nome: 'Goiás', regiao: 'Centro-Oeste' },
  { sigla: 'MA', nome: 'Maranhão', regiao: 'Nordeste' },
  { sigla: 'MT', nome: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { sigla: 'MG', nome: 'Minas Gerais', regiao: 'Sudeste' },
  { sigla: 'PA', nome: 'Pará', regiao: 'Norte' },
  { sigla: 'PB', nome: 'Paraíba', regiao: 'Nordeste' },
  { sigla: 'PR', nome: 'Paraná', regiao: 'Sul' },
  { sigla: 'PE', nome: 'Pernambuco', regiao: 'Nordeste' },
  { sigla: 'PI', nome: 'Piauí', regiao: 'Nordeste' },
  { sigla: 'RJ', nome: 'Rio de Janeiro', regiao: 'Sudeste' },
  { sigla: 'RN', nome: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { sigla: 'RS', nome: 'Rio Grande do Sul', regiao: 'Sul' },
  { sigla: 'RO', nome: 'Rondônia', regiao: 'Norte' },
  { sigla: 'RR', nome: 'Roraima', regiao: 'Norte' },
  { sigla: 'SC', nome: 'Santa Catarina', regiao: 'Sul' },
  { sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste' },
  { sigla: 'SE', nome: 'Sergipe', regiao: 'Nordeste' },
  { sigla: 'TO', nome: 'Tocantins', regiao: 'Norte' },
];

async function main() {
  console.log('Iniciando o seed de estados no banco de dados...');
  
  for (const estado of estados) {
    const result = await prisma.estado.upsert({
      where: { sigla: estado.sigla },
      update: { 
        nome: estado.nome,
        regiao: estado.regiao,
      },
      create: { 
        sigla: estado.sigla, 
        nome: estado.nome,
        regiao: estado.regiao,
      },
    });
    console.log(`Estado ${result.sigla} - ${result.nome} (${result.regiao}) processado.`);
  }

  console.log('Seed de estados finalizado com sucesso.');
}

main()
  .catch((e) => {
    console.error('Erro ao executar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
