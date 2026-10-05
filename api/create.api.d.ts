// index.d.ts
export interface Answers {
    directory: string;
    id: string;
    name: string;
    description: string;
    author: string;
    sdkVersion: string;
}
export declare function slug(text: string): string;
export declare function files(answers: Answers): Record<string, string>;
export declare function write(root: string, entries: Record<string, string>): string[];
export declare function main(argv: string[]): Promise<number>;
