declare namespace lethil {

  /**
   * configuration
   */
  function set(name?:string,rest?:any): any;

  const db: any;
  const config: any;

  /**
   * set tasks or routes
   * @returns $.Route
   */
  function route(name?:string,rest?:any): any;

  /**
   * void
   */
  // function init(): void;

  // interface route {any}
  // const route: any;
  const testing: any;

  /**
   * run command line.
   */
  function command(): any;

  /**
   * start server.
   */
  function server(): any;

  interface PlatformPath {
  }
}

export const config: any;
export function route(name?:string,rest?:any): any;
export default lethil;
