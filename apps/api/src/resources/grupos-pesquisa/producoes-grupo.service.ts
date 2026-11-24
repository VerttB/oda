import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@oda/database';
import type {
  ProducoesConfirmadasQuery,
  RevisarProducaoGrupo,
} from '@oda/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const reviewSelect = {
  versao: true,
  decisao: true,
  justificativa: true,
  evidencia: true,
  fonteUrl: true,
  revisor: true,
  revisadoEm: true,
} as const;
type Review = Prisma.ProducaoGrupoRevisaoGetPayload<{
  select: typeof reviewSelect;
}>;

function response(row: Review | null) {
  if (!row) return { versao: 0, revisao: null };
  const { versao, revisadoEm, ...revisao } = row;
  return {
    versao,
    revisao: { ...revisao, revisadoEm: revisadoEm.toISOString() },
  };
}

@Injectable()
export class ProducoesGrupoService {
  constructor(private readonly db: PrismaService) {}

  private async assertPair(
    db: Prisma.TransactionClient,
    grupoId: string,
    producaoId: string,
  ) {
    if (
      !(await db.grupoPesquisa.findUnique({
        where: { id: grupoId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Grupo não encontrado.');
    }
    if (
      !(await db.producao.findUnique({
        where: { id: producaoId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Produção não encontrada.');
    }
  }

  async latest(grupoId: string, producaoId: string) {
    await this.assertPair(this.db, grupoId, producaoId);
    return response(
      await this.db.producaoGrupoRevisao.findFirst({
        where: { grupoId, producaoId },
        orderBy: { versao: 'desc' },
        select: reviewSelect,
      }),
    );
  }

  async review(
    grupoId: string,
    producaoId: string,
    input: RevisarProducaoGrupo,
    revisor: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const key = 'revisao-producao-grupo:' + grupoId + ':' + producaoId;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      await this.assertPair(tx, grupoId, producaoId);
      const current = await tx.producaoGrupoRevisao.findFirst({
        where: { grupoId, producaoId },
        orderBy: { versao: 'desc' },
        select: reviewSelect,
      });
      const {
        versaoEsperada,
        decisao,
        justificativa,
        evidencia = null,
        fonteUrl = null,
      } = input;
      if (
        current &&
        current.decisao === decisao &&
        current.justificativa === justificativa &&
        current.evidencia === evidencia &&
        current.fonteUrl === fonteUrl &&
        current.revisor === revisor
      ) {
        return response(current);
      }
      const currentVersion = current?.versao ?? 0;
      if (versaoEsperada !== currentVersion) {
        throw new ConflictException(
          'A revisão mudou. Consulte a versão atual antes de enviar outra decisão.',
        );
      }
      return response(
        await tx.producaoGrupoRevisao.create({
          data: {
            grupoId,
            producaoId,
            versao: currentVersion + 1,
            decisao,
            justificativa,
            evidencia,
            fonteUrl,
            revisor,
          },
          select: reviewSelect,
        }),
      );
    });
  }

  async listConfirmed(
    grupoId: string,
    { page, size }: ProducoesConfirmadasQuery,
  ) {
    return this.db.$transaction(
      async (tx) => {
        if (
          !(await tx.grupoPesquisa.findUnique({
            where: { id: grupoId },
            select: { id: true },
          }))
        ) {
          throw new NotFoundException('Grupo não encontrado.');
        }
        const lastConfirmed = Prisma.sql`
        FROM producao_grupo_revisao r
        WHERE r.grupo_id = ${grupoId} AND r.decisao = 'CONFIRMADO'
          AND NOT EXISTS (
            SELECT 1 FROM producao_grupo_revisao newer
            WHERE newer.grupo_id = r.grupo_id AND newer.producao_id = r.producao_id AND newer.versao > r.versao
          )`;
        const [{ total }] = await tx.$queryRaw<
          { total: number }[]
        >`SELECT count(*)::int AS total ${lastConfirmed}`;
        const ids = await tx.$queryRaw<{ id: string }[]>`
        SELECT r.producao_id AS id ${lastConfirmed}
        ORDER BY r.revisado_em DESC, r.producao_id LIMIT ${size} OFFSET ${(page - 1) * size}`;
        const rows = await tx.producao.findMany({
          where: { id: { in: ids.map((row) => row.id) } },
          select: {
            id: true,
            titulo: true,
            ano: true,
            tipo: true,
            doi: true,
            url: true,
          },
        });
        const byId = new Map(rows.map((row) => [row.id, row]));
        return {
          data: ids.map((row) => byId.get(row.id)!),
          meta: {
            page,
            size,
            totalItems: total,
            totalPages: Math.ceil(total / size),
          },
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
