export function isValidDgpId(value: string): boolean {
    return /^\d{16}$/.test(value);
}

export function assertValidDgpIds(values: string[]): void {
    const invalid = values.filter(value => !isValidDgpId(value));
    if (invalid.length > 0) {
        throw new Error(`IDs DGP invalidos: ${invalid.join(', ')}. Cada ID deve conter exatamente 16 digitos.`);
    }
}
