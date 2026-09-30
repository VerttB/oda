export function memorySnapshot() {
    const memory = process.memoryUsage();
    const mb = (bytes: number) => Math.round(bytes / 1024 / 1024 * 100) / 100;
    return { heapUsadoMb: mb(memory.heapUsed), rssMb: mb(memory.rss), memoriaExternaMb: mb(memory.external) };
}
