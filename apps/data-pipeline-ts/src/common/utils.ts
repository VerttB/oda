export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export const randomSleep = (min: number, max: number) => sleep(Math.floor(Math.random() * (max - min + 1) + min));
export const cleanStr = (s: string | null | undefined): string => {
    if (!s) return '';
    return s.replace(/\s+/g, ' ').trim();
};