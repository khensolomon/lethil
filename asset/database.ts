import mysqlConnection from "./mysql";
export namespace connection {
  export class mongo {}
  export const mysql:any=mysqlConnection;
  export const what:string='??';
}