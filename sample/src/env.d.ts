declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
    URL_BASE: `http://${string}.${string}` | `https://${string}.${string}`;
    COOKIE_SECRET: string;
  }
}
