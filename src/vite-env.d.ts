/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public app URL used to build participant access links. */
  readonly VITE_PUBLIC_URL?: string;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
