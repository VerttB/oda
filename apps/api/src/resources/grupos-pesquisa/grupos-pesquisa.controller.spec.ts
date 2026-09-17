import { GruposPesquisaController } from './grupos-pesquisa.controller';
import { GruposPesquisaService } from './grupos-pesquisa.service';

describe('GruposPesquisaController', () => {
  let controller: GruposPesquisaController;
  const groups = { findSimcc: jest.fn() };

  beforeEach(() => {
    groups.findSimcc.mockReset();
    controller = new GruposPesquisaController(groups as unknown as GruposPesquisaService, {} as any, {} as any);
  });

  it('encaminha os filtros da rota SIMCC ao servico', async () => {
    const query = { page: 2, size: 10 };
    groups.findSimcc.mockResolvedValue({ data: [], meta: {} });

    await controller.findSimcc(query as any);

    expect(groups.findSimcc).toHaveBeenCalledWith(query);
  });
});
