declare module '@biowasm/aioli' {
  export default class Aioli {
    constructor(
      tools: string[] | Record<string, unknown>[],
      options?: Record<string, unknown>,
    );
    mount(files: unknown): Promise<string[]>;
    exec(
      program: string,
      args?: string[],
    ): Promise<string | { stdout: string; stderr: string }>;
  }
}
