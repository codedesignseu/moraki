// Migration SQL is inlined as a string at build time (babel-plugin-inline-import).
declare module '*.sql' {
  const sql: string;
  export default sql;
}
