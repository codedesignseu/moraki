// Migration SQL is inlined as a string at build time (babel-plugin-inline-import).
declare module '*.sql' {
  const sql: string;
  export default sql;
}

// sql.js's pure-JavaScript build, used by the web preview stand-in (client.web.ts).
declare module 'sql.js/dist/sql-asm.js' {
  export { default } from 'sql.js';
}
