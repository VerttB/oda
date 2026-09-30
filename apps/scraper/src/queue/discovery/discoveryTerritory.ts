import {
    BRAZIL_STATES,
    BrazilStateCode,
    parseBrazilRegion,
    parseBrazilState,
    statesByRegion,
} from '@oda/queue';

export type DiscoveryTarget = {
    chave: string;
    uf: BrazilStateCode;
};

export type DiscoveryTerritoryArguments = {
    chaves: string[];
    ufs: BrazilStateCode[];
    targets: DiscoveryTarget[];
    abrangencia: string;
    dryRun: boolean;
};

function optionValue(args: string[], index: number, option: string) {
    const current = args[index];
    if (current === option) {
        const value = args[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`Informe um valor para ${option}.`);
        return { value, consumed: 2 };
    }
    if (current.startsWith(`${option}=`)) {
        const value = current.slice(option.length + 1);
        if (!value) throw new Error(`Informe um valor para ${option}.`);
        return { value, consumed: 1 };
    }
    return null;
}

export function parseDiscoveryTerritoryArguments(
    args: string[],
    options: { defaultKeys?: boolean } = {},
): DiscoveryTerritoryArguments {
    const keys: string[] = [];
    const explicitStates: BrazilStateCode[] = [];
    let region: ReturnType<typeof parseBrazilRegion> | undefined;
    let brasil = false;
    let statesSelected = false;
    let dryRun = false;

    for (let index = 0; index < args.length;) {
        const arg = args[index];
        const statesOption = optionValue(args, index, '--estados') || optionValue(args, index, '--estado');
        if (statesOption) {
            statesSelected = true;
            explicitStates.push(...statesOption.value.split(',').map(parseBrazilState));
            index += statesOption.consumed;
            continue;
        }
        const regionOption = optionValue(args, index, '--regiao');
        if (regionOption) {
            region = parseBrazilRegion(regionOption.value);
            index += regionOption.consumed;
            continue;
        }
        if (arg === '--brasil') {
            brasil = true;
            index++;
            continue;
        }
        if (arg === '--dry-run') {
            dryRun = true;
            index++;
            continue;
        }
        if (arg.startsWith('--')) throw new Error(`Opcao desconhecida: ${arg}.`);
        if (!arg.trim() || arg.trim().length > 100) {
            throw new Error('Cada chave deve conter entre 1 e 100 caracteres.');
        }
        keys.push(arg.trim());
        index++;
    }

    const territoryOptions = Number(statesSelected) + Number(Boolean(region)) + Number(brasil);
    if (territoryOptions > 1) {
        throw new Error('Use apenas uma abrangencia: --estados, --regiao ou --brasil.');
    }

    const ufs = brasil
        ? BRAZIL_STATES.map(state => state.uf)
        : region
            ? statesByRegion(region)
            : statesSelected
                ? [...new Set(explicitStates)]
                : ['BA' as const];
    const chaves = keys.length
        ? [...new Map(keys.map(key => [key.toLocaleLowerCase('pt-BR'), key])).values()]
        : options.defaultKeys === false
            ? []
            : ['a', 'e', 'i', 'o', 'u'];
    const targets = ufs.flatMap(uf => chaves.map(chave => ({ chave, uf })));
    const abrangencia = brasil
        ? 'BRASIL'
        : region
            ? `REGIAO_${region}`
            : `ESTADOS_${ufs.join('_')}`;

    return { chaves, ufs, targets, abrangencia, dryRun };
}
