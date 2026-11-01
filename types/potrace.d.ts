declare module 'potrace' {
  type PotraceOptions = Record<string, unknown>;

  export class Potrace {
    setParameters(params: PotraceOptions): void;
    loadImage(source: string | Buffer, callback: (err: Error | null) => void): void;
    getSVG(callback: (err: Error | null, svg: string) => void): void;
  }

  function trace(
    source: string | Buffer,
    params: PotraceOptions,
    callback: (err: Error | null, svg: string) => void,
  ): void;
  function trace(source: string | Buffer, callback: (err: Error | null, svg: string) => void): void;

  const potrace: {
    trace: typeof trace;
    Potrace: typeof Potrace;
  };
  export default potrace;
}
