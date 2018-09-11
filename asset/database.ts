import mysqlConnection from "./mysql";
export namespace connection {
  export class mongodb {}
  export const mysql:any=mysqlConnection;
  export const testing:string='Ok';
}