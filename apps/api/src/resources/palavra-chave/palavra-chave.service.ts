import { PrismaService } from '@/prisma/prisma.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { keywordIdentity, keywordSearchKey } from '@oda/shared-types';
import { CreatePalavraChaveDto } from './dto/create-palavra-chave.dto';
import { UpdatePalavraChaveDto } from './dto/update-palavra-chave.dto';

const PALAVRA_CHAVE_LIST_KEY = 'palavrachave:list';

@Injectable()
export class PalavraChaveService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createPalavraChaveDto: CreatePalavraChaveDto) {
    const termo = this.validTerm(createPalavraChaveDto.termo);
    const saved = await this.write(() =>
      this.prismaService.palavraChave.create({
        data: {
          termo,
          termoNormalizado: keywordSearchKey(termo),
          origem: 'MANUAL',
          chaveIdentidade: keywordIdentity(termo),
        },
      }),
    );
    await this.cacheManager.del(PALAVRA_CHAVE_LIST_KEY);
    return saved;
  }

  async findAll() {
    return this.cacheManager.wrap(
      PALAVRA_CHAVE_LIST_KEY,
      async () =>
        await this.prismaService.palavraChave.findMany({
          omit: {
            criadoEm: true,
            atualizadoEm: true,
          },
        }),
    );
  }

  async findById(id: string) {
    return await this.prismaService.palavraChave.findUnique({
      where: { id: id },
    });
  }

  async findByTermo(termo: string) {
    const matches = await this.prismaService.palavraChave.findMany({
      where: { termoNormalizado: keywordSearchKey(termo) },
      take: 2,
    });
    if (matches.length > 1)
      throw new ConflictException(
        'Há termos de fontes diferentes. Consulte pelo ID.',
      );
    if (!matches.length)
      throw new NotFoundException('Palavra-chave não encontrada.');
    return matches[0];
  }

  async update(id: string, updatePalavraChave: UpdatePalavraChaveDto) {
    const current = await this.prismaService.palavraChave.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Palavra-chave não encontrada.');
    const termo =
      updatePalavraChave.termo === undefined
        ? undefined
        : this.validTerm(updatePalavraChave.termo);
    const saved = await this.write(() =>
      this.prismaService.palavraChave.update({
        where: { id },
        data: {
          ...(termo === undefined
            ? {}
            : {
                termo,
                termoNormalizado: keywordSearchKey(termo),
                // A identidade externa e a identidade de origem não mudam por edição do rótulo.
                ...(current.origem === 'MANUAL' && !current.externalId
                  ? { chaveIdentidade: keywordIdentity(termo) }
                  : {}),
              }),
        },
      }),
    );
    await this.cacheManager.del(PALAVRA_CHAVE_LIST_KEY);
    return saved;
  }

  private validTerm(value: string): string {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException('Informe uma palavra-chave não vazia.');
    return value.trim();
  }

  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe uma palavra-chave com essa identidade na mesma origem.',
        );
      }
      throw error;
    }
  }
}
