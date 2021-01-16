declare namespace lethil {

  /**
   * configuration
   */
  function set(name?:string,rest?:any): any;

  function db(): any;
  function config(): any;

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

export default lethil;
