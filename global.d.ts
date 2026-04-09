declare module '*.css' {}

declare module 'dom-to-image-more' {
  interface Options {
    scale?: number;
    width?: number;
    height?: number;
    style?: object;
    useCORS?: boolean;
  }
  const domtoimage: {
    toPng(node: Node, options?: Options): Promise<string>;
    toJpeg(node: Node, options?: Options): Promise<string>;
    toSvg(node: Node, options?: Options): Promise<string>;
    toBlob(node: Node, options?: Options): Promise<Blob>;
    toCanvas(node: Node, options?: Options): Promise<HTMLCanvasElement>;
  };
  export default domtoimage;
}
