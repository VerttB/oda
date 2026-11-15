import type { PrismaClient } from "../generated/prisma";

export async function retainPipelineHistory(
  prisma: PrismaClient,
  cutoff: Date,
  limit = 100,
) {
  return prisma.$transaction(
    async (tx) => {
      // Bloqueia apenas lotes encerrados, sem referências de último erro na fila.
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT p.id FROM pipeline_log p
      WHERE p.status::text IN ('CONCLUIDO','ERRO') AND p.data_fim < ${cutoff}
      AND NOT EXISTS (SELECT 1 FROM relatorio_consistencia r WHERE r.pipeline_log_id=p.id AND r.estado='EM_ANDAMENTO')
      AND NOT EXISTS (SELECT 1 FROM pipeline_log_item i JOIN fila_extracao_grupo f
        ON f.ultimo_erro_id=i.id WHERE i.pipeline_log_id=p.id)
      AND NOT EXISTS (SELECT 1 FROM pipeline_log_item i JOIN fila_extracao_pesquisador f
        ON f.ultimo_erro_id=i.id WHERE i.pipeline_log_id=p.id)
      ORDER BY p.data_fim LIMIT ${limit} FOR UPDATE OF p SKIP LOCKED
    `;
      const ids = rows.map((row) => row.id);
      if (!ids.length) return 0;
      await tx.$executeRaw`
      INSERT INTO pipeline_metrica_diaria
      SELECT dia, processamento, escopo,
        COUNT(*) FILTER (WHERE status='SUCESSO'), COUNT(*) FILTER (WHERE status='ERRO'),
        COALESCE(SUM(tempo_ms),0), COUNT(tempo_ms),
        COALESCE(SUM(GREATEST(tentativas-1,0)),0), COUNT(tentativas)
      FROM vw_pipeline_itens WHERE pipeline_log_id=ANY(${ids}::text[])
      GROUP BY dia, processamento, escopo
      ON CONFLICT (dia,processamento,escopo) DO UPDATE SET
        sucessos=pipeline_metrica_diaria.sucessos+EXCLUDED.sucessos,
        falhas=pipeline_metrica_diaria.falhas+EXCLUDED.falhas,
        duracao_total_ms=pipeline_metrica_diaria.duracao_total_ms+EXCLUDED.duracao_total_ms,
        itens_com_duracao=pipeline_metrica_diaria.itens_com_duracao+EXCLUDED.itens_com_duracao,
        tentativas_adicionais=pipeline_metrica_diaria.tentativas_adicionais+EXCLUDED.tentativas_adicionais,
        itens_com_tentativas=pipeline_metrica_diaria.itens_com_tentativas+EXCLUDED.itens_com_tentativas
    `;
      return (await tx.pipelineLog.deleteMany({ where: { id: { in: ids } } }))
        .count;
    },
    { timeout: 30000 },
  );
}
