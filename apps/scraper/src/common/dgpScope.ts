import { isSimccInstitution } from '@oda/shared-types';
import type { DataScope } from '@oda/queue';
import { isValidDgpId } from './dgpId';

export function selectDgpRowsForScope<T extends { dgpId: string; instituicao: string }>(
    rows: T[],
    scope: DataScope,
    take?: number,
    regionalCimatecIds?: ReadonlySet<string>,
): T[] {
    const selected = rows
        .filter(row => isValidDgpId(row.dgpId))
        .filter(row => scope !== 'simcc' || isSimccInstitution(row.instituicao, regionalCimatecIds?.has(row.dgpId)));

    return scope === 'simcc' || take === undefined
        ? selected
        : selected.slice(0, take);
}
